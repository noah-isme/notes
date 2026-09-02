<script lang="ts">
  import type { ActionData } from './$types';
  import { IconNote, IconAlert } from '$lib/components/icons';

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Create Account | Notes Workspace</title>
</svelte:head>

<div class="auth-container">
  <div class="auth-card">
    <div class="auth-header-brand">
      <div class="brand-badge">
        <IconNote size={20} />
      </div>
      <div>
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-subtitle">Sign up to start organizing your private notes.</p>
      </div>
    </div>

    {#if form?.error}
      <div class="error-banner" role="alert">
        <IconAlert size={15} />
        <span>{form.error}</span>
      </div>
    {/if}

    <form method="POST" class="auth-form">
      <div class="form-group">
        <label for="email">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autocomplete="email"
          value={form?.email ?? ''}
          placeholder="you@example.com"
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="new-password"
          minlength="6"
          placeholder="••••••••"
        />
        <span class="hint">Minimum 6 characters</span>
      </div>

      <button type="submit" class="btn-primary">Register</button>
    </form>

    <p class="auth-footer">
      Already have an account? <a href="/login">Log in</a>
    </p>
  </div>
</div>

<style>
  .auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 1.5rem;
  }

  .auth-card {
    width: 100%;
    max-width: 380px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
  }

  .auth-header-brand {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .brand-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    background: #0f172a;
    color: #ffffff;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .auth-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 0.125rem 0;
    letter-spacing: -0.01em;
  }

  .auth-subtitle {
    color: #64748b;
    font-size: 0.8125rem;
    margin: 0;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    padding: 0.625rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    margin-bottom: 1.25rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #334155;
  }

  .form-group input {
    padding: 0.5625rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #0f172a;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .form-group input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .hint {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .btn-primary {
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
    padding: 0.625rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.15s;
    margin-top: 0.25rem;
  }

  .btn-primary:hover {
    background: #1e293b;
  }

  .auth-footer {
    text-align: center;
    font-size: 0.8125rem;
    color: #64748b;
    margin-top: 1.25rem;
    margin-bottom: 0;
  }

  .auth-footer a {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
  }

  .auth-footer a:hover {
    text-decoration: underline;
  }
</style>
