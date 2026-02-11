# Watch A Demo

[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/lUGM1Rb20hU/0.jpg)](https://www.youtube.com/watch?v=lUGM1Rb20hU)

# Variable Pricing Parking Garage Demo

Interactive demo showcasing a revenue-maximizing variable pricing system for a parking garage, themed around FIFA World Cup 2026 at MetLife Stadium, New Jersey. Built as a portfolio piece demonstrating dynamic pricing algorithms, real-time WebSocket communication, and modern React development.

## Overview

A simulated parking garage where prices adjust dynamically based on occupancy, time of day, demand forecasts, location, and event context. The core is a three-layer pricing engine that uses price elasticity of demand to find the revenue-maximizing price point for each spot.

**Key features:**
- Three-layer pricing engine (base price, context multipliers, elasticity optimization)
- Real-time horizontal garage visualization with 5 aisles (100 spaces)
- **Simulation mode** with price-sensitive AI demand and realistic occupancy patterns (fills to 95% by game time)
- Manual booking flow with 30-second price locking and full breakdowns
- Time simulation (6 AM - 11:59 PM) with play/pause and speed controls (1x, 2x, 5x, 10x)
- Operator dashboard with revenue, occupancy, pricing metrics, and trend charts
- End-of-day summary with final statistics
- WebSocket-driven real-time updates with auto-reconnect
- FIFA World Cup 2026 themed dark dashboard aesthetic

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS v4, Recharts, Vite |
| Backend | FastAPI (Python), WebSocket |
| State | In-memory (no database) |
| Real-time | WebSocket push from server |
| Testing | pytest (170 tests) |

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
│   │       ├── GarageGrid/     # Horizontal garage visualization with 5 aisles
│   │       ├── BookingPanel/   # Slide-out booking flow with price breakdown
│   │       ├── TimeControls/   # Play/pause + time slider
│   │       ├── OperatorPanel/  # Metrics dashboard (revenue, occupancy, charts)
│   │       ├── SystemPanel/    # Collapsible bottom drawer (event log, price breakdown)
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
# All backend tests (170 tests)
python3 -m pytest backend/tests/ -v

# Specific test files
python3 -m pytest backend/tests/test_garage_init.py -v   # 19 tests
python3 -m pytest backend/tests/test_pricing.py -v       # 51 tests
python3 -m pytest backend/tests/test_api.py -v           # 55 tests
python3 -m pytest backend/tests/test_simulation.py -v    # 44 tests
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

### Projected Revenue

The dashboard displays a projected end-of-day revenue using demand-curve-weighted extrapolation. The calculation:

1. Sums demand forecast values for past hours vs. remaining hours
2. Applies the ratio to current revenue: `projected = current + (current × remaining_demand / past_demand)`

This assumes future revenue per demand unit matches past performance, providing operators a real-time estimate of daily earnings potential.

**Detailed documentation:** See [PRICING_LOGIC.md](PRICING_LOGIC.md) for a comprehensive walkthrough with examples and economic reasoning.

## Garage Layout

Horizontal layout with 5 aisles and 100 spaces:

| Zone | Columns | Description | Spot Types |
|------|---------|-------------|------------|
| A | 0-2 | Near entrance (left) | EV (rows 0-2) + Motorcycle (rows 7-9) |
| B | 3-6 | Middle | Standard |
| C | 7-9 | Far from entrance (right) | Standard |

- **5 horizontal aisles** with driving lanes between parking rows
- **Entrance/Exit on left side**
- **Perpendicular parking** (rectangular spots, not angled)
- EV and Motorcycle spots grouped together near entrance for convenience

## WebSocket Protocol

### Client → Server
```
select_spot    { space_id }           # Select and hold a spot
release_spot   { space_id }           # Release a held spot
book_spot      { space_id, duration } # Confirm booking (1-4 hours)
set_playing    { is_playing }         # Play/pause simulation
set_time       { time }               # Scrub to specific time
set_speed      { speed }              # Set playback speed (1, 2, 5, or 10)
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
- ✅ Horizontal garage visualization with 5 aisles and zone coloring
- ✅ Slide-out booking panel with full price breakdown
- ✅ Operator dashboard (revenue, occupancy, trend sparklines, price histogram, demand curve)
- ✅ System transparency panel (collapsible drawer with event log)
- ✅ Intro modal and mobile warning
- ✅ Auto-reconnect with exponential backoff
- ✅ **Simulation engine** (price-sensitive AI, target-occupancy-driven, realistic sporting event patterns)
- ✅ **End-of-day summary modal** with final statistics and trend charts
- ✅ **Simulation toggle** (Sim: ON/OFF)
- ✅ **Projected revenue** calculation with demand-curve weighting
- ✅ **Speed controls** (1x, 2x, 5x, 10x)
- ✅ 170 passing tests

## Deployment

### Railway (Recommended)

This project is configured for one-click deployment to [Railway](https://railway.app/).

**Prerequisites:**
- A Railway account (free tier available)
- Git repository pushed to GitHub

**Steps:**

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```

2. **Create a new project on Railway:**
   - Go to [railway.app](https://railway.app/) and sign in
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

3. **Railway will automatically:**
   - Detect the `Dockerfile` and build using Docker
   - Build the frontend with Node.js 20
   - Set up Python 3.11 backend with the built frontend
   - Start the FastAPI server

4. **Generate a public URL:**
   - Go to your service → Settings → Networking
   - Click "Generate Domain" to get a public URL
   - Your app will be live at `https://your-app.up.railway.app`

**Configuration files:**
- `Dockerfile` - Multi-stage build (Node.js frontend + Python backend)
- `railway.toml` - Railway-specific settings (health check, restart policy)

**How it works:**
- Multi-stage Docker build: Stage 1 builds frontend, Stage 2 runs Python backend
- The backend serves both the API/WebSocket and the built frontend static files
- All traffic goes through a single domain, avoiding CORS/WebSocket issues
- The `/ws` endpoint handles real-time communication
- All other routes serve the React SPA

### Local Production Test

To test the production build locally before deploying:

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Run backend (will serve frontend from frontend/dist)
python3 -m uvicorn backend.main:app --port 8000

# Open http://localhost:8000 in your browser
```

### Docker (Local)

You can also run the production build locally using Docker:

```bash
# Build the image
docker build -t parking-garage .

# Run the container
docker run -p 8000:8000 parking-garage

# Open http://localhost:8000 in your browser
```

## License

MIT
