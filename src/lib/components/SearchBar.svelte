<script lang="ts">
  interface SearchBarProps {
    value?: string;
    placeholder?: string;
    debounceMs?: number;
    onSearch?: (query: string) => void;
    onClear?: () => void;
  }

  let {
    value = '',
    placeholder = 'Search notes by title or content...',
    debounceMs = 250,
    onSearch,
    onClear,
  }: SearchBarProps = $props();

  let inputValue = $state(value);
  let isInitialMount = true;

  // Sync external value changes to local state
  $effect(() => {
    inputValue = value;
  });

  // Debounced search trigger on typing
  $effect(() => {
    const current = inputValue;
    if (isInitialMount) {
      isInitialMount = false;
      return;
    }

    const timer = setTimeout(() => {
      onSearch?.(current);
    }, debounceMs);

    return () => clearTimeout(timer);
  });

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    inputValue = target.value;
  }

  function handleClear() {
    inputValue = '';
    onClear?.();
    onSearch?.('');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClear();
    }
  }
</script>

<div class="search-bar-container">
  <span class="search-icon" aria-hidden="true">🔍</span>
  <input
    type="text"
    class="search-input"
    {placeholder}
    value={inputValue}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    aria-label="Search notes"
  />
  {#if inputValue.length > 0}
    <button
      type="button"
      class="search-clear-btn"
      onclick={handleClear}
      aria-label="Clear search query"
    >
      &times;
    </button>
  {/if}
</div>

<style>
  .search-bar-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    font-size: 0.875rem;
    color: #94a3b8;
    pointer-events: none;
    user-select: none;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 2.25rem 0.625rem 2.25rem;
    font-size: 0.875rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #1e293b;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    box-sizing: border-box;
  }

  .search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .search-input::placeholder {
    color: #94a3b8;
  }

  .search-clear-btn {
    position: absolute;
    right: 0.5rem;
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 1.125rem;
    line-height: 1;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .search-clear-btn:hover {
    color: #475569;
    background: #f1f5f9;
  }
</style>
