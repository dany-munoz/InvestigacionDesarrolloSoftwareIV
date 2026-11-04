import { HttpClient } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { AuthResponse, Credentials } from '../models/credentials.models';
import { TodoItemDatabase } from '../database/todo-item-database';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'todoapp_token';

@Service()
export class Auth {

    private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
    readonly isLoggedIn = computed(() => {
        const token = this.tokenSignal();
        return token !== null && token !== undefined && token !== '';
    });
    private readonly http = inject(HttpClient);

    private readonly todoItemDatabase = inject(TodoItemDatabase);

    login(credentials: Credentials): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
            tap((response) => this.setToken(response.token))
        );
    }

    logout() {
        this.setToken(null);
        this.todoItemDatabase.clearAll();
    }

    getToken(): string | null {
        return this.tokenSignal();
    }

    private setToken(token: string | null) {
        this.tokenSignal.set(token);
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }
}
