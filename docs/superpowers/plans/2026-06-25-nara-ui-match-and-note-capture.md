# Nara UI Pixel-Match + Text Note Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-match every screen/component in `apps/mobile` pixel-for-pixel to `Nara.dc.html`, remove the voice/recording feature, and replace it with a frictionless text "New note" capture (Home hero + redesigned rich-text editor).

**Architecture:** React Native + Expo Router app. This is a UI-fidelity pass: the authoritative source is `Nara.dc.html` (inline-styled HTML mockup of all 10 screens). Each task reconciles one file's styles to the exact values in that mockup. Voice screens are deleted; the Home capture hero and `editor.tsx` are net-new product design. No backend/API changes.

**Tech Stack:** React Native 0.85, Expo 56, Expo Router, Reanimated, TanStack Query, Zustand, `@10play/tentap-editor` (rich text), Schibsted Grotesk.

**Authoritative references (read before each UI task):**
- Design mockup: `/Users/mac/Downloads/Alma product vision (2)/Nara.dc.html`
- Tokens: `apps/mobile/src/theme/tokens.ts` (already aligned — colors `#F3F3F1`/`#FFFFFF`/`#18191B`/`#2E50E6`, `fontFamily.grotesk = 'SchibstedGrotesk'`)
- Spec: `docs/superpowers/specs/2026-06-25-nara-ui-match-and-note-capture-design.md`

