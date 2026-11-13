import { TodoItem } from './todo-item.model';

// Conflicto entre la edición local y la versión actual del servidor.
export interface TodoConflict {
    todoId: number;
    localItem: TodoItem;
    serverItem: TodoItem;
    detectedAt: string;
}
