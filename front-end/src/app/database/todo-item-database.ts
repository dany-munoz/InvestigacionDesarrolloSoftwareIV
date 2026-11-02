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
}