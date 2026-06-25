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
- **Fonts:** `expo-font` + `@expo-google-fonts/schibsted-grotesk` (single typeface).
- **Animations:** `react-native-reanimated`. All 6 animations must be disabled when
  `prefers-reduced-motion` / Reduce Motion is on (use `AccessibilityInfo`).
- Lives in `apps/mobile`.

## 3. Design tokens (authoritative — build `theme/tokens.ts` from this)
```ts
export const colors = {
  paper:     '#F3F3F1',  // all screens background
  card:      '#FFFFFF',  // note cards, bubbles
  ink:       '#18191B',  // primary text, buttons, record circle
  body:      '#26282B',  // note body text
  subInk:    '#4D5560',  // secondary text
  faint:     '#9A9DA1',  // metadata, timestamps
  inactive:  '#A8ABAE',  // disabled state
  lockscreen: '#121316', // nudge screen background
  accent:    '#2E50E6',  // cobalt — all interactive, Nara voice
  waveform:  '#4E6EF0',  // lifted cobalt for listening waveform
  
  category: {
    work:   { base: '#2E50E6', tint: '#E4E9FD' },
    person: { base: '#1B9C77', tint: '#D7F0E7' },
    family: { base: '#D24E6E', tint: '#F8E2E8' },
    books:  { base: '#C0892E', tint: '#F4E9D3' },
  },
  border: {
    card:        'rgba(20,22,24,0.07)',
    interactive: 'rgba(20,22,24,0.10)',
  },
};

export const radius = {
  pill:   999,   // filter chips, tone chips, input
  person: 16,    // person cards, processing mark
  avatar: 14,    // person avatars (rounded square)
  card:   14,    // note cards, CTA buttons
  mark:   7,     // Nara mark square
  dot:    2,     // category markers (rounded square, not circle)
  circle: 9999,  // record button, cobalt dot, chat send
};

export const fonts = {
  grotesk: 'Schibsted Grotesk',
};

export const typography = {
  display:   { size: 32, weight: 700, tracking: -0.9 },     // home greeting
  title:     { size: 23, weight: 700, tracking: -0.4 },     // reveal headline, person name
  body:      { size: 15, weight: 500, tracking: 0 },        // note content, ask answers
  voice:     { size: 15.5, weight: 400, italic: true },    // listening prompt
  label:     { size: 11.5, weight: 600, tracking: 0.4, caps: true }, // category labels
  meta:      { size: 11.5, weight: 500 },                   // timestamps, counts
  eyebrow:   { size: 11.5, weight: 600, tracking: 0.6, caps: true }, // section headers
};

export const spacing = {
  xs: 4,      // dot-to-label gap
  sm: 8,      // meta row gaps
  md: 10,     // card stack gap
  lg: 16,     // card padding (horizontal)
  xl: 24,     // screen horizontal padding
  xxl: 36,    // between major blocks
  statusBar: 60,   // top padding (clears status bar)
  tabBar: 122,     // bottom padding (clears tab bar)
};

export const shadow = {
  card:       '0 1px 3px rgba(20,22,24,0.05)',
  recordBtn:  '0 16px 34px rgba(24,25,27,0.3)',
  lockCard:   '0 8px 24px rgba(0,0,0,0.4)',
};
```
Category color is keyed by category **name** (case-insensitive). Backend may emit
categories beyond these four — assign new ones a deterministic color from an extended
palette; keep the four canonical mappings above fixed.

## 4. Typography rules
- **Schibsted Grotesk is the only typeface.** One grotesk across all sizes and weights
  gives Nara its editorial confidence — no decorative serif, just clear hierarchy.
- **Display (32px, 700)** for home greeting, screen titles. Bold and tight.
- **Title (23px, 700)** for reveal headline, person name. Tight tracking.
- **Body (15px, 500)** for note content, Ask answers. Medium for warmth and readability.
- **Voice italic (15.5px, 400 italic)** for listening prompt, ramble quote. Nara's voice,
  distinguished by bubble and colour, not font.
- **Label (11.5px, 600, uppercase, 0.4px tracking)** for category labels.
- **Meta (11.5px, 500)** for timestamps, counts.
- **Eyebrow (11.5px, 600, uppercase, 0.6px tracking)** for section headers.
- All text sizes use zero or negative letter-spacing for tightness. Category markers are
  always uppercase labels — never colour-only.

## 5. The 6 animations (Reanimated; off on reduce-motion)
- `pulseRing`: scale 0.92→1.5, opacity 0.5→0, 3s ease-out infinite. Two thin cobalt
  rings offset by 1.5s ripple from record button — quiet invitation to talk.
- `wavePulse`: scaleY 0.30→1, ease-in-out infinite. 38 cobalt bars on listening screen,
  staggered 0–0.56s delay, 0.8–1.4s duration — organic, breathing waveform.
- `breathe`: scale 1→1.06, 1.6s ease-in-out infinite. Nara mark on processing screen
  — something is happening, quietly.
- `fadeUp`: translateY(16→0) + opacity 0→1, 0.5s ease. Four reveal cards stagger at
  130ms intervals — ramble becomes order.
