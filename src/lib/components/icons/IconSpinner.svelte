<script lang="ts">
  interface Props {
    size?: number | string;
    class?: string;
    color?: string;
  }

  let { size = 16, class: className = '', color = 'currentColor' }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="animate-spin {className}"
  aria-hidden="true"
>
  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
</svg>

<style>
  .animate-spin {
    animation: spin 0.75s linear infinite;
    flex-shrink: 0;
    display: inline-block;
    vertical-align: middle;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
