<script module lang="ts">
  function getPropValue<T>(getter: () => T): T {
    return getter();
  }
</script>

<script lang="ts">
  import { IconSearch, IconClose } from './icons';

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

  let inputValue = $state(getPropValue(() => value));
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

  let inputRef = $state<HTMLInputElement | null>(null);

  export function focus() {
    inputRef?.focus();
    inputRef?.select();
  }

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
  <span class="search-icon" aria-hidden="true">
    <IconSearch size={15} />
  </span>
  <input
    bind:this={inputRef}
    type="text"
    class="search-input"
    {placeholder}
    value={inputValue}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    aria-label="Search notes"
    title="Search notes (Cmd/Ctrl+K)"
  />
  {#if inputValue.length > 0}
    <button
      type="button"
      class="search-clear-btn"
      onclick={handleClear}
      aria-label="Clear search query"
    >
      <IconClose size={13} />
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
    color: #94a3b8;
    pointer-events: none;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-input {
    width: 100%;
    padding: 0.5625rem 2.25rem 0.5625rem 2.25rem;
    font-size: 0.875rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
    color: #0f172a;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    box-sizing: border-box;
  }

  .search-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
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
    color: #0f172a;
    background: #f1f5f9;
  }
</style>
