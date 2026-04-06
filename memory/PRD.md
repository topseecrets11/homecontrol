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
- [x] Sentry: UNIDEN SOLO PRO, battery, last event, WAKE FEED

### Phase 6 — THE AESTHETICS ENGINE
- [x] Dark granite CSS texture (body::after radial-gradient, 0.4 opacity)
- [x] 12px border-radius on all cards/panels via CSS var(--radius)
- [x] CSS variable theme engine (--theme-accent, --theme-accent-dim)

### THE FINAL CIRCUIT (Feb 2026)
- [x] Global Spacing: --os-gap: 24px, all grids/flex use var(--os-gap)
- [x] Custom Color Picker: Single [ CUSTOM COLOR ] button triggers native input[type=color]
- [x] Settings Redesign: 3 tabs [ AESTHETICS | CONNECTIONS | SYSTEM MEMORY ]
- [x] Connections: Password-masked inputs for Hetzner IP, Stripe Key, Tuya ID → homeOS.config
- [x] System Memory: [ EXPORT ] downloads home_os_backup.json, [ IMPORT ] uploads/parses/reloads
- [x] THE SANCTUM: Sub-nav LIBRARY | RESILIENCE
- [x] Library: 2-column (280px catalog + reading pane), EB Garamond 24px
- [x] Intervention Mode: body bg → #1a1814, accent → Aged Gold #d4af37, reverts on close
- [x] Resilience: Daily Non-Negotiables checklist (90m Deep Work, Zone 2, 19:00 Hard-Stop), auto-reset, progress counter
- [x] THE ORACLE: Forecasting Theater
- [x] Hero display: ESTIMATED MONTHLY REVENUE with Orbitron 2.8rem
- [x] SVG Area Chart: 12-month projection, updates live with sliders
- [x] 3 Range Sliders: Ad Spend ($0-$5k), Conv Rate (0.5%-5%), LTV ($10-$200)
- [x] Formula: (adSpend / 0.50) * (convRate / 100) * ltv

## Testing
- Phase 1: 94% | Phase 2: 100% | Phase 4: 100% | Phase 5: 100% | Phase 6: 100% | Final Circuit: 100%

## Backlog
### P1
- VIRGIL LLM (Hermes VPS), real Tuya/Sentry device APIs, data export improvements
### P2
- Additional Library entries, Oracle forecasting enhancements
