import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { TodoItem } from '../models/todo-item.model';
import { PendingOperation } from '../models/pending-operation.model';

@Injectable({
    providedIn: 'root',
})
export class TodoItemDatabase extends Dexie {
    // Declaramos las tablas
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
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['todo-items', 'pending-operations'], 'readwrite');
            const store = transaction.objectStore('todo-items');
            const pendingStore = transaction.objectStore('pending-operations');

            store.put(item);

            const pendingOp: PendingOperation = {
                type: operationType,
                todoId: item.id,
                payload: item,
                timestamp: new Date().toISOString(),
            };
            pendingStore.add(pendingOp);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getPendingCount(): Promise<number> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('pending-operations', 'readonly');
            const store = transaction.objectStore('pending-operations');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllPending(): Promise<PendingOperation[]> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('pending-operations', 'readonly');
            const store = transaction.objectStore('pending-operations');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}