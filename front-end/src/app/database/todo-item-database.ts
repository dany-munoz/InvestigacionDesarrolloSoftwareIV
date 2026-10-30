import { Injectable } from '@angular/core';
import { TodoItem } from '../models/todo-item.model';

@Injectable({
    providedIn: 'root',
})
export class TodoItemDatabase {

    private dbName = 'TaskManagerDB';
    private dbVersion = 1;

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
}