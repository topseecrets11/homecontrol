# HOME OS — TOPSEE COMMAND

## Problem Statement
Landscape-locked, modular OS for a solo founder. Pure Vanilla JS + localStorage, zero backend. Strict: no box-shadow, text-shadow, backdrop-filter, gradients.

## Architecture
- Vanilla JS IIFE: `/app/frontend/public/homeos.js`
- Flat CSS: `/app/frontend/public/homeos.css`
- Static HTML: `/app/frontend/public/index.html`
- PWA: manifest.json + service-worker.js
- Storage: localStorage key `homeOS` (O(1) cached reads)

## What's Been Implemented

### Phase 1 — Core Shell (2026-04-06)
- [x] Header, Sidebar, Viewport, AI Bar
- [x] Portrait lock, 4-module router (mount/unmount)
- [x] Wellbeing overlay (RECOVERY/VITALITY/TEMPER sliders)
- [x] Lockout Protocol (T1 Nudge, T2 Intervention, T3 Relapse)
- [x] VIRGIL contextual messages, live clock, mode indicators

### Phase 2 — Arena + PWA (2026-04-06)
- [x] PWA manifest (standalone, landscape) + service worker (offline cache)
- [x] Arena: 2x2 KPI grid, expandable Growth Nebula SVG chart
- [x] LIVE FUNNEL PULSE terminal (6s interval, max 10 events)

### Phase 4 — THE LEDGER (2026-04-06)
- [x] Arena sub-router: OVERVIEW | THE LEDGER tabs
- [x] Full mount/unmount between sub-views
- [x] Products table (ID, NAME, SALES, REV) — left column
- [x] Transactions table — right column
- [x] SIMPLE mode: TX, TIME, PRODUCT, STATUS (paid=#32CD32, abandoned=#555)
- [x] DETAILED mode: TX, TIME, PRODUCT, AMT, SOURCE, CUSTOMER
- [x] Instant re-render on view toggle
- [x] Products/transactions data persisted in localStorage
- [x] Funnel interval cleanup on sub-view switch

## Testing
- Phase 1: 94% (15/16) — toggle automation quirk
- Phase 2: 100% (18/18)
- Phase 4: 100% (17/17)

## Backlog
### P0
- THE NODE: Smart home grid, sentry placeholders
- THE SANCTUM: Library (EB Garamond reading mode), wellbeing dashboard

### P1
- THE ORACLE: Forecasting theater, growth projections
- Arena: editable transaction entries, computed KPIs from raw data

### P2
- VIRGIL local LLM (Hermes VPS)
- Real home automation APIs
- Data export/import
