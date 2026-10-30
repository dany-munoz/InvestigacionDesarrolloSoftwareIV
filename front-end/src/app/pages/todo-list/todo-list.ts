import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TodoItemService } from '../../services/todo-item-service';
import { TodoItem } from '../../models/todo-item.model';
import Swal from 'sweetalert2';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-todo-list',
  imports: [RouterLink],
  templateUrl: './todo-list.html',
  styleUrl: './todo-list.css'
})

export class TodoList implements OnInit {
  private readonly authService = inject(Auth);
  private readonly todoItemService = inject(TodoItemService);

  todos = signal<TodoItem[]>([]);
  loading = signal(true);
  errorMessage = signal('');
  ngOnInit(): void {
    this.todoItemService.getAll().subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Tasks could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  onToggle(todo: TodoItem): void {
    this.todoItemService.toggleComplete(todo.id).subscribe({
      next: (updated) =>
        this.todos.update((current) => current.map((t) => (t.id === updated.id ? updated : t))),
      error: () => Swal.fire({
        icon: "error",
        title: "Error",
        text: "Task could not be updated.",
        showConfirmButton: false,
      }),
    });
  }

  onDelete(todo: TodoItem): void {
    // const confirmed = confirm(`Delete "${todo.title}"?`);
    // if (!confirmed) {
    //   return;
    // }
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Delete"
    }).then((result) => {
      if (!result.isConfirmed)
        return;

      this.todoItemService.delete(todo.id).subscribe({
        next: () => this.todos.update((current) => current.filter((t) => t.id !== todo.id)),
        error: () => this.errorMessage.set('Task could not be deleted.'),
      });
    });


  }
}