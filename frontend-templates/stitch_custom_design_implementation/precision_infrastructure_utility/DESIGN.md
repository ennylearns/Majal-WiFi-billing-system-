---
name: Precision Infrastructure Utility
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#424654'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737785'
  outline-variant: '#c3c6d6'
  surface-tint: '#0957ce'
  primary: '#0045a9'
  on-primary: '#ffffff'
  primary-container: '#175cd3'
  on-primary-container: '#d7e0ff'
  inverse-primary: '#b1c5ff'
  secondary: '#525f73'
  on-secondary: '#ffffff'
  secondary-container: '#d6e3fb'
  on-secondary-container: '#586579'
  tertiary: '#005823'
  on-tertiary: '#ffffff'
  tertiary-container: '#007330'
  on-tertiary-container: '#7cf995'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b1c5ff'
  on-primary-fixed: '#001847'
  on-primary-fixed-variant: '#0040a0'
  secondary-fixed: '#d6e3fb'
  secondary-fixed-dim: '#bac7de'
  on-secondary-fixed: '#0f1c2d'
  on-secondary-fixed-variant: '#3b485a'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  metric-display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
  metric-display-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
  micro-label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a high-craft, engineering-grade digital environment built for telecommunications and network operations. It is characterized by absolute functional clarity, structural discipline, and purposeful economy of form. The aesthetic intentionally discards decorative trends—refusing amorphous gradients, unnecessary glassmorphism, floating multi-color badge clutter, and arbitrary glows—in favor of crisp architectural precision, structured tabular density, and unambiguous status communication.

The target audience comprises enterprise network architects, operational engineers, and enterprise customers requiring instantaneous insight into bandwidth consumption, packet transmission, latency status, and billing ledger infrastructure. The interface evokes unyielding reliability, clinical accuracy, and quiet technical authority. Every line, spacer, and container serves a legible operational function.

## Colors

The palette employs a clean, calibrated hierarchy centered around high-contrast legibility and purposeful signaling:

- **Primary Brand & Interactive:** Deep Precision Cobalt (`#175CD3`) establishes active interactive weight, transitioning strictly to `#154FB3` on hover and `#0E3F96` on active pressed states. Focus rings utilize `#175CD3` at 15% opacity with a 2px offset.
- **Base Neutral & Type:** Deep Slate Ink (`#0F172A`) commands high-contrast primary typographic elements, tabular metrics, and primary navigational paths.
- **Secondary Typographic & Metadata:** Charcoal Slate (`#475467`) renders supporting telemetry labels, subheaders, and structural tabular headers.
- **Surfaces & Canvases:** The foundation layers a crisp porcelain off-white canvas (`#F8FAFC`) with pure clinical white (`#FFFFFF`) elevated container cards and data tables. Secondary container fills leverage subtle slate tinting (`#F1F5F9`).
- **Structural Dividers:** Hairline borders consistently use crisp subtle slate (`#E2E8F0`), creating tactile grid divisions without heavy visual noise. Hover border states step up to `#CBD5E1`.
- **Functional Semantics:** 
  - **Success / Healthy:** Precision Emerald (`#16A34A`) with muted background tint (`#F0FDF4`) and subtle border (`#BBF7D0`) for operational uplinks and healthy interface stats.
  - **Error / Danger:** Precision Crimson (`#DC2626`) with restrained background tint (`#FEF2F2`) and defined border (`#FECACA`) for dropped connections, latency spikes, and destructive events.
  - **Warning / Degraded:** Amber Ochre (`#D97706`) with light fill (`#FFFBEB`) for degraded bandwidth or packet anomalies.

## Typography

The typography strategy leverages `Inter` across all structural tiers to deliver industrial legibility and uncompromising tabular alignment.

- **Tabular Figures & Metrics:** All numeric readouts, IP routing tables, packet rates, timestamps, and financial currencies enforce OpenType tabular figures (`font-feature-settings: "tnum" 1, "cv05" 1`).
- **Micro-Labels & Technical Meta:** Micro-labels utilize uppercase rendering (`text-transform: uppercase`) paired with explicit `+0.06em` tracking to prevent ink-bleed and maintain distinct hierarchical separation against regular body copy.
- **Rhythm & Flow:** Paragraph text strictly avoids justified alignment and caps max readable line lengths at 68 characters. Line-heights are anchored tightly to functional 4px increments to maintain visual vertical grounding.

## Layout & Spacing

A disciplined 8px dimensional framework governs all element bounds and structural divisions, utilizing 4px exclusively for micro-alignments, icon gaps, and dense table row buffers:

- **Desktop (1280px+):** 12-column layout, max-width 1440px centered, with 24px (`1.5rem`) gutters and 32px (`2rem`) outer boundaries. Multi-tier dashboards place fixed 256px utility sidebars alongside dynamic analytical panes.
- **Tablet (768px - 1279px):** 8-column layout with 16px (`1rem`) gutters and 24px (`1.5rem`) outer canvas margins. Multi-metric dashboards collapse secondary analytical blocks into two-column structural stacks.
- **Mobile (<768px):** 4-column layout with 16px (`1rem`) gutters and 16px (`1rem`) outer margins. Tables enable horizontal scrolling on fixed headers with pinned identification columns rather than stacking, preserving raw operational readability.

## Elevation & Depth

Visual hierarchy rejects exaggerated drop shadows and blurry light fields. Structural depth is established strictly through crisp hairline containment (`1px solid #E2E8F0`) augmented by quiet, natural ambient diffusion:

- **Base Level (Canvas):** Ground plane (`#F8FAFC`), no elevation or border.
- **Card / Surface Level (Default):** Pure white background (`#FFFFFF`), bounded by `1px solid #E2E8F0`, underpinned by a restrained baseline shadow: `0px 1px 3px 0px rgba(15, 23, 42, 0.04), 0px 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Interactive / Hover Surface:** Elevated card containers receive a subtle shift on pointer hover: border transitions to `#CBD5E1` with elevation adjusting to `0px 4px 6px -1px rgba(15, 23, 42, 0.06), 0px 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Overlay Level (Modals, Contextual Dropdowns):** Bounded by `1px solid #E2E8F0`, underpinned by an authoritative operational shadow: `0px 10px 15px -3px rgba(15, 23, 42, 0.08), 0px 4px 6px -4px rgba(15, 23, 42, 0.04)`. Backdrop scrims employ `#0F172A` at a flat 40% opacity without synthetic backdrop blurs.

## Shapes

The design uses a clean, architectural geometry that enforces order without appearing sterile or clinical:

- **Card Containers & Modules:** Fixed 12px outer radius (`rounded-lg`), establishing clear sectional containment for analytical widgets, routing lists, and account ledgers.
- **Interactive Controls (Buttons, Form Inputs):** Fixed 8px radius (`rounded-md`), providing tactile balance and precise edge definition across action zones.
- **Status Badges & Micro Tags:** Fixed 6px radius (`rounded-sm`), avoiding generic stadium pills in favor of sharp, compact technical tags.
- **Internal Nested Elements:** Inner elements seated inside padded 12px cards maintain a calibrated nested radius of 8px to guarantee concentric optical borders.

## Components

### Buttons
- **Primary:** Solid `#175CD3` background, `#FFFFFF` text, 8px radius, height 40px (padding 0 16px). Hover state `#154FB3`; active `#0E3F96`. Disabled state `#F1F5F9` background with `#94A3B8` text.
- **Secondary / Outline:** Background `#FFFFFF`, hairline border `1px solid #E2E8F0`, `#0F172A` label. Hover state `#F8FAFC` background with `#CBD5E1` border.
- **Destructive:** Solid `#DC2626` background, `#FFFFFF` text. Hover state `#B91C1C`.

### Badges & Status Indicators
- Structured with 6px border-radius, height 22px, padding 2px 8px, typography `micro-label`.
- Badges pair a soft solid background with a 1px perimeter border and precise text:
  - **Online / Active:** Background `#F0FDF4`, border `1px solid #BBF7D0`, text `#16A34A`. Includes a leading 6px circular dot (`#16A34A`).
  - **Degraded / High Latency:** Background `#FFFBEB`, border `1px solid #FDE68A`, text `#B45309`.
  - **Offline / Incident:** Background `#FEF2F2`, border `1px solid #FECACA`, text `#DC2626`.
  - **Neutral / Idle:** Background `#F1F5F9`, border `1px solid #E2E8F0`, text `#475467`.

### Form Inputs
- Background `#FFFFFF`, 1px solid `#E2E8F0`, 8px radius, height 40px, padding 0 12px, font size 14px (`body-md`), text `#0F172A`.
- Placeholder text in `#94A3B8`.
- Focus state switches border strictly to `#175CD3` with a crisp outer outline of `0 0 0 3px rgba(23, 92, 211, 0.12)`.
- Error state: border `#DC2626`, focus ring `0 0 0 3px rgba(220, 38, 38, 0.12)`.

### Checkboxes & Radios
- Size 16px by 16px. Border `1px solid #CBD5E1`, background `#FFFFFF`. Checkboxes use 4px radius; radios use 50% circle.
- Checked state: background `#175CD3`, border `#175CD3` containing crisp white 1.5px checkmark/indicator.

### Cards & Telemetry Modules
- Base card: Background `#FFFFFF`, 12px radius, `1px solid #E2E8F0`, default ambient elevation shadow.
- Header block: Border-bottom `1px solid #F1F5F9`, height 56px, flex vertical center with metadata micro-labels right-aligned.
- Metric cards display large tabular figures (`metric-display`) flanked by unit notation (`body-sm`, `#475467`) and directional status delta indicators.

### Tables & Data Grids
- Hairline divider rows with alternating hover state (`#F8FAFC`).
- Header row: background `#F8FAFC`, border-bottom `1px solid #E2E8F0`, uppercase tracking (`micro-label`), text `#475467`, height 40px.
- Table body cell: height 48px, padding 0 16px, border-bottom `1px solid #F1F5F9`, font size 14px tabular numbers for traffic/bandwidth/IPs.