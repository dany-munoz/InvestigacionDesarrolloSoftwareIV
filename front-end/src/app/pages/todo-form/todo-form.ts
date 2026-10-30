import { Component, inject, OnInit, signal } from '@angular/core';
import { TodoItemService } from '../../services/todo-item-service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  imports: [RouterLink, ReactiveFormsModule],
  selector: 'app-todo-form',
  styleUrl: './todo-form.css',
  templateUrl: './todo-form.html',
})
export class TodoForm implements OnInit {
  private readonly todoItemService = inject(TodoItemService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
  });

  errorMessage = signal('');
  editingId: number | null = null;
  private existingIsCompleted = false;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam)
      return;

    this.editingId = Number(idParam);
    this.todoItemService.getById(this.editingId).subscribe({
      next: (todo) => {
        this.form.patchValue({
          title: todo.title,
          description: todo.description ?? '',
        });
        this.existingIsCompleted = todo.isCompleted;
      },
      error: () => this.errorMessage.set('Unable to load the task. Try again.'),
    })
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.editingId) {
      this.todoItemService.update(this.editingId, {...this.form.getRawValue(), isCompleted: this.existingIsCompleted,}).subscribe({
        next: () => this.router.navigate(['/tasks']),
        error: () => this.errorMessage.set('Unable to update the task. Try again.'),
      });
      return;
    }

    this.errorMessage.set('');

    this.todoItemService.create(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/tasks']),
      error: () => this.errorMessage.set('Unable to create the task. Try again.'),
    })
  }
}
