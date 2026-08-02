<script lang="ts">
import { page } from "$app/state";
import { resolve } from "$app/paths";
import { copy } from "$lib/copy";
import { localeFromPath } from "$lib/archive";
import Icon from "$lib/components/Icon.svelte";

const locale = $derived(localeFromPath(page.url.pathname));
const text = $derived(copy[locale]);
const missing = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{missing ? text.notFoundTitle : text.invalidTitle} — Fuscabot Archive</title>
</svelte:head>
<main id="main" class="shell error">
  <p class="eyebrow">{page.status}</p>
  <h1>{missing ? text.notFoundTitle : text.invalidTitle}</h1>
  <p>{missing ? text.notFoundBody : text.invalidBody}</p>
  <p><a class="icon-link" href={resolve("/[locale=locale]", { locale })}><Icon name="arrow-left" /> {text.back}</a></p>
</main>
