import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { TodoItem } from '../../models/todo-item.model';
import { Auth } from '../../services/auth';
import { TodoItemService } from '../../services/todo-item-service';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, from, switchMap } from 'rxjs';
import { TodoItemDatabase } from '../../database/todo-item-database';
import { SyncService } from '../../services/sync-service';

@Component({
  selector: 'app-todo-list',
  imports: [RouterLink],
  templateUrl: './todo-list.html',
  styleUrl: './todo-list.css'
})

export class TodoList implements OnInit {
  protected readonly authService = inject(Auth);
  private readonly router = inject(Router);
  private readonly todoItemService = inject(TodoItemService);
  private readonly syncService = inject(SyncService);
  private readonly todoItemDatabase = inject(TodoItemDatabase);
  private readonly destroyRef = inject(DestroyRef);

  pendingCount = this.todoItemService.pendingCount;

  todos = signal<TodoItem[]>([]);
  conflictIds = signal<Set<number>>(new Set());
  loading = signal(true);
  errorMessage = signal('');

  constructor() {
    this.syncService.completed$
      .pipe(
        switchMap(() =>
          from(this.todoItemDatabase.getAll()).pipe(
            catchError((error: unknown) => {
              console.error(
                'Error al actualizar la lista después de sincronizar:',
                error
              );

              this.errorMessage.set(
                'No se pudo actualizar la lista de tareas.'
              );

              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((todos) => {
        this.todos.set(todos);
        this.loading.set(false);
        this.errorMessage.set('');
        void this.loadConflicts();
      });
  }

  private async loadConflicts(): Promise<void> {
    const conflicts = await this.todoItemDatabase.getConflicts();
    this.conflictIds.set(new Set(conflicts.map((conflict) => conflict.todoId)));
  }

  ngOnInit(): void {
    void this.loadConflicts();

    this.todoItemService.getAll().subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.loading.set(false); 
      },
      error: async () => {
        try {
          const localTodos = await this.todoItemDatabase.todoItems.toArray();
          this.todos.set(localTodos);
          this.errorMessage.set('');
        } catch (localError) {
          this.errorMessage.set('Las tareas no se pudieron cargar. Por favor, inténtalo de nuevo más tarde.');
        } finally {
          this.loading.set(false);
        }
      },
    });
  }

  onToggle(todo: TodoItem): void {
    this.todoItemService.toggleComplete(todo.id).subscribe({
      next: (updated) =>
        this.todos.update((current) => current.map((t) => (t.id === updated.id ? updated : t))),
      error: () => Swal.fire({
        icon: 'error',
        iconColor: 'var(--danger)',
        title: 'No se pudo actualizar la tarea',
        text: 'Revisa tu conexión e inténtalo de nuevo.',
        showConfirmButton: false,
        customClass: {
          popup: 'app-dialog',
          title: 'app-dialog-title',
          htmlContainer: 'app-dialog-text',
        },
      }),
    });
  }

  onLogout(): void {
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  onDelete(todo: TodoItem): void {
    Swal.fire({
      title: '¿Eliminar esta tarea?',
      text: `“${todo.title}” se eliminará y no podrás recuperarla.`,
      icon: 'warning',
      iconColor: 'var(--warn)',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      buttonsStyling: false,
      customClass: {
        popup: 'app-dialog',
        title: 'app-dialog-title',
        htmlContainer: 'app-dialog-text',
        actions: 'app-dialog-actions',
        confirmButton: 'btn-primary',
        cancelButton: 'btn-secondary',
      },
    }).then((result) => {
      if (!result.isConfirmed)
        return;

      this.todoItemService.delete(todo.id).subscribe({
        next: () => this.todos.update((current) => current.filter((t) => t.id !== todo.id)),
        error: () => this.errorMessage.set('No se pudo eliminar la tarea.'),
      });
    });


  }
}