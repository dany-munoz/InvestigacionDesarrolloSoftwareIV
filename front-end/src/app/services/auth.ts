import { HttpClient } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { AuthResponse, Credentials } from '../models/credentials.models';
import { TodoItemDatabase } from '../database/todo-item-database';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

    const TOKEN_KEY = 'todoapp_token';

@Service()
export class Auth {

    private readonly tokenSignal = signal <string | null>(localStorage.getItem(TOKEN_KEY)); 
    readonly isLoggedIn = computed (() => this.tokenSignal() !== null);
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);

    private readonly todoItemDatabase = inject(TodoItemDatabase);

    login(credentials: Credentials) : Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
            tap((response) => this.setToken(response.token))
        );
    }

    logout() {
        this.setToken(null);
        this.todoItemDatabase.clearAll();
        this.router.navigate(['/']);
    }

    getToken() : string | null {
        return this.tokenSignal();
    }

    private setToken(token : string | null) {
        this.tokenSignal.set(token);
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }
}
