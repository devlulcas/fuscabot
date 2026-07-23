export const STYLE_PATH = "/assets/archive-10af37a3.css";

export const ARCHIVE_CSS = String.raw`
:root {
  color-scheme: light;
  --paper: #f4f0e5;
  --paper-raised: #fbf8ef;
  --ink: #292d28;
  --muted: #676d62;
  --sage: #71806c;
  --rose: #a87975;
  --ochre: #b48645;
  --line: #c8c5b8;
  --focus: #3f5944;
  --artwork-filter: none;
  --measure: 72rem;
  font-family: "Source Serif 4", Georgia, serif;
}
* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); scroll-behavior: smooth; }
body {
  display: flex; flex-direction: column; margin: 0; min-height: 100dvh;
  line-height: 1.65; overflow-x: hidden;
  background: var(--paper); color: var(--ink);
}
a, button, input, select { touch-action: manipulation; -webkit-tap-highlight-color: rgb(63 89 68 / 24%); }
a { color: inherit; text-decoration-thickness: .08em; text-underline-offset: .18em; }
a:hover { color: var(--focus); }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible {
  outline: .16rem solid var(--focus); outline-offset: .2rem;
}
.skip-link {
  position: fixed; inset: .75rem auto auto .75rem; z-index: 10; padding: .55rem .8rem;
  background: var(--ink); color: var(--paper); transform: translateY(-180%);
}
.skip-link:focus { transform: none; }
.shell { width: min(calc(100% - 2rem), var(--measure)); margin-inline: auto; }
.masthead {
  padding-block: 1.2rem; border-bottom: 1px solid var(--line);
  view-transition-name: site-header;
}
.masthead__inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.masthead__actions { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; }
.wordmark, h1, h2 { font-family: "Libre Caslon Text", Georgia, serif; font-weight: 400; }
h1, h2 { text-wrap: balance; overflow-wrap: anywhere; }
.wordmark { font-size: 1.15rem; text-decoration: none; }
.locale-nav { display: flex; gap: .8rem; font-size: .85rem; }
.locale-nav [aria-current] { text-decoration: none; color: var(--muted); }
.theme-control-mount { min-width: 6.7rem; min-height: 2.15rem; }
.theme-control {
  display: grid; grid-template-columns: repeat(3, 1fr); padding: .18rem;
  border: 1px solid var(--line); border-radius: 999px; background: var(--paper-raised);
}
.theme-choice {
  display: grid; place-items: center; min-width: 2rem; min-height: 1.75rem; padding: 0;
  border: 0; border-radius: 999px; color: var(--muted); line-height: 1;
}
.theme-choice:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); }
.theme-choice[aria-pressed="true"] {
  background: var(--ink); color: var(--paper); box-shadow: 0 .08rem .3rem rgb(0 0 0 / 18%);
}
main { padding-block: clamp(2.5rem, 7vw, 6rem); view-transition-name: page-content; }
.hero { max-width: 50rem; margin-bottom: clamp(2.5rem, 6vw, 5rem); }
h1 { margin: 0 0 1rem; font-size: clamp(2.7rem, 8vw, 6rem); line-height: .98; letter-spacing: -.035em; }
h2 { margin: 0; font-size: clamp(1.45rem, 3vw, 2rem); line-height: 1.2; }
.subtitle { color: var(--muted); font-size: clamp(1.05rem, 2vw, 1.3rem); max-width: 42rem; }
.eyebrow, .meta, .result-count, label, .tag, .pagination {
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: .75rem;
}
.eyebrow { color: var(--rose); letter-spacing: .12em; text-transform: uppercase; }
.filters {
  display: grid; grid-template-columns: minmax(12rem, 1fr) minmax(10rem, .45fr) auto;
  align-items: end; gap: clamp(1.25rem, 3vw, 2rem);
  padding-block: clamp(1.8rem, 4vw, 2.8rem); border-block: 1px solid var(--line);
}
.field { display: grid; gap: .55rem; }
input, select, button {
  min-height: 2.75rem; border: 0; border-bottom: 1px solid var(--ink); border-radius: 0;
  background: transparent; color: inherit; font: inherit;
}
select, option { background-color: var(--paper); color: var(--ink); }
button { padding-inline: 1.2rem; border: 1px solid var(--ink); cursor: pointer; }
button:hover { background: var(--ink); color: var(--paper); }
.results { list-style: none; padding: 0; margin: 0; }
.card { display: grid; grid-template-columns: 9rem 1fr; gap: clamp(1rem, 4vw, 4rem); padding-block: 2rem; border-bottom: 1px solid var(--line); }
.card__body { min-width: 0; }
.card__title a {
  text-decoration: none;
  background-image: linear-gradient(var(--focus), var(--focus));
  background-position: 0 100%; background-repeat: no-repeat; background-size: 0 .08em;
  transition: color .18s ease, background-size .24s ease;
}
.card__title a:hover { background-size: 100% .08em; }
.summary { max-width: 46rem; color: var(--muted); }
.meta { color: var(--muted); overflow-wrap: anywhere; }
.tags { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: 1rem; }
.tag {
  border: 1px solid var(--line); padding: .2rem .45rem; text-decoration: none;
  transition: border-color .18s ease, background-color .18s ease, transform .18s ease;
}
.tag:hover { border-color: var(--sage); }
.pagination { display: flex; justify-content: space-between; gap: 1rem; padding-block: 2rem; }
.empty, .error { padding-block: 3rem; border-bottom: 1px solid var(--line); }
.detail { display: grid; grid-template-columns: minmax(0, 2fr) minmax(12rem, .7fr); gap: clamp(2rem, 7vw, 7rem); }
.detail h1 { font-size: clamp(2.5rem, 6vw, 5rem); overflow-wrap: anywhere; }
blockquote { margin: 2rem 0; padding: .25rem 0 .25rem 1.3rem; border-left: .2rem solid var(--rose); font-size: 1.15rem; overflow-wrap: anywhere; }
.source-link {
  display: inline-block; margin-top: 2rem; padding: .65rem 1rem; border: 1px solid var(--ink);
  text-decoration: none; transition: background-color .18s ease, color .18s ease, transform .18s ease;
}
.source-link:hover { background: var(--ink); color: var(--paper); }
footer {
  margin-top: auto; color: var(--muted);
}
.artwork {
  width: min(100%, 100rem); margin: clamp(4rem, 10vw, 9rem) auto 0;
}
.artwork__visual { overflow: hidden; background: var(--paper); }
.artwork__image {
  display: block; width: 100%; height: min(72dvh, 52rem); object-fit: cover;
  object-position: center bottom; filter: var(--artwork-filter);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 20%) 12%, #000 38%);
  mask-image: linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 20%) 12%, #000 38%);
}
.artwork__credit {
  margin-block: .8rem 1.5rem; color: var(--muted); text-align: right;
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: .65rem;
}
.footer__bar {
  border-top: 1px solid var(--line); padding-block: 2rem;
  view-transition-name: site-footer;
}
.footer__inner {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 1rem 2rem;
}
.footer__links {
  display: flex; flex-wrap: wrap; gap: .6rem 1.25rem;
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: .75rem;
}
.footer__links a { text-decoration: none; }
.footer__links a:hover { text-decoration: underline; }
.tag:hover, .source-link:hover { transform: translateY(-.1rem); }
@view-transition { navigation: auto; }
::view-transition-group(site-header), ::view-transition-group(site-footer) {
  animation-duration: .22s;
}
::view-transition-old(page-content) { animation: page-out .16s ease both; }
::view-transition-new(page-content) { animation: page-in .28s ease both; }
@keyframes page-out {
  to { opacity: 0; transform: translateY(-.45rem); }
}
@keyframes page-in {
  from { opacity: 0; transform: translateY(.65rem); }
}
@media (max-width: 44rem) {
  .filters, .detail { grid-template-columns: 1fr; }
  .card { grid-template-columns: 1fr; gap: .5rem; }
  .masthead__inner { align-items: center; }
  .masthead__actions { gap: .65rem; }
  .locale-nav span { display: none; }
  .artwork__credit { text-align: left; }
}
:root[data-theme="dark"] {
  color-scheme: dark; --paper: #20231f; --paper-raised: #292d28; --ink: #eee9dc;
  --muted: #b4b7ac; --line: #51564d; --focus: #b9c9ad;
  --artwork-filter: brightness(.72) saturate(.72);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark; --paper: #20231f; --paper-raised: #292d28; --ink: #eee9dc;
    --muted: #b4b7ac; --line: #51564d; --focus: #b9c9ad;
    --artwork-filter: brightness(.72) saturate(.72);
  }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation: none !important;
  }
}
`;
