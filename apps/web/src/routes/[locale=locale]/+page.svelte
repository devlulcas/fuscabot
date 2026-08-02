<script lang="ts">
import ArchiveCard from "$lib/components/ArchiveCard.svelte";
import { resolve } from "$app/paths";
import Icon from "$lib/components/Icon.svelte";
import { copy } from "$lib/copy";
import { otherLocale, pageUrl } from "$lib/archive";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const text = $derived(copy[data.locale]);
const canonical = $derived(`${data.origin}${pageUrl(data.locale, data.query)}`);
const alternate = $derived(`${data.origin}${pageUrl(otherLocale(data.locale), data.query)}`);
const socialImage = $derived(`${data.origin}/assets/social/fuscabot-og-e923a46a.jpg`);
const previousUrl = $derived(pageUrl(data.locale, { ...data.query, page: data.query.page - 1 }));
const nextUrl = $derived(pageUrl(data.locale, { ...data.query, page: data.query.page + 1 }));
</script>

<svelte:head>
  <title>Fuscabot Archive</title>
  <meta name="description" content={text.subtitle} />
  <link rel="canonical" href={canonical} />
  <link rel="alternate" hreflang={data.locale} href={canonical} />
  <link rel="alternate" hreflang={otherLocale(data.locale)} href={alternate} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Fuscabot Archive" />
  <meta property="og:title" content="Fuscabot Archive" />
  <meta property="og:description" content={text.subtitle} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={socialImage} />
  <meta property="og:image:alt" content={text.socialImageAlt} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={socialImage} />
</svelte:head>

<main id="main" class="shell">
  <section class="hero" aria-labelledby="archive-title">
    <p class="eyebrow">{data.locale === "en" ? "Public field notes" : "Notas públicas"}</p>
    <h1 id="archive-title">Fuscabot Archive</h1>
    <p class="subtitle">{text.subtitle}</p>
  </section>
  <form class="filters" action={`/${data.locale}/`} method="get" role="search">
    <div class="field">
      <label for="archive-query">{text.search}</label>
      <input id="archive-query" name="q" type="search" maxlength="100" value={data.query.query ?? ""} autocomplete="off" placeholder={`${text.searchPlaceholder}…`} />
    </div>
    <div class="field">
      <label for="archive-tag">{text.tag}</label>
      <select id="archive-tag" name="tag" value={data.query.tag ?? ""}>
        <option value="">{text.allTags}</option>
        {#each data.result.tags as tag (tag.slug)}<option value={tag.slug}>{tag.label}</option>{/each}
      </select>
    </div>
    <button type="submit">{text.apply}</button>
  </form>
  <p class="result-count" aria-live="polite">{data.result.total} {data.result.total === 1 ? text.result : text.results}</p>
  {#if data.result.items.length}
    <ol class="results">
      {#each data.result.items as item (item.slug)}<ArchiveCard {item} locale={data.locale} />{/each}
    </ol>
  {:else}
    <p class="empty">{text.empty}</p>
  {/if}
  {#if data.totalPages > 1}
    <nav class="pagination" aria-label={`${text.page} ${data.query.page} / ${data.totalPages}`}>
      {#if data.query.page > 1}<a rel="prev" href={resolve(previousUrl as "/")}><Icon name="arrow-left" /> {text.newer}</a>{:else}<span></span>{/if}
      <span>{text.page} {data.query.page} / {data.totalPages}</span>
      {#if data.query.page < data.totalPages}<a rel="next" href={resolve(nextUrl as "/")}>{text.older} <Icon name="arrow-right" /></a>{:else}<span></span>{/if}
    </nav>
  {/if}
</main>
