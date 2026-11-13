import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { inject } from '@angular/core';
import { SyncService } from './services/sync-service';

@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
    readonly sync = inject(SyncService);
  protected readonly title = signal('TodoApp');
}
