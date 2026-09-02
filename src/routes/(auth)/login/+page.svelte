<script lang="ts">
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<div class="auth-container">
  <div class="auth-card">
    <h1 class="auth-title">Welcome Back</h1>
    <p class="auth-subtitle">Log in to access your private notes.</p>

    {#if form?.error}
      <div class="error-banner" role="alert">
        {form.error}
      </div>
    {/if}

    <form method="POST" class="auth-form">
      <div class="form-group">
        <label for="email">Email</label>
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
          autocomplete="current-password"
          placeholder="••••••••"
        />
      </div>

      <button type="submit" class="btn-primary">Log In</button>
    </form>

    <p class="auth-footer">
      Don't have an account? <a href="/register">Sign up</a>
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
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .auth-card {
    width: 100%;
    max-width: 400px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  }
  .auth-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 0.5rem 0;
  }
  .auth-subtitle {
    color: #64748b;
    font-size: 0.875rem;
    margin: 0 0 1.5rem 0;
  }
  .error-banner {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    margin-bottom: 1.25rem;
  }
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #334155;
  }
  .form-group input {
    padding: 0.625rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .form-group input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
  .btn-primary {
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
    padding: 0.75rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    transition: background 0.15s;
    margin-top: 0.5rem;
  }
  .btn-primary:hover {
    background: #1e293b;
  }
  .auth-footer {
    text-align: center;
    font-size: 0.875rem;
    color: #64748b;
    margin-top: 1.5rem;
    margin-bottom: 0;
  }
  .auth-footer a {
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
  }
  .auth-footer a:hover {
    text-decoration: underline;
  }
</style>
