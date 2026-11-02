import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, from, Observable, switchMap, tap } from 'rxjs';
import { TodoItem } from '../models/todo-item.model';
import { NewTodoItem } from '../models/new-todo-item.model';
import { UpdateTodoItem } from '../models/update-todo-item.model';
import { TodoItemDatabase } from '../database/todo-item-database';

@Injectable({
    providedIn: 'root',
})
export class TodoItemService {
    private readonly baseUrl = `${environment.apiUrl}/todoitems`;
    private readonly http = inject(HttpClient);
    private readonly todoItemDatabase = inject(TodoItemDatabase);

    pendingCount = signal<number>(0);

    constructor(){
        this.refreshPendingCount();
    }

    async refreshPendingCount(): Promise<void> {
        const count = await this.todoItemDatabase.getPendingCount();
        this.pendingCount.set(count);
    }

    getAll(): Observable<TodoItem[]> {
        return this.http.get<TodoItem[]>(this.baseUrl).pipe(
            tap(async (todoItems) => {
                await this.todoItemDatabase.saveAll(todoItems);
            }),
            catchError( (error) => {
                console.error('Error connecting to API: loading local data', error);
                return from(this.todoItemDatabase.getAll());
            })
        );
    }

    toggleComplete(id: number): Observable<TodoItem> {
        return this.http.patch<TodoItem>(`${this.baseUrl}/${id}/toggle`, {});
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

    create(todo: NewTodoItem): Observable<TodoItem> {
        return this.http.post<TodoItem>(this.baseUrl, todo).pipe(
            tap(async (createdItem) => {
                await this.todoItemDatabase.save(createdItem);
            }),
            catchError(async (error) => {
                console.warn('No connection, saving task creation to the local queue.', error);

                const tempId = -Math.floor(Math.random() * 100000);
                const localItem: TodoItem = {
                    id: tempId,
                    title: todo.title,
                    description: todo.description,
                    isCompleted: false,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                };

                await this.todoItemDatabase.saveWithPending(localItem, 'CREATE');
                await this.refreshPendingCount();
                return localItem;
            })
        );
    }

    getById(id: number): Observable<TodoItem> {
        return this.http.get<TodoItem>(`${this.baseUrl}/${id}`).pipe(
            catchError(async (error) => {
                console.warn('No connection, searching for the task in local storage.', error);
                const localItem = await this.todoItemDatabase.getById(id);
                if (!localItem) {
                    throw new Error('The task does not exist in the local database');
                }
                return localItem;
            })
        );
    }

    update(id: number, todo: UpdateTodoItem): Observable<TodoItem> {
        return this.http.put<void>(`${this.baseUrl}/${id}`, todo).pipe(
            switchMap(async () => {
                const existingItem = await this.todoItemDatabase.getById(id);
                const updatedItem: TodoItem = {
                    id,
                    title: todo.title,
                    description: todo.description,
                    isCompleted: todo.isCompleted,
                    createdAt: existingItem?.createdAt ?? new Date().toISOString(),
                    completedAt: todo.isCompleted ? new Date().toISOString() : null,
                };
                await this.todoItemDatabase.save(updatedItem);
                return updatedItem;
            }),
            catchError(async (error) => {
                console.warn('No connection, saving task edit to the local queue', error);

                const existingItem = await this.todoItemDatabase.getById(id);
                const localItem: TodoItem = {
                    id,
                    title: todo.title,
                    description: todo.description,
                    isCompleted: todo.isCompleted,
                    createdAt: existingItem?.createdAt ?? new Date().toISOString(),
                    completedAt: todo.isCompleted ? new Date().toISOString() : null,
                };

                await this.todoItemDatabase.saveWithPending(localItem, 'UPDATE');
                await this.refreshPendingCount();
                return localItem;
            })
        );
    }
}