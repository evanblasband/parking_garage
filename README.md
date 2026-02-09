# Variable Pricing Parking Garage Demo

Interactive demo showcasing a revenue-maximizing variable pricing system for a parking garage, themed around FIFA World Cup 2026 at MetLife Stadium, New Jersey. Built as a portfolio piece demonstrating dynamic pricing algorithms, real-time WebSocket communication, and modern React development.

## Overview

A simulated parking garage where prices adjust dynamically based on occupancy, time of day, demand forecasts, location, and event context. The core is a three-layer pricing engine that uses price elasticity of demand to find the revenue-maximizing price point for each spot.

**Key features:**
- Three-layer pricing engine (base price, context multipliers, elasticity optimization)
- Real-time garage visualization with 10x10 CSS Grid (100 spaces)
- **Auto-booking simulation** with price-sensitive demand and realistic occupancy patterns (fills to 95% by game time)
- Manual booking flow with 30-second price locking and full breakdowns
- Time simulation (6 AM - 11:59 PM) with play/pause controls
- Operator dashboard with revenue, occupancy, and pricing metrics
- End-of-day summary with final statistics
- WebSocket-driven real-time updates with auto-reconnect
- FIFA World Cup 2026 themed dark dashboard aesthetic

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS v4, Vite |
| Backend | FastAPI (Python), WebSocket |
| State | In-memory (no database) |
| Real-time | WebSocket push from server |
| Testing | pytest (161 tests) |

## Project Structure

```
├── backend/
│   ├── main.py                 # FastAPI entry point + WebSocket endpoint
│   ├── config/
│   │   └── settings.py         # Enums, pricing config, garage config, demand curve
│   ├── models/
│   │   ├── space.py            # Space model (id, type, zone, row, col, distance)
│   │   ├── reservation.py      # Reservation model
│   │   └── garage.py           # GarageState + initialize_garage()
│   ├── engine/
│   │   ├── pricing.py          # Three-layer pricing engine with elasticity
│   │   └── simulation.py       # Auto-booking and auto-clearing engine
│   └── tests/
│       ├── test_garage_init.py # Garage initialization tests (19 tests)
│       ├── test_pricing.py     # Pricing engine tests (51 tests)
│       └── test_api.py         # WebSocket API tests (48 tests)
├── frontend/
│   ├── src/
│   │   ├── types/index.ts      # TypeScript interfaces matching backend
│   │   ├── context/            # React Context + useReducer + WebSocket
│   │   │   └── GarageContext.tsx
│   │   └── components/
│   │       ├── GarageGrid/     # 10x10 CSS Grid visualization
│   │       ├── BookingPanel/   # Slide-out booking flow with price breakdown
│   │       ├── TimeControls/   # Play/pause + time slider
│   │       ├── OperatorPanel/  # Metrics dashboard (revenue, occupancy)
│   │       ├── IntroModal/     # Welcome modal with instructions
│   │       ├── MobileWarning/  # Desktop-only warning (<1280px)
│   │       └── DaySummaryModal/ # End-of-day statistics summary
│   ├── package.json
│   └── vite.config.ts
├── CLAUDE.md                   # AI assistant instructions
├── DECISIONS.md                # Technical decision log
├── PRICING_LOGIC.md            # Detailed pricing engine documentation
└── PROGRESS.md                 # Task tracker
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend

```bash
# From project root
pip install -r backend/requirements.txt

# Start the server
python3 -m uvicorn backend.main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000` with:
- WebSocket endpoint: `ws://localhost:8000/ws`
- Health check: `GET /health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

**Note:** Requires a screen width of at least 1280px for optimal experience.

### Running Both Together

```bash
# Terminal 1: Backend
python3 -m uvicorn backend.main:app --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

Then open `http://localhost:5173` in your browser.

## Running Tests

