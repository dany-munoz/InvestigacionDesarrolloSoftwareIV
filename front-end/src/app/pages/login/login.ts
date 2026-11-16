import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isRegister = signal(
    Boolean(this.route.snapshot.data['isRegister']) || this.router.url.includes('register')
  );

  form = this.fb.nonNullable.group({
    userName: ['', Validators.required],
    password: ['', Validators.required],
  });

  errorMessage = signal('');

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    const credentials = this.form.getRawValue();

    const authRequest$ = this.isRegister()
      ? this.authService.register(credentials)
      : this.authService.login(credentials);

    authRequest$.subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        if (!this.isRegister() && err.status === 401) {
          this.errorMessage.set('Nombre de usuario o contraseña incorrectos.');
        } else if (this.isRegister() && (err.status === 400 || err.status === 409)) {
          this.errorMessage.set(
            typeof err.error === 'string' ? err.error : 'El nombre de usuario ya está en uso o los datos no son válidos.'
          );
        } else {
          this.errorMessage.set(
            typeof err.error === 'string'
              ? err.error
              : `No se pudo ${this.isRegister() ? 'crear la cuenta' : 'iniciar sesión'}. Por favor, inténtalo de nuevo más tarde.`
          );
        }
      },
    });
  }
}