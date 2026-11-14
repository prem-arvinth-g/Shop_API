import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

// The small pop-up message at the bottom of the screen. Shown by src/app/app.html.
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<{ text: string; type: 'ok' | 'error' } | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, type: 'ok' | 'error' = 'ok') {
    this.message.set({ text, type });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(null), 4000);
  }

  // Turns any API error into a readable sentence.
  error(err: unknown) {
    const e = err as HttpErrorResponse;
    let text = 'Something went wrong. Please try again.';
    if (e?.status === 429) text = 'Too many tries. Please wait a few minutes.';
    else if (e?.status === 401) text = 'Please log in first.';
    else if (e?.error?.message) text = e.error.message;                     // AppError from the server
    else if (e?.error?.errors) text = (Object.values(e.error.errors)[0] as string[])[0];   // [Required] etc.
    this.show(text, 'error');
  }
}
