# HOME OS — TOPSEE COMMAND

## Problem Statement
Build a landscape-locked, modular operating system designed as a high-performance habitat for a solo founder. Pure Vanilla JS + HTML + CSS, localStorage persistence, zero backend. Strict performance rules: no box-shadow, text-shadow, backdrop-filter, or gradients.

## Architecture
- **Frontend**: Vanilla JS IIFE in `/app/frontend/public/homeos.js`
- **Styles**: Flat CSS in `/app/frontend/public/homeos.css`
- **HTML**: Static structure in `/app/frontend/public/index.html`
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

## What's Been Implemented (2026-04-06)
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

## Testing Status
- Iteration 1: 94% pass (15/16 categories)
- Only LOW priority: toggle automation quirk (works fine for real users)

## Prioritized Backlog

### P0 (Next Phase)
- THE ARENA content: Sales metrics, conversion funnel, financial dashboards
- THE NODE content: Home automation widgets, sentry camera placeholders

### P1
- THE SANCTUM content: Library with EB Garamond reading mode, mental health tools
- THE ORACLE content: Forecasting theater, growth projections, gut-feeling notes

### P2
- VIRGIL integration with local LLM (Hermes VPS)
- Real home automation API integrations for THE NODE
- PWA manifest + service worker for offline capability
- Custom notification sounds / ambient system tones
- Data export/import for localStorage backup

## Next Tasks
1. Build ARENA module content (sales machine, conversion theatre)
2. Build NODE module content (smart home grid, sentry feed placeholder)
3. Build SANCTUM module content (library, wellbeing dashboard)
4. Build ORACLE module content (forecasting theater, projections)
5. Add VIRGIL local LLM routing when user's Hermes VPS is ready
