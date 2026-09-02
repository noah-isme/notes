<script lang="ts">
  import { page } from '$app/stores';
  import { IconNote, IconAlertCircle, IconLock } from '$lib/components/icons';

  let status = $derived($page.status || 404);
  let errorMessage = $derived($page.error?.message || 'Note is private or not found');
</script>

<svelte:head>
  <title>Note Not Found — Notes</title>
</svelte:head>

<div class="public-error-layout">
  <!-- Public Header -->
  <header class="public-header">
    <div class="header-container">
      <a href="/" class="brand-logo" title="Notes Home">
        <span class="brand-icon">
          <IconNote size={18} />
        </span>
        <span class="brand-text">Notes</span>
      </a>

      <div class="header-actions">
        <a href="/login" class="btn-signin">Sign In</a>
        <a href="/register" class="btn-get-started">Get Started</a>
      </div>
    </div>
  </header>

  <!-- Error Container -->
  <main class="error-main">
    <div class="error-card">
      <div class="error-icon-wrapper">
        {#if status === 404}
          <IconLock size={32} />
        {:else}
          <IconAlertCircle size={32} />
        {/if}
      </div>

      <span class="error-status-badge">{status}</span>
      <h1 class="error-title">{errorMessage}</h1>
      <p class="error-description">
        This note may be private, the share link may have expired or been regenerated, or the note no longer exists.
      </p>

      <div class="error-actions">
        <a href="/" class="btn-home">Return to Home</a>
        <a href="/login" class="btn-login">Sign in to your account</a>
      </div>
    </div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
      Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f8fafc;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
  }

  .public-error-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #f8fafc;
  }

  .public-header {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1.5rem;
  }

  .header-container {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 700;
    color: #0f172a;
    text-decoration: none;
    letter-spacing: -0.01em;
  }

  .brand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #0f172a;
    color: #ffffff;
    border-radius: 6px;
  }

  .brand-text {
    font-size: 1.0625rem;
    font-weight: 700;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-signin {
    color: #475569;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .btn-signin:hover {
    color: #0f172a;
    background: #f1f5f9;
  }

  .btn-get-started {
    background: #0f172a;
    color: #ffffff;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .btn-get-started:hover {
    background: #1e293b;
  }

  .error-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
  }

  .error-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 3rem 2.5rem;
    max-width: 480px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .error-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #fef2f2;
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.25rem;
  }

  .error-status-badge {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #dc2626;
    background: #fee2e2;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    margin-bottom: 0.75rem;
  }

  .error-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 0.75rem 0;
  }

  .error-description {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #64748b;
    margin: 0 0 2rem 0;
  }

  .error-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .btn-home {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #0f172a;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .btn-home:hover {
    background: #1e293b;
  }

  .btn-login {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    color: #475569;
    border: 1px solid #cbd5e1;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-login:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
</style>
