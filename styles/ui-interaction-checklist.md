# Frontend Interaction Checklist

Single source of truth for interactive UI quality across landing and dashboard surfaces.

## State Contract
- Every interactive control must define behavior for: `default`, `hover`, `focus-visible`, `active`, `disabled`, and `loading` (when applicable).
- `focus-visible` must be clearly visible in light mode (dark mode deferred to post-v1).
- `disabled` state must include both visual feedback and blocked interaction.

## Accessibility Contract
- Every interactive control must be keyboard reachable.
- Non-submit buttons must use `type="button"`.
- Stateful controls must expose ARIA state (`aria-expanded`, `aria-pressed`, `aria-disabled`, etc.) when applicable.
- Dialog-like mobile overlays must use a focus trap and return focus on close.

## Contrast Contract
- Small text and icon-only controls must meet WCAG AA contrast.
- Prefer semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-secondary`, etc.) over ad-hoc accent text on tiny labels.

## QA Matrix
- Viewports: `390x844`, `768x1024`, `1440x900`.
- Themes: light only (dark mode deferred to post-v1).
- Input modes: mouse, keyboard-only, touch.
- Validate all interactive controls on:
  - Landing `/`
  - Dashboard list `/dashboard`
  - New meeting `/dashboard/new`
  - Meeting detail `/dashboard/[id]`
  - Dashboard loading/error surfaces
