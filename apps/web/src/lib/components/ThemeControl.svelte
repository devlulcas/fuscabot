<script lang="ts">
import { onMount } from "svelte";
import Icon from "./Icon.svelte";

type Theme = "light" | "dark";
let { label, lightLabel, darkLabel }: { label: string; lightLabel: string; darkLabel: string } =
  $props();
let theme = $state<Theme>("light");
let mounted = $state(false);

onMount(() => {
  const stored = localStorage.getItem("fuscabot-theme");
  theme = stored === "dark" ? "dark" : "light";
  applyTheme(theme);
  mounted = true;
});

function applyTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    next === "dark" ? "#20231f" : "#f4f0e5",
  );
}

function selectTheme(next: Theme): void {
  if (next === theme) return;
  try {
    localStorage.setItem("fuscabot-theme", next);
  } catch {
    // Selection still applies to this page when storage is unavailable.
  }
  const update = () => {
    theme = next;
    applyTheme(next);
  };
  if (document.startViewTransition) document.startViewTransition(update);
  else update();
}
</script>

<div class="theme-control" role="group" aria-label={label}>
  <button class="theme-choice" type="button" aria-label={lightLabel}
    aria-pressed={theme === "light"} title={lightLabel} disabled={!mounted}
    onclick={() => selectTheme("light")}>
    <Icon name="sun" />
  </button>
  <button class="theme-choice" type="button" aria-label={darkLabel} aria-pressed={theme === "dark"}
    title={darkLabel} disabled={!mounted} onclick={() => selectTheme("dark")}>
    <Icon name="moon" />
  </button>
</div>
