# noter Design System

> This document is the source of truth for all visual and interaction decisions in the noter app.
> Every change to UI should be grounded in the principles here.
> Reference product: **Craft.do** (document-first, warm, non-techie friendly).

---

## 1. Core Philosophy

noter is a meeting companion for non-technical users. The interface should feel like a calm, focused workspace — not a developer dashboard. Users are busy professionals who want to find their notes and get out. 

**Three Pillars:**
1. **Calm Focus**: Generous whitespace, restrained color, nothing competes for attention. The interface should recede, making the content (notes/documents) the hero.
2. **Clear Hierarchy**: You always know what's most important on the screen. Progressive disclosure is key: hide complexity until it's needed.
3. **Warm Feedback**: Loading, success, and error states feel human, not technical. Motion and micro-interactions should feel smooth and organic.

---

## 2. Typography & Layout

Typography is the foundation of the workspace. It must feel premium and highly readable.

*   **Typeface**: Use modern, clean sans-serif (e.g., Inter, SF Pro) with excellent legibility.
*   **Scale**: Maintain strict hierarchy. 
    *   H1s should be prominent but elegant.
    *   Body text should be highly readable (typically 15px-16px).
    *   Small text (metadata, hints) should be legible but muted.
*   **Spacing & Line Height**: Generous line height for body text (e.g., `leading-relaxed`). Use substantial margins between sections to let the interface "breathe".
*   **Reading Width**: Confine main document content to a comfortable reading width (e.g., `max-w-prose` or ~65ch). Never stretch text across full wide screens.
*   **Layout**: Center the main workspace or use asymmetrical split panes (like a sidebar + large editor), common in modern note-taking apps.

---

## 3. Color & Theming

The color palette should be restrained. Avoid stark contrasts that cause eye strain.

*   **Foundation**: Use a monochromatic, low-contrast grayscale base for structural elements (backgrounds, borders). Use CSS custom properties built on `oklch`.
*   **Backgrounds**: The main workspace should feel like a blank sheet of paper (e.g., off-white in light mode, deep gray/black in dark mode). 
*   **Primary Brand Color**: Use sparingly. Reserve the primary color for primary actions, active states, or subtle accents. It should *not* dominate the screen.
*   **Semantic Colors**: 
    *   *Destructive*: Soft reds.
    *   *Success*: Soft greens.
    *   *Warning*: Soft ambers. 
    *   Do not use harsh, highly saturated semantic colors.
*   **Text Colors**: 
    *   Primary text: High contrast (e.g., `text-foreground`).
    *   Secondary text: Muted (e.g., `text-muted-foreground`) to establish hierarchy.

---

## 4. Component Anatomy

Components should feel tactile but not heavy.

*   **Elevation & Depth**:
    *   Use very subtle, diffused drop shadows to lift floating elements (popovers, modals, floating action bars) above the canvas.
    *   Avoid hard borders where shadows can do the job of separation.
*   **Radii (Corners)**: 
    *   Use generous border radii for containers, cards, and buttons (e.g., `rounded-lg`, `rounded-xl`, or `rounded-2xl`). This ensures a friendly, approachable aesthetic. Sharp corners feel technical and harsh.
*   **Glassmorphism**: 
    *   Use subtle background blur (`backdrop-blur`) for sticky headers, floating toolbars, or overlays. This creates a sense of depth without solid color blocks.

---

## 5. Interaction & Motion

Motion should guide the user, not distract them.

*   **Hover States**: Interactive elements must have clear hover states. Use subtle background color shifts (`hover:bg-accent/50`) rather than jarring color changes.
*   **Transitions**: All state changes (hover, active, focus) and appearance/disappearance of elements should be animated with smooth, quick transitions (e.g., `transition-all duration-200 ease-in-out`).
*   **Spring Animations**: Where appropriate (like modals opening, popovers appearing), use spring-like physics for a responsive, organic feel.
*   **Tooltips**: Use tooltips generously for icon-only buttons to aid discoverability, but ensure they appear quickly and un-intrusively.

---

## 6. Writing & Voice

The words on the screen are part of the design.

*   **Tone**: Human, warm, and clear. 
*   **Rule**: Never use technical jargon or internal system names in user-facing UI. 
*   **Empty States**: Empty states should be inviting, perhaps with soft illustrations, and always provide a clear "next action" path.
*   **Error Messages**: Apologetic and constructive. Tell the user *how* to fix the problem, not just that a system error occurred.

---

## Development Checklist for UI Changes

Before committing UI code, ask:
- [ ] Does this look like a calm document workspace, or a complex dashboard?
- [ ] Is the primary action obvious? Is secondary information muted?
- [ ] Are the corners appropriately rounded?
- [ ] Are transitions smooth when I hover or click?
- [ ] Did I use the `oklch` theme tokens instead of hardcoded hex colors?