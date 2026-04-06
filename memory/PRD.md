# HOME OS — TOPSEE COMMAND

## Architecture
- Vanilla JS IIFE: `/app/frontend/public/homeos.js`
- Flat CSS: `/app/frontend/public/homeos.css`
- HTML: `/app/frontend/public/index.html`
- PWA: manifest.json + service-worker.js
- Storage: localStorage `homeOS` (O(1) cached)

## Implemented

### Phase 1 — Core Shell
- [x] Header, Sidebar, Viewport, AI Bar, Portrait lock
- [x] 4-module router (mount/unmount), Wellbeing overlay
- [x] Lockout Protocol T1/T2/T3, VIRGIL messages, Live clock

### Phase 2 — Arena + PWA
- [x] PWA manifest + service worker
- [x] Arena: 2x2 KPI grid, Growth Nebula SVG, Funnel Pulse

### Phase 4 — THE LEDGER
- [x] Arena sub-router: OVERVIEW | THE LEDGER
- [x] Products + Transactions tables, SIMPLE/DETAILED toggle

### Phase 5 — THE NODE
- [x] 3-column grid (25%/40%/35%): Climate | Genio Matrix | Sentry
- [x] Climate: Strathdale VIC, temps (in/out), humidity
- [x] Network: status + latency
- [x] Genio Matrix: 3 device cards with toggle ON/OFF (persists to localStorage)
- [x] ON=green border/text, OFF=grey
- [x] Sentry: UNIDEN SOLO PRO, battery, last event
- [x] WAKE FEED: 3s RTSP connection simulation with blink cursor

## Testing
- Phase 1: 94% | Phase 2: 100% | Phase 4: 100% | Phase 5: 100%

## Backlog
### P0
- THE SANCTUM: Library (EB Garamond), wellbeing dashboard
### P1
- THE ORACLE: Forecasting theater, projections
### P2
- VIRGIL LLM (Hermes VPS), real device APIs, data export
