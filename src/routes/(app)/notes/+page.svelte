<script lang="ts">
  import AppPage from '../+page.svelte';
  import type { PageData, ActionData } from '../$types';

  let { data, form }: { data: PageData; form?: ActionData } = $props();
</script>

<AppPage {data} {form} />

