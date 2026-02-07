# Variable Pricing Parking Garage Demo

Interactive demo showcasing a revenue-maximizing variable pricing system for a parking garage, themed around FIFA World Cup 2026 at MetLife Stadium, New Jersey. Built as a portfolio piece for Arena AI.

## Overview

A simulated parking garage where prices adjust dynamically based on occupancy, time of day, demand forecasts, location, and event context. The core is a three-layer pricing engine that uses price elasticity of demand to find the revenue-maximizing price point for each spot.

**Key features:**
- Three-layer pricing engine (base price, context multipliers, elasticity optimization)
- Real-time garage visualization with a CSS Grid map
- Manual booking flow with price locking and breakdowns
- Time simulation (6 AM - 11:59 PM) with play/pause controls
- Operator dashboard with revenue, occupancy, and pricing metrics
- WebSocket-driven real-time updates

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI (Python), WebSocket |
| State | In-memory (no database) |
| Real-time | WebSocket push from server |
| Deployment | Docker Compose (local), Railway (cloud) |

## Project Structure

```
├── backend/
│   ├── config/
│   │   └── settings.py          # Enums, pricing config, garage config, demand curve
│   ├── models/
│   │   ├── space.py             # Space model (id, type, zone, row, col, distance)
│   │   ├── reservation.py       # Reservation model
│   │   └── garage.py            # GarageState + initialize_garage()
│   ├── engine/
│   │   └── pricing.py           # Three-layer pricing engine with elasticity
│   ├── tests/
│   │   ├── test_garage_init.py  # Garage initialization tests (19 tests)
│   │   └── test_pricing.py     # Pricing engine tests (51 tests)
│   └── requirements.txt
├── frontend/                    # React app (planned)
├── CLAUDE.md                    # AI assistant instructions
├── DECISIONS.md                 # Technical decision log
└── PROGRESS.md                  # Task tracker
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend, when available)
- Docker & Docker Compose (optional, for containerized runs)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker (full stack)

```bash
docker-compose up --build
```

## Running Tests

```bash
# All backend tests
cd backend
python3 -m pytest

# Specific test files
python3 -m pytest tests/test_garage_init.py -v
python3 -m pytest tests/test_pricing.py -v

# With output
python3 -m pytest -v -s
```

Run tests from the project root:

```bash
python3 -m pytest backend/tests/ -v
```

## Pricing Engine

The pricing engine maximizes `Revenue = Price x Expected_Bookings(Price)` using three layers:

1. **Base Price** — per spot type: Standard $10/hr, EV $15/hr, Motorcycle $5/hr
2. **Context Multipliers** — five factors applied to the base price:
   - Occupancy (non-linear: 1.0x at <=50%, up to 4.0x at 100%)
   - Time of day (relative to 7 PM game time)
   - Demand forecast (hourly curve peaking at hour 19)
   - Location (zone A/B/C distance from entrance)
   - Event (2.0x World Cup)
3. **Elasticity Optimization** — adjusts the context-multiplied price per segment. Inelastic segments (EV, last-minute) get pushed toward the ceiling; elastic segments (far spots, advance booking) get reduced for volume.

**Guardrails:** $5/hr floor, $50/hr ceiling. No price smoothing — prices jump freely for dramatic demo effect.

**Detailed documentation:** See [PRICING_LOGIC.md](PRICING_LOGIC.md) for a comprehensive walkthrough with examples and economic reasoning.

## Garage Layout

MVP uses a 10x10 grid (100 spaces), configurable to 25x20 (500 spaces):

| Zone | Rows | Description | Spot Types |
|------|------|-------------|------------|
| A | 0-2 | Near entrance | Standard + EV (cols 0-1) |
| B | 3-6 | Middle | Standard |
| C | 7-9 | Far from entrance | Standard + Motorcycle (cols 8-9) |

Entrance is at row 0, center columns.

## Progress

### Completed

- [x] Backend scaffolding: project structure, dependencies, Pydantic models
- [x] Configuration: pricing config, garage config, demand forecast curve
- [x] Garage initialization: grid generation with zones, spot types, distances
- [x] Tests for garage initialization (19 passing)
- [x] Three-layer pricing engine with elasticity optimization
- [x] Pricing engine tests (51 passing, 70 total)

### In Progress
- [ ] FastAPI entry point + WebSocket endpoint
- [ ] Booking flow (spot hold, price lock, reservation)

### Planned

- [ ] Time simulation (play/pause, tick loop)
- [ ] Frontend (React + TypeScript + Tailwind)
- [ ] Garage grid visualization
- [ ] Booking panel (slide-out)
- [ ] Operator dashboard
- [ ] Intro modal + UX polish
- [ ] Auto-booking simulation engine (post-MVP)
- [ ] Docker deployment
- [ ] Railway cloud deployment
