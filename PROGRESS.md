# Progress Tracker

## MVP (This Weekend)

### Backend Setup
- [x] Initialize FastAPI project with dependencies (fastapi, uvicorn, pydantic, websockets, pytest)
- [x] Define Pydantic models: Space, Reservation, PriceResult, GarageState, EventLogEntry
- [x] Implement GarageConfig (10x10 grid, configurable) and PricingConfig with tunable params
- [x] Implement garage initialization (generate 100 spaces with zones and types)

### Pricing Engine
- [x] Layer 1: Base price lookup by spot type
- [x] Layer 2: Occupancy multiplier (non-linear curve)
- [x] Layer 2: Time-of-day multiplier (relative to 7 PM game time)
- [x] Layer 2: Demand forecast multiplier (pre-loaded hourly curve)
- [x] Layer 2: Location multiplier (by zone/distance)
- [x] Layer 2: Event multiplier (2.0x World Cup)
- [x] Layer 3: Elasticity-adjusted optimization (per segment)
- [x] Guardrails: Floor $5, ceiling $50
- [x] PriceResult with full breakdown of every factor

### API & WebSocket
- [x] WebSocket endpoint: initial full state snapshot on connect
- [x] WebSocket endpoint: handle user actions (select spot, book, play/pause, time scrub, reset)
- [x] Spot hold system: 30-second server-side lock on selection, release on timeout/booking
- [x] Time simulation: play/pause at 1x speed (1 sim-hr per 10 real-sec), advance state and push deltas
- [x] Booking endpoint: validate hold, create reservation, lock price, return confirmation
- [x] Reset endpoint: clear all state back to 6 AM
- [x] Auto-reconnect support: full snapshot on reconnect

### Tests
- [x] Pricing engine unit tests: base prices, each multiplier curve, elasticity adjustments, guardrails (70 tests)
- [x] API integration tests: WebSocket connect/disconnect, booking flow, time advancement, reset (48 tests)

### Documentation
- [x] PRICING_LOGIC.md: Comprehensive walkthrough of three-layer pricing engine with examples

### Frontend Setup
- [x] Initialize React + TypeScript + Tailwind project (Vite)
- [x] Define TypeScript interfaces matching backend Pydantic models
- [x] Implement React Context + useReducer for state management
- [x] Implement useWebSocket hook with auto-reconnect + exponential backoff + "reconnecting" banner

### Garage Grid
- [x] CSS Grid layout rendering spaces as divs (10x10)
- [x] Color coding: available (green by type), booked (red), selected (yellow)
- [x] Hover tooltips: spot ID, type, current price
- [x] Click handler: select spot, trigger server hold
- [x] Entrance/exit marker at top-center

### Booking Panel
- [x] Slide-out side panel on spot selection
- [x] Display: spot details, locked price, price breakdown (all factors)
- [x] Duration selector (1-4 hours)
- [x] Book button → confirm reservation
- [x] Booking confirmation display (spot ID, time window, locked price, total cost)
- [x] Close/deselect behavior (release hold)

### Time Controls
- [x] Time slider (6 AM – 11:59 PM)
- [x] Play/pause button at 1x speed
- [x] Current time display (large, prominent)
- [x] Time scrub: user drags slider, state updates accordingly

### Operator Panel
- [x] Right sidebar with dark background, light text
- [x] Current revenue (sum of all bookings)
- [ ] Projected revenue (demand-curve-weighted extrapolation)
- [x] Occupancy rate (% booked, by type and total)
- [x] Average price (mean of current hour bookings)
- [x] Bookings this hour (count)

### UX Polish
- [x] Intro modal on first load (dismissible, re-openable via "?" button)
- [x] Desktop-only: "Best viewed on desktop" message for viewports < 1280px
- [x] World Cup 2026 theme: deep blue, red, white color palette
- [x] Dark dashboard aesthetic

### DevOps
- [ ] Dockerfile.frontend
- [ ] Dockerfile.backend
- [ ] docker-compose.yml (full stack with one command)

---

## Post-MVP

### Simulation Engine
- [x] Server-side tick loop for auto-booking
- [x] Price-sensitive booking: weighted by inverse price
- [x] Demand-curve-driven booking rate
- [x] Auto-clearing: expired reservations, 2% early departure per tick
- [x] "Auto: ON/OFF" toggle in UI
- [x] Simulated bookings flagged with `is_simulated=true`
- [x] Event logging for all simulation activity
- [x] Target occupancy curve (95% by game time, realistic sporting event pattern)
- [x] Occupancy-aware booking (books aggressively when behind target)
- [x] Post-game mass exodus (15% departure rate after 10 PM)
- [x] Game-time duration bias (longer stays during game)
- [x] Comprehensive simulation tests (44 tests)
- [x] Multi-booking per tick when behind target (burst arrivals)

### Speed Controls
- [x] Speed selector: 1x, 2x, 5x, 10x
- [x] Tick loop respects speed multiplier
- [x] WebSocket handler for set_speed message
- [x] Speed control tests (7 tests)
- [x] Logical ticks for speed-independent simulation outcomes

### System Transparency Panel
- [ ] Collapsible bottom drawer UI
- [ ] Event log: rolling window of last 50 entries
- [ ] Price factor breakdown table for selected spot
- [ ] Recharts: occupancy trend graph over simulated time
- [ ] Recharts: revenue accumulation graph over simulated time

### Operator Panel Charts
- [ ] Recharts sparklines for metric trends
- [ ] Price distribution histogram
- [ ] Demand forecast curve visualization

### Scale to 500 Spaces
- [ ] Update GarageConfig to 25x20 grid
- [ ] Verify CSS Grid performance with 500 divs
- [ ] Adjust zone/type distribution to full spec

### End of Day
- [x] Auto-stop at 11:59 PM
- [x] "Day Complete" summary overlay: final revenue, total bookings, peak occupancy, avg price
- [x] Restart Simulation button

### Deployment
- [ ] Railway deployment (backend + frontend)
- [ ] Public URL for async demo viewing
