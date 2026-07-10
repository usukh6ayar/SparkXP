# SparkXP — Critical UX Fixes: Build Spec (C1–C4)

> Turns the **Critical** items from [`UX_REVIEW.md`](./UX_REVIEW.md) into a
> build-ready spec. Each item: owner · files · the change · copy · states ·
> acceptance criteria · effort · dependencies. Respects the Choi/Boju ownership
> split (`DESIGN_REVIEW_ASSIGNMENTS.md`). Backend deltas are called out for
> Өсөхбаяр. **No visual redesign beyond what's specified — implement the flow.**

**Order of impact:** C1 (Home hero) → C2 (quiz feedback) → C3 (Buddy legibility)
→ C4 (value before auth). C1+C2 alone move activation/retention the most.

---

## C1 — Home: one primary "Continue / Start" hero
**Owner:** Choi (`app/(tabs)/index.tsx`) · **Effort:** M (~1 day) · **Depends on:**
real progress data (backend — see C1-BE).

### Problem → goal
Home lists ~6 equal cards → decision fatigue. Goal: **one unmistakable primary
action** at the top of the body; everything else becomes a compact secondary row.

### Change
1. **Promote** the existing `cont` ("Continue learning") card into a **single hero
   card** directly under the fox hero — full-width, the app's only `primary`
   (glow-gradient) CTA on the screen.
2. **Demote** Review reminder + Assignments + the 4 skill tiles into **one
   horizontal "Quick practice" strip** (compact chips/tiles, secondary styling).
3. **Remove** the 4-across skill tiles as a primary block (they duplicate Lessons +
   Soril — see H1). Keep at most one "Practice a skill →" entry that opens a picker.
4. **Real progress** on the hero (see C1-BE) — never the hard-coded `0.75`.

### Component shape (target)
```
<Home>
  <Hero fox + greeting + streak/gem/XP badges />        // unchanged
  <ContinueHero                                          // THE primary action
     title=lesson.title  progress=real%  cta="Continue →" (or "Start learning →")
     variant="primary-glow" />
  <QuickRow>                                             // secondary, horizontal
     <Chip icon=alarm  label="Review {n}"  → /swipe />
     <Chip icon=book   label="Reading"     → /reading />
     <Chip icon=mic    label="Speak"       → /chat />
     <Chip icon=clipboard label="Assignments" (only if enrolled) → /assignments />
  </QuickRow>
  <SkeletonHome /> while loading
</Home>
```

### States
- **New user (no history):** hero shows "Start your first lesson →" (not "Continue").
- **Nothing due:** Review chip hidden or shows "All caught up ✓".
- **Loading:** skeleton for hero + badges (no 0→value pop-in).
- **Error:** hero falls back to "Browse lessons →" (never a dead screen).

### Acceptance criteria
- Exactly **one** primary/glow CTA visible above the fold in the body.
- Hero progress reflects **real** completion (or is hidden if unknown) — no `0.75`.
- Secondary actions are visually lighter (not full cards) and fit one row/strip.
- Home renders a skeleton on first load.

### C1-BE (backend — Өсөхбаяр)
- Expose **real per-lesson progress** for the "continue" lesson (e.g. completed
  sections / total, or lesson-complete boolean) so the hero % is truthful. Until
  then, **hide the % bar** and show only title + CTA.

---

## C2 — Quiz: instant per-answer feedback + real celebration
**Owner:** Boju (`app/quiz/[id].tsx`) — this is assignment **#4** (still open) ·
**Effort:** M (~1 day) · **Depends on:** `haptics.ts` (exists), Confetti (exists).

### Problem → goal
The quiz reveals right/wrong **only at the end** → feels like a test, not learning
(breaks the Duolingo dopamine loop). Goal: **immediate feedback per question.**

### Change — per-question flow (state machine)
```
answering → (tap "Check") → graded(correct|wrong) → (tap "Continue") → next | result
```
- On **Check** (not auto-advance): grade the current answer client-side against the
  known correct answer.
  - **Correct:** option turns green ✓, `haptics.success()`, short "Correct!" line.
  - **Wrong:** chosen option red ✗, **correct option highlighted green**,
    `haptics.error()` + subtle shake, one-line explanation if available.
