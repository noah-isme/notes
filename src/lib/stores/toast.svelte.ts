/**
 * Svelte 5 Runes Toast Notification Store
 */

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

export class ToastState {
  toasts = $state<ToastItem[]>([]);

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000): string {
    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, type, message, duration };
    this.toasts.push(item);

    if (duration > 0 && typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  success(message: string, duration = 4000): string {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000): string {
    return this.show(message, 'error', duration);
  }

  info(message: string, duration = 4000): string {
    return this.show(message, 'info', duration);
  }

  remove(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  clear(): void {
    this.toasts = [];
  }
}

export const toast = new ToastState();
