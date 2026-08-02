<script lang="ts">
import type { PublicArchiveItem } from "@fuscabot/api";
import { youtubeThumbnailUrl } from "@fuscabot/contracts";
import { resolve } from "$app/paths";
import type { ArchiveLocale } from "$lib/archive";
import { copy } from "$lib/copy";
import Icon from "./Icon.svelte";
import LocalDate from "./LocalDate.svelte";

let { item, locale }: { item: PublicArchiveItem; locale: ArchiveLocale } = $props();
const text = $derived(copy[locale]);
const thumbnailUrl = $derived(youtubeThumbnailUrl(item.outboundUrl));
</script>

<li class="card">
  <p class="meta">
    <LocalDate value={item.publishedAt} {locale} />
  </p>
  <article class="card__body">
    <h2 class="card__title"><a href={resolve("/[locale=locale]/links/[slug]", { locale, slug: item.slug })}>{item.title}</a></h2>
    {#if item.summary}<p class="summary">{item.summary}</p>{/if}
    <p class="meta card__source">
      <span>{item.sourceDomain}</span>
      <a class="card__source-link" href={item.outboundUrl} aria-label={`${text.open}: ${item.sourceDomain}`} rel="noopener noreferrer external"><Icon name="arrow-up-right" /></a>
    </p>
    {#if thumbnailUrl}
      <div class="card__video">
        <p class="media-label">{text.youtubeVideo}</p>
        <a class="video-thumbnail" href={item.outboundUrl} aria-label={`${text.playYouTube}: ${item.title}`} rel="noopener noreferrer external">
          <img src={thumbnailUrl} alt="" width="480" height="360" loading="lazy" decoding="async" />
          <span><Icon name="play" /></span>
        </a>
      </div>
    {/if}
    {#if item.tags.length}
      <div class="tags">
        {#each item.tags as tag (tag.slug)}
          <a class="tag" href={resolve((`/[locale=locale]/?tag=${encodeURIComponent(tag.slug)}`) as "/[locale=locale]", { locale })}>{tag.label}</a>
        {/each}
      </div>
    {/if}
  </article>
</li>
