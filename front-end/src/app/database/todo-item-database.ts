import { Injectable } from '@angular/core';
import { TodoItem } from '../models/todo-item.model';
import { PendingOperation } from '../models/pending-operation.model';

@Injectable({
    providedIn: 'root',
})
export class TodoItemDatabase {

    private dbName = 'TaskManagerDB';
    private dbVersion = 2;

    private dbPromise: Promise<IDBDatabase> | null = null;

    connect(): Promise<IDBDatabase> {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(
                this.dbName,
                this.dbVersion
            );

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('todo-items')) {
                    const store = db.createObjectStore('todo-items', {
                        keyPath: 'id'
                    });
                    store.createIndex('syncStatus', 'syncStatus', {
                        unique: false
                    });
                }

                if (!db.objectStoreNames.contains('pending-operations')) {
                    db.createObjectStore('pending-operations', {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                this.dbPromise = null;
                reject(request.error);
            };
        });

        return this.dbPromise;
    }

    async saveAll(todoItems: TodoItem[]): Promise<void> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('todo-items', 'readwrite');
            const store = transaction.objectStore('todo-items');
            todoItems.forEach(item => store.put(item));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getAll(): Promise<TodoItem[]> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('todo-items', 'readonly');
            const store = transaction.objectStore('todo-items');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll(): Promise<void> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('todo-items', 'readwrite');
            const store = transaction.objectStore('todo-items');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getById(id: number): Promise<TodoItem | undefined> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('todo-items', 'readonly');
            const store = transaction.objectStore('todo-items');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async save(item: TodoItem): Promise<void> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('todo-items', 'readwrite');
            const store = transaction.objectStore('todo-items');
            const request = store.put(item);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
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
}