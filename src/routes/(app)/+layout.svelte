<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';
  import { IconNote, IconUser } from '$lib/components/icons';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="app-layout">
  <header class="app-header">
    <div class="header-content">
      <div class="header-left">
        <a href="/" class="logo" title="Notes Workspace">
          <span class="logo-icon-wrapper">
            <IconNote size={15} />
          </span>
          <span class="logo-text">Notes</span>
        </a>
      </div>

      {#if data.user}
        <div class="header-right">
          <a href="/profile" class="user-profile-btn" title="Manage Account & Profile">
            <span class="avatar-chip">
              <IconUser size={12} />
            </span>
            <span class="user-display-label">{data.user.name || data.user.email}</span>
          </a>
          <form action="/logout" method="POST" class="logout-form">
            <button type="submit" class="btn-logout" title="Sign out of account">Logout</button>
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
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .app-layout {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: #ffffff;
  }

  .app-header {
    height: 46px;
    min-height: 46px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 40;
    flex-shrink: 0;
    box-sizing: border-box;
  }

  .header-content {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 700;
    color: #0f172a;
    text-decoration: none;
    letter-spacing: -0.015em;
  }

  .logo-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #0f172a;
    color: #ffffff;
    border-radius: 5px;
  }

  .logo-text {
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-profile-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    text-decoration: none;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    color: #334155;
    transition: all 0.15s ease;
    max-width: 200px;
  }

  .user-profile-btn:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .avatar-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .user-display-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .logout-form {
    margin: 0;
  }

  .btn-logout {
    background: transparent;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    font-family: inherit;
  }

  .btn-logout:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .app-main {
    flex: 1;
    min-height: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }
</style>
