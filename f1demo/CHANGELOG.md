# Changelog

All notable changes for this workspace are documented in this file.

## Unreleased (2026-05-20)

- Phase F: Dashboard redesign — glance-first 4-pane layout, independent widget loading.
- Phase H: Live reliability — WebSocket with SSE fallback and latency tracking.
- Backend: Added numerous tests and fixed async mocking issues in `cached_get`.
- Phase K: Accessibility — added `e2e/a11y-jsdom.js` axe-core checks (jsdom) as a Playwright-free fallback.
- Phase G: PWA baseline — `manifest.webmanifest` and `sw.js` added.
- Feature roadmap: added scaffolded endpoints and pages for head-to-head comparison, results archive, track DNA, and consistency tracking.
- Validation: added focused backend tests for the new comparison and archive routes.
