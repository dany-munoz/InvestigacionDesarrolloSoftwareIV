import { TodoItem } from './todo-item.model';

export interface TodoConflict {
    todoId: number;
    localItem: TodoItem;
    serverItem: TodoItem;
    detectedAt: string;
}
