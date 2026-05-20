<!--
Thanks for contributing to F1 Demo. Fill in the sections below; delete what
does not apply. Linked issues will be closed automatically when this PR
merges to main.
-->

## Summary

<!-- One or two sentences: what does this change do, and why? -->

Closes #

## Scope

- [ ] Backend (FastAPI / automator)
- [ ] Frontend (React / Vite)
- [ ] Docs / DX
- [ ] Infra / CI

## Implementation notes

<!-- Anything reviewers should know about the approach, tradeoffs, or
non-obvious decisions. -->

## Testing

- [ ] `./.venv/bin/python -m pytest -q backend/tests` passes locally
- [ ] `cd frontend && npm run lint` is clean
- [ ] `cd frontend && npm test` passes
- [ ] `cd frontend && npm run build` succeeds
- [ ] Manual smoke: backend boots on :8000, frontend boots on :5173, dashboard renders

## Screenshots / clips (UI changes only)

<!-- Drag GIFs or PNGs here for any visible change. Include before / after if
the change is visual. -->

## Accessibility

- [ ] Keyboard navigation works for new controls
- [ ] Visible focus ring on every focusable element
- [ ] Reduced-motion preference respected for new animations
- [ ] Screen reader announces new live regions / status messages
- [ ] Color contrast verified for new text/background combinations

## Rollout

- [ ] No new env vars, or `.env.example` updated
- [ ] No breaking API change, or migration noted in `docs/deployment.md`
- [ ] Docs updated (`README.md` / `docs/*`) if user-facing
