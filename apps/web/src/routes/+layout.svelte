<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import { localeFromPath, otherLocale } from "$lib/archive";
  import { copy } from "$lib/copy";
  import Icon from "$lib/components/Icon.svelte";
  import ThemeControl from "$lib/components/ThemeControl.svelte";
  import "../app.css";

  let { children }: { children: Snippet } = $props();
  const locale = $derived(localeFromPath(page.url.pathname));
  const alternate = $derived(otherLocale(locale));
  const text = $derived(copy[locale]);
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-title" content="Fuscabot Archive" />
  <link rel="manifest" href="/site.webmanifest" />
</svelte:head>

<a class="skip-link" href="#main">{text.skip}</a>
<header class="masthead">
  <div class="shell masthead__inner">
    <a class="wordmark" href={resolve("/[locale=locale]", { locale })} translate="no">Fuscabot Archive</a>
    <div class="masthead__actions">
      <nav class="locale-nav" aria-label="Language">
        <span aria-current="page">{text.language}</span>
        <a href={resolve("/[locale=locale]", { locale: alternate })} lang={alternate}>{text.alternateLanguage}</a>
      </nav>
      <ThemeControl label={text.theme} lightLabel={text.lightTheme} darkLabel={text.darkTheme} />
    </div>
  </div>
</header>

{@render children()}

<footer>
  <figure class="artwork">
    <div class="artwork__visual">
      <img class="artwork__image" src="/assets/artwork/landscape-with-windmill-anthonie-erkelens-0dfeab43.webp" width="3891" height="2719" loading="lazy" decoding="async" alt={text.artworkAlt} />
    </div>
    <figcaption class="shell artwork__credit">The Elisha Whittelsey Collection, The Elisha Whittelsey Fund, 2003</figcaption>
  </figure>
  <div class="footer__bar">
    <div class="shell footer__inner">
      <span translate="no">Fuscabot Archive</span>
      <nav class="footer__links" aria-label={text.footerLinks}>
        <a class="icon-link" href="https://github.com/devlulcas" rel="noopener noreferrer external">GitHub <Icon name="arrow-up-right" /></a>
        <a class="icon-link" href="https://www.lucasalvesrego.com/" rel="noopener noreferrer external">{text.website} <Icon name="arrow-up-right" /></a>
      </nav>
    </div>
  </div>
</footer>
