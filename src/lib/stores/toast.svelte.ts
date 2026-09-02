/**
 * Svelte 5 Runes Toast Notification Store
 * Includes deduplication, max queue capping, and auto-dismissal.
 */

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

const MAX_VISIBLE_TOASTS = 3;

export class ToastState {
  toasts = $state<ToastItem[]>([]);

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000): string {
    if (!message || typeof message !== 'string') {
      return '';
    }

    // Deduplication: prevent identical messages from spamming the screen
    const existingIndex = this.toasts.findIndex(
      (t) => t.message === message && t.type === type
    );
    if (existingIndex !== -1) {
      return this.toasts[existingIndex].id;
    }

    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, type, message, duration };

    // Cap at MAX_VISIBLE_TOASTS
    if (this.toasts.length >= MAX_VISIBLE_TOASTS) {
      this.toasts = [...this.toasts.slice(this.toasts.length - MAX_VISIBLE_TOASTS + 1), item];
    } else {
      this.toasts = [...this.toasts, item];
    }

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
