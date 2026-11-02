export interface PendingOperation {
    id?: number;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    todoId: number;
    payload: any;
    timestamp: string;
}