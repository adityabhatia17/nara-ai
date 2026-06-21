# CLAUDE_FRONTEND.md — Frontend Agent Briefing

You are the **Frontend Engineer** for Nara. You build the entire React Native + Expo
app. You make **no architectural decisions** — stack and API are fixed. You execute
against this design system and `docs/API_CONTRACT.md`. **Phase 3 work** — start only
once the backend (Phases 1–2) exposes the contract. The contract is frozen; if you
need a change, the Architect updates API_CONTRACT.md + its changelog first.

---

## 1. What Nara is & why design matters
A voice-first personal memory app for Priya (24, busy, no patience for systems). The
app must feel warm, calm, literary — "somewhere you'd want to go," not software. Read
`nara-product-vision.md`. The magic moments the UI must nail: the **Reveal** (one
input → several notes cascading in), **Ask Nara** (feels like someone who read
everything), the **weekly letter**, and **nudges** (specific, never generic).

## 2. Stack (locked)
- **React Native + Expo** (managed). TypeScript.
- **Navigation:** Expo Router (file-based; React Navigation under the hood).
- **Server state:** TanStack Query (React Query) — caching, the recording-status
  poll, retries, optimistic updates.
- **Local/UI state:** Zustand (recording state, active filters, transient UI).
- **Fonts:** `expo-font` + `@expo-google-fonts/newsreader` and
  `@expo-google-fonts/hanken-grotesk`.
- **Animations:** `react-native-reanimated`. All 7 animations must be disabled when
  `prefers-reduced-motion` / Reduce Motion is on (use `AccessibilityInfo`).
- Lives in `apps/mobile`.

## 3. Design tokens (authoritative — build `theme/tokens.ts` from this)
```ts
export const colors = {
  bg:           '#F1E9DB',  // all screens except Listening & Nudges
  bgListening:  '#EBE1D0',
  bgNudges:     '#2E2A24',
  surface:      '#FBF6EC',  // cards
  accent:       '#BC6A47',  // terracotta brand
  category: {
    work:   { base: '#BE6E45', tint: '#ECDBCB' },
    people: { base: '#7E9270', tint: '#DCE3D2' },
    family: { base: '#B27079', tint: '#EBD7DA' },
    books:  { base: '#B5913F', tint: '#EBDFC2' },
  },
  text: {
    primary:   '#2E2A24',
    note:      '#3A352D',
    secondary: '#8A7E6B',
    muted:     '#A2967F',
    veryMuted: '#B2A691',
    faintest:  '#CFC4AF',
    darkSec:   '#6E6456',
  },
  border: {
    card:        'rgba(46,42,36,0.06)',  // 1px
    interactive: 'rgba(46,42,36,0.10)',
    tabTop:      'rgba(46,42,36,0.06)',  // 1px
  },
};
export const radius = {
  card: 16, personCard: 18, circle: 9999, actionBtn: 13, chip: 999,
  // chat bubbles: user 18/18/6/18, nara 18/18/18/6
};
export const fonts = {
  serif: 'Newsreader',       // VOICE: titles, note body, names, italic taglines
  sans:  'HankenGrotesk',    // STRUCTURE: labels, categories, timestamps, buttons, tabs
};
```
Category color is keyed by category **name** (case-insensitive). Backend may emit
categories beyond these four — assign new ones a deterministic color from an extended
palette; keep the four canonical mappings above fixed.

## 4. Typography rules
- **Newsreader (serif) = the voice.** Screen titles (34), note detail (24), person
  names (19), note cards (16), home tagline italic (17), processing italic (20),
  large clock weight 300 (52). Weights 300/400.
- **Hanken Grotesk (sans) = structure.** Primary buttons 15/600, filter tabs & body
  UI 13, category labels 12/600 (0.3px tracking), section headers 11.5/600 uppercase
  (1.2–1.4px tracking), tab labels 10.5/600. Weights 400/500/600/700.
