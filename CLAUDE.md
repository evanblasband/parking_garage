# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive demo application showcasing a revenue-maximizing variable pricing system for a 500-space parking garage. Themed around FIFA World Cup 2026 at MetLife Stadium, New Jersey. This is a portfolio piece — the demo must be polished, self-explanatory, and error-free.

The full specification lives in `prd-parking (1).md`.

## Tech Stack

- **Language:** Python
- **UI Framework:** Streamlit
- **Architecture:** Client-side only, all state in-memory (Streamlit session state), no backend/database

## Commands

```bash
pip install -r requirements.txt     # Install dependencies
streamlit run main.py               # Run the application
```

## Project Structure

```
parking_demo/
├── main.py                 # Streamlit entry point
├── components/             # UI components (garage map, panels, controls)
├── engine/                 # Core logic (pricing, simulation, demand forecast)
├── models/                 # Dataclasses (Space, Reservation, AppState)
├── config/                 # Settings, constants, pricing config
└── utils/                  # Shared helpers
```

## Architecture

### Three-Layer Pricing Engine

The pricing engine is the core of this project. It maximizes `Revenue = Price × Expected_Bookings(Price)` using price elasticity of demand.

1. **Layer 1 — Base Price:** Per spot type (Standard $10, EV $15, Motorcycle $5 per hour)
2. **Layer 2 — Context Multipliers:** Five multipliers applied to base price:
   - Occupancy (non-linear curve: 1.0x at ≤50%, up to 4.0x at 100%)
   - Time of day (relative to 7 PM game time)
   - Demand forecast (pre-loaded hourly curve peaking at hour 19)
   - Location (distance from entrance, by zone A/B/C)
   - Event (2.0x for World Cup)
3. **Layer 3 — Elasticity Optimization:** Adjusts context price based on price elasticity of demand per segment. Inelastic segments (EV, last-minute) get pushed toward ceiling; elastic segments (far spots, advance booking) get reduced for volume.

**Guardrails:** Floor $5/hr, ceiling $50/hr, max change ±20% per interval.

### Simulation Engine

Runs on a tick loop when "Simulate Other Users" is toggled on:
- **Auto-booking:** Price-sensitive random bookings weighted by inverse price, rate influenced by hourly demand forecast curve
- **Auto-clearing:** Expired reservations cleared; 10% early departure chance per tick
- Target: garage reaches 90%+ occupancy by 7 PM

### Garage Layout

- 25 columns × 20 rows = 500 spaces
- Zone A (rows 1-5, near entrance), Zone B (rows 6-15), Zone C (rows 16-20, far)
- EV spots: Zone A columns 1-3 (75 spots), Motorcycle: Zone C columns 23-25 (25 spots), Standard: remaining (400)
- Entrance/exit at row 1, center columns

### Key Data Models

- `Space`: id, type (STANDARD/EV/MOTORCYCLE), zone (A/B/C), row, col, distance_to_entrance
- `Reservation`: id, space_id, start/end time, locked price, total cost, is_simulated flag, status (ACTIVE/COMPLETED/CANCELLED)
- `PriceResult`: final_price plus full breakdown of every multiplier and elasticity adjustment
- `AppState`: Single container holding current_time, spaces, reservations, simulation state, event_log

### Elasticity Parameters

| Segment | Elasticity | Behavior |
|---------|-----------|----------|
| Standard far (Zone C) | ~1.3 | Elastic — reduce price for volume |
| Standard near (Zone A) | ~0.9 | Inelastic — convenience premium |
| EV charging | 0.7 | Inelastic — captive demand |
| Last-minute (<1hr) | modified ×0.7 | Very inelastic — time pressure |
| Advance (>4hr) | modified ×1.2 | Elastic — can shop around |

### Demand Forecast Curve

Pre-loaded hourly values from 6 AM to 11 PM, peaking at 1.0 at hour 19 (game time). Key shape: gradual ramp from 0.05 at 6 AM → 0.60 at 4 PM → 1.00 at 7 PM → drops to 0.10 at 11 PM.

## UI Structure

- **Top bar:** Time controls (slider 6 AM–11:59 PM, play/pause, speed 1×/2×/5×/10×)
- **Main area:** Grid-based garage map with color-coded spots + selection/booking panel
- **Right sidebar:** Operator panel (revenue, occupancy, avg price, bookings/hour, demand forecast chart)
- **Bottom/tab:** System transparency panel (event log, price factor breakdown, occupancy/revenue trend charts)
- **Theme:** FIFA World Cup 2026 colors (deep blue, red, white)
