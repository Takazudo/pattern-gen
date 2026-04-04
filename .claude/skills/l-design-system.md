# Design System

Project design system rules for the pattern-gen viewer app. Auto-invoked when working on UI components, CSS, styling, or layout in `packages/pattern-gen-viewer/`.

---
autoPickWhen:
  - writing CSS or modifying App.css
  - creating or editing React components in packages/pattern-gen-viewer/
  - adding UI elements, dialogs, modals, buttons, or form controls
  - working on layout, spacing, colors, or typography
  - creating shared/reusable components
  - updating the styleguide
---

## CSS Architecture: 3-Tier Token System

All styles live in `packages/pattern-gen-viewer/src/App.css`. The file uses Tailwind CSS v4 Approach B (no default theme).

### Tier 1: Palette (`:root`)

Raw oklch color values. **Never reference directly** in component styles.

```css
:root {
  --palette-neutral-950: oklch(14% 0 0);
  --palette-glass-bg: oklch(0% 0 0 / 75%);
  --palette-glass-light-12: oklch(100% 0 0 / 12%);
  /* ... */
}
```

### Tier 2: Theme (`@theme`)

Semantic tokens that map palette to roles. These become Tailwind utilities automatically.

```css
@theme {
  --color-bg, --color-fg, --color-fg-muted, --color-fg-subtle, --color-fg-faint
  --color-accent, --color-surface-glass
  --color-control-bg, --color-control-bg-hover
  --color-border, --color-border-hover, --color-border-focus, --color-border-subtle, --color-border-faint
  --spacing-sp-{3xs,2xs,xs,sm,md,lg,xl,2xl}
  --radius-{sm,md,lg}
  --font-size-{2xs,xs,sm,base,lg}
}
```

### Tier 3: Component Styles

CSS classes that use theme tokens via `var()`. One-off values (specific widths, blur amounts) are literals with `/* ARBITRARY */` comments.

## Token Reference

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `sp-3xs` | 3px | Micro gaps |
| `sp-2xs` | 4px | Inline padding, compact gaps |
| `sp-xs` | 6px | Input padding, small gaps |
| `sp-sm` | 8px | Section padding, medium gaps |
| `sp-md` | 12px | Group spacing, panel padding |
| `sp-lg` | 16px | Panel outer margin |
| `sp-xl` | 20px | Section spacing, panel inner padding |
| `sp-2xl` | 28px | Major section dividers |

### Colors

| Token | Role |
|-------|------|
| `--color-bg` | Page background (dark) |
| `--color-fg` | Primary text |
| `--color-fg-muted` | Secondary text |
| `--color-fg-subtle` | Tertiary text (placeholders) |
| `--color-fg-faint` | De-emphasized text |
| `--color-accent` | Accent elements |
| `--color-surface-glass` | Glass panel backgrounds |
| `--color-control-bg` | Form element backgrounds |
| `--color-control-bg-hover` | Form element hover |
| `--color-border` | Default borders |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4px | Small elements (swatches, tags) |
| `md` | 6px | Controls (inputs, buttons) |
| `lg` | 12px | Panels, modals |

### Font Size

| Token | Value | Usage |
|-------|-------|-------|
| `2xs` | 10px | Micro labels |
| `xs` | 11px | Section headers |
| `sm` | 12px | Body text, buttons |
| `base` | 13px | Input text, modal descriptions |
| `lg` | 18px | Panel headings |

## Rules

### 1. Always use theme tokens

Never use raw pixel values for spacing, colors, radius, or font sizes. Use the tokens:

```css
/* CORRECT */
padding: var(--spacing-sp-md);
color: var(--color-fg-muted);
border-radius: var(--radius-md);

/* WRONG */
padding: 12px;
color: #aaa;
border-radius: 6px;
```

Exception: one-off values that don't fit any token (specific widths, blur amounts) are allowed as literals. Mark them with `/* ARBITRARY */`.

### 2. Glass morphism pattern

All floating panels, overlays, and dropdowns use this pattern:

```css
background: var(--color-surface-glass);
backdrop-filter: blur(12px);
border-radius: var(--radius-lg);
border: 1px solid var(--color-border);
```

### 3. Modal/overlay pattern

```css
/* Overlay */
.my-overlay {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 60%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

/* Modal card */
.my-modal {
  background: oklch(15% 0 0);
  border: 1px solid oklch(100% 0 0 / 15%);
  border-radius: var(--radius-lg);
  padding: 24px;
  max-width: 520px;
  width: 90%;
  box-shadow: 0 16px 48px oklch(0% 0 0 / 50%);
}
```

### 4. Button patterns

```css
/* Standard button */
.btn {
  background: var(--color-control-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-fg-muted);
  padding: var(--spacing-sp-xs) var(--spacing-sp-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--default-transition-duration),
              border-color var(--default-transition-duration);
}

.btn:hover {
  background: var(--color-control-bg-hover);
  border-color: var(--color-border-hover);
  color: var(--color-fg);
}
```

For destructive actions, use red-toned oklch colors directly (no token needed for rare variants).

### 5. No external UI libraries

Do not add Radix UI, Headless UI, shadcn, or similar. Build UI components from scratch using the design tokens. The app's glass-morphism aesthetic requires custom styling that library components can't provide.

### 6. Shared components for reusable UI patterns

When implementing UI, check if a shared component already exists:

| Component | File | Usage |
|-----------|------|-------|
| `ConfirmDialog` | `confirm-dialog.tsx` | Confirmation modals with custom content |
| `CollapsibleSection` | `collapsible-section.tsx` | Expandable/collapsible panels |
| `CompositionMenu` | `composition-menu.tsx` | Dropdown menu pattern |
| `DiscardConfirmationDialog` | `discard-confirmation-dialog.tsx` | Discard/Keep/Cancel flow |

**Before creating new UI**, check if an existing component can be extended. If you need a new reusable pattern (e.g., a new type of dialog, dropdown, or form control), create it as a shared component in `src/components/` rather than inlining it.

### 7. All styles in App.css

Do not create CSS modules or component-specific CSS files (except for truly isolated sub-apps like the Composer). All styles go in `App.css` in the "Tier 3: Component styles" section.

### 8. Styleguide maintenance

When adding or modifying shared UI components:

1. Create or update a `*.stories.tsx` file alongside the component
2. Add stories showing key variants and states
3. Run `pnpm run styleguide:dev` to verify stories render correctly
4. The styleguide lives at `packages/styleguide/` and auto-discovers `*.stories.tsx` files

## Best Practices Reference

For advanced CSS patterns not covered here, invoke `/css-wisdom <topic>`. Key topics:

- **Layout**: flexbox, grid, centering, positioning, stacking context
- **Typography**: fluid sizing, font loading, text overflow
- **Colors**: oklch, color-mix, dark mode, three-tier color strategy
- **Spacing**: tight token strategy, gap vs margin
- **Responsive**: container queries, fluid design with clamp()
- **Interactive**: hover/focus states, transitions, scroll behavior
- **Architecture**: cascade layers, component-first strategy

The full topic index is available via `/css-wisdom`.
