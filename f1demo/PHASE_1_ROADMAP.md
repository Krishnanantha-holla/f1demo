# Phase 1: Stabilization & Live Data Reliability

**Status**: ✅ All Phase 0 blockers fixed. App boots successfully.

## Verified State

- [x] Backend compiles cleanly (17/17 tests pass)
- [x] Frontend package.json valid JSON, npm ci succeeds
- [x] WebSocket signature aligned (live_stream service)
- [x] Removed broken language-boundary route (circuit_map)
- [x] Integration test: dashboard boots at http://localhost:5173

## Phase 1 Goals

1. **Live WebSocket reliability** — fix reconnection leaks, add error recovery
2. **Performance baseline** — measure and improve data polling efficiency
3. **Test coverage expansion** — add WebSocket, live routing, and circuit data tests
4. **Automator hardening** — fix INTERNAL_SECRET validation, clean dead file writes
5. **CI/CD validation** — ensure GitHub Actions workflow passes

---

## Detailed Roadmap

### 1. WebSocket Lifecycle Fix
**File**: `backend/src/hooks/useWebSocket.js`  
**Issue**: Reconnect timer fires even during cleanup, causing stale reconnect attempts after unmount.  
**Fix**:
```javascript
// Add active flag to prevent post-unmount reconnects
useEffect(() => {
  let active = true;
  
  const onclose = () => {
    if (active && reconnectCount < MAX_RETRIES) {
      reconnectTimer = setTimeout(() => connect(), backoffMs);
    }
  };
  
  return () => {
    active = false;
    clearTimeout(reconnectTimer);
  };
}, []);
```
**Priority**: High (blocks live UX stability)  
**Est. time**: 1-2 hours

---

### 2. Stream Polling Alignment
**Files**: `backend/services/live_stream.py`, `backend/routes/live.py`  
**Issue**: 
- Service polls `/position` and `/race_control`, but route exposes `/positions` and `/race_control_messages`
- Fixed polling interval (8s) with no adaptive backoff
  
**Fixes**:
- [ ] Verify OpenF1 actual resource names and align both service and route
- [ ] Add jittered exponential backoff (±30% on 8s base)
- [ ] Add circuit-specific lap count validation to prevent over-polling
- [ ] Log timing stats for perf monitoring

**Priority**: High (affects data freshness)  
**Est. time**: 2-3 hours

---

### 3. Automator Internal Endpoint Hardening
**Files**: `backend/automator.py`, `backend/routes/misc.py`  
**Issue**: `trigger_refresh()` sends POST to `/internal/refresh-cache` but route expects `INTERNAL_SECRET` header; automator may not set it.  
**Fixes**:
- [ ] Ensure automator reads `INTERNAL_SECRET` from env and passes it in header
- [ ] Remove or document the dead `public/session_mode.json` write
- [ ] Add trace logging for cache refresh trigger
- [ ] Test round-trip: automator → internal endpoint → cache update

**Priority**: Medium (impacts live refresh reliability)  
**Est. time**: 1-2 hours

---

### 4. Test Coverage Expansion
**Files**: `backend/tests/test_api.py`, `frontend/src/__tests__/`  
**Missing coverage**:
- [ ] WebSocket connect/disconnect/reconnect happy path
- [ ] WebSocket error handling (upstream 401, 500, timeout)
- [ ] Circuit data integrity check (frontend local data is complete)
- [ ] Automator state round-trip (read/write/reload)
- [ ] News service ranking and dedup logic

**Est. time**: 3-4 hours

---

### 5. Dead Code Cleanup
**Items**:
- [ ] Delete `backend/test_fastf1.py` (ad-hoc smoke script, not a real test)
- [ ] Move or delete unused imports in route modules (e.g., `re` in `live.py`)
- [ ] Review and remove `cache_lookup`, `cache_write` if unused in live path

**Priority**: Low (code hygiene)  
**Est. time**: 1 hour

---

### 6. CI/CD Validation
**File**: `.github/workflows/ci.yml`  
**Actions**:
- [ ] Run workflow against Phase 0 fixes
- [ ] Verify backend pytest and frontend build both pass
- [ ] Add npm lint to frontend job
- [ ] Confirm container build succeeds
- [ ] Test docker-compose up

**Priority**: Medium (shipping confidence)  
**Est. time**: 1-2 hours

---

## Dependency Graph

```
1. WebSocket Lifecycle Fix
   ↓
2. Stream Polling Alignment
   ↓
3. Automator Hardening
   ↓
4. Test Coverage (in parallel with above)
   ↓
5. Dead Code Cleanup (can be parallel)
   ↓
6. CI/CD Validation
```

---

## Success Criteria

- [x] Phase 0: All hard blockers fixed, app boots
- [ ] Phase 1: All tests pass, live data flows reliably for 10+ minutes, no console errors
- [ ] Phase 1: WebSocket reconnects after network interruption
- [ ] Phase 1: CI/CD workflow passes for full repo

---

## Notes

- **Automator 403 Issue**: Currently hitting 403 Forbidden on cache refresh. Likely because automator doesn't pass INTERNAL_SECRET header. Needs investigation.
- **Live Data Latency**: 8-second polling is acceptable for live timing but should measure end-to-end latency.
- **Frontend Large Files**: Dashboard (663 lines), Telemetry (1262 lines), Analysis (867 lines), RaceDetail (975 lines) are candidates for Phase 4 refactor, not Phase 1.
- **News Feed**: Baseline works but lacks clustering, entity scoring, and personalization. Phase 3 feature.

---

## Post-Phase 1 Work (Phase 2+)

- Dashboard glance-first redesign (independent widget loading)
- News entity extraction and clustering
- Telemetry page module split (3D, lap comparison, race sim)
- Global CSS extraction from 3,907-line monolith
- Advanced analytics (stint analysis, tire degradation models)
- Team radio search and filtering

