# CLAUDE_FRONTEND.md — Frontend Agent Briefing

You are the **Frontend Engineer** for Nara. You build the entire React Native + Expo
app. You make **no architectural decisions** — stack and API are fixed. You execute
against this design system and `docs/API_CONTRACT.md`. **Phase 3 work** — start only
once the backend (Phases 1–2) exposes the contract. The contract is frozen; if you
need a change, the Architect updates API_CONTRACT.md + its changelog first.

---

## 1. What Nara is & why design matters
A text-based personal memory app for Priya (24, busy, no patience for systems). The
user types notes (like a notes app); Phase 1 is text-only (no audio/recording). The
app must feel warm, calm, literary -- "somewhere you'd want to go," not software. The
magic moments the UI must nail: the **Reveal** (one input -> several notes cascading
in), **Ask Nara** (feels like someone who read everything), the **weekly letter**, and
**nudges** (specific, never generic).

## 2. Stack (locked)
- **React Native + Expo** (managed). TypeScript.
- **Navigation:** Expo Router (file-based; React Navigation under the hood).
- **Server state:** TanStack Query (React Query) -- caching, entry-status poll,
  retries, optimistic updates.
- **Local/UI state:** Zustand (active filters, transient UI flags).
- **Rich-text editor:** `@10play/tentap-editor` (TenTap) for note editing.
- **Fonts:** `expo-font` + `@expo-google-fonts/schibsted-grotesk` (single typeface).
- **Animations:** `react-native-reanimated`. Animations must be disabled when
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

## 5. Animations (Reanimated; off on reduce-motion)
- `breathe`: scale 1->1.06, 1.6s ease-in-out infinite. Nara mark on processing --
  something is happening, quietly.
- `fadeUp`: translateY(16->0) + opacity 0->1, 0.5s ease. Reveal cards stagger at
  130ms intervals -- input becomes organized notes.
- `dotBlink`: opacity 0.25->1, 1.2s infinite. Three dots, each delayed 200ms. Ask
  typing indicator.
- `pushDown`: translateY(-14->0) + opacity 0->1, 0.5s ease. Nudge banner arrives
  from above.

## 6. Navigation structure (Expo Router)
- **Tab navigator:**
  - **Home** (index) -- notes-list-first with FAB for new note
  - **Notes** -> Feed -> Note Detail (stack)
  - **Ask** -> Ask Nara
  - **People** -> People -> Person Detail (stack)
  - **Settings**
- **Full-screen routes (no tab bar):** Editor (TenTap), Reveal.
- **Modal overlay:** Nudges (dark overlay, Home visible behind).
- **Auth group:** Login (email/password + Google OAuth), Verify.

## 7. State management shape
- **TanStack Query** for all server data. Query keys: `['notes', filters]`,
  `['note', id]`, `['entities', type]`, `['entity', id]`, `['categories']`,
  `['letters']`, `['letter', id]`, `['mood', range]`, `['nudges']`,
  `['entry-status', id]` (poll: `refetchInterval` ~1500ms until status terminal).
  Optimistic updates for note edit/append and loose-end dismiss.
- **Zustand** store: active feed filter (time|category|person), transient UI flags.
  Nothing that belongs to the server lives here.

## 8. API client
- `lib/api.ts`: base URL from env, attaches `Authorization: Bearer <supabase jwt>`
  from the Supabase session, parses the standard error shape, throws typed errors.
- Auth via `@supabase/supabase-js` (email/password + Google OAuth). Session drives
  the JWT.
- Loading states map to Query states; entry submission polls `['entry-status', id]`
  until done, then navigates to Reveal.
- Import response types from `packages/shared` — do not redefine note/entity shapes.

## 9. The screens
1. **Home** (tabs/index) -- Notes-list-first layout with display greeting. Conditional
   nudge card (pushDown). Floating action button (FAB) bottom-right for new note.
2. **Feed** (tabs/notes/index) -- "Your notes" (display 700), filter pills
   (Time/Category/Person), grouped note cards with eyebrow section headers. Tab: Notes.
3. **Note Detail** (tabs/notes/[id]) -- Category dot+label+timestamp, full text
   (body 500), Nara context box. Edit (full replace) and "Add to note" (append) actions.
4. **Editor** (editor.tsx) -- Full-screen TenTap rich-text editor for composing/editing
   notes. No tab bar.
5. **Reveal** (reveal.tsx) -- "From what you said" (title 700), verbatim quote block,
   N note cards staggered fadeUp, CTA to feed. No tab bar.
6. **Ask Nara** (tabs/ask) -- Chat thread (user bubbles right cobalt, Nara left white),
   dotBlink typing indicator, suggestion chips, input + send. Tab: Ask.
7. **People** (tabs/people/index) -- Person cards (avatar, name, mention count, last
   quote, chevron). Tab: People.
8. **Person Detail** (tabs/people/[id]) -- Large avatar + name + mention stats,
   timeline with tone pills and vertical connector. Tab: People.
9. **Settings** (tabs/settings) -- User preferences. Tab: Settings.
10. **Nudges** (nudges-modal.tsx) -- Dark overlay #121316 modal, nudge cards, pushDown
    animation. Home visible behind.
11. **Login** (auth/login) -- Email/password + Google OAuth via Supabase Auth.
12. **Verify** (auth/verify) -- Email verification / OTP.

## 10. The 10 governing visual rules
1. **Paper bg (#F3F3F1) everywhere except Nudges (#121316 lockscreen dark).**
   No colour-washing per screen.
2. **Schibsted Grotesk only.** One face across all sizes and weights. Warmth comes
   from weight and size, not a typeface switch.
3. **All note cards use one identical component** — Feed, Reveal, Home recents,
   Person timeline. Consistent visually and in code.
4. **All animations disabled when reduce-motion is active.** Use `AccessibilityInfo`
   to detect and Reanimated `useReduceMotion()` hook.
5. **FAB (new-note button) is the primary action on Home.** Floating action button,
   bottom-right, always accessible.
6. **Category colour applied consistently.** Dot (7px rounded square, not circle)
   + label in same colour. Never colour-only signal.
7. **Tab bar is opaque, not frosted.** Paper background with hairline top border.
8. **Nudges is a dark overlay, not a screen.** Lockscreen #121316, Home visible behind.
9. **No truncation.** Person names, category names, note content wrap. No ellipsis.
10. **Press states are quiet.** Opacity 0.85 or subtle scale 0.98 — nothing bouncy.

## 11. Component inventory
`NoteCard` (universal -- Feed/Reveal/Home/Person timeline), `CategoryPill`,
`FilterTabs`, `FAB` (floating action button), `BreathingLogo`, `PersonCard`,
`TonePill`, `ChatBubble` (user/nara variants), `TypingDots`, `NudgeCard` (light +
dark-glass variants), `SectionHeader`, `PrimaryButton`/`SecondaryButton`,
`ScreenTitle`, `TabBar`.

## 12. Current implementation state
### Done
- Design system tokens implemented in `theme/tokens.ts`.
- All screens built: Home (FAB), Feed, Note Detail, Editor (TenTap), Reveal, Ask,
  People, Person Detail, Settings, Nudges modal, Login (email/password + Google), Verify.
- Expo Router navigation wired (tabs + stacks + modals + auth group).
- TanStack Query + Zustand integrated. API client with Supabase Auth.
- Backend API fully implemented and E2E tested.

### Queued
- UX polish pass (empty states, error handling, press states).
- Push notifications (Expo Push).
- Production deployment.
