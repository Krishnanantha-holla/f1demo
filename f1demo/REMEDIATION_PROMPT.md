# F1 Demo — Phase 0/1 Remediation + UI/UX Polish Prompt

> **How to use this file:** paste the contents (from the next heading down) into a fresh agent
> session, or work through it yourself top-to-bottom. Each step is self-contained, points at exact
> files, and ships its own verification snippet. Run the **Final verification block** at the end
> after every step is done.

---

You are working in repo root `/home/krishnanantha/f1demo`. The working tree is `f1demo/` (yes, nested).
Phase 0 has resolved most hard blockers (see `f1demo/PHASE_0_COMPLETE.md`), but a follow-up audit
found 10 backend/wiring defects and a list of UI/UX/animation gaps. Fix every item below in order,
then run the verification block at the end.

Do **not** introduce unrelated refactors. After each fix, re-run the relevant tests. Keep diffs
tight and match the existing project style (CSS variables in `:root`, `var(--ease-out-expo)`,
class-based components, Zustand store, Vite + React 19).

---

## 1. Repair the GitHub Actions workflow (CRITICAL)

**File:** `f1demo/.github/workflows/ci.yml`

**Defect:** The file contains two concatenated YAML workflow documents, both `name: CI`. The first
(lines 1–24) was the original, broken backend-only workflow that uses repo-root-relative paths that
do not exist at the repository root. The second (lines 25–62) is the correct dual-job workflow with
`defaults.run.working-directory: f1demo/backend|f1demo/frontend`. GitHub Actions will reject this or
silently honor only one block.

**Fix:** Replace the entire file contents with **only** the second workflow (the one that has both
`backend` and `frontend` jobs). Drop the duplicated header. Final file should start with `name: CI`
exactly once and contain exactly one `jobs:` mapping with `backend` and `frontend` jobs.

**Verify:**
```bash
python -c "import yaml; yaml.safe_load(open('f1demo/.github/workflows/ci.yml'))"
# Must print no errors.
grep -c '^name: CI$' f1demo/.github/workflows/ci.yml   # must print 1
```

---

## 2. Make `routes/schedule.py` use the app limiter

**File:** `f1demo/backend/routes/schedule.py` (lines ~14, 68, 83)

**Defect:** Module creates its own `Limiter` instance:
```python
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
```
This is not the same instance that `main.py` registers via `app.state.limiter = limiter`, so the
`@limiter.limit("30/minute")` decorators never engage SlowAPI's middleware.

**Fix:** Promote the limiter to a shared module so both `main.py` and route modules import the same
instance.

Create `f1demo/backend/limiter.py`:
```python
"""Shared SlowAPI limiter instance used by main.py and route modules."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
```
Then change `main.py` to `from limiter import limiter` and `routes/schedule.py` to do the same,
removing its local `Limiter(...)` construction. Do not change the `@limiter.limit("30/minute")`
decorator lines — only the source of `limiter`.

**Verify:**
```bash
cd f1demo && ./.venv/bin/python -c "from backend.main import app, limiter as m; from backend.routes import schedule as s; assert m is s.limiter; print('OK')"
```

---

## 3. Remove or wire `useLiveSession.js`

**File:** `f1demo/frontend/src/hooks/useLiveSession.js`

**Defect:** Imported nowhere (only self-references). Audit's instruction: "delete or wire it into
the app." Keeping unused live-control code increases maintenance noise and risks bit-rot of the
notification path.

**Fix (default — delete):** Remove the file. Also remove `frontend/src/hooks/useNotifications.js`
*only if* it is exclusively imported by `useLiveSession.js` (verify with
`grep -r useNotifications f1demo/frontend/src` first; if any other module uses it, leave it alone).

**Verify (if deleted):**
```bash
! grep -r useLiveSession f1demo/frontend/src
```

---

## 4. Fix circuit-data file path mismatch

**Files:**
- `f1demo/backend/routes/misc.py` — reads `Path(__file__).resolve().parents[2] / "data" / "circuits.json"`, i.e. `f1demo/data/circuits.json`.
- `f1demo/scripts/generate_circuits_json.py` — writes `Path(__file__).resolve().parents[1] / "backend" / "data" / "circuits.json"`, i.e. `f1demo/backend/data/circuits.json`.

