<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { toast } from '$lib/stores/toast.svelte';
  import Toast from '$lib/components/Toast.svelte';

  let { data, form }: { data: PageData; form?: ActionData } = $props();

  // Local state for profile inputs
  let name = $state(data.profile.name ?? '');
  let email = $state(data.profile.email);
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');

  // Handle toast notifications from form action responses
  $effect(() => {
    if (form?.profileError) {
      toast.error(form.profileError);
    } else if (form?.profileSuccess) {
      toast.success(form.profileMessage || 'Profile updated successfully');
    }

    if (form?.passwordError) {
      toast.error(form.passwordError);
    } else if (form?.passwordSuccess) {
      toast.success(form.passwordMessage || 'Password updated successfully');
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    }
  });

  // Calculate initials for avatar
  let userInitials = $derived.by(() => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  });

  // Format member since date
  let memberSinceFormatted = $derived.by(() => {
    try {
      const d = new Date(data.profile.createdAt);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  });
</script>

<svelte:head>
  <title>User Profile | Notes Workspace</title>
</svelte:head>

<Toast />

<div class="profile-container">
  <!-- Top Navigation Header -->
  <div class="profile-top-nav">
    <a href="/" class="btn-back-link">
      ← Back to Notes
    </a>
    <span class="top-nav-title">Account Settings</span>
  </div>

  <!-- Hero Profile Banner -->
  <div class="profile-hero-card">
    <div class="profile-avatar">
      {userInitials}
    </div>
    <div class="profile-hero-info">
      <h2 class="profile-display-name">
        {name || data.profile.name || 'Anonymous User'}
      </h2>
      <p class="profile-email-sub">{email || data.profile.email}</p>
      <span class="profile-joined-date">Member since {memberSinceFormatted}</span>
    </div>

    <!-- Quick Stats in Hero -->
    <div class="hero-stats-group">
      <div class="hero-stat-item">
        <span class="stat-number">{data.stats.notesCount}</span>
        <span class="stat-label">Notes</span>
      </div>
      <div class="hero-stat-item">
        <span class="stat-number">{data.stats.tagsCount}</span>
        <span class="stat-label">Tags</span>
      </div>
    </div>
  </div>

  <!-- Grid of Settings Cards -->
  <div class="settings-grid">
    <!-- Card 1: Personal Information -->
    <section class="settings-card" aria-labelledby="personal-info-heading">
      <div class="card-header">
        <div class="header-icon">👤</div>
        <div>
          <h3 id="personal-info-heading" class="card-title">Personal Information</h3>
          <p class="card-subtitle">Update your display name and contact email address.</p>
        </div>
      </div>

      {#if form?.profileError}
        <div class="alert alert-error" role="alert">
          <span>⚠️ {form.profileError}</span>
        </div>
      {/if}

      {#if form?.profileSuccess}
        <div class="alert alert-success" role="status">
          <span>✅ {form.profileMessage}</span>
        </div>
      {/if}

      <form method="POST" action="?/updateProfile" class="settings-form">
        <div class="form-group">
          <label for="display-name-input" class="form-label">Display Name</label>
          <input
            id="display-name-input"
            type="text"
            name="name"
            class="form-input"
            placeholder="e.g. Alex Johnson"
            maxlength="100"
            bind:value={name}
          />
          <span class="form-hint">Used as your public label across your notes workspace.</span>
        </div>

        <div class="form-group">
          <label for="email-input" class="form-label">Email Address</label>
          <input
            id="email-input"
            type="email"
            name="email"
            class="form-input"
            required
            placeholder="you@example.com"
            bind:value={email}
          />
          <span class="form-hint">This email is used to sign into your account.</span>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">
            Save Profile
          </button>
        </div>
      </form>
    </section>

    <!-- Card 2: Security & Password -->
    <section class="settings-card" aria-labelledby="security-heading">
      <div class="card-header">
        <div class="header-icon">🔒</div>
        <div>
          <h3 id="security-heading" class="card-title">Password & Security</h3>
          <p class="card-subtitle">Change your password to keep your notes workspace secure.</p>
        </div>
      </div>

      {#if form?.passwordError}
        <div class="alert alert-error" role="alert">
          <span>⚠️ {form.passwordError}</span>
        </div>
      {/if}

      {#if form?.passwordSuccess}
        <div class="alert alert-success" role="status">
          <span>✅ {form.passwordMessage}</span>
        </div>
      {/if}

      <form method="POST" action="?/updatePassword" class="settings-form">
        <div class="form-group">
          <label for="current-password-input" class="form-label">Current Password</label>
          <input
            id="current-password-input"
            type="password"
            name="currentPassword"
            class="form-input"
            required
            placeholder="••••••••"
            bind:value={currentPassword}
          />
        </div>

        <div class="form-group">
          <label for="new-password-input" class="form-label">New Password</label>
          <input
            id="new-password-input"
            type="password"
            name="newPassword"
            class="form-input"
            required
            minlength="6"
            placeholder="Minimum 6 characters"
            bind:value={newPassword}
          />
          <span class="form-hint">Must be at least 6 characters.</span>
        </div>

        <div class="form-group">
          <label for="confirm-password-input" class="form-label">Confirm New Password</label>
          <input
            id="confirm-password-input"
            type="password"
            name="confirmPassword"
            class="form-input"
            required
            minlength="6"
            placeholder="Re-enter new password"
            bind:value={confirmPassword}
          />
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">
            Update Password
          </button>
        </div>
      </form>
    </section>
  </div>
</div>

<style>
  .profile-container {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 3rem;
  }

  /* Top Navigation */
  .profile-top-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: #2563eb;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .btn-back-link:hover {
    background: #f1f5f9;
    color: #1d4ed8;
  }

  .top-nav-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
  }

  /* Hero Card */
  .profile-hero-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.75rem 2rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .profile-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
    color: #ffffff;
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
  }

  .profile-hero-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .profile-display-name {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
    color: #0f172a;
  }

  .profile-email-sub {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
  }

  .profile-joined-date {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.25rem;
  }

  .hero-stats-group {
    display: flex;
    gap: 1.5rem;
    padding-left: 1.5rem;
    border-left: 1px solid #f1f5f9;
  }

  .hero-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-number {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  /* Settings Grid */
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .settings-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .header-icon {
    font-size: 1.375rem;
    line-height: 1;
  }

  .card-title {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: #0f172a;
  }

  .card-subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.4;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #334155;
  }

  .form-input {
    padding: 0.625rem 0.875rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #0f172a;
    background: #ffffff;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-hint {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .btn-primary {
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-primary:hover {
    background: #1d4ed8;
  }

  /* Alerts */
  .alert {
    padding: 0.625rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .alert-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .alert-success {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }

    .profile-hero-card {
      flex-direction: column;
      text-align: center;
      padding: 1.5rem;
    }

    .hero-stats-group {
      padding-left: 0;
      border-left: none;
      padding-top: 1rem;
      border-top: 1px solid #f1f5f9;
      width: 100%;
      justify-content: center;
    }
  }
</style>
