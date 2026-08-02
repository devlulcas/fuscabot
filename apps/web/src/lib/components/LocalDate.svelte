<script lang="ts">
import { onMount } from "svelte";
import type { ArchiveLocale } from "$lib/archive";
import { formatArchiveDate } from "$lib/dates";

let { value, locale }: { value: Date | string; locale: ArchiveLocale } = $props();
let mounted = $state(false);
const dateTime = $derived(new Date(value).toISOString());
const formatted = $derived(formatArchiveDate(value, locale, mounted ? undefined : "UTC"));

onMount(() => {
  mounted = true;
});
</script>

<time datetime={dateTime}>{formatted}</time>
