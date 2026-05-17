---
version: alpha
name: Linearis Professional
description: Kanai's premium board workspace design system for strategic delivery.
colors:
  primary: "#003d9b"
  primary-container: "#0052cc"
  primary-fixed: "#dae2ff"
  secondary: "#4f5f7b"
  secondary-container: "#cdddff"
  tertiary: "#a33500"
  neutral: "#f8f9fb"
  surface: "#f8f9fb"
  surface-bright: "#f8f9fb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f3f4f6"
  surface-container: "#edeef0"
  surface-container-high: "#e7e8ea"
  surface-container-highest: "#e1e2e4"
  outline: "#737685"
  outline-variant: "#c3c6d6"
  on-primary: "#ffffff"
  on-primary-fixed: "#001848"
  on-secondary-container: "#51617e"
  on-surface: "#191c1e"
  on-surface-variant: "#434654"
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Manrope
    fontSize: 38px
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.16em
  meta-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0em
rounded:
  sm: 7px
  md: 16px
  lg: 20px
  xl: 24px
  shell: 28px
  page: 32px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 40px
  page-gutter: 32px
  page-max: 1180px
components:
  app-background:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
  page-background:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
  workspace-sidebar:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    padding: 24px
  surface-raised:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
  surface-pressed:
    backgroundColor: "{colors.surface-container-highest}"
    textColor: "{colors.on-surface}"
  subtle-divider:
    backgroundColor: "{colors.outline-variant}"
    height: 1px
  metadata-muted:
    textColor: "{colors.outline}"
    typography: "{typography.label-sm}"
  kicker-label:
    textColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
  button-tonal:
    backgroundColor: "{colors.primary-fixed}"
    textColor: "{colors.on-primary-fixed}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
  icon-button-md:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    height: 44px
    width: 44px
  icon-button-sm:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    height: 40px
    width: 40px
  island-shell:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.shell}"
    padding: 24px
  board-column:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.xl}"
    padding: 16px
  board-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 16px
  board-card-hover:
    backgroundColor: "{colors.surface-bright}"
    textColor: "{colors.on-surface}"
  navigation-item:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
  navigation-item-active:
    backgroundColor: "{colors.primary-fixed}"
    textColor: "{colors.on-primary-fixed}"
  chip-primary:
    backgroundColor: "{colors.primary-fixed}"
    textColor: "{colors.on-primary-fixed}"
    typography: "{typography.meta-xs}"
    rounded: "{rounded.full}"
    padding: 8px
  chip-secondary:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.meta-xs}"
    rounded: "{rounded.full}"
    padding: 8px
  chip-urgent:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.surface-container-lowest}"
    typography: "{typography.meta-xs}"
    rounded: "{rounded.full}"
    padding: 8px
---

## Overview

Kanai uses the `Linearis Professional` design system for a premium strategic board workspace. The interface should feel executive, calm, and highly organized: soft off-white surfaces, blue leadership accents, generous rounded containment, and editorial display typography over hard separators.

The existing app combines Material-like semantic color names with a lighter "island" visual language. Keep new UI aligned with the board-first workspace: layered panels, compact metadata, pill-shaped controls, and restrained motion.

## Colors

The palette is a cool professional system built from deep blue, slate neutrals, and warm urgency accents.

- **Primary (`#003d9b`) and primary container (`#0052cc`):** Use for the most important action on a screen, active brand moments, and blue gradients. Existing primary buttons use a `135deg` gradient between these two colors.
- **Primary fixed (`#dae2ff`):** Use for selected navigation, search affordances, primary chips, and compact metadata that should read as active without becoming a full CTA.
- **Secondary (`#4f5f7b`) and secondary container (`#cdddff`):** Use for workspace labels, soft supporting chips, and subdued brand emphasis.
- **Tertiary (`#a33500`):** Use sparingly for urgent tags, error messages, logout hover states, and authentication warnings.
- **Surface neutrals (`#f8f9fb` through `#ffffff`):** Build tonal depth with layered surface containers instead of high-contrast borders.
- **Text (`#191c1e`, `#434654`) and outlines (`#737685`, `#c3c6d6`):** Use `on-surface` for primary copy, `on-surface-variant` for metadata and inactive controls, and outlines only where tonal separation is not enough.

Use translucent white overlays and `color-mix()` only as implementation details for glass panels and subtle states. The token source of truth remains the hex values in front matter.

## Typography

Typography is split between `Manrope` display text and `Inter` interface text.

