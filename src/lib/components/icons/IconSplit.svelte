<script lang="ts">
  interface Props {
    size?: number | string;
    class?: string;
  }
  let { size = 16, class: className = '' }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
>
  <rect width="18" height="18" x="3" y="3" rx="2" />
  <line x1="12" x2="12" y1="3" y2="21" />
</svg>
