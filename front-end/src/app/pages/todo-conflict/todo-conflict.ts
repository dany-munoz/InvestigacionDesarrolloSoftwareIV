import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TodoItemDatabase } from '../../database/todo-item-database';
import { TodoConflict } from '../../models/todo-conflict.model';
import { SyncService } from '../../services/sync-service';
import { TodoItemService } from '../../services/todo-item-service';

@Component({
  selector: 'app-todo-conflict',
  imports: [RouterLink],
  templateUrl: './todo-conflict.html',
  styleUrl: './todo-conflict.css',
})
export class TodoConflictPage implements OnInit {
  private readonly database = inject(TodoItemDatabase);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly syncService = inject(SyncService);
  private readonly todoItemService = inject(TodoItemService);

  conflict = signal<TodoConflict | null>(null);
  loading = signal(true);
  resolving = signal(false);
  errorMessage = signal('');

  private todoId = 0;

  async ngOnInit(): Promise<void> {
    this.todoId = Number(this.route.snapshot.paramMap.get('id'));

    try {
      this.conflict.set((await this.database.getConflict(this.todoId)) ?? null);
    } catch (error) {
      console.error('Error al cargar el conflicto:', error);
      this.errorMessage.set('No se pudo cargar el conflicto.');
    } finally {
      this.loading.set(false);
    }
  }

  differs(field: 'title' | 'description' | 'isCompleted'): boolean {
    const conflict = this.conflict();
    return !!conflict && conflict.localItem[field] !== conflict.serverItem[field];
  }

  keepLocal(): Promise<void> {
    return this.resolve(
      () => this.database.keepLocalVersion(this.todoId),
      'Conflicto resuelto: se conservó tu versión y se enviará al servidor.'
    );
  }

  keepServer(): Promise<void> {
    return this.resolve(
      () => this.database.keepServerVersion(this.todoId),
      'Conflicto resuelto: se conservó la versión del servidor y se descartó la edición local.'
    );
  }

  private async resolve(action: () => Promise<void>, message: string): Promise<void> {
    this.resolving.set(true);
    this.errorMessage.set('');

    try {
      await action();
      await this.todoItemService.refreshPendingCount();
      await this.syncService.refreshConflictCount();
      this.syncService.message.set(message);
      void this.syncService.sync();
      await this.router.navigate(['/tasks']);
    } catch (error) {
      console.error('Error al resolver el conflicto:', error);
      this.errorMessage.set('No se pudo resolver el conflicto. Tus cambios se conservan.');
    } finally {
      this.resolving.set(false);
    }
  }
}
