---
name: Botanist's Archive
colors:
  surface: "#fcf9f0"
  surface-dim: "#dddad1"
  surface-bright: "#fcf9f0"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f6f3ea"
  surface-container: "#f1eee5"
  surface-container-high: "#ebe8df"
  surface-container-highest: "#e5e2da"
  on-surface: "#1c1c17"
  on-surface-variant: "#4d4540"
  inverse-surface: "#31312b"
  inverse-on-surface: "#f4f1e8"
  outline: "#7e756f"
  outline-variant: "#cfc4bd"
  surface-tint: "#635d5a"
  primary: "#181512"
  on-primary: "#ffffff"
  primary-container: "#2d2926"
  on-primary-container: "#96908b"
  inverse-primary: "#cdc5c0"
  secondary: "#56642b"
  on-secondary: "#ffffff"
  secondary-container: "#d6e7a1"
  on-secondary-container: "#5a682f"
  tertiary: "#2f0608"
  on-tertiary: "#ffffff"
  tertiary-container: "#4a1a1b"
  on-tertiary-container: "#c47e7d"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#e9e1dc"
  primary-fixed-dim: "#cdc5c0"
  on-primary-fixed: "#1e1b18"
  on-primary-fixed-variant: "#4b4642"
  secondary-fixed: "#d9eaa3"
  secondary-fixed-dim: "#bdce89"
  on-secondary-fixed: "#161f00"
  on-secondary-fixed-variant: "#3e4c16"
  tertiary-fixed: "#ffdad8"
  tertiary-fixed-dim: "#ffb3b1"
  on-tertiary-fixed: "#380c0e"
  on-tertiary-fixed-variant: "#6e3636"
  background: "#fcf9f0"
  on-background: "#1c1c17"
  surface-variant: "#e5e2da"
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: "400"
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: "400"
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 28px
    fontWeight: "400"
    lineHeight: 36px
  body-lg:
    fontFamily: Source Serif 4
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
  body-md:
    fontFamily: Source Serif 4
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  annotation-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: "500"
    lineHeight: 12px
    letterSpacing: 0.1em
spacing:
  unit: 4px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 12px
  stack-md: 32px
  stack-lg: 64px
---

## Brand & Style

This design system is inspired by the meticulous world of 18th-century botanical
illustrations and scientific field journals. The aesthetic is defined by a sense
of quiet discovery, academic rigor, and natural elegance. It targets an audience
that appreciates archival quality, intentionality, and a focus on content over
artifice.

The visual style is a fusion of **Minimalism** and **Editorial Design**. It
prioritizes vast, "pollen-rich" whitespace to allow imagery and data to breathe.
Surfaces are treated like heavy, unbleached paper, while interactive elements
carry the weight and precision of a fine-tipped ink pen. The emotional response
is one of calm, intellectual curiosity, and timeless sophistication.

## Colors

The palette is rooted in organic pigments and historical archives.

- **Pollen Paper (#F5F2E9):** The foundational surface color. It is warm and
  matte, reducing eye strain and providing a textured, "lived-in" backdrop.
- **Faded Ink (#2D2926):** Used for all primary text and fine borders. It avoids
  the harshness of pure black, mimicking aged gall ink.
- **Sage Green (#8A9A5B):** The primary functional accent, used for success
  states and secondary navigation, reminiscent of dried leaves.
- **Dusty Rose (#B57170):** A sophisticated highlight color for interactive
  states and specific botanical categorizations.
- **Harvest Ochre (#D4A017):** A tertiary accent for warning states or featured
  annotations, drawn from floral stamens.

## Typography

The typography contrasts the romanticism of the 18th-century press with the
precision of modern data entry.

- **Headings:** Use **Libre Caslon Text** for its high-contrast strokes and
  classic serif terminals. It should be used sparingly to denote major sections
  or specimen names.
- **Body:** **Source Serif 4** provides exceptional readability for long-form
  descriptions, maintaining a scholarly tone while ensuring digital clarity.
- **Annotations:** **JetBrains Mono** is used for metadata, "field notes," and
  technical specs. Its monospaced nature evokes the feeling of a typewriter or a
  carefully hand-scribed ledger, providing a functional contrast to the serifs.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop to mimic the centered
composition of a printed plate.

- **Desktop:** A centered 12-column grid with a max-width of 1280px. Margins are
  generous (64px) to emphasize the paper-like canvas.
- **Mobile:** A 4-column grid with 20px margins. Content flows vertically with a
  focus on single-column "study cards."
- **Rhythm:** Spacing follows a 4px base unit, but increments are large
  (stack-md/lg) to prevent the UI from feeling cluttered. Elements are often
  grouped with asymmetrical whitespace to suggest a hand-placed archival layout.

## Elevation & Depth

In this design system, depth is achieved through **Tonal Layering** and **Fine
Outlines** rather than shadows.

- **No Shadows:** Shadows are strictly avoided to maintain the flat, 2D
  aesthetic of a botanical plate.
- **Ink Borders:** Hierarchy is defined by 0.5px or 1px solid lines in "Faded
  Ink" at low opacities (15–30%).
- **Paper Tiers:** Interactive surfaces (like open menus) use a slightly lighter
  version of the background or a very subtle 1px border to separate themselves
  from the base layer.
- **Focus:** Selection is indicated by a "Sage Green" underline or a subtle
  background tint, never by lifting the element off the page.

## Shapes

The shape language is strictly **Sharp (0)**.

To mirror the edges of cut paper and formal scientific documents, all corners
are 90 degrees. This applies to buttons, input fields, cards, and images. The
only exception is the use of circular "stamp" icons or botanical illustrations
themselves, which provide organic contrast to the rigid, architectural frame of
the UI.

## Components

Consistent styling across components reinforces the archival narrative:

- **Buttons:** Rectangular with a 1px border. The primary button has a subtle
  "Sage Green" fill with "Faded Ink" text. Secondary buttons are transparent
  with a bottom-only border.
- **Slim Cards:** Used for specimen listings. These feature a hairline border,
  minimal padding, and "JetBrains Mono" metadata at the top-right corner.
- **Input Fields:** A single bottom border (like a signature line) rather than a
  full box. Labels are small, uppercase monospaced text.
- **Chips/Tags:** Minimalist boxes with a 0.5px border. They resemble small
  taxonomical labels pinned to a specimen.
- **Search Bar:** A simple, full-width line with a small "search" label in mono
  font. No icons or heavy containers.
- **Navigation:** Top-aligned text links in "Source Serif 4," separated by a
  vertical pipe (|) to evoke the feel of a table of contents.
