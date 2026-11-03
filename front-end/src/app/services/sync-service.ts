import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject, firstValueFrom, timeout } from 'rxjs';

import { environment } from '../../environments/environment';
import { TodoItemDatabase } from '../database/todo-item-database';
import { PendingOperation } from '../models/pending-operation.model';
import { TodoItem } from '../models/todo-item.model';
import { Auth } from './auth';
import { TodoItemService } from './todo-item-service';

@Injectable({
    providedIn: 'root',
})
export class SyncService {
    private readonly http = inject(HttpClient);
    private readonly database = inject(TodoItemDatabase);
    private readonly auth = inject(Auth);
    private readonly todoItemService = inject(TodoItemService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly baseUrl = `${environment.apiUrl}/todoitems`;
    private readonly requestTimeout = 10000;
    private readonly retryInterval = 5000;

    private started = false;
    private running = false;
    private timer: ReturnType<typeof setInterval> | null = null;

    private readonly completedSubject = new Subject<void>();
    readonly completed$ = this.completedSubject.asObservable();

    readonly networkAvailable = signal(navigator.onLine);
    readonly apiAvailable = signal<boolean | null>(null);
    readonly syncing = signal(false);
    readonly message = signal('Sincronización pendiente de iniciar.');
    readonly lastSync = signal<string | null>(null);

    readonly pendingCount = this.todoItemService.pendingCount;

    private readonly handleOnline = (): void => {
        this.networkAvailable.set(true);
        void this.sync();
    };

    private readonly handleOffline = (): void => {
        this.networkAvailable.set(false);
        this.apiAvailable.set(false);
        this.message.set(
            'Sin conexión. Los cambios pendientes permanecen en el dispositivo.'
        );
    };

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.stop();
            this.completedSubject.complete();
        });
    }

    start(): void {
        if (this.started) {
            return;
        }

        this.started = true;

        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);

        this.timer = setInterval(() => {
            void this.sync();
        }, this.retryInterval);

        void this.sync();
    }

    stop(): void {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);

        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.started = false;
    }

    async sync(): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;

        try {
            await this.todoItemService.refreshPendingCount();

            this.networkAvailable.set(navigator.onLine);

            if (!navigator.onLine) {
                this.handleOffline();
                return;
            }

            if (!this.auth.getToken()) {
                this.apiAvailable.set(null);
                this.message.set('Inicia sesión para sincronizar.');
                return;
            }

            this.syncing.set(true);
            this.message.set('Sincronizando cambios...');

            const pendingOperations = await this.database.getAllPending();

            for (const snapshot of pendingOperations) {
                if (snapshot.id === undefined) {
                    throw new Error('Se encontró una operación sin identificador.');
                }

                // Una creación anterior puede haber sustituido el ID temporal.
                const currentOperation =
                    await this.database.pendingOperations.get(snapshot.id);

                if (!currentOperation) {
                    continue;
                }

                await this.sendOperation(currentOperation);
                await this.todoItemService.refreshPendingCount();
            }

            await this.receiveRemoteItems();
            await this.todoItemService.refreshPendingCount();

            this.apiAvailable.set(true);
            this.lastSync.set(new Date().toLocaleTimeString());

            this.message.set(
                this.pendingCount() === 0
                    ? 'Sincronizado. No quedan cambios pendientes.'
                    : 'Los cambios nuevos se enviarán en el siguiente ciclo.'
            );

            this.completedSubject.next();
        } catch (error: unknown) {
            this.handleError(error);
        } finally {
            this.syncing.set(false);
            this.running = false;
        }
    }

    private async sendOperation(operation: PendingOperation): Promise<void> {
        const operationId = operation.id;

        if (operationId === undefined) {
            throw new Error('No se puede confirmar una operación sin identificador.');
        }

        const item = operation.payload as TodoItem;

        switch (operation.type) {
            case 'CREATE': {
                const serverItem = await firstValueFrom(
                    this.http.post<TodoItem>(this.baseUrl, {
                        title: item.title,
                        description: item.description,
                        isCompleted: item.isCompleted,
                        createdAt: item.createdAt,
                        completedAt: item.completedAt,
                    }).pipe(timeout(this.requestTimeout))
                );

                this.apiAvailable.set(true);

                await this.database.confirmCreatedItem(
                    operationId,
                    serverItem
                );

                return;
            }

            case 'UPDATE': {
                await firstValueFrom(
                    this.http.put<void>(
                        `${this.baseUrl}/${operation.todoId}`,
                        {
                            title: item.title,
                            description: item.description,
                            isCompleted: item.isCompleted,
                            completedAt: item.completedAt,
                        }
                    ).pipe(timeout(this.requestTimeout))
                );

                this.apiAvailable.set(true);

                await this.database.confirmPendingOperation(operationId);

                return;
            }

            default:
                throw new Error(
                    `La sincronización todavía no admite: ${operation.type}`
                );
        }
    }

    private async receiveRemoteItems(): Promise<void> {
        const serverItems = await firstValueFrom(
            this.http.get<TodoItem[]>(this.baseUrl).pipe(
                timeout(this.requestTimeout)
            )
        );

        this.apiAvailable.set(true);
        await this.database.saveRemoteItems(serverItems);
    }

    private handleError(error: unknown): void {
        console.error('Error durante la sincronización:', error);

        if (error instanceof HttpErrorResponse) {
            this.apiAvailable.set(error.status !== 0);

            if (error.status === 401 || error.status === 403) {
                this.message.set(
                    'Se necesita una sesión válida. Los pendientes se conservan.'
                );
                return;
            }

            if (error.status === 409) {
                this.message.set(
                    'La API informó un conflicto. El pendiente se conserva.'
                );
                return;
            }

            this.message.set(
                `Falló el envío o la consulta (HTTP ${error.status}). ` +
                'Los pendientes no confirmados se conservan. Se reintentará.'
            );
            return;
        }

        this.apiAvailable.set(null);
        this.message.set(
            'No se pudo completar la sincronización. ' +
            'Los pendientes no confirmados se conservan. Se reintentará.'
        );
    }
}