/**
 * Svelte 5 Runes Toast Notification Store
 * Includes deduplication, max queue capping, and auto-dismissal.
 */

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
  action?: ToastAction;
}

const MAX_VISIBLE_TOASTS = 3;

export class ToastState {
  toasts = $state<ToastItem[]>([]);

  show(
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    durationOrOptions: number | ToastOptions = 4000,
    actionParam?: ToastAction
  ): string {
    if (!message || typeof message !== 'string') {
      return '';
    }

    let duration = 4000;
    let action: ToastAction | undefined = actionParam;

    if (typeof durationOrOptions === 'number') {
      duration = durationOrOptions;
    } else if (typeof durationOrOptions === 'object' && durationOrOptions !== null) {
      if (typeof durationOrOptions.duration === 'number') {
        duration = durationOrOptions.duration;
      }
      if (durationOrOptions.action) {
        action = durationOrOptions.action;
      }
    }

    // Deduplication: prevent identical messages from spamming the screen
    const existingIndex = this.toasts.findIndex(
      (t) => t.message === message && t.type === type
    );
    if (existingIndex !== -1) {
      return this.toasts[existingIndex].id;
    }

    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, type, message, duration, action };

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

  showWithAction(
    message: string,
    action: ToastAction,
    type: 'success' | 'error' | 'info' = 'info',
    duration = 6000
  ): string {
    return this.show(message, type, { duration, action });
  }

  success(message: string, durationOrOptions: number | ToastOptions = 4000, action?: ToastAction): string {
    return this.show(message, 'success', durationOrOptions, action);
  }

  error(message: string, durationOrOptions: number | ToastOptions = 5000, action?: ToastAction): string {
    return this.show(message, 'error', durationOrOptions, action);
  }

  info(message: string, durationOrOptions: number | ToastOptions = 4000, action?: ToastAction): string {
    return this.show(message, 'info', durationOrOptions, action);
  }

  remove(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  clear(): void {
    this.toasts = [];
  }
}

export const toast = new ToastState();
