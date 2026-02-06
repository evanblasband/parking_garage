# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive demo application showcasing a revenue-maximizing variable pricing system for a parking garage. Themed around FIFA World Cup 2026 at MetLife Stadium, New Jersey. This is a portfolio piece for Arena AI — the demo must be polished, self-explanatory, and error-free. It will be cloud-hosted for async viewing by the Arena team.

The full specification lives in `prd-parking (1).md`.

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + Recharts
- **Backend:** FastAPI (Python) with WebSocket support
- **State:** Single in-memory GarageState instance on the server (no database)
- **Real-time:** WebSocket push — server owns simulation tick loop, pushes state to clients
- **Deployment:** Railway (primary, cloud-hosted) + Docker Compose (secondary, local)

## Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Tests
cd backend
pytest                          # All tests
pytest tests/test_pricing.py    # Pricing engine unit tests
pytest tests/test_api.py        # API integration tests

# Docker (full stack)
docker-compose up --build
```

## Project Structure

```
/
├── frontend/                    # React + TypeScript app
│   ├── src/
│   │   ├── components/          # UI components
│   │   │   ├── GarageGrid/      # CSS Grid garage visualization
│   │   │   ├── BookingPanel/    # Slide-out booking side panel
│   │   │   ├── TimeControls/    # Slider, play/pause
│   │   │   ├── OperatorPanel/   # Metrics dashboard (right sidebar)
│   │   │   ├── SystemPanel/     # Collapsible bottom drawer (post-MVP)
│   │   │   └── IntroModal/      # Dismissible intro, re-openable via "?" button
│   │   ├── context/             # React Context + useReducer state management
│   │   ├── hooks/               # WebSocket connection, auto-reconnect logic
│   │   └── types/               # TypeScript interfaces matching backend Pydantic models
│   └── package.json
├── backend/
│   ├── main.py                  # FastAPI entry point + WebSocket endpoint
│   ├── engine/
│   │   ├── pricing.py           # Three-layer pricing engine with elasticity
│   │   ├── simulation.py        # Auto-booking and clearing tick loop
│   │   └── demand_forecast.py   # Pre-loaded hourly demand curve
│   ├── models/
│   │   ├── space.py             # Space Pydantic model
│   │   ├── reservation.py       # Reservation Pydantic model
│   │   └── garage.py            # GarageState container
│   ├── config/
│   │   └── settings.py          # Pricing config, garage config, all constants
│   └── tests/
│       ├── test_pricing.py      # Pricing engine unit tests
│       └── test_api.py          # FastAPI + WebSocket integration tests
├── docker-compose.yml
├── Dockerfile.frontend
├── Dockerfile.backend
└── prd-parking (1).md
```

## Architecture

### Three-Layer Pricing Engine

The pricing engine is the core of this project. It maximizes `Revenue = Price x Expected_Bookings(Price)` using price elasticity of demand. The model is economically rigorous but has tunable parameters so demo output looks dramatic.

1. **Layer 1 — Base Price:** Per spot type (Standard $10, EV $15, Motorcycle $5 per hour)
2. **Layer 2 — Context Multipliers:** Five multipliers applied to base price:
   - Occupancy (non-linear curve: 1.0x at <=50%, up to 4.0x at 100%)
   - Time of day (relative to 7 PM game time)
   - Demand forecast (pre-loaded hourly curve peaking at hour 19)
   - Location (distance from entrance, by zone A/B/C)
   - Event (2.0x for World Cup)
3. **Layer 3 — Elasticity Optimization:** Adjusts context price based on price elasticity of demand per segment. Inelastic segments (EV, last-minute) get pushed toward ceiling; elastic segments (far spots, advance booking) get reduced for volume.

**Guardrails:** Floor $5/hr, ceiling $50/hr. No price smoothing (±20% cap dropped) — prices jump freely for dramatic demo effect.

### WebSocket Communication

- **Hybrid payload strategy:** Delta events for simulation ticks, full state snapshot on initial connect and after user actions (bookings)
- **Auto-reconnect:** Frontend retries with exponential backoff on disconnect, requests full state snapshot on reconnect, shows "reconnecting..." banner
- **Price locking:** When user selects a spot, server creates a 30-second hold. Price is locked at selection time, not at booking confirmation time

### Simulation Engine (Post-MVP)

Server-side tick loop running via WebSocket push:
- **Auto-booking:** Price-sensitive random bookings weighted by inverse price, rate influenced by hourly demand forecast curve
- **Auto-clearing:** Expired reservations cleared; 10% early departure chance per tick
- Target: garage reaches 90%+ occupancy by 7 PM

### Garage Layout

Grid size is configurable via `GarageConfig`. MVP uses 10x10 (100 spaces), scales to 25x20 (500 spaces):
- Zone A (near entrance), Zone B (middle), Zone C (far)
- EV spots near entrance, Motorcycle spots far side, Standard everywhere else
- Entrance/exit at row 1, center columns

### Key Data Models

- `Space`: id, type (STANDARD/EV/MOTORCYCLE), zone (A/B/C), row, col, distance_to_entrance
- `Reservation`: id, space_id, start/end time, locked price, total cost, is_simulated flag, status (ACTIVE/COMPLETED/CANCELLED)
- `PriceResult`: final_price plus full breakdown of every multiplier and elasticity adjustment
- `GarageState`: Single server-side container holding current_time, spaces, reservations, simulation state, event_log

### Elasticity Parameters

| Segment | Elasticity | Behavior |
|---------|-----------|----------|
| Standard far (Zone C) | ~1.3 | Elastic — reduce price for volume |
| Standard near (Zone A) | ~0.9 | Inelastic — convenience premium |
| EV charging | 0.7 | Inelastic — captive demand |
| Last-minute (<1hr) | modified x0.7 | Very inelastic — time pressure |
| Advance (>4hr) | modified x1.2 | Elastic — can shop around |

### Demand Forecast Curve

Pre-loaded hourly values from 6 AM to 11 PM, peaking at 1.0 at hour 19 (game time). Key shape: gradual ramp from 0.05 at 6 AM -> 0.60 at 4 PM -> 1.00 at 7 PM -> drops to 0.10 at 11 PM.

## UI Structure

- **Top bar:** Time controls (slider 6 AM-11:59 PM, play/pause). Speed controls (2x/5x/10x) deferred to post-MVP.
- **Main area:** CSS Grid garage map with color-coded divs + slide-out booking side panel on spot selection
- **Right sidebar:** Operator panel — metric cards with large numbers (Recharts sparklines deferred to post-MVP). Revenue projection uses demand-curve-weighted extrapolation.
- **Bottom drawer (post-MVP):** Collapsible system transparency panel (event log rolling window of last 50 entries, price factor breakdown, occupancy/revenue trend charts)
- **Intro modal:** Shown on first load, dismissible, re-openable via "?" button
- **Theme:** FIFA World Cup 2026 colors (deep blue, red, white), dark dashboard aesthetic
- **Desktop only:** 1280px+ minimum. Show explicit "best viewed on desktop" message for smaller viewports.
- **Sim vs user bookings:** Subtle visual indicator — same color family, small icon or shade difference

### End of Day

When simulation reaches 11:59 PM, auto-stop with a "Day Complete" summary overlay showing final revenue, total bookings, peak occupancy, and average price.

## MVP Scope

**In (this weekend):**
- 10x10 grid (100 spaces), configurable to scale to 500
- Pricing engine with three-layer model + tunable params
- Manual booking flow (click spot -> slide-out panel -> select duration -> book)
- Time slider with play/pause at 1x speed (1 sim-hour per 10 real-seconds, full day in ~3 min)
- Operator panel with numeric metric cards (no charts)
- Intro modal (dismissible + re-openable)
- Desktop-only layout with small-screen warning
- FastAPI backend with WebSocket
- Pricing engine unit tests + API integration tests

**Deferred (post-MVP):**
- Auto-booking simulation engine (tick loop)
- System transparency panel (collapsible bottom drawer)
- Speed controls (2x/5x/10x)
- Recharts sparklines and trend graphs in operator panel
- Scale to full 500-space grid
- Railway cloud deployment

## Testing

- **Pricing engine unit tests:** Verify multiplier curves, elasticity adjustments, guardrails, edge cases
- **API integration tests:** FastAPI endpoints + WebSocket connection, booking flow, state management
