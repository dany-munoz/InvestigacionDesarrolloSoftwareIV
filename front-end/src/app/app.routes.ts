import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './pages/login/login';
import { TodoList } from './pages/todo-list/todo-list';
import { TodoForm } from './pages/todo-form/todo-form';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login},
  { path: 'tasks', component: TodoList },
  { path: 'tasks/new', component: TodoForm },
  { path: 'tasks/:id/edit', component: TodoForm },
];
