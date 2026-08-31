# ADR 0001: Landscape Alliance Design System & Top-Nav SPA Redesign

- **Status**: Approved & Implemented
- **Date**: 2026-08-31
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

The previous acAIcia frontend used a sidebar-focused layout with a dark forestry green palette (`#0F291E`). To align with the updated **Landscape Alliance** brand guidelines and provide a modern, evidence-first web presentation, a comprehensive UI overhaul was commissioned based on the brand design system specification.

---

## 2. Decision Drivers

1. **Brand Identity**: Harmonize UI tokens with Landscape Alliance colors (`#f0f7f2` botanical canvas, `#0f1026` deep plum primary, `#0fa8a6` teal accent).
2. **Typography**: Adopt `DM Sans` for UI text, `Source Serif 4` for editorial headings, and `IBM Plex Mono` for code & citation metadata.
3. **Information Architecture**: Transition from a sidebar SPA layout to a scrollable top-nav layout with dedicated routes (`/`, `/assistant`, `/how-it-works`, `/about`, `/feedback`, `/admin`).
4. **User Experience**: Provide an intuitive hero interface with an embedded assistant card, live RAG status stage progression, and peer-reviewed literature source cards with clickable DOIs.

---

## 3. Considered Options

* **Option A**: Retain sidebar layout with palette token updates only.
* **Option B (Chosen)**: Full top-navigation SPA redesign with React Router 6, dedicated landing page, modular page shell (`AcaiciaPageShell`), and brand design system alignment.

---

## 4. Decision Outcome

**Option B** was selected and fully implemented:
* **Tailwind & CSS Tokens**: HSL custom CSS variables mapped in `src/styles/globals.css` and `tailwind.config.js`.
* **Brand Logo**: Created `Wordmark.tsx` wrapping `logo-new.svg` (Acacia tree mark with teal foliage accent).
* **Navigation Shell**: Created `Header.tsx`, `Footer.tsx`, and `Layout.tsx` without sidebar clutter.
* **Page Routing**: Implemented clean React Router 6 routes for all site sections.

---

## 5. Consequences

* **Positive**:
  * Professional, academic presentation matching Landscape Alliance brand standards.
  * Mobile-responsive top navigation bar with accessible drawer dropdown.
  * Standardized typography hierarchy (`DM Sans`, `Source Serif 4`, `IBM Plex Mono`).
* **Negative**:
  * Required refactoring of existing tabbed `InfoView` components into dedicated page routes.