- **Never swap the two.** (Visual Rule #2.)

## 5. The 7 animations (Reanimated; off on reduce-motion)
- `wavePulse`: scaleY 0.30→1→0.30, 38 bars, dur 0.8–1.4s, delay 0–0.56s (Listening).
- `fadeUp`: opacity+translateY(16→0), 0.5s ease, stagger 0.05/0.18/0.31/0.44/0.6s (Reveal).
- `pushDown`: opacity+translateY(-14→0), 0.5s ease (nudge card in).
- `pulseRing`: scale 0.92→1.55 + opacity→0, 2.8s ease-out, 2 rings 1.4s apart, infinite (record btn).
- `breathe`: scale 1↔1.07 + opacity 0.9↔1, 1.6s ease-in-out, infinite (Processing logo).
- `dotBlink`: opacity 0.22→1→0.22, 1.2s, 3 dots delay 0/0.2/0.4s (Ask typing).
- `scrimIn`: opacity 0→1 (overlay backdrop).

## 6. Navigation structure (Expo Router)
- **Tab navigator** (frosted bar — blur + parchment w/ opacity, Visual Rule #7):
  - **Talk** → Home
  - **Notes** → Feed → Note Detail (stack)
  - **Ask** → Ask Nara
  - **People** → People → Person Detail (stack)
- **Full-screen routes (no tab bar):** Listening, Processing, Reveal.
- **Modal overlay (Home visible behind):** Nudges (Visual Rule #8).
- Deep links: nudge tap → relevant note/Home; weekly-letter push → letter screen.

## 7. State management shape
- **TanStack Query** for all server data. Query keys: `['notes', filters]`,
  `['note', id]`, `['entities', type]`, `['entity', id]`, `['categories']`,
  `['letters']`, `['letter', id]`, `['mood', range]`, `['nudges']`,
  `['entry-status', id]` (poll: `refetchInterval` ~1500ms until status terminal).
  Optimistic updates for note edit/append and loose-end dismiss.
- **Zustand** store: `recording` (idle|listening|processing + elapsed), active feed
  filter (time|category|person), transient UI flags. Nothing that belongs to the
  server lives here.

## 8. API client
- `lib/api.ts`: base URL from env, attaches `Authorization: Bearer <supabase jwt>`
  from the Supabase session, parses the standard error shape, throws typed errors.
- Auth via `@supabase/supabase-js` (magic link). Session drives the JWT.
- Loading states map to Query states; the recording flow drives Listening →
  Processing → poll → Reveal off `['entry-status', id]`.
- Import response types from `packages/shared` — do not redefine note/entity shapes.

## 9. The 10 screens
1. **Home** — header (logo+wordmark), greeting (Newsreader 31) + date (HG 13.5 muted),
   conditional nudge card (pushDown), 120px terracotta record button + 2 pulseRing
   rings (always most prominent — Rule #5), italic tagline, "Recent" + 2 latest notes.
   Tab: Talk.
2. **Listening** — bg #EBE1D0, "Nara is listening", 38 wavePulse bars, timer
   (Newsreader 52/300), 80px white stop btn w/ terracotta square. No tab bar.
3. **Processing** — bg #F1E9DB, 78px terracotta breathe logo, "Sorting what you said…"
   (italic Newsreader 20), auto-advance ~1.8s. No tab bar.
4. **Reveal** — "From what you said" header, verbatim quote block (left terracotta
   border), "Nara made [N] notes." , N note cards staggered fadeUp, dark full-width
   "See them in your feed" CTA. No tab bar.
5. **Feed** — "Your notes" (Newsreader 32), 3 filter pills (Time/Category/People),
   grouped note cards w/ section headers, 3 views. Tab: Notes.
6. **Note Detail** — "‹ Notes" back, category dot+label+timestamp, full text
   (Newsreader 24), Nara context box (light terracotta tint, italic), "Add a voice
   note" (dark) + "Type" (light). Tab: Notes.
7. **Ask Nara** — heading+subtitle, chat thread (user bubbles right terracotta, Nara
   left cream), dotBlink typing, suggestion chips (unused only), input + send. Tab: Ask.
8. **People** — heading+subtitle, person cards (initial+tint avatar, name, mention
   count, last quote, chevron). Tab: People.
9. **Person Detail** — "‹ People" back, large avatar + name + mention stats, timeline
   (date label + tone pill + note text) with thin connecting vertical line. Tab: People.
10. **Nudges** — dark overlay #2E2A24 modal, "From Nara" heading+subtitle, dark-glass
    nudge cards (avatar+text+timestamp), "Close" pill. No tab bar; Home behind.

## 10. The 10 governing visual rules
1. Bg always #F1E9DB except Listening (#EBE1D0) and Nudges (#2E2A24).
2. Newsreader for voice; Hanken Grotesk for structure. Never swap.
3. All note cards use one identical component everywhere.
4. All animations off when reduce-motion is active.
5. Record button is always the most prominent element on Home.
6. Category color applied consistently — same color for dot and label text.
7. Tab bar background frosted (blur + parchment opacity).
8. Nudges is an overlay, not a screen — Home exists behind it.
9. Person names, category names, note content are never truncated.
10. Press states are quiet (opacity 0.85 or subtle scale) — nothing bouncy.

## 11. Component inventory (build these reusables)
`NoteCard` (the one card, used in Feed/Reveal/Home/Person timeline), `CategoryPill`,
`FilterTabs`, `RecordButton` (+ pulseRing), `Waveform` (38 bars), `BreathingLogo`,
`PersonCard`, `ToneePill`, `ChatBubble` (user/nara variants), `TypingDots`,
`NudgeCard` (light + dark-glass variants), `SectionHeader`, `PrimaryButton`/
`SecondaryButton`, `ScreenTitle`, `TabBar` (frosted).

## 12. Current implementation state
### Done
- Design system + screens fully specified (this doc).
### Queued (dependency order, start when backend contract is live)
1. Scaffold `apps/mobile` (Expo + Expo Router + TS).
2. Fonts + `theme/tokens.ts` + reduce-motion hook.
3. API client + Supabase auth + TanStack Query provider + Zustand store.
4. Reusable components (§11), starting with `NoteCard`.
5. Tab navigator + stacks + overlay route.
6. Screens in flow order: Home → Listening → Processing → Reveal → Feed → Note Detail
   → Ask → People → Person Detail → Nudges.
7. The 7 animations, then reduce-motion pass.
8. Polish: frosted tab bar, press states, empty states.
```
