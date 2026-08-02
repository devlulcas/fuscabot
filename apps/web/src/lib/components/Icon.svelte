<script lang="ts">
let { name }: { name: "arrow-left" | "arrow-right" | "arrow-up-right" | "moon" | "play" | "sun" } =
  $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="16"
  height="16"
  viewBox={name === "play" ? "0 0 256 256" : "0 0 16 16"}
  fill={name === "play" ? "currentColor" : "none"}
  aria-hidden="true"
  focusable="false"
>
  {#if name === "play"}
    <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" />
  {:else if name === "sun"}
    <circle cx="8" cy="8" r="2.75" stroke="currentColor" stroke-width="1.25" />
    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06m7.78 7.78 1.06 1.06m0-9.9-1.06 1.06m-7.78 7.78-1.06 1.06" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
  {:else if name === "moon"}
    <path d="M13.75 10.15A6 6 0 0 1 5.85 2.25a6 6 0 1 0 7.9 7.9Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
  {:else if name === "arrow-up-right"}
    <path d="M4 12 12 4m0 0H6m6 0v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === "arrow-left"}
    <path d="M13 8H3m4-4L3 8l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  {:else}
    <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  {/if}
</svg>