- Replace the single "Next/Submit" with a **two-step**: `Check` → `Continue`.
- Keep the final submit to the backend for scoring/XP (grading stays authoritative
  server-side; client feedback is a preview using the question's correct field).
- **Result screen:** replace static 🎉 with **Confetti + `haptics.success()` + XP
  count-up** on pass.

> Note: `GET /quizzes/:id` currently **hides** correct answers (anti-cheat). For
> instant feedback the client needs to know correctness → see C2-BE.

### States
- answering (nothing selected → Check disabled)
- graded-correct / graded-wrong (feedback shown, Continue enabled)
- submitting (spinner)
- result-pass (confetti + XP) / result-fail (encourage retry)

### Acceptance criteria
- After Check, the user sees **immediately** whether they were right, and the
  **correct answer** if wrong, with matching haptic.
- Advancing is a deliberate "Continue" (user reads the feedback).
- Pass result shows a real celebration (confetti + haptic + XP count-up).

### C2-BE (backend — Өсөхбаяр)
- Provide correctness to the client **without leaking all answers up front**. Options:
  (a) a lightweight **`POST /quizzes/:id/check`** that grades ONE answer and returns
  `{correct, correctAnswer?, explanation?}`; or (b) include the correct index in
  `GET /quizzes/:id` for practice-mode quizzes only. **(a) is safer.**

---

## C3 — AI Buddy: make the differentiator legible + scaffolded
**Owner:** Boju (`app/(tabs)/chat.tsx`, `CustomTabBar.tsx` label) · **Effort:** M ·
**Depends on:** GPT-4o-mini live (done), voice limits API (`GET /ai/buddy/usage`,
exists).

### Problem → goal
The strongest feature is a **wordless center tab** and a **blank "type or talk"
canvas** that can hit a limit/permission wall on first tap. Goal: announce it,
scaffold the first turn, make limits graceful.

### Change
1. **Label the tab** (`CustomTabBar` center): add a visible "Buddy" / "Ярих" label
   (it's currently image-only). One line under it is fine.
2. **First-open state** (no messages): a warm header ("Practice speaking English —
   I'll correct you gently") + **3–4 tappable starter prompts** ("Talk about your
   day", "Order coffee", "Introduce yourself").
3. **Voice affordances:** show **voice-minutes remaining** (from `/ai/buddy/usage`);
   pre-check before recording; on limit → **auto-switch to text** with a clear,
   non-error message ("Voice limit reached — keep chatting by text").
4. **Progressive disclosure** of a turn: show reply first; **correction collapses**
   behind a "See correction" tap (cuts per-turn overload).

### States
- no-session / first-open (starter prompts)
- recording / transcribing / thinking / speaking (clear status per stage)
- voice-limit → text-only (graceful)
- error (STT/LLM/TTS fail) → "Didn't catch that, try again" (not a raw error)

### Acceptance criteria
- A first-time user can tell **what the tab does** without tapping (label + promise).
- The first turn is **one tap** (a starter prompt), not a blank box.
- Hitting a voice limit **never dead-ends** — it falls to text with a friendly note.

---

## C4 — Value before the auth wall (taste-task onboarding)
**Owner:** Choi (`app/(auth)/onboarding.tsx`, auth flow) · **Effort:** M–L ·
**Depends on:** a tiny "sample" content set that works **unauthenticated**
(see C4-BE).

### Problem → goal
Users must register (username+email+password+OTP) **before any win** → drop-off.
Goal: **experience a win first**, then a soft signup to "save your streak".

### Change
1. **Onboarding = 1 personalization question** ("Why are you learning?" / level) →
   **a 20-second taste task** (2–3 vocab/quiz items) → "**+10 XP! 🎉 Save your
   progress?**" → then signup.
2. Move the **auth wall AFTER** the first win.
3. Offer **guest / "try first"** (local-only progress) or social login to cut fields.
4. Use the personalization answer to make **Home non-generic on first real open**
   (feeds C1's new-user hero copy).

### States
- taste-task in progress → success (+XP) → soft signup prompt
- guest mode (progress stored locally until signup; migrate on signup)

### Acceptance criteria
- A brand-new user reaches **real content within ≤3 taps** and earns XP **before**
  being asked to register.
- Signup is framed as "save your streak/progress", not a gate.

### C4-BE (backend — Өсөхбаяр)
- A **public sample endpoint** (a handful of words/quiz items) servable without JWT,
  OR ship a tiny bundled sample set in the app. Guest→user **progress migration** on
  signup (attach local XP/answers to the new account).

---

## Ownership & sequencing summary

| Item | Owner (FE) | Backend (Өсөхбаяр) | Effort | Priority |
| --- | --- | --- | --- | --- |
| C1 Home hero | Choi | real lesson progress | M | 🟥 1 |
| C2 Quiz feedback | Boju (#4) | `/quizzes/:id/check` | M | 🟥 2 |
| C3 Buddy legibility | Boju (+ tab label) | (uses existing usage API) | M | 🟥 3 |
| C4 Taste-task onboarding | Choi | public sample + guest migration | M–L | 🟥 4 |

**Parallelism:** C1 (Choi) ∥ C2/C3 (Boju) are different files → no conflict, build in
parallel. The tab-label bit of C3 touches shared `CustomTabBar` → small announced PR.
C4 is larger; can follow C1–C3.

**Backend order for Өсөхбаяр:** `/quizzes/:id/check` (C2) → real lesson progress
(C1) → public sample + guest migration (C4).

---

## Definition of done (Critical set)
- Home has **one** obvious daily action with real (or hidden) progress.
- Quizzes teach in real time (instant feedback + celebration).
- The AI Buddy tab **announces itself**, scaffolds turn 1, and degrades gracefully.
- A new user **earns XP before signup**.
- Every touched screen has skeleton/empty/error/success states.