- **Display and headlines:** Use `Manrope` with tight tracking for page titles, product naming, and prominent marketing/auth copy. This creates the editorial, premium tone seen in the board and login surfaces.
- **Body:** Use `Inter` at 14px to 18px with relaxed line heights for readable operational content.
- **Labels and metadata:** Use `Inter` with medium or semibold weights. Uppercase kicker labels use wide tracking (`0.16em`) and should stay small, calm, and infrequent.

Avoid adding additional font families. The app imports only `Inter` and `Manrope` in `src/styles.css`.

## Layout

Kanai layouts use generous responsive gutters and contained islands.

- Use `.page-wrap` behavior for marketing/auth content: max width `1180px`, centered, with a 1rem side inset on small screens.
- Workspace pages fill the viewport and shift from stacked mobile sections to sidebar plus board canvas at large breakpoints.
- Preserve the board rhythm: 16px card padding, 24px column radius, 24px grid gaps, and 32px page-scale spacing.
- Prefer grouped controls in rounded pills rather than separated rectangular toolbars.
- Keep density moderate: board cards can be compact, but page headers and shell panels need breathing room.

## Elevation & Depth

Depth is created with tonal layers, translucent white panels, blur, and soft shadows.

- Use glass panels for major shells: semi-transparent white, `backdrop-blur`, an inset white glint, and low-opacity shadows around `rgba(25,28,30,0.04)` to `rgba(25,28,30,0.08)`.
- Use hover elevation sparingly: board cards and primary CTAs may translate up by `2px` to communicate affordance.
- Backgrounds may include broad radial blue highlights and the subtle 32px grid texture already present in `body::after`.
- Avoid heavy drop shadows, dark overlays, or strong borders that would break the light, executive workspace tone.

## Shapes

The shape language is soft and pill-forward.

- Use full-radius pills for buttons, search bars, navigation items, avatars, icon buttons, and chips.
- Use 16px radius for board cards, 20px to 24px for contained content cards, 28px for major island shells, and 32px for page-level board containers.
- Keep code blocks and small inline code tighter, matching the existing 7px radius.
- Do not mix sharp rectangular controls into the workspace unless they are inherited browser primitives or dense code/documentation content.

## Components

- **Primary buttons:** Use a blue `primary` to `primary-container` gradient, white text, 12px vertical padding, pill radius, and the existing soft blue shadow. Use for sign-in, invite, and open-board actions.
- **Secondary buttons and links:** Use `surface-container` or `surface-container-low` backgrounds with `on-surface` text. Keep them pill-shaped and visually quieter than primary actions.
- **Icon buttons:** Use 40px or 44px square pills with centered Lucide icons. Default to `surface-container-lowest` with `on-surface-variant`; reserve active states for `primary-fixed`.
- **Island shells:** Use translucent white, blur, large radius, and soft shadow for login hero panels, about content, workspace header, and sidebar containers.
- **Board columns:** Use `surface-container`, 24px radius, 16px padding, and a subtle shadow. Column headings should be small semibold labels with counts in outline gray.
- **Board cards:** Use white cards with 16px radius and 16px padding. Include compact tags and metadata chips; hover may lift and increase shadow slightly.
- **Navigation:** Use text-first nav links in the global header and pill nav items in the workspace sidebar. Active workspace nav uses `primary-fixed` and `on-primary-fixed`.
- **Chips and tags:** Use primary fixed for active/primary metadata, secondary container for neutral supporting metadata, and softened tertiary for urgent states. Keep chip text at 11px to 12px semibold.
- **Auth/info cards:** Use `surface-container` blocks inside larger shells with small uppercase labels and body text. Error panels use tertiary color with a lightly mixed background.

## Do's and Don'ts

- Do preserve the light, premium board-workspace feel with tonal surfaces, glass shells, and restrained blue accents.
- Do use `Manrope` for display moments and `Inter` for all operational UI.
- Do keep interactive controls rounded-full unless the component is a card or shell.
- Do use `primary-fixed` for selected states and compact active metadata instead of overusing saturated blue.
- Do keep shadows low-opacity and soft; elevation should feel atmospheric, not material-heavy.
- Don't introduce new brand colors without replacing or extending the CSS custom properties in `src/styles.css`.
- Don't use pure black text, dense borders, or hard gray panels where existing `on-surface` and surface-container tokens work.
- Don't place multiple saturated primary CTAs in the same local group.
- Don't add sharp-cornered controls to the workspace UI.
- Don't use tertiary orange for general decoration; reserve it for urgency, errors, or destructive-adjacent states.