**Defect:** The generator and consumer disagree on the location, so running the generator does not
produce data the route can read.

**Fix:** Standardize on **one** location. Recommended: `f1demo/backend/data/circuits.json`.

1. Edit `routes/misc.py` so `data_dir = Path(__file__).resolve().parents[1] / "data"` (one level up
   from `routes/` → `backend/data`). Remove the JS-parsing fallback inside the route handler — it
   should treat a missing JSON file as a 503 with a helpful message.
2. Run the generator once to populate the file: `python f1demo/scripts/generate_circuits_json.py`.
3. Add `f1demo/backend/data/circuits.json` to git (it's static metadata).
4. Strengthen `test_circuit_map_endpoint.py` (see Step 7).

**Verify:**
```bash
cd f1demo && ./.venv/bin/python scripts/generate_circuits_json.py
test -s f1demo/backend/data/circuits.json
./.venv/bin/python -m pytest -q backend/tests/test_circuit_map_endpoint.py
```

---

## 5. Make `/internal/refresh-cache` actually clear the request cache

**Files:** `f1demo/backend/utils.py`, `f1demo/backend/routes/misc.py`

**Defect:** `cache_clear()` from `cache_store` only flushes the optional Redis/disk store. The
in-process `_cache: TTLCache` in `utils.py` (used by `cached_get`) is not touched, so refresh-cache
keeps stale OpenF1 responses for up to 60 s after a TI commit lands.

**Fix:**
1. In `utils.py`, add a small public function:
   ```python
   async def clear_request_cache() -> None:
       """Clear the in-process TTLCache used by cached_get."""
       async with _cache_lock:
           _cache.clear()
   ```
2. In `routes/misc.py`, change the handler to `async def`, await `clear_request_cache()` before the
   `cache_store.cache_clear()` call. Update the import to include `clear_request_cache`.
3. Add a test in `backend/tests/test_api.py` that populates `_cache` (mock `httpx.AsyncClient`),
   calls `/internal/refresh-cache` with the secret, then asserts `_cache` is empty.

**Verify:**
```bash
cd f1demo && ./.venv/bin/python -m pytest -q backend/tests/test_api.py
```

---

## 6. Drop unused `Request` import in `routes/live.py`

**File:** `f1demo/backend/routes/live.py` line 2

**Defect:** `from fastapi import APIRouter, Request, WebSocket, HTTPException` — `Request` is never
referenced.

**Fix:** Change to `from fastapi import APIRouter, WebSocket, HTTPException`.

**Verify:** `cd f1demo && ./.venv/bin/python -c "import backend.routes.live"` succeeds.

---

## 7. Strengthen `test_circuit_map_endpoint.py`

**File:** `f1demo/backend/tests/test_circuit_map_endpoint.py`

**Defect:** Current assertion accepts `200 or 501`, so a missing data file is silently green.

**Fix:** After Step 4, the file should be:
```python
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_circuit_map_returns_metadata():
    resp = client.get("/api/circuit-map/Bahrain")
    assert resp.status_code == 200
    data = resp.json()
    assert "fullName" in data
    assert "svgPath" in data


def test_circuit_map_404_for_unknown():
    resp = client.get("/api/circuit-map/NotARealCircuit")
    assert resp.status_code == 404
```

---

## 8. Add a news-ranking / dedup test

**File:** create `f1demo/backend/tests/test_news_service.py`

**Defect:** Audit's final coverage list explicitly called out "news ranking and dedup logic"; no
test covers it today. `services/news_service.py` dedupes only by exact lower-cased title, which is
worth pinning down before any Phase 3 rework.

**Fix sketch (adjust to actual signatures):**
```python
import asyncio
from unittest.mock import AsyncMock
from backend.services import news_service


def test_fetch_news_dedupes_by_title(monkeypatch):
    fake_feed = {
        "entries": [
            {"title": "Hamilton wins!", "link": "a", "published": "2026-05-19T10:00:00Z"},
            {"title": "HAMILTON WINS!", "link": "b", "published": "2026-05-19T11:00:00Z"},
            {"title": "Verstappen P2", "link": "c", "published": "2026-05-19T12:00:00Z"},
        ]
    }
    monkeypatch.setattr(news_service, "feedparser",
                        type("F", (), {"parse": staticmethod(lambda _: fake_feed)})())
    monkeypatch.setattr(news_service, "SOURCES", ["x"])
    cache_lookup = AsyncMock(return_value=None)
    cache_write = AsyncMock()
    logger = type("L", (), {"warning": lambda *a, **kw: None,
                             "error":   lambda *a, **kw: None,
                             "info":    lambda *a, **kw: None})()

    items = asyncio.run(news_service.fetch_news(cache_lookup, cache_write, logger))
    titles = [it["title"].lower() for it in items]
    assert titles.count("hamilton wins!") == 1
    assert "verstappen p2" in titles
```

**Verify:** `cd f1demo && ./.venv/bin/python -m pytest -q backend/tests/test_news_service.py`

---

## 9. Harden `routes/schedule.py::next_race` timezone handling

**File:** `f1demo/backend/routes/schedule.py` (around line 50)

**Defect:** Current code assumes the entire `EventDate` column is uniformly tz-aware or tz-naive,
which can blow up on mixed FastF1 returns:
```python
upcoming = s[s["EventDate"].dt.tz_localize("UTC") > now] \
    if s["EventDate"].dt.tz is None else s[s["EventDate"] > now]
```

**Fix:** Normalize first, then compare:
```python
ts = s["EventDate"]
if getattr(ts.dt, "tz", None) is None:
    ts = ts.dt.tz_localize("UTC")
else:
    ts = ts.dt.tz_convert("UTC")
upcoming = s[ts > now]
```

**Verify:** `cd f1demo && ./.venv/bin/python -m pytest -q backend/tests`

---

## 10. Mark `useAppInit.js` Phase-2 status with a TODO comment

**File:** `f1demo/frontend/src/hooks/useAppInit.js`

This was tagged as Phase 2 work in the audit; do **not** rewrite in this pass. Leave behavior as-is
but add a top-of-file comment so reviewers don't think it was overlooked:
```js
// NOTE: blocking Promise.all is intentional pre-Phase-2. Glance-first, independent
// widget loading is tracked in PHASE_1_ROADMAP.md > "Post-Phase 1 Work".
```

---

## 11. UI/UX, animation, and visual polish

The app already has a solid token system (`:root` in `f1demo/frontend/src/styles.css` defines
`--bg-darkest`, `--f1-red`, `--ease-out-expo`, `--ease-spring`, team colors), 86 animation
declarations, and skeleton classes. The gaps below are the high-leverage, low-risk wins. Apply
them in the order given. Each step lists exact files and code.

### 11.1 Accessibility-safe motion (`prefers-reduced-motion`)

**Why:** No `prefers-reduced-motion` rule exists anywhere in `frontend/src` (verified via grep).
WCAG 2.1 SC 2.3.3 requires honoring this user setting; current animations will run at full
amplitude even for users who explicitly opt out.

**File:** `f1demo/frontend/src/styles.css` — append at the bottom (or near the keyframe block):
```css
/* ── Reduced motion: respect user preference ── */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  /* Keep the live pulse subtle so live UX still reads as live */
  .lc-live-dot { animation: none; opacity: 1; }
}
```

### 11.2 Visible focus rings (`:focus-visible`)

**Why:** Grep confirms zero `:focus-visible` rules. Many `.sidebar-icon`, `button`, `a`, `kbd` and
`select` controls likely have no visible keyboard focus — a hard a11y blocker for keyboard users.

**File:** `f1demo/frontend/src/styles.css` — append:
```css
/* ── Keyboard focus ring (visible only on keyboard nav) ── */
:where(a, button, [role="button"], input, select, textarea, summary, [tabindex]):focus {
  outline: none;
}
:where(a, button, [role="button"], input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--f1-red);
  outline-offset: 2px;
  border-radius: 6px;
  box-shadow: 0 0 0 4px rgba(255, 30, 0, 0.18);
  transition: box-shadow 0.15s var(--ease-out-expo);
}
```

### 11.3 Skip-to-content link

**Why:** The sidebar has 7 nav links before the main content; keyboard and screen-reader users have
no way to bypass them.

**File:** `f1demo/frontend/src/App.jsx` — add the link as the first child inside `<div className="app-layout">`, and add an `id="main"` to `<main className="content">`:
```jsx
<div className="app-layout">
  <a className="skip-link" href="#main">Skip to content</a>
  <Sidebar />
  <div className="main-wrapper">
    <main id="main" className="content" tabIndex={-1}>
      …
    </main>
  </div>
  …
</div>
```

**File:** `f1demo/frontend/src/styles.css` — append:
```css
.skip-link {
  position: fixed;
  top: -40px;
  left: 1rem;
  z-index: 1000;
  background: var(--f1-red);
  color: #fff;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  font-weight: 700;
  letter-spacing: 0.3px;
  transition: top 0.2s var(--ease-out-expo);
  box-shadow: 0 6px 18px rgba(0,0,0,0.45);
}
.skip-link:focus-visible { top: 1rem; }
```

### 11.4 Live region for race-control alerts and live-mode flips

**Why:** `LiveCompanion.jsx` shows banner alerts (`<div className="lc-alert">…`) and the LIVE state
is purely visual. Screen readers cannot perceive a flag change. The Sidebar hamburger has
`aria-label` but no `aria-expanded`.

**File:** `f1demo/frontend/src/components/LiveCompanion.jsx`

- Add `role="status"` and `aria-live="polite"` to the alert wrapper:
  ```jsx
  <div className="lc-alert" role="status" aria-live="polite" aria-atomic="true" style={{ '--alert-color': alertColor }}>
  ```
- Add `aria-live="off"` to the timing tower (do **not** announce every position change — it would
  flood the user) but add `aria-label` so it reads as a region:
  ```jsx
  <div className="lc-tower" role="region" aria-label="Live timing tower" aria-live="off">
  ```
- Add an off-screen status sentence that flips when `isLive` changes:
  ```jsx
  <span className="sr-only" aria-live="polite">
    {isLive ? `${sessionName} is live.` : ''}
  </span>
  ```

**File:** `f1demo/frontend/src/components/Sidebar.jsx`
- Add `aria-expanded={collapsed}` and `aria-controls="primary-nav"` to the hamburger button.
- Add `id="primary-nav"` to the `<nav>`.
- Add `aria-hidden="true"` to every decorative `<svg>` inside `.sidebar-icon` and the hamburger
  (icons are paired with text labels, so the SVG is decorative).

**File:** `f1demo/frontend/src/styles.css` — append (only if `.sr-only` is not already defined; grep
to confirm):
```css
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}
```

### 11.5 Page transitions (route change choreography)

**Why:** Today, route changes pop in with no transition. Existing keyframes (`fadeSlideUp`,
`cardEntrance`) are perfect for a tasteful entry animation; we just need to apply them at the
route boundary without adding dependencies.

**File:** `f1demo/frontend/src/App.jsx` — wrap the `<Routes>` in a `<div>` keyed by the current
pathname so React remounts on navigation:
```jsx
import { Routes, Route, useLocation } from 'react-router-dom';
…
function RoutedContent() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-frame">
      <Routes location={location}>
        … (existing routes) …
      </Routes>
    </div>
  );
}

// Replace the existing <Routes>…</Routes> block inside <Suspense> with <RoutedContent />
```

**File:** `f1demo/frontend/src/styles.css` — append:
```css
.route-frame {
  animation: fadeSlideUp 280ms var(--ease-out-expo) both;
  will-change: transform, opacity;
}
@media (prefers-reduced-motion: reduce) {
  .route-frame { animation: none; }
}
```

### 11.6 Loading polish — use existing skeletons, not just the spinner

**Why:** `Suspense` fallback is a generic spinner (`<Loading text="Loading page..." />`). The app
already has `.skeleton-chart`, `.skeleton-row`, `.skeleton-card`, and a `shimmer` keyframe — they
are barely used.

**File:** `f1demo/frontend/src/components/Shared.jsx` — extend with shimmer-based skeletons:
```jsx
export function Skeleton({ width = '100%', height = '1rem', radius = '6px', style }) {
  return (
    <span
      className="skeleton-shimmer"
      style={{ width, height, borderRadius: radius, display: 'inline-block', ...style }}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <Skeleton height="2rem" width="40%" />
      <div style={{ height: '1rem' }} />
      <Skeleton height="200px" radius="12px" />
      <div style={{ height: '0.75rem' }} />
      <Skeleton height="1rem" width="80%" />
      <Skeleton height="1rem" width="60%" />
    </div>
  );
}
```

**File:** `f1demo/frontend/src/styles.css` — append (the `shimmer` keyframe already exists at the
top; just wire it):
```css
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.10) 50%,
    rgba(255,255,255,0.04) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
.page-skeleton {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 960px;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer { animation: none; background: rgba(255,255,255,0.06); }
}
```

**File:** `f1demo/frontend/src/App.jsx` — change the `Suspense` fallback:
```jsx
import { Loading, PageSkeleton } from './components/Shared';
…
<Suspense fallback={<PageSkeleton />}>
  <RoutedContent />
</Suspense>
```

Keep the `Loading` spinner export — it is used elsewhere.

### 11.7 Live-companion micro-interactions (already partially staggered)

`LiveCompanion.jsx` currently does `style={{ animationDelay: ${idx * 0.04}s }}` on each row but
the matching CSS rule may be missing or clipped. Make sure the row entrance reads cleanly and is
reduced-motion-safe.

**File:** `f1demo/frontend/src/styles.css` — append (or merge near `.lc-row` if already defined):
```css
.lc-row {
  display: grid;
  grid-template-columns: 1.5rem 0.75rem 2.5rem 1fr auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border-left: 3px solid var(--team-color, transparent);
  background: rgba(255,255,255,0.02);
  animation: slideInRight 360ms var(--ease-out-expo) both;
  transition: background 0.2s var(--ease-out-expo), transform 0.2s var(--ease-out-expo);
}
.lc-row:hover {
  background: rgba(255,255,255,0.05);
  transform: translateX(2px);
}
.lc-live-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--f1-red);
  box-shadow: 0 0 0 0 var(--f1-red-glow);
  animation: glowPulse 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .lc-row { animation: none; }
  .lc-live-dot { animation: none; }
}
```

### 11.8 Number-flip transition on lap times / gaps (optional, no deps)

**Why:** When a row's gap or position changes, the value swap is jarring (instant text replace).
A 120 ms cross-fade keyed on the value is enough to register the change without dependencies.

**File:** `f1demo/frontend/src/components/Shared.jsx` — append:
```jsx
import { useEffect, useState } from 'react';

export function FlipValue({ value, className = '', durationMs = 160 }) {
  const [shown, setShown] = useState(value);
  const [phase, setPhase] = useState('in');

  useEffect(() => {
    if (value === shown) return;
    setPhase('out');
    const t = setTimeout(() => {
      setShown(value);
      setPhase('in');
    }, durationMs);
    return () => clearTimeout(t);
  }, [value, shown, durationMs]);

  return (
    <span className={`flip-value flip-${phase} ${className}`}>{shown}</span>
  );
}
```

**File:** `f1demo/frontend/src/styles.css` — append:
```css
.flip-value {
  display: inline-block;
  transition: opacity 160ms var(--ease-out-expo), transform 160ms var(--ease-out-expo);
  font-variant-numeric: tabular-nums;
}
.flip-out { opacity: 0; transform: translateY(-4px); }
.flip-in  { opacity: 1; transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .flip-value { transition: none; }
  .flip-out, .flip-in { transform: none; }
}
```

Use it in `LiveCompanion.jsx` for the gap column:
```jsx
{gap && <FlipValue className="lc-gap" value={gap} />}
```

### 11.9 Toast / notification surface

**Why:** Errors today fall back to `<div className="error-msg">` and silent `console.warn`. There
is no transient feedback for success/info events (cache refreshed, session went live, etc.).

**File:** create `f1demo/frontend/src/components/Toast.jsx`:
```jsx
import { useEffect } from 'react';
import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), ...t }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info:    (msg) => useToastStore.getState().push({ tone: 'info', msg }),
  success: (msg) => useToastStore.getState().push({ tone: 'success', msg }),
  error:   (msg) => useToastStore.getState().push({ tone: 'error', msg }),
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 4500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="toast-host" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} role="status" aria-live="polite">
          <span>{t.msg}</span>
          <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
```

**File:** `f1demo/frontend/src/App.jsx` — render `<ToastHost />` once near the bottom (sibling to
`<LiveCompanion />`). Import: `import ToastHost from './components/Toast';`

**File:** `f1demo/frontend/src/styles.css` — append:
```css
.toast-host {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 999;
  max-width: min(360px, 90vw);
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  background: var(--bg-card-glass);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  color: var(--text);
  box-shadow: 0 12px 30px rgba(0,0,0,0.45);
  animation: slideInRight 320ms var(--ease-out-expo) both;
  font-size: 0.88rem;
}
.toast-info    { border-left: 3px solid var(--cyan); }
.toast-success { border-left: 3px solid var(--green); }
.toast-error   { border-left: 3px solid var(--f1-red); box-shadow: 0 12px 30px rgba(255,30,0,0.25); }
.toast-close {
  background: transparent;
  border: 0;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}
.toast-close:hover { color: var(--text); }
@media (prefers-reduced-motion: reduce) {
  .toast { animation: none; }
}
```

### 11.10 Web font preconnect + size cap (perceived performance)

**Why:** `frontend/src/styles.css` does
`@import url('https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700;900&display=swap');`
on first paint. Without `<link rel="preconnect">`, the browser opens the font connection late and
incurs FOIT. Also, `&display=swap` is already there — keep it. We only need to add the preconnect
and reduce the loaded weights to those actually used (verify via grep).

**File:** `f1demo/frontend/index.html` — add inside `<head>` before the `<title>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="preload"
  as="style"
  href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700;900&display=swap"
/>
```

(Optional, low risk) Verify weights actually referenced via
`grep -E "font-weight: ?(400|600|700|900)" f1demo/frontend/src/styles.css`. If any of those weights
are unused, drop them from the URL. Do not touch the existing `@import` if you do this — only the
HTML preconnect/preload.

### 11.11 Theming variables for light surface tokens (forward-looking, no UI change yet)

**Why:** Today colors are dark-only. Adding `color-scheme: dark` declares intent to the browser
(form controls, scrollbars) without forcing a light theme yet — a one-liner that pays off when a
light mode is added.

**File:** `f1demo/frontend/src/styles.css` — inside `:root`, add:
```css
color-scheme: dark;
```
And add to `body`:
```css
accent-color: var(--f1-red);
```

### 11.12 `<Loading>` text becomes visually stable (reduce CLS)

**File:** `f1demo/frontend/src/components/Shared.jsx`
```jsx
export function Loading({ text = 'Loading…' }) {
  return (
    <div className="loading" role="status" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <span className="loading-text">{text}</span>
    </div>
  );
}
```

**File:** `f1demo/frontend/src/styles.css` — ensure (only add what's missing):
```css
.loading {
  min-height: 8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  color: var(--text-muted);
}
.spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: var(--f1-red);
  border-radius: 50%;
  animation: rotateGlow 0.9s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; border-top-color: var(--f1-red); }
}
```

### 11.13 Sidebar polish (active link indicator, reduced jitter)

**File:** `f1demo/frontend/src/styles.css` — search for `.sidebar-icon.active` and replace the rule
with:
```css
.sidebar-icon { position: relative; }
.sidebar-icon.active {
  background: linear-gradient(90deg, rgba(255,30,0,0.18), rgba(255,30,0,0.04));
  color: #fff;
  box-shadow: 0 2px 12px rgba(225, 6, 0, 0.25);
}
.sidebar-icon.active::before {
  content: '';
  position: absolute;
  left: -0.75rem;
  top: 8px; bottom: 8px;
  width: 3px;
  background: var(--f1-red);
  border-radius: 0 3px 3px 0;
  box-shadow: 0 0 12px rgba(255,30,0,0.6);
}
.sidebar-icon:hover { transform: translateX(1px); } /* was 2px — feels less twitchy */
@media (prefers-reduced-motion: reduce) {
  .sidebar-icon, .sidebar-icon:hover { transform: none; }
}
```

### 11.14 Smooth scrolling and selection color

**File:** `f1demo/frontend/src/styles.css` — append:
```css
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

::selection {
  background: rgba(255, 30, 0, 0.35);
  color: #fff;
}
```

### 11.15 Ensure meta/theme color (mobile address bar, PWA-friendly)

**File:** `f1demo/frontend/index.html` — add inside `<head>`:
```html
<meta name="theme-color" content="#09090b" />
<meta name="color-scheme" content="dark" />
```

### 11.16 Tests for the new UI primitives

**File:** `f1demo/frontend/src/__tests__/Toast.test.jsx`
```jsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, expect, test } from 'vitest';
import ToastHost, { toast } from '../components/Toast';

test('toast appears and auto-dismisses', () => {
  vi.useFakeTimers();
  render(<ToastHost />);
  act(() => { toast.success('Saved!'); });
  expect(screen.getByText('Saved!')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  vi.useRealTimers();
});
```

**File:** `f1demo/frontend/src/__tests__/FlipValue.test.jsx`
```jsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, expect, test } from 'vitest';
import { FlipValue } from '../components/Shared';

test('FlipValue swaps value after transition', () => {
  vi.useFakeTimers();
  const { rerender } = render(<FlipValue value="+0.300" />);
  expect(screen.getByText('+0.300')).toBeInTheDocument();
  rerender(<FlipValue value="+0.250" />);
  act(() => { vi.advanceTimersByTime(200); });
  expect(screen.getByText('+0.250')).toBeInTheDocument();
  vi.useRealTimers();
});
```

(Adjust selectors if `@testing-library/jest-dom` matchers are not yet wired — `setup.js` already
imports it, so they should work.)

### 11.17 Lighthouse-grade smoke check (manual, optional)

After everything builds, run a quick Lighthouse pass on the dev server (Chrome DevTools → Lighthouse
→ Mobile → Accessibility + Performance). Goals:

- Accessibility ≥ 95 (skip-link, focus-visible, aria-live, reduced-motion all in place)
- Performance ≥ 85 (preconnect + preload should remove the FOIT spike)
- No "Background and foreground colors do not have a sufficient contrast ratio" findings on
  `--text-muted` over `--bg-card`. If any appear, bump `--text-muted` from `#a1a1aa` to `#b4b4bd`.

---

## Final verification block

Run from repo root:
```bash
# Backend
cd /home/krishnanantha/f1demo/f1demo
./.venv/bin/python -m pytest -q backend/tests   # expect green; count >= 23 + new tests

# YAML parses to a single workflow
python -c "import yaml, sys; doc=yaml.safe_load(open('.github/workflows/ci.yml')); assert doc.get('name')=='CI'; assert set(doc['jobs'])>={'backend','frontend'}; print('CI OK')"

# Frontend
cd frontend
npm run lint
npm run build
npm test

# Boot smoke
cd .. && bash start_dashboard.sh --skip-install &
sleep 15
curl -fsS http://localhost:8000/api/health | python -m json.tool
curl -fsS http://localhost:8000/api/circuit-map/Bahrain | python -m json.tool
curl -fsS -X POST http://localhost:8000/internal/refresh-cache \
  -H "X-Internal-Secret: changeme-in-production"
kill %1 2>/dev/null || true

# UI/UX checklist (manual)
# 1. Tab through the page — every focusable element shows a red focus ring.
# 2. First Tab on the dashboard reveals the "Skip to content" pill.
# 3. Toggle OS reduced-motion — animations and shimmer halt.
# 4. Trigger a route change — content fades up, no jarring pop.
# 5. While a session is live, the live dot pulses; race-control alert is announced by VoiceOver/NVDA.
# 6. Resize the browser narrow — hamburger toggles correctly with aria-expanded flipping.
```

Once everything is green, update `PHASE_0_COMPLETE.md` to add a "Follow-up patches" section listing
all 11 numbered fixes above and tick off the corresponding items in `PHASE_1_ROADMAP.md`.
