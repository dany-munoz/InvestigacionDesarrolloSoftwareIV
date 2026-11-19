import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { PendingOperation } from '../models/pending-operation.model';
import { TodoConflict } from '../models/todo-conflict.model';
import { TodoItem } from '../models/todo-item.model';

@Injectable({
    providedIn: 'root',
})
export class TodoItemDatabase extends Dexie {
    todoItems!: Table<TodoItem, number>;
    pendingOperations!: Table<PendingOperation, number>;
    conflicts!: Table<TodoConflict, number>;

    constructor() {
        super('TaskManagerDB');

        this.version(2).stores({
            todoItems: 'id, syncStatus',
            pendingOperations: '++id, todoId, type'
        });

        this.version(3).stores({
            todoItems: 'id, syncStatus',
            pendingOperations: '++id, todoId, type',
            conflicts: 'todoId'
        });
    }

    async saveAll(todoItems: TodoItem[]): Promise<void> {
        await this.todoItems.bulkPut(todoItems);
    }

    async getAll(): Promise<TodoItem[]> {
        return await this.todoItems.toArray();
    }

    async clearAll(): Promise<void> {
        await this.todoItems.clear();
    }

    async getById(id: number): Promise<TodoItem | undefined> {
        return await this.todoItems.get(id);
    }

    async save(item: TodoItem): Promise<void> {
        await this.todoItems.put(item);
    }

    async deleteItem(id: number): Promise<void> {
        await this.todoItems.delete(id);
    }

    async saveWithPending(item: TodoItem, operationType: 'CREATE' | 'UPDATE'): Promise<void> {
        await this.transaction('rw', this.todoItems, this.pendingOperations, async () => {
            await this.todoItems.put(item);

            const pendingOp = {
                type: operationType,
                todoId: item.id,
                payload: item,
                timestamp: new Date().toISOString(),
            } as PendingOperation;
            await this.pendingOperations.add(pendingOp);
        });
    }

    async getPendingCount(): Promise<number> {
        return await this.pendingOperations.count();
    }

    async getAllPending(): Promise<PendingOperation[]> {
        return await this.pendingOperations.toArray();
    }

        async confirmCreatedItem(
        operationId: number,
        serverItem: TodoItem
    ): Promise<void> {
        if (!Number.isInteger(serverItem.id) || serverItem.id <= 0) {
            throw new Error('La API devolvió un identificador de tarea inválido.');
        }

        await this.transaction(
            'rw',
            this.todoItems,
            this.pendingOperations,
            async () => {
                const operation = await this.pendingOperations.get(operationId);

                if (!operation) {
                    return;
                }

                if (operation.type !== 'CREATE') {
                    throw new Error('El pendiente no corresponde a una creación.');
                }

                const temporaryId = operation.todoId;
                const localItem = await this.todoItems.get(temporaryId);

                await this.todoItems.put({
                    ...(localItem ?? serverItem),
                    id: serverItem.id,
                    version: serverItem.version,
                });

                if (temporaryId !== serverItem.id) {
                    await this.todoItems.delete(temporaryId);
                }

                await this.pendingOperations.delete(operationId);

                await this.pendingOperations
                    .where('todoId')
                    .equals(temporaryId)
                    .modify((pending) => {
                        pending.todoId = serverItem.id;
                        pending.payload = {
                            ...pending.payload,
                            id: serverItem.id,
                            version: serverItem.version,
                        };
                    });
            }
        );
    }

    async confirmPendingOperation(operationId: number): Promise<void> {
        await this.pendingOperations.delete(operationId);
    }

    async confirmUpdatedItem(
        operationId: number,
        serverItem: TodoItem
    ): Promise<void> {
        await this.transaction(
            'rw',
            this.todoItems,
            this.pendingOperations,
            async () => {
                await this.pendingOperations.delete(operationId);

                const remaining = await this.pendingOperations
                    .where('todoId')
                    .equals(serverItem.id)
                    .count();

                if (remaining === 0) {
                    await this.todoItems.put(serverItem);
                    return;
                }

                await this.pendingOperations
                    .where('todoId')
                    .equals(serverItem.id)
                    .modify((pending) => {
                        pending.payload = {
                            ...pending.payload,
                            version: serverItem.version,
                        };
                    });

                await this.todoItems.update(serverItem.id, {
                    version: serverItem.version,
                });
            }
        );
    }

    async saveConflict(localItem: TodoItem, serverItem: TodoItem): Promise<void> {
        await this.conflicts.put({
            todoId: localItem.id,
            localItem,
            serverItem,
            detectedAt: new Date().toISOString(),
        });
    }

    async getConflicts(): Promise<TodoConflict[]> {
        return await this.conflicts.toArray();
    }

    async getConflict(todoId: number): Promise<TodoConflict | undefined> {
        return await this.conflicts.get(todoId);
    }

    async getConflictCount(): Promise<number> {
        return await this.conflicts.count();
    }

    async keepLocalVersion(todoId: number): Promise<void> {
        await this.transaction(
            'rw',
            this.todoItems,
            this.pendingOperations,
            this.conflicts,
            async () => {
                const conflict = await this.conflicts.get(todoId);
                if (!conflict) {
                    return;
                }

                const serverVersion = conflict.serverItem.version;

                await this.pendingOperations
                    .where('todoId')
                    .equals(todoId)
                    .modify((pending) => {
                        pending.payload = {
                            ...pending.payload,
                            version: serverVersion,
                        };
                    });

                await this.todoItems.update(todoId, { version: serverVersion });
                await this.conflicts.delete(todoId);
            }
        );
    }

    async keepServerVersion(todoId: number): Promise<void> {
        await this.transaction(
            'rw',
            this.todoItems,
            this.pendingOperations,
            this.conflicts,
            async () => {
                const conflict = await this.conflicts.get(todoId);
                if (!conflict) {
                    return;
                }

                await this.todoItems.put(conflict.serverItem);
                await this.pendingOperations.where('todoId').equals(todoId).delete();
                await this.conflicts.delete(todoId);
            }
        );
    }

    async saveRemoteItems(serverItems: TodoItem[]): Promise<void> {
        await this.transaction(
            'rw',
            this.todoItems,
            this.pendingOperations,
            async () => {
                const pendingOperations = await this.pendingOperations.toArray();

                const protectedIds = new Set(
                    pendingOperations.map(operation => operation.todoId)
                );

                const serverIds = new Set(serverItems.map(item => item.id));
                const localItems = await this.todoItems.toArray();
                const idsToDelete = localItems
                    .filter(local => !serverIds.has(local.id) && !protectedIds.has(local.id))
                    .map(local => local.id);

                if(idsToDelete.length > 0) {
                    await this.todoItems.bulkDelete(idsToDelete);
                }

                const itemsToSave = serverItems.filter(
                    item => !protectedIds.has(item.id)
                );

                await this.todoItems.bulkPut(itemsToSave);
            }
        );
    }
}