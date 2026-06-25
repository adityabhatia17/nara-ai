# Nara — Pixel-Match to `Nara.dc.html` + Redesigned Text Note Capture

**Date:** 2026-06-25
**Status:** Approved (design owner delegated decisions to the engineer)
**Source of truth:** `Nara.dc.html` (design canvas, in user's `Downloads/Alma product vision (2)/`)

---

## 1. Goal

Two things, in one pass:

1. **Pixel-perfect re-match** of every screen and component in `apps/mobile` to the
   canonical `Nara.dc.html` design. The app was originally built from this file but has
   drifted; this pass restores exact fidelity (colors, type, spacing, radii, animations).
2. **Remove the voice/recording feature** and replace it with a properly product-designed
   **text note capture**: a frictionless "New note" entry on Home and a clean rich-text
   editor. The previous "Create a new note" bar + throwaway editor are discarded.

Non-goals: no backend/API changes, no rename (the product stays **"Nara"**), no new
screens beyond what `Nara.dc.html` defines.

---

## 2. Design tokens (authoritative — verbatim from `Nara.dc.html`)

| Token | Value |
|---|---|
| paper (all screen bg) | `#F3F3F1` |
| card / bubble bg | `#FFFFFF` |
| ink (primary text, buttons, hero) | `#18191B` |
| body text | `#26282B` |
| secondary text | `#6A6E73` |
| faint / meta | `#9A9DA1` |
| inactive (tab) | `#A8ABAE` |
| accent (cobalt) | `#2E50E6` |
| nudge/lockscreen bg | `#121316` |
| category — Work | `#2E50E6` |
| category — Person/Rohan | `#1B9C77` (tint `#D7F0E7`) |
| category — Family | `#D24E6E` |
| category — Books | `#C0892E` |
| card border | `rgba(20,22,24,0.07)` |
| interactive border | `rgba(20,22,24,0.12)` |

- **Typeface:** Schibsted Grotesk only (already loaded).
- **Category markers:** 7px **rounded squares** (radius 2px), never circles; label same color, uppercase, 0.4px tracking.
- **Radii:** card 14, person card 16, avatar 13–15, mark 6–7, pill 999.
- **Animations (Reanimated; all off under reduce-motion):** `pulseRing`, `breathe`,
  `fadeUp` (Reveal stagger), `dotBlink` (Ask typing), `pushDown` (Home nudge), `scrimIn`
  (Nudges). `wavePulse` is retired with the voice screens.

---

## 3. Screen-by-screen match targets

All paddings/sizes are taken from `Nara.dc.html` and must be reproduced exactly.

1. **Home** (`(tabs)/index.tsx`) — header: 25px ink mark (radius 7) w/ 8px cobalt dot +
   "Nara" (18/700/-0.4); right = timestamp (12.5/500/faint). Greeting 32/700/-0.9,
   mb 22. Conditional push-nudge card (white, radius 16, `pushDown`). **Capture hero**
   (see §4) in the record button's exact block. "Recent" eyebrow + "All notes" cobalt
   link; identical note cards. **Removed:** bottom quick-input row + dark "Create a new
   note" button.
2. **Reveal** (`reveal.tsx`) — "From what you said" eyebrow; cobalt-left-border italic
   quote; "Nara made N notes" (25/700/-0.6); N note cards stagger `fadeUp`
   (0.05/0.18/0.31/0.44s); dark "See them in your feed" CTA (`fadeUp` 0.6s). Entered
   after creating a note (in place of after-recording).
3. **Feed** (`(tabs)/notes/index.tsx`) — "Your notes" 32/700/-0.8; Time/Category/People
   filter pills (active = white bg + 0.12 border); eyebrow section headers; identical
   note cards (gap 10).
4. **Note Detail** (`(tabs)/notes/[id].tsx`) — back "‹ Notes"; category dot+label+time;
   body 23/600/-0.4; cobalt context box (`rgba(46,80,230,0.06)`); two-button row —
   **"Add to note"** (ink) + **"Edit"** (white, 0.12 border). Both open the editor.
5. **Ask Nara** (`(tabs)/ask.tsx`) — "Ask Nara" 32/700 + subtitle; thread (user right
   cobalt bubble `18/18/6/18`, Nara left white `16/16/16/5`); `dotBlink` 3-dot typing;
   suggestion chips; rounded input + 32px cobalt ↑ send.
6. **People** (`(tabs)/people/index.tsx`) — "People" 32/700 + subtitle; person cards
   (46px tint avatar radius 13, name 17/600, count meta, last-quote 13.5/400, chevron).
7. **Person Detail** (`(tabs)/people/[id].tsx`) — back "‹ People"; 54px avatar + name
   26/700 + mention meta; tinted summary box; vertical timeline (1.5px connector, 11px
   tone dots w/ 2.5px paper ring, date eyebrow + tone pill + text 15.5/500).
8. **Nudges** (`nudges-modal.tsx`) — dark `#121316` overlay (`scrimIn`); centered date +
   "9:41" (62/600/-1); frosted white nudge cards (radius 18, mark + "NARA" + time +
   text); pill "Close". Home visible behind.
9. **Tab bar** (`components/app-tabs.tsx`) — frosted `rgba(243,243,241,0.85)` blur,
   hairline top border `rgba(20,22,24,0.07)`; four glyph icons (Talk square+dot / Notes
   3-lines / Ask speech bubble / People two circles); active cobalt, inactive `#A8ABAE`.
   Labels 10.5/600.

**Deleted:** `listening.tsx`, `processing.tsx`, and all routing/handlers that reference
recording (`startRecording`/`stopRecording`, Zustand `recording` state, record-button &
waveform/pulse-on-listening components if unused elsewhere).

---

## 4. Redesigned capture — "New note" hero (Home)

**Product rationale:** Nara's differentiator is *no structure*. Other note apps front-load
friction (pick notebook, tap title, choose format). Nara goes intent → cursor in one tap.

- **Placement & rhythm:** occupies the exact block the record hero used (padding 52px top
  / 46px bottom, centered column) so Home stays pixel-faithful.
- **Affordance:** 118px ink (`#18191B`) circle, shadow `0 16px 34px rgba(24,25,27,0.3)`,
  containing a calm **pencil/compose glyph** in paper color (built from views, mirroring
  how the mic icon was drawn). Two cobalt `pulseRing` rings retained as a quiet "tap me"
  invitation (off under reduce-motion).
- **Copy:** "New note" (16/600/ink, mt 24) + "Just start writing. No structure needed."
  (13/400/faint, mt 5).
- **Press state:** opacity 0.85 (quiet, per Visual Rule #10).
- **Action:** `router.push('/editor')` → editor opens **autofocused**.

---

## 5. Redesigned editor (`editor.tsx`)

Keep the existing **TenTap (`@10play/tentap-editor`)** engine (already a dependency);
redesign the chrome and toolbar to product quality.

- **Frame:** full-screen, `#F3F3F1` paper, safe-area aware.
- **Header:** **Cancel** (left, faint→ink) · "New note" / "Edit note" (center 17/600) ·
  **Save** (right, cobalt 14/600, disabled+0.35 opacity until content). Discard
  confirmation on Cancel when dirty.
- **No title field.** The first line is the title (Apple/Bear behavior). Autofocus on
  mount; placeholder "Start writing…".
- **Body CSS:** Schibsted Grotesk; p 15/500/1.5; strong 700; em italic; ul/ol indent;
  h1 24 / h2 20 / h3 17 (700); empty-placeholder faint.
- **Toolbar (docked above keyboard, theme-matched):** curated item set —
  **Heading (H1/H2/H3), Bold, Italic, Bullet list, Numbered list, Checklist, Quote**.
  Active icon = cobalt (`#2E50E6`), active wrapper = `rgba(46,80,230,0.08)`, idle = body,
  disabled = faint. Large evenly-spaced targets; horizontal scroll if overflow, never clip.
- **Save:** new → `POST /entries` (drives the AI pipeline; may surface Reveal); edit →
  `PUT /notes/:id`. Brief "Saved" toast, then back. Invalidate `['notes']` (+ `['note',id]`).
- **Acceptance:** add/remove bullets, toggle numbered list, bold, three heading levels,
  checklist, quote, and plain paragraphs all work with no clipping, no lost focus, no
  stuck toolbar — verified on iOS.

---

## 6. Files touched

- `theme/tokens.ts` — audit/correct against §2.
- Screens: `(tabs)/index.tsx`, `(tabs)/notes/index.tsx`, `(tabs)/notes/[id].tsx`,
  `(tabs)/ask.tsx`, `(tabs)/people/index.tsx`, `(tabs)/people/[id].tsx`, `reveal.tsx`,
  `nudges-modal.tsx`, `editor.tsx`.
- Components: `note-card`, `app-tabs(.web)`, `nara-logo`, primary/secondary buttons,
  `chat-bubble`, `typing-dots`, `person-card`, `tone-pill`, `category-pill`,
  `filter-tabs`, `section-header`, `screen-title` — reconciled to one canonical version
  each (the repo currently has duplicate cased/kebab variants; collapse to the ones in use).
- Delete: `listening.tsx`, `processing.tsx`, unused `record-button`/waveform/pulse pieces.
- `store/app.ts` — drop recording state.

---

## 7. Risks / notes

- **Duplicate components:** repo has both `NoteCard.tsx` and `note-card.tsx` etc. Identify
  which each screen imports; match-and-fix the live one, remove dead twins (no behavior
  change to consumers).
- **TenTap toolbar theming** is constrained to the library's theme API + injected CSS;
  curated item list via `DEFAULT_TOOLBAR_ITEMS` filtered/reordered. Verify checklist/quote
  items exist in the installed version before committing to them; fall back gracefully.
- **Pixel fidelity** verified by side-by-side against `Nara.dc.html` screens, not by eye
  memory.