```bash
# All backend tests (161 tests)
python3 -m pytest backend/tests/ -v

# Specific test files
python3 -m pytest backend/tests/test_garage_init.py -v   # 19 tests
python3 -m pytest backend/tests/test_pricing.py -v       # 51 tests
python3 -m pytest backend/tests/test_api.py -v           # 48 tests
python3 -m pytest backend/tests/test_simulation.py -v    # 43 tests
```

## Pricing Engine

The pricing engine maximizes `Revenue = Price × Expected_Bookings(Price)` using three layers:

### Layer 1: Base Price
Per spot type:
- Standard: $10/hr
- EV Charging: $15/hr
- Motorcycle: $5/hr

### Layer 2: Context Multipliers
Five factors applied multiplicatively:

| Factor | Range | Description |
|--------|-------|-------------|
| Occupancy | 1.0× - 4.0× | Non-linear curve (1.0× at ≤50%, 4.0× at 100%) |
| Time | 0.5× - 2.5× | Relative to 7 PM game time |
| Demand | 0.05× - 1.0× | Hourly forecast curve peaking at hour 19 |
| Location | 0.8× - 1.3× | Zone A (near) premium, Zone C (far) discount |
| Event | 2.0× | World Cup multiplier |

### Layer 3: Elasticity Optimization
Adjusts the context-multiplied price based on segment elasticity:
- **Inelastic segments** (EV, last-minute, near entrance): Price pushed up
- **Elastic segments** (far spots, advance booking): Price reduced for volume

**Guardrails:** $5/hr floor, $50/hr ceiling.

**Detailed documentation:** See [PRICING_LOGIC.md](PRICING_LOGIC.md) for a comprehensive walkthrough with examples and economic reasoning.

## Garage Layout

10×10 grid (100 spaces) with three zones:

| Zone | Rows | Description | Spot Types |
|------|------|-------------|------------|
| A | 0-2 | Near entrance | Standard + EV (cols 0-1) |
| B | 3-6 | Middle | Standard |
| C | 7-9 | Far from entrance | Standard + Motorcycle (cols 8-9) |

Entrance is at row 0, center columns.

## WebSocket Protocol

### Client → Server
```
select_spot    { space_id }           # Select and hold a spot
release_spot   { space_id }           # Release a held spot
book_spot      { space_id, duration } # Confirm booking (1-4 hours)
set_playing    { is_playing }         # Play/pause simulation
set_time       { time }               # Scrub to specific time
set_simulation { enabled }            # Toggle auto-booking simulation
reset          {}                     # Reset to 6 AM
get_state      {}                     # Request full state snapshot
```

### Server → Client
```
state_snapshot    { state, prices, metrics }  # Full state (on connect, tick, booking)
spot_held         { space_id, price_result }  # Spot selected, price locked
spot_released     { space_id }                # Hold released
booking_confirmed { reservation }             # Booking successful
booking_failed    { space_id, reason }        # Booking failed
day_complete      { stats }                   # Simulation reached 11:59 PM
error             { message }                 # Generic error
```

## Features

### Completed
- ✅ Three-layer pricing engine with elasticity optimization
- ✅ FastAPI backend with WebSocket endpoint
- ✅ 30-second spot hold system with price locking
- ✅ Time simulation (play/pause/scrub)
- ✅ React frontend with TypeScript
- ✅ 10×10 garage grid visualization
- ✅ Slide-out booking panel with full price breakdown
- ✅ Operator dashboard (revenue, occupancy, avg price)
- ✅ Intro modal and mobile warning
- ✅ Auto-reconnect with exponential backoff
- ✅ **Auto-booking simulation engine** (price-sensitive, target-occupancy-driven, realistic sporting event patterns)
- ✅ **End-of-day summary modal** with final statistics
- ✅ **Simulation toggle** (Auto: ON/OFF)
- ✅ 161 passing tests

### Planned
- ⬜ Speed controls (2×, 5×, 10×)
- ⬜ Recharts sparklines and trend graphs
- ⬜ Docker Compose deployment
- ⬜ Railway cloud deployment

## License

MIT