- `dotBlink`: opacity 0.25→1, 1.2s infinite. Three dots, each delayed 200ms. Ask typing.
- `pushDown`: translateY(-14→0) + opacity 0→1, 0.5s ease. Home nudge banner arrives
  from above — like a notification, because it is one.

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
1. **Home** — 32px display greeting "Good morning, Priya" + meta timestamp, conditional
   nudge card (pushDown), 118px ink record button + 2 cobalt pulseRing rings (always most
   prominent — Rule #5), "Recent" eyebrow + 2 latest note cards. Tab: Talk.
2. **Listening** — paper bg #F3F3F1, "Nara is listening" (body 500), 38 cobalt wavePulse
   bars, timer (display 700), 60px ink stop circle w/ cobalt square. No tab bar.
3. **Processing** — paper bg #F3F3F1, 78px ink mark with cobalt dot, breathing (breathe),
   "Sorting what you said…" (voice italic 400, 15.5px), auto-advance ~1.8s. No tab bar.
4. **Reveal** — "From what you said" (title 700), verbatim quote block (left cobalt
   border), "Nara made 4 notes" (title 700), N note cards staggered fadeUp, dark full-width
   "See them in your feed" CTA. No tab bar.
5. **Feed** — "Your notes" (display 700), 3 filter pills (Time/Category/Person), grouped
   note cards w/ eyebrow section headers, 3 views. Tab: Notes.
6. **Note Detail** — "‹ Notes" (meta), category dot+label+meta timestamp, full text
   (body 500), nara context box (white bg, italic voice, eye preview), "Add a voice note"
   (primary button) + "Type" (secondary). Tab: Notes.
7. **Ask Nara** — heading+subtitle, chat thread (user bubbles right cobalt, Nara left
   white), dotBlink typing, suggestion chips (category or entity-based), input + send. Tab: Ask.
8. **People** — heading+subtitle, person cards (initial+tint avatar, name title, mention
   count meta, last quote body, chevron). Tab: People.
9. **Person Detail** — "‹ People" (meta), large avatar + name title + mention stats meta,
   timeline (date eyebrow + tone pill + note body) with thin vertical connector. Tab: People.
10. **Nudges** — dark overlay #121316 modal, "From Nara" (display 700 inverted), nudge
    cards (mark icon + body text + meta timestamp), "Close" (secondary button). No tab bar,
    Home visible behind. Modal entry: pushDown animation.

## 10. The 10 governing visual rules
1. **Paper bg (#F3F3F1) everywhere except Nudges (#121316 lockscreen dark).**
   No colour-washing per screen.
2. **Schibsted Grotesk only.** One face across all sizes and weights. Warmth comes
   from weight and size, not a typeface switch.
3. **All note cards use one identical component** — Feed, Reveal, Home recents,
   Person timeline. Consistent visually and in code.
4. **All animations disabled when reduce-motion is active.** Use `AccessibilityInfo`
   to detect and Reanimated `useReduceMotion()` hook.
5. **Record button is the most prominent element on Home.** 118px circle, always
   centred, full-width tap target (or App-specific — check platform guidance).
6. **Category colour applied consistently.** Dot (7px rounded square, not circle)
   + label in same colour. Never colour-only signal.
7. **Tab bar is opaque, not frosted.** Paper background with hairline top border.
8. **Nudges is a dark overlay, not a screen.** Lockscreen #121316, Home visible behind.
9. **No truncation.** Person names, category names, note content wrap. No ellipsis.
10. **Press states are quiet.** Opacity 0.85 or subtle scale 0.98 — nothing bouncy.

## 11. Component inventory (build these reusables)
`NoteCard` (the one card, used in Feed/Reveal/Home/Person timeline), `CategoryPill`,
`FilterTabs`, `RecordButton` (+ pulseRing), `Waveform` (38 bars), `BreathingLogo`,
`PersonCard`, `ToneePill`, `ChatBubble` (user/nara variants), `TypingDots`,
`NudgeCard` (light + dark-glass variants), `SectionHeader`, `PrimaryButton`/
`SecondaryButton`, `ScreenTitle`, `TabBar` (frosted).

## 12. Current implementation state
### Done
- Design system fully specified with actual Nara Design System.dc.html tokens.
- Backend API contract frozen (12 endpoints, E2E tested, all services live).
- Shared types published (`@nara/shared` with all response shapes).
- Login screen designed as part of Auth flow (magic-link → JWT → protected routes).

### In flight (parallel subagents with shared source of truth)
1. **Foundation** — Scaffold `apps/mobile`, install Expo Router + TanStack Query + Zustand,
   build `theme/tokens.ts` (colors, typography, spacing, radii, shadows), API client with
   error handling, Supabase auth (magic link), reduce-motion hook.
2. **Components** — NoteCard (universal), CategoryPill, FilterTabs, RecordButton (+ pulseRing),
   Waveform (38 bars), BreathingLogo, PersonCard, TonePill, ChatBubble, TypingDots,
   NudgeCard, SectionHeader, PrimaryButton, SecondaryButton, ScreenTitle, TabBar.
3. **Screens (in parallel)**:
   - **Auth Screen** — Magic link input, OTP entry (Supabase handles).
   - **Home** — Record button, recent notes, nudge banner, tab bar.
   - **Listening** — Waveform, timer, stop button.
   - **Processing** — Breathing logo, auto-advance.
   - **Reveal** — Quote block, cascading note cards (fadeUp), CTA.
   - **Feed** — Filter pills, note cards, section headers.
   - **Note Detail** — Full text, Nara context, append/edit actions.
   - **Ask Nara** — Chat thread, typing indicator, suggestion chips.
   - **People** — Person cards, navigation to detail.
   - **Person Detail** — Timeline with tone pills, vertical connector.
   - **Nudges** — Dark modal overlay, push-down entry.
4. **Integration & Polish** — Router wiring, TanStack Query setup (caching, polling
   for entry-status), Zustand store, all 6 animations with reduce-motion pass, press
   states (opacity/scale), empty states, error handling, navigation stack order.

All agents read from:
- `docs/API_CONTRACT.md` (frozen, authoritative endpoint shapes)
- `docs/CLAUDE_FRONTEND.md` (this file — design tokens + visual rules)
- `@nara/shared` types (import types, don't redefine)
```
