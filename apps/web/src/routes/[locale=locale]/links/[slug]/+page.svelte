<script lang="ts">
import { youtubeThumbnailUrl } from "@fuscabot/contracts";
import { resolve } from "$app/paths";
import { copy } from "$lib/copy";
import { isSameUtcDate, metaDescription, otherLocale } from "$lib/archive";
import Icon from "$lib/components/Icon.svelte";
import LocalDate from "$lib/components/LocalDate.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const text = $derived(copy[data.locale]);
const thumbnailUrl = $derived(youtubeThumbnailUrl(data.item.outboundUrl));
const path = $derived(`/${data.locale}/links/${encodeURIComponent(data.item.slug)}`);
const canonical = $derived(`${data.origin}${path}`);
const description = $derived(metaDescription(data.item.summary ?? text.subtitle));
</script>

<svelte:head>
  <title>{data.item.title} — Fuscabot Archive</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <link rel="alternate" hreflang={data.locale} href={canonical} />
  <link rel="alternate" hreflang={otherLocale(data.locale)}
    href={`${data.origin}/${otherLocale(data.locale)}/links/${encodeURIComponent(data.item.slug)}`} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content={`${data.item.title} — Fuscabot Archive`} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={`${data.origin}/assets/social/fuscabot-og-e923a46a.jpg`} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main id="main" class="shell">
  <p><a class="back-link" href={resolve("/[locale=locale]", { locale: data.locale })}><span class="back-link__icon"><Icon name="arrow-left" /></span><span>{text.back}</span></a></p>
  <article class="detail">
    <p class="eyebrow">{data.item.sourceDomain}</p>
    <h1>{data.item.title}</h1>
    <dl class="detail__dates meta">
      <div><dt>{text.published}</dt><dd><LocalDate value={data.item.publishedAt} locale={data.locale} /></dd></div>
      {#if !isSameUtcDate(data.item.publishedAt, data.item.updatedAt)}
        <div><dt>{text.updated}</dt><dd><LocalDate value={data.item.updatedAt} locale={data.locale} /></dd></div>
      {/if}
    </dl>
    {#if thumbnailUrl}
      <a class="video-thumbnail detail__video" href={data.item.outboundUrl} aria-label={`${text.playYouTube}: ${data.item.title}`} rel="noopener noreferrer external">
        <img src={thumbnailUrl} alt="" width="480" height="360" decoding="async" /><span><Icon name="play" /></span>
      </a>
    {/if}
    {#if data.item.summary}<p class="subtitle">{data.item.summary}</p>{/if}
    {#if data.item.selectedText}<blockquote>{data.item.selectedText}</blockquote>{/if}
    {#if data.item.tags.length}
      <div class="tags">{#each data.item.tags as tag (tag.slug)}<a class="tag" href={resolve((`/[locale=locale]/?tag=${encodeURIComponent(tag.slug)}`) as "/[locale=locale]", { locale: data.locale })}>{tag.label}</a>{/each}</div>
    {/if}
    <a class="source-link" href={data.item.outboundUrl} rel="noopener noreferrer external">{text.open} <Icon name="arrow-up-right" /></a>
  </article>
</main>
