# HOME OS — TOPSEE COMMAND

## Problem Statement
Build a landscape-locked, modular operating system designed as a high-performance habitat for a solo founder. Pure Vanilla JS + HTML + CSS, localStorage persistence, zero backend. Strict performance rules: no box-shadow, text-shadow, backdrop-filter, or gradients.

## Architecture
- **Frontend**: Vanilla JS IIFE in `/app/frontend/public/homeos.js`
- **Styles**: Flat CSS in `/app/frontend/public/homeos.css`
- **HTML**: Static structure in `/app/frontend/public/index.html`
- **PWA**: manifest.json + service-worker.js for offline capability
- **Storage**: localStorage key `homeOS` (O(1) cached reads)
- **Framework**: CRA serves static files; React disabled (renders empty span)

## User Persona
Solo founder running a digital business from a home office. Needs a command-center OS with wellbeing monitoring, operational dashboards, and built-in resilience safeguards.

## Core Requirements (Static)
1. Landscape-locked UI with portrait overlay
2. 4-module router (ARENA, NODE, SANCTUM, ORACLE) with full DOM mount/unmount
3. Wellbeing check-in overlay (RECOVERY, VITALITY, TEMPER sliders)
4. Lockout Protocol (T1 Nudge, T2 Intervention, T3 Relapse)
5. VIRGIL AI message bar with contextual static messages
6. Sticky header with live clock and mode indicator
7. Matte Black / Charcoal / Lime Green color scheme
8. JetBrains Mono, Orbitron, EB Garamond font stack
9. PWA with offline caching
10. Arena business dashboard with KPI cards

## What's Been Implemented

### Phase 1 — Core Shell (2026-04-06)
- [x] Complete shell: Header, Sidebar, Viewport, AI Bar
- [x] Portrait lock overlay with "ROTATE TO ACCESS COMMAND"
- [x] 4-module navigation router with full mount/unmount
- [x] Wellbeing check-in overlay with 3 sliders (1-10)
- [x] dailyModifier calculation from wellbeing scores
- [x] 5-minute check-in interval logic
- [x] Settings panel with T1/T2/T3 toggles
- [x] T1 Nudge: VIRGIL blunt messages when energy < 0.4
- [x] T2 Intervention: Arena lockout after 2hr idle under T1
- [x] T3 Relapse: Configurable time limit with ACTIVATE
- [x] Mode indicator (OPERATIONAL/NUDGE/INTERVENTION/LOCKDOWN)
- [x] Activity tracking with debounced localStorage writes
- [x] Live clock (Orbitron font)
- [x] CSS compliance: zero shadows, zero blur, zero gradients
- [x] All data-testid attributes on interactive elements

### Phase 2 — Arena + PWA (2026-04-06)
- [x] PWA manifest.json (standalone, landscape orientation)
- [x] Service worker with stale-while-revalidate caching
- [x] SVG icon for PWA
- [x] THE ARENA module: 2x2 KPI grid
  - Lead Velocity: 42 leads
  - Conversion Efficiency: 2.4%
  - Customer LTV: $34.50
  - Monthly Net Profit: $4,200
- [x] Card 4 expandable: full-width with Growth Nebula SVG chart
- [x] Growth Nebula: 2px lime green line chart, $15k target, 12 data points
- [x] LIVE FUNNEL PULSE: auto-scrolling mock terminal, 6s interval, max 10 events
- [x] Arena data persisted in localStorage
- [x] localStorage migration for existing users (adds arena field)

## Testing Status
- Phase 1: 94% pass (15/16 categories) — toggle automation quirk only
- Phase 2: 100% pass (18/18 categories)

## Prioritized Backlog

### P0 (Next Phase)
- THE NODE content: Home automation grid, sentry camera placeholders, smart home controls
- THE SANCTUM content: Library with EB Garamond reading mode, mental health tools

### P1
- THE ORACLE content: Forecasting theater, growth projections, gut-feeling notes
- Arena: editable KPI values, real-time totals

### P2
- VIRGIL integration with local Hermes VPS LLM
- Real home automation API integrations for THE NODE
- Data export/import for localStorage backup
- Notification system / ambient tones

## Next Tasks
1. Build NODE module content (smart home grid, sentry feed placeholder)
2. Build SANCTUM module content (library, wellbeing dashboard)
3. Build ORACLE module content (forecasting theater, projections)
4. Add editable KPI values to Arena
5. Wire VIRGIL to Hermes VPS when ready