**Global verification command (run after every task):**
```bash
cd /Users/mac/Developer/nara/apps/mobile && npx tsc --noEmit
```
Expected: no new type errors. (Visual fidelity is verified by opening the file's target section in `Nara.dc.html` and confirming every color/size/radius/spacing matches.)

**Conventions for every UI task:**
- Use `fontFamily.grotesk` for all text; reproduce exact `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight` from the mockup.
- RN `lineHeight` is absolute px: convert mockup `line-height:1.45` at 15px → `lineHeight: 15 * 1.45`.
- Category markers are **7px rounded squares, `borderRadius: 2`** — never circles.
- Press states: `activeOpacity={0.85}`.
- Commit after each task: `git -C /Users/mac/Developer/nara add -A && git -C /Users/mac/Developer/nara commit -m "<msg>"`.

---

## Task 0: Baseline & worktree

**Files:** none (setup)

- [ ] **Step 1: Confirm clean baseline**

Run: `git -C /Users/mac/Developer/nara status` → note current branch is clean.
Run: `cd /Users/mac/Developer/nara/apps/mobile && npx tsc --noEmit` → record any pre-existing errors so we don't blame them on our changes.

- [ ] **Step 2: Branch**

```bash
git -C /Users/mac/Developer/nara checkout -b ui-nara-match-note-capture
```

---

## Task 1: Token audit vs `Nara.dc.html`

**Files:** Modify `apps/mobile/src/theme/tokens.ts`

- [ ] **Step 1:** Open `Nara.dc.html` and confirm these are present in `tokens.ts` exactly: paper `#F3F3F1`, card `#FFFFFF`, ink `#18191B`, body `#26282B`, secondary `#6A6E73`, faint `#9A9DA1`, inactive `#A8ABAE`, accent `#2E50E6`, lockscreen `#121316`, category work `#2E50E6`, person/Rohan `#1B9C77`/tint `#D7F0E7`, family `#D24E6E`, books `#C0892E`, card border `rgba(20,22,24,0.07)`, interactive border `rgba(20,22,24,0.12)`.
- [ ] **Step 2:** Fix `colors.subInk` usage: mockup secondary text is `#6A6E73` (back chevrons, "Notes", subtitles). Add `secondary: '#6A6E73'` to `colors` if missing; keep `subInk: '#4D5560'` (used in note-detail context box text). Set `border.interactive` to `rgba(20,22,24,0.12)` (mockup uses 0.12, file currently 0.10).
- [ ] **Step 3:** Verify `npx tsc --noEmit` clean. Commit: `chore(tokens): reconcile to Nara.dc.html values`.

---

## Task 2: Remove the voice / recording feature

**Files:**
- Delete: `apps/mobile/src/app/listening.tsx`, `apps/mobile/src/app/processing.tsx`
- Delete (after confirming unused): `apps/mobile/src/components/record-button.tsx`, `apps/mobile/src/components/pulse-ring.tsx` only if not reused by the new hero (the new hero will re-implement its own pulse rings — see Task 3)
- Modify: `apps/mobile/src/store/app.ts`, `apps/mobile/src/app/_layout.tsx` (route registration if explicit)

- [ ] **Step 1:** `grep -rn "listening\|processing\|startRecording\|stopRecording\|recording" apps/mobile/src` to enumerate every reference.
- [ ] **Step 2:** Delete `listening.tsx` and `processing.tsx`. Expo Router is file-based, so removing the files removes the routes; also remove any explicit `<Stack.Screen name="listening"|"processing" />` entries in `_layout.tsx`.
- [ ] **Step 3:** In `store/app.ts`, remove the `recording` state slice (idle|listening|processing + elapsed) and any actions that set it. Leave feed-filter / transient UI state intact.
- [ ] **Step 4:** Remove imports of `RecordButton`/`PulseRing`/waveform from any screen. Delete `record-button.tsx` and `pulse-ring.tsx` if `grep` shows zero remaining imports.
- [ ] **Step 5:** `npx tsc --noEmit` clean (fix dangling imports). Commit: `feat: remove voice/recording feature`.

---

## Task 3: Home — capture hero (new design) + pixel-match

**Files:** Modify `apps/mobile/src/app/(tabs)/index.tsx`. Reference: `Nara.dc.html` lines 14–98 (the `isHome` block, visible in the design diff).

Target layout (top → bottom), all values exact:
- Screen: `flex:1; background #F3F3F1`. Scroll content padding: `60px` top is provided by SafeArea + `paddingTop`; horizontal `24`; bottom `122`.
- **Header row** (`space-between`, `marginBottom: 36`):
  - Left group (gap 9): mark = 25×25, `borderRadius:7`, bg `#18191B`, centered 8×8 `borderRadius:50%` dot bg `#2E50E6`; then "Nara" text `18/700`, `letterSpacing:-0.4`, `#18191B`.
  - Right: timestamp text `12.5/500`, `#9A9DA1`, format `Mon · 8:47 AM` (keep existing `formatHeaderTime`). (Keep the logout affordance from current code, right of the timestamp, gap 12 — it is an app necessity not in the mockup; style it minimally with faint color.)
- **Greeting** (`marginBottom: 22`): `32/700`, `letterSpacing:-0.9`, `lineHeight: 32*1.08`, `#18191B`. Text from existing `getGreeting` → e.g. "Good morning, Priya.".
- **Push-nudge card** (conditional, existing `NudgeBanner` with `pushDown`): white, `borderRadius:16`, border `rgba(20,22,24,0.07)`, padding `15px 16px`, gap 12, shadow `0 1px 3px rgba(20,22,24,0.05)`; mark 22×22 radius 6 ink + 7px cobalt dot; text `15/500` lh `15*1.42` `#18191B`; meta `11/600` uppercase `#9A9DA1` ls 0.5, `NARA · just now`.
- **Capture hero** (replaces record block; container `paddingVertical: 52 top / 46 bottom`, centered column):

```tsx
// New-note hero — occupies the record button's exact block.
// 128px tap container holds two cobalt pulse rings + a 118px ink circle with a pencil glyph.
<TouchableOpacity onPress={() => router.push('/editor')} activeOpacity={0.85}
  style={{ width: 128, height: 128, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
  {!reduceMotion && <PulseRings />}{/* two Animated rings: scale 0.92→1.5, opacity 0.5→0, 3s, 2nd delayed 1.5s, 1.5px cobalt border, inset 4 */}
  <View style={{ width: 118, height: 118, borderRadius: 59, backgroundColor: '#18191B',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.3, shadowRadius: 34, elevation: 16 }}>
    <PencilGlyph color="#F3F3F1" />{/* diagonal pencil drawn from views: ~ 40px tall nib+body, paper-colored */}
  </View>
</TouchableOpacity>
<Text style={{ fontFamily: fontFamily.grotesk, fontSize: 16, fontWeight: '600', color: '#18191B', marginTop: 24 }}>New note</Text>
<Text style={{ fontFamily: fontFamily.grotesk, fontSize: 13, fontWeight: '400', color: '#9A9DA1', marginTop: 5 }}>Just start writing. No structure needed.</Text>
```

`PencilGlyph`: build a simple pencil from 2–3 views (a rotated 45° rounded body bar `width:8 height:34 radius:3` + a small triangular nib) in `#F3F3F1`, mirroring how the mic icon was drawn with views. Keep it calm and legible at 118px.

`PulseRings`: reuse the existing `usePulseRing` animation hook if present (check `hooks/animations.ts`); two `Animated.View`, `position:absolute; inset:4; borderRadius:59; borderWidth:1.5; borderColor:'rgba(46,80,230,0.3)'`, second offset 1.5s. Off when `reduceMotion`.

- **Recent header** (`space-between`, `marginBottom: 13`): eyebrow "Recent" `11.5/600` ls 0.6 uppercase `#9A9DA1`; right "All notes" `12.5/600` `#2E50E6` → `router.push('/(tabs)/notes')`.
- **Recent cards**: `gap:10`; render up to 2 `NoteCard` (canonical component from Task 5); loading → 2 `NoteCardSkeleton`; empty → faint centered text.

- [ ] **Step 1:** Read current `(tabs)/index.tsx` and `hooks/animations.ts`. Remove the bottom `bottomArea` (quick input + dark "Create a new note" button) and the `entryMutation`/`quickInput` state entirely.
- [ ] **Step 2:** Implement the capture hero block (above) in the record button's position. Add `PencilGlyph` + `PulseRings` as local components in this file (or `components/new-note-hero.tsx` if cleaner).
- [ ] **Step 3:** Verify header, greeting, nudge, recent against `Nara.dc.html` lines 14–98 — every value matches.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Manually confirm: tapping the hero routes to `/editor`. Commit: `feat(home): new-note hero replaces record button; pixel-match Home`.

---

## Task 4: Redesigned editor (`editor.tsx`)

**Files:** Modify `apps/mobile/src/app/editor.tsx` (full rewrite of chrome; keep TenTap engine).

- [ ] **Step 1: Verify available toolbar items.** In a scratch check, log `DEFAULT_TOOLBAR_ITEMS` from `@10play/tentap-editor` and confirm which of {heading, bold, italic, bulletList, orderedList, taskList/checklist, blockquote} the installed `^1.0.1` exposes. Use only items that exist; if checklist/quote are absent, omit them (do not fabricate).
- [ ] **Step 2: Header.** Replace with: `Cancel` (left, `14/500` `#6A6E73`, with discard-confirm Alert when dirty) · center title `New note`/`Edit note` (`17/600` ink) · `Save` (right, `14/600` cobalt, `opacity:0.35` + disabled until `hasContent`). Header border-bottom `rgba(20,22,24,0.07)`, bg paper.
- [ ] **Step 3: Editor body.** Keep `useEditorBridge` with `autofocus: true`, `avoidIosKeyboard: true`, `PlaceholderBridge` placeholder `'Start writing…'`. Keep the injected `editorCSS` (Schibsted Grotesk; p 15/500/1.5; strong 700; em italic; ul/ol indent; h1 24 / h2 20 / h3 17 at 700; empty-placeholder color faint). No separate title field — first line is the title.
- [ ] **Step 4: Toolbar.** Dock above keyboard (existing `KeyboardAvoidingView` pattern). Provide a **curated, reordered** item list (filter `DEFAULT_TOOLBAR_ITEMS` to: heading, bold, italic, bulletList, orderedList, [checklist], [blockquote]). Theme: `icon.tintColor = colors.body`, `iconActive.tintColor = colors.accent`, `iconWrapperActive.backgroundColor = 'rgba(46,80,230,0.08)'`, `iconDisabled.tintColor = colors.faint`, toolbar bg paper, top border `colors.border.card`. Ensure the toolbar is horizontally scrollable (TenTap `Toolbar` is by default) so items never clip.
- [ ] **Step 5: Save.** Keep mutation: new → `POST /entries {text}`; edit (`noteId`) → `PUT /notes/:id {text}`. On success invalidate `['notes']` (+ `['note', noteId]`), show "Saved" toast, `router.back()`. Keep empty-note guard.
- [ ] **Step 6: Acceptance (manual on iOS sim or device).** In a new note: type a paragraph; apply H1/H2/H3 to a line; bold + italic a word; create a bullet list, add 3 items, remove one (toggle off); create a numbered list; (checklist + quote if available). Confirm: no clipped toolbar, focus never lost, Save enabled only with content, "Saved" toast then return. `npx tsc --noEmit` clean. Commit: `feat(editor): product-grade rich-text note editor`.

---

## Task 5: Canonical `NoteCard` component

**Files:** Modify the live note card; remove the dead duplicate. Reference: `Nara.dc.html` lines 183–192 (feed card) — the canonical card used in Home/Feed/Reveal/Person.

- [ ] **Step 1:** `grep -rn "from '@/components/note-card'\|from '@/components/NoteCard'" apps/mobile/src` to determine which file is imported by screens. The live one (imported by Home) is `components/note-card.tsx`.
- [ ] **Step 2:** Match the live `NoteCard` exactly: container white, border `rgba(20,22,24,0.07)`, `borderRadius:14`, padding `14px 16px`. Meta row (`align-items:center`, gap 8, `marginBottom:8`): 7×7 `borderRadius:2` category dot (color via `getCategoryColor(cat)`) + label `11.5/600` ls 0.4 uppercase same color + spacer + time `11.5/–` `#9A9DA1`. Body `15/500` lh `15*1.45` `#26282B`. No truncation (Visual Rule #9).
- [ ] **Step 3:** Delete the unused duplicate (`NoteCard.tsx` or `note-card.tsx`, whichever has zero imports). Repeat the import check for `NoteCardSkeleton`/`NoteCardSkeleton`.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit: `refactor(note-card): canonical card matched to Nara.dc.html; remove duplicate`.

---

## Task 6: Feed (`(tabs)/notes/index.tsx`)

**Files:** Modify `apps/mobile/src/app/(tabs)/notes/index.tsx`. Reference: `Nara.dc.html` lines 169–198.

- [ ] **Step 1:** Header block padding `60/24/4`: "Your notes" `32/700` ls `-0.8` `#18191B` mb 16; filter row gap 7 with three pills Time/Category/People.
- [ ] **Step 2:** Filter pill style — active: `color #18191B`, `background #FFFFFF`, `border 1px rgba(20,22,24,0.12)`; inactive: `color #9A9DA1`, transparent bg/border. Padding `7px 15px`, `borderRadius:999`, `13/600`.
- [ ] **Step 3:** Scroll body padding `16/24/122`. For each section: eyebrow header `11.5/600` ls 0.6 uppercase `#9A9DA1`, margin `14/0/11`; then `gap:10` of canonical `NoteCard`. Keep existing grouping logic (time/category/person) wired to Zustand filter.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit: `feat(feed): pixel-match to Nara.dc.html`.

---

## Task 7: Note Detail (`(tabs)/notes/[id].tsx`)

**Files:** Modify `apps/mobile/src/app/(tabs)/notes/[id].tsx`. Reference: `Nara.dc.html` lines 200–227.

- [ ] **Step 1:** Header padding `58/24/10`: back row `‹` `19px` `#6A6E73` + "Notes" `14/500` `#6A6E73` → `router.back()`.
- [ ] **Step 2:** Body padding `18/24/122`. Meta row (mb 18): 8×8 `borderRadius:2` category dot + label `12/600` ls 0.4 uppercase same color + spacer + time `12.5` `#9A9DA1`. Note text `23/600` lh `23*1.42` `-0.4` `#18191B`.
- [ ] **Step 3:** Context box (mt 24): bg `rgba(46,80,230,0.06)`, `borderRadius:14`, padding `14/16`, gap 11; 20×20 radius 6 ink mark + 6px cobalt dot; text `14/400` lh 1.5 `#4D5560`: `Filed to your {label} thread. Add to it any time.`
- [ ] **Step 4:** Action row (mt 22, gap 10): **"Add to note"** — `flex:1` ink `#18191B` `borderRadius:12` padding 14, text `14/600` `#F3F3F1`; **"Edit"** — `flex:1` white border `rgba(20,22,24,0.12)` `borderRadius:12` padding 14, text `14/600` `#4D5560`. Both `router.push({ pathname: '/editor', params: { noteId, initialContent } })` (Add = append-focused; for v1 both open the editor in edit mode — wire append semantics only if the API supports it, else both edit).
- [ ] **Step 5:** `npx tsc --noEmit` clean. Commit: `feat(note-detail): pixel-match; text actions replace voice`.

---

## Task 8: Reveal (`reveal.tsx`)

**Files:** Modify `apps/mobile/src/app/reveal.tsx`. Reference: `Nara.dc.html` lines 132–166.

- [ ] **Step 1:** Body padding `64/24/122`. Eyebrow "From what you said" `11.5/600` ls 0.6 uppercase `#9A9DA1` mb 12.
- [ ] **Step 2:** Quote block: `borderLeftWidth:2` `#2E50E6`, `paddingLeft:15`, mb 28; text italic `15.5/400` lh 1.6 `#6A6E73`.
- [ ] **Step 3:** "Nara made N notes." `25/700` `-0.6` `#18191B` mb 20. Then `gap:11` of `NoteCard`s, each entering with `fadeUp` staggered at 0.05 / 0.18 / 0.31 / 0.44s (use existing `useFadeUp` from `hooks/animations.ts`; off under reduce-motion).
- [ ] **Step 4:** CTA (mt 28): ink `#18191B` `borderRadius:13` padding 16, centered text `15/600` `#F3F3F1` "See them in your feed" → `router.replace('/(tabs)/notes')`; `fadeUp` 0.6s.
- [ ] **Step 5:** Confirm reveal is reachable from editor save (new entry → reveal of the produced notes if the pipeline returns them; otherwise keep current trigger). `npx tsc --noEmit` clean. Commit: `feat(reveal): pixel-match to Nara.dc.html`.

---

## Task 9: Ask Nara (`(tabs)/ask.tsx`)

**Files:** Modify `apps/mobile/src/app/(tabs)/ask.tsx`. Reference: `Nara.dc.html` lines 229–262.

- [ ] **Step 1:** Header padding `60/24/14`, border-bottom `rgba(20,22,24,0.07)`: "Ask Nara" `32/700` `-0.8`; subtitle `13/400` `#9A9DA1` mt 4 "She's read everything you've shared."
- [ ] **Step 2:** Thread body padding `20/20/16`, `gap:12`. User bubble: right-aligned, max 78%, bg `#2E50E6`, text `#FFFFFF`, radius `18/18/6/18`, padding `12/15`, `14.5/–` lh 1.45. Nara bubble: left, max 84%, white, border `rgba(20,22,24,0.07)`, text `#3A352D`→ use `#26282B`, radius `16/16/16/5`, padding `13/16`, `15/–` lh 1.5.
- [ ] **Step 3:** Typing indicator (when busy): left white bubble radius `16/16/16/5`, three 7px cobalt dots with `dotBlink` at 0 / 0.2 / 0.4s.
- [ ] **Step 4:** Footer padding `10/18/40`: suggestion chips — white, border `rgba(20,22,24,0.12)`, `borderRadius:999`, padding `9/14`, `13/500` `#4D5560`, margin `0 6 8 0`. Input row (mt 6): white pill border `rgba(20,22,24,0.12)` padding `12/14/12/18`, placeholder `14` `#9A9DA1` "Ask about anything you've said…", 32×32 cobalt circle send with white `↑`.
- [ ] **Step 5:** `npx tsc --noEmit` clean. Commit: `feat(ask): pixel-match to Nara.dc.html`.

---

## Task 10: People (`(tabs)/people/index.tsx`)

**Files:** Modify `apps/mobile/src/app/(tabs)/people/index.tsx`. Reference: `Nara.dc.html` lines 264–289.

- [ ] **Step 1:** Header padding `60/24/8`: "People" `32/700` `-0.8`; subtitle `13/400` `#9A9DA1` mt 4 "The people you mention, remembered over time."
- [ ] **Step 2:** List padding `18/24/122`, `gap:10`. Person card: white, border `rgba(20,22,24,0.07)`, `borderRadius:16`, padding `15/16`, gap 14, `align-items:center`. Avatar 46×46 `borderRadius:13` bg `getCategoryColor(x,'tint')`, initial `19/600` color `getCategoryColor(x)`. Name `17/600` `-0.2` `#18191B` + count `11.5` `#9A9DA1` (`· N mentions`). Last-quote `13.5/400` `#6A6E73` lh 1.35. Chevron `›` `19` `#C4C6C9`.
- [ ] **Step 3:** `npx tsc --noEmit` clean. Commit: `feat(people): pixel-match to Nara.dc.html`.

---

## Task 11: Person Detail (`(tabs)/people/[id].tsx`)

**Files:** Modify `apps/mobile/src/app/(tabs)/people/[id].tsx`. Reference: `Nara.dc.html` lines 291–326.

- [ ] **Step 1:** Header padding `58/24/8`: back "‹ People" `19`/`14/500` `#6A6E73` (mb 16). Identity row gap 14: avatar 54×54 `borderRadius:15` tint bg, initial `24/600` colored; name `26/700` `-0.6` `#18191B`; meta `13/400` `#9A9DA1` mt 2 "Mentioned N times this month".
- [ ] **Step 2:** Body padding `22/24/122`. Summary box: bg `rgba(<personColor-rgb>,0.1)`, `borderRadius:14`, padding `14/16`, mb 24; text `14.5/500` lh 1.5 in a darkened person color.
- [ ] **Step 3:** Timeline: container `paddingLeft:24`; absolute connector `left:5; top:6; bottom:6; width:1.5; rgba(20,22,24,0.1)`. Each item mb 24: absolute dot `left:-23; top:4; 11×11; borderRadius:50%`, tone color, `border:2.5 #F3F3F1`. Row: date eyebrow `11.5/600` ls 0.4 uppercase `#9A9DA1` + tone pill `11/600` padding `2/9` `borderRadius:999` tone color on tone tint. Text `15.5/500` lh 1.45 `#26282B`.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit: `feat(person-detail): pixel-match to Nara.dc.html`.

---

## Task 12: Nudges modal (`nudges-modal.tsx`)

**Files:** Modify `apps/mobile/src/app/nudges-modal.tsx`. Reference: `Nara.dc.html` lines 328–353.

- [ ] **Step 1:** Full-screen bg `#121316`, `scrimIn` fade-in 0.4s. Header padding `72/26/18`, centered: date `15/500` `rgba(243,243,241,0.5)` ls 0.5; clock `62/600` `-1` `#F3F3F1` mt 4 (tabular nums) — show current time or "9:41".
- [ ] **Step 2:** List padding `14/16/40`, `gap:9`. Nudge card: bg `rgba(255,255,255,0.96)`, `borderRadius:18`, padding `14/15`, gap 11. Mark 24×24 radius 7 ink + 7px cobalt dot. Header row: "NARA" `12/700` ls 0.3 uppercase `#18191B` + time `11.5` `#8A8E93`. Text `14.5/500` lh 1.42 `#26282B`.
- [ ] **Step 3:** "Close" pill: centered, mt 14, padding `11/26`, `borderRadius:999`, border `rgba(243,243,241,0.25)`, text `13.5/500` `rgba(243,243,241,0.8)` → dismiss modal.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit: `feat(nudges): pixel-match to Nara.dc.html`.

---

## Task 13: Tab bar (`components/app-tabs.tsx` + `.web.tsx`)

**Files:** Modify `apps/mobile/src/components/app-tabs.tsx` (and `app-tabs.web.tsx`). Reference: `Nara.dc.html` lines 355–375. Note: 4 tabs **Talk / Notes / Ask / People** (no separate tab for capture — capture is the Home hero).

- [ ] **Step 1:** Bar: frosted `rgba(243,243,241,0.85)` + blur (`expo-blur` or `expo-glass-effect`), top border `rgba(20,22,24,0.07)`, padding `9/26/26`, `justify:space-around`, `align:flex-end`.
- [ ] **Step 2:** Icons (active `#2E50E6`, inactive `#A8ABAE`), all 2.5px stroke, label `10.5/600` below, gap 5, width 56:
  - **Talk:** 21×21 `borderRadius:6` 2.5px border + centered 7px filled dot.
  - **Notes:** three stacked 2.5px bars (middle 70% width), gap 3.5, width 21.
  - **Ask:** 21×18 2.5px border, `borderRadius: 8/8/8/2` (speech bubble).
  - **People:** two 13×13 circles, 2.5px border, overlapped `marginLeft:-6`, the front one bg `#F3F3F1`.
- [ ] **Step 3:** Confirm tab→route map: Talk→`(tabs)/index`, Notes→`(tabs)/notes`, Ask→`(tabs)/ask`, People→`(tabs)/people`. `npx tsc --noEmit` clean. Commit: `feat(tabbar): pixel-match icons & frosted bar to Nara.dc.html`.

---

## Task 14: Dedupe, cross-screen audit, final verification

**Files:** various components (remove dead duplicates), `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Component dedupe.** For each pair {`NoteCard.tsx`/`note-card.tsx`, `NaraLogo.tsx`/`nara-logo.tsx`, `PrimaryButton.tsx`/`primary-button.tsx`, `SecondaryButton.tsx`/`secondary-button.tsx`, `ScreenTitle.tsx`/`screen-title.tsx`, `TonePill.tsx`/`tone-pill.tsx`, `ChatBubble`/`chat-bubble`, `PersonCard`/`person-card`, `Metadata`/`SectionHeader`}, run `grep -rn "components/<name>" apps/mobile/src`; keep the imported one, delete the orphan. Do not change any consumer.
- [ ] **Step 2: Greeting/name audit.** `grep -rn "Alma" apps/mobile/src` → must be zero (product stays "Nara"). `grep -rn "voice\|record\|listening\|microphone" apps/mobile/src` → only benign matches remain.
- [ ] **Step 3:** Full `npx tsc --noEmit` clean across the app.
- [ ] **Step 4: Run the app** (use the project `run` skill or `cd apps/mobile && npx expo start`). Walk all tabs + new-note flow + editor + note detail + reveal; compare each against the matching `Nara.dc.html` screen side by side. Fix any drift.
- [ ] **Step 5:** Commit: `chore: dedupe components; final Nara.dc.html fidelity pass`.

---

## Self-review (author check)

- **Spec coverage:** §3 screens 1–9 → Tasks 3,8,6,7,9,10,11,12,13; §4 capture hero → Task 3; §5 editor → Task 4; voice removal → Task 2; tokens → Task 1; dedupe risk → Tasks 5 & 14. All covered.
- **Placeholders:** none — every UI task cites exact `Nara.dc.html` line ranges + concrete values; net-new hero/editor carry full code/structure.
- **Type/name consistency:** `fontFamily.grotesk`, `getCategoryColor`, `NoteCard`, `useFadeUp`/`usePulseRing`/`usePushDown` (verify exact hook names in `hooks/animations.ts` during Task 3) used consistently.
- **Open verify-at-build items (flagged, not placeholders):** TenTap toolbar item availability (Task 4 Step 1); exact animation hook names (Task 3); which of each duplicate component pair is live (Tasks 5/14).
