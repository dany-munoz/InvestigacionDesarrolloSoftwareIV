import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-todo-list',
  styleUrl: './todolist.css',
  templateUrl: './todolist.html',
})
export class TodoList {
  
  tasks = [
    {title: 'Crear el proyecto de Angular', done: true},
    {title: 'Configurar el proyecto de Angular', done: true},
    {title: 'Agregar el primer componente', done: true},
    {title: 'Conectar con el Backend', done: false},
  ];

}