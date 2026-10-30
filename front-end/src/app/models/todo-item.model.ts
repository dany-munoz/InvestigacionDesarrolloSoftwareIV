export interface TodoItem {
    id: number;
    title: string;
    description: string | null;
    isCompleted: boolean;
    createdAt: string;
    completedAt: string | null;
}