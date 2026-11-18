import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, from, Observable, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TodoItemDatabase } from '../database/todo-item-database';
import { NewTodoItem } from '../models/new-todo-item.model';
import { TodoItem } from '../models/todo-item.model';
import { UpdateTodoItem } from '../models/update-todo-item.model';

@Injectable({
    providedIn: 'root',
})
export class TodoItemService {
    private readonly baseUrl = `${environment.apiUrl}/todoitems`;
    private readonly http = inject(HttpClient);
    private readonly todoItemDatabase = inject(TodoItemDatabase);

    pendingCount = signal<number>(0);

    constructor() {
        this.refreshPendingCount();
    }

    private isNetworkError(error: unknown): boolean {
        if(!navigator.onLine) {
            return true;
        }
        if (error instanceof HttpErrorResponse) {
            return error.status === 0 || error.status === 503 || error.status === 504;
        }
        return false;
    }

    async refreshPendingCount(): Promise<void> {
        const count = await this.todoItemDatabase.getPendingCount();
        this.pendingCount.set(count);
    }

    getAll(): Observable<TodoItem[]> {
        return this.http.get<TodoItem[]>(this.baseUrl).pipe(
            switchMap(async (serverItems) => {    
                await this.todoItemDatabase.saveRemoteItems(serverItems);
                return await this.todoItemDatabase.getAll();
            }),
            catchError((error) => {
                if(!this.isNetworkError(error)) {
                    return throwError(() => error);
                }

                console.error('Error connecting to API: loading local data', error);
                return from(this.todoItemDatabase.getAll());
            })
        );
    }

    toggleComplete(id: number): Observable<TodoItem> {
        return this.http.patch<TodoItem>(`${this.baseUrl}/${id}/toggle`, {}).pipe(
            // Guarda la tarea con su nueva versión para que una edición posterior
            // no se base en una versión vieja.
            tap(async (updatedItem) => {
                await this.todoItemDatabase.save(updatedItem);
            })
        );
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
            tap(async () => {
                await this.todoItemDatabase.deleteItem(id);
            })
        );
    }

    create(todo: NewTodoItem): Observable<TodoItem> {
        return this.http.post<TodoItem>(this.baseUrl, todo).pipe(
            tap(async (createdItem) => {
                await this.todoItemDatabase.save(createdItem);
            }),
            catchError((error) => {

                if(!this.isNetworkError(error)){
                    return throwError(() => error);
                }

                console.warn('No connection, saving task creation to the local queue.', error);

                const tempId = -Math.floor(Math.random() * 100000);
                const localItem: TodoItem = {
                    id: tempId,
                    title: todo.title,
                    description: todo.description,
                    isCompleted: false,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                    version: 0,
                };

                return from(
                    (async () => {
                        await this.todoItemDatabase.saveWithPending(localItem, 'CREATE');
                        await this.refreshPendingCount();
                        return localItem;
                    })()
                );
            })
        );
    }

    getById(id: number): Observable<TodoItem> {
        return this.http.get<TodoItem>(`${this.baseUrl}/${id}`).pipe(
            catchError((error) => {
                console.warn('No connection, searching for the task in local storage.', error);

                return from(
                    this.todoItemDatabase.getById(id).then((localItem) => {
                        if (!localItem) {
                            throw new Error('The task does not exist in the local database');
                        }
                        return localItem;
                    })
                );
            })
        );
    }

    update(id: number, todo: UpdateTodoItem): Observable<TodoItem> {
        return from(this.todoItemDatabase.getById(id)).pipe(
            switchMap((existingItem) => {
                // La edición se envía con la versión sobre la que se hizo,
                // para que el servidor detecte si la tarea cambió en otro lugar.
                const baseVersion = existingItem?.version ?? 0;

                const buildLocalItem = (): TodoItem => ({
                    id,
                    title: todo.title,
                    description: todo.description,
                    isCompleted: todo.isCompleted,
                    createdAt: existingItem?.createdAt ?? new Date().toISOString(),
                    completedAt: todo.isCompleted ? new Date().toISOString() : null,
                    version: baseVersion,
                });

                return this.http.put<TodoItem>(`${this.baseUrl}/${id}`, { ...todo, version: baseVersion }).pipe(
                    switchMap(async (serverItem) => {
                        await this.todoItemDatabase.save(serverItem);
                        return serverItem;
                    }),
                    catchError((error) => {
                        const isConflict = error instanceof HttpErrorResponse && error.status === 409;

                        if (!this.isNetworkError(error) && !isConflict) {
                            return throwError(() => error);
                        }

                        const localItem = buildLocalItem();

                        return from(
                            (async () => {
                                await this.todoItemDatabase.saveWithPending(localItem, 'UPDATE');

                                if (isConflict) {
                                    // Conflicto: la edición se conserva como pendiente
                                    // y se registran ambas versiones para elegir.
                                    console.warn('Conflict detected, saving both versions.', error);
                                    await this.todoItemDatabase.saveConflict(localItem, error.error as TodoItem);
                                } else {
                                    console.warn('No connection, saving task edit to the local queue', error);
                                }

                                await this.refreshPendingCount();
                                return localItem;
                            })()
                        );
                    })
                );
            })
        );
    }
}