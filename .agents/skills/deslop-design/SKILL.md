---
name: deslop-design
description: De-slop AI-generated UI designs and frontend code. Audits against the 18 telltale signs of slop first, then applies component-level refinement. Use when asked to de-slop, clean up vibecoded UI, audit AI design tropes, or replace AI UI clichés.
---

# De-Slop Design

Operational protocol to eliminate AI interface clichés ("slop") and apply human intentionality to generated UI code and designs.

Operate in two strict, non-overlapping sequential phases. Complete Phase 1 entirely before Phase 2 begins.

---

## Phase 1: The Slop Audit

Audit the target markup, styles, or design against the 18 telltale slop traits.

### The 18 Slop Traits

| Trait | Pattern | Target Replacement |
|---|---|---|
| 1. **Gradient + Glow Buttons** | Multi-stop gradients, saturated colored glows | Flat solid fill or clean crisp border |
| 2. **Emojis as Icons** | Standard emojis (🚀, ✅, 💜, ⚡) inside buttons/headers | Standardized vector SVG icons (Lucide, Heroicons) |
| 3. **Heavy Muddy Shadows** | High-blur, high-spread dark drop shadows | 1px border contrast (`border-slate-200`) or crisp `shadow-xs` |
| 4. **Boring Centered Layout** | Uniform center-aligned stacks without spatial rhythm | Asymmetric grid, left-aligned content, deliberate whitespace |
| 5. **Hyper-Dense Clutter** | Redundant helper labels ("tap here"), arbitrary stat badges | Whitespace breathing room, essential content only |
| 6. **Cards Wrapped in Cards** | Nested boxes around every row, item, or toggle | Flat list rows, divider lines, or whitespace grouping |
| 7. **Gratuitous Glassmorphism** | Frosted-glass blur panels without functional layering | Opaque surface with clean 1px border |
| 8. **Uniform Pill Rounding** | Every container and badge forced into `rounded-full` | Controlled `rounded-md` (4px–8px) matching visual scale |
| 9. **Arbitrary Spacing** | Ad-hoc paddings and margins | Fixed 4px/8px spacing scale |
| 10. **Generic Flat Type** | Uncurated system sans-serif with weak typographic contrast | Strict typographic scale, bold display vs readable body |
| 11. **Missing Hierarchy** | Equal weight/color across all actions and containers | Single dominant primary CTA; outline/ghost for secondary |
| 12. **Default Chart Colors** | Raw, uncurated Recharts/Chart.js default palettes | Curated 2–3 tone palette matching product brand |
| 13. **AI Purple / Amber** | Stereotypical electric indigo/purple or muted warm amber | Purposeful brand palette or crisp neutral-first theme |
| 14. **Floating Gradient Orbs** | Blurry pastel blobs floating behind cards | Clean solid background or purposeful subtle grain/grid |
| 15. **Sterile Vector Shapes** | Synthetic, mathematically flat geometry | Curated real photography, authentic SVGs, subtle texture |
| 16. **Tacked-on Side Borders** | Colored left accent stripes on every card and callout | Clean typography, subtle tint, or unified border |
| 17. **Distracting Float Keyframes**| Pointless continuous bouncing/floating animations | Static resting state with purposeful 150ms hover/active feedback |
| 18. **Neon-on-Dark Cliché** | Glowing cyan/magenta borders on dark charcoal panels | Refined dark mode: subtle zinc borders, restrained highlights |

### Audit Output Requirement

Emit a structured diagnostic table before writing any code or proposing solutions:

```markdown
### Slop Audit
| Element / Location | Slop Trait Identified | Specific Visual Issue |
|---|---|---|
| e.g. `<Button className="bg-gradient...">` | #1 Gradient + Glow | Saturated purple gradient with glowing blur shadow |
| e.g. `<div className="card inside card">` | #6 Nested Cards | Every metric row wrapped in separate border card |
```

### Phase 1 Completion Criterion
Audit complete when every component/section in the target UI is accounted for and cataloged in the audit table. Do not edit code or emit final UI markup during Phase 1.

---

## Phase 2: Surgical De-Slopification

Execute component-level refactoring using positive design targets.

### 1. De-densify
- Delete redundant helper text, explanatory microcopy that restates the obvious, and decorative stat chips.
- Flatten nested containers: replace inner cards with borderless rows separated by whitespace or a 1px subtle divider (`divide-slate-100`).
- Remove decorative background blur blobs and non-functional keyframe float animations.

### 2. Apply Concrete Design Tokens
State explicit target values rather than general aesthetic guidance:

- **Surfaces & Borders**:
  - Replace blur and muddy shadows with flat surfaces: `bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800`.
  - Use minimal elevation: `box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`.
- **Palette**:
  - Restrict to 1 primary accent tone, slate/zinc neutrals, and semantic alert tokens.
  - Specify exact hex tokens or standard design system classes (`text-zinc-900`, `bg-zinc-900 text-white`).
- **Typography**:
  - Enforce clear scale: `text-2xl font-bold tracking-tight` for titles, `text-sm text-zinc-500` for captions.
  - Pair distinct weights to make scanning instant.
- **Icons**:
  - Standardize on Lucide or Heroicons with consistent stroke widths (`strokeWidth={1.5}` or `2`).
  - Size icons strictly to text bounding boxes (`w-4 h-4` for button icons, `w-5 h-5` for navigation).
- **Hierarchy & Layout**:
  - Designate exactly one primary action per view (e.g. solid high-contrast button). Render secondary actions as outline or ghost.
  - Align elements along asymmetric grids with left-aligned typographic anchors.

### 3. Calibrate Style by Complexity
- **Digital / Structured (clean execution)**: Minimalist SaaS, dense tables, data-rich dashboards, developer tools. Focus on high-contrast borders, strict whitespace, and tabular monospace digits.
- **Organic / Expressive**: Editorial, marketing landing pages, consumer apps. Integrate curated photography or bespoke SVG artwork rather than algorithmic AI decorations.

---

## Completion Criteria & Verification

Verification is complete when the refactored code passes all checks:
- [ ] Every item from the Phase 1 Audit table has a concrete code fix.
- [ ] No gradient buttons with glow shadows.
- [ ] All emoji icons replaced with vector SVGs.
- [ ] Zero gratuitous nested cards or blurred backdrop containers.
- [ ] Exactly one primary CTA per view with secondary actions clearly demoted.
- [ ] Palette constrained to intentional hex tokens (no uncurated purple/neon glow).
- [ ] Spacing adheres strictly to a 4px/8px scale.
