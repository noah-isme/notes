<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="app-layout">
  <header class="app-header">
    <div class="header-content">
      <div class="logo">
        <span class="logo-icon">📝</span>
        <span class="logo-text">Notes</span>
      </div>
      {#if data.user}
        <div class="user-menu">
          <span class="user-email">{data.user.email}</span>
          <form action="/logout" method="POST" class="logout-form">
            <button type="submit" class="btn-logout">Logout</button>
          </form>
        </div>
      {/if}
    </div>
  </header>

  <main class="app-main">
    {@render children()}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
      Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f8fafc;
    color: #0f172a;
  }

  .app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1.5rem;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .header-content {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-email {
    font-size: 0.875rem;
    color: #64748b;
  }

  .btn-logout {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s ease-in-out;
  }

  .btn-logout:hover {
    background: #e2e8f0;
    color: #1e293b;
  }

  .app-main {
    flex: 1;
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
    padding: 1.5rem;
    box-sizing: border-box;
  }
</style>
