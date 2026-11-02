import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { PendingOperation } from '../models/pending-operation.model';
import { TodoItem } from '../models/todo-item.model';

@Injectable({
    providedIn: 'root',
})
export class TodoItemDatabase extends Dexie {
    todoItems!: Table<TodoItem, number>;
    pendingOperations!: Table<PendingOperation, number>;

    constructor() {
        super('TaskManagerDB');

        this.version(2).stores({
            todoItems: 'id, syncStatus',
            pendingOperations: '++id, todoId, type'
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
                        };
                    });
            }
        );
    }

    async confirmPendingOperation(operationId: number): Promise<void> {
        await this.pendingOperations.delete(operationId);
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

                const itemsToSave = serverItems.filter(
                    item => !protectedIds.has(item.id)
                );

                await this.todoItems.bulkPut(itemsToSave);
            }
        );
    }
}