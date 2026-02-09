# Technical Decisions

## React + FastAPI over Streamlit

The PRD originally specified Streamlit. We switched to React + TypeScript frontend with a FastAPI backend.

**Why:** Streamlit re-runs the entire script on every user interaction. For this demo, we need a 500-cell interactive grid with hover tooltips, click-to-select, real-time WebSocket-driven updates, and a slide-out booking panel — all happening while a simulation tick loop runs continuously. Streamlit has no native support for per-element hover/click events on custom grids, no true real-time push (requires polling hacks with `st.rerun()`), and limited layout control for complex dashboard arrangements.

**Tradeoff:** More development effort — we now maintain a frontend and a backend instead of a single Python file. Justified because the demo's visual polish and interactivity are core to the portfolio pitch, and Streamlit would require fighting the framework at every step.

## CSS Grid over Canvas/SVG for Garage Visualization

**Why:** 500 HTML divs is trivial for modern browsers. CSS Grid gives us native DOM events (hover, click) per cell with zero library overhead, CSS transitions for smooth color changes, and easy tooltip integration. Canvas would require manual hit-testing for click/hover on individual cells. SVG adds 500 DOM elements with heavier overhead than plain divs.

**Tradeoff:** Less control over pixel-perfect rendering than Canvas. Acceptable because the grid is rectangular and uniform — CSS Grid is the natural fit.

## WebSocket Push over Polling/SSE

**Why:** The simulation engine runs server-side and needs to push state updates to the client in real time. WebSocket gives us bidirectional communication — server pushes tick updates, client sends user actions (bookings, time control) — all over one connection. Polling would waste requests and add latency. SSE is one-directional, so user actions would need separate REST calls, adding complexity.

**Tradeoff:** WebSocket connections are stateful, which adds reconnection logic. We handle this with auto-reconnect + exponential backoff + full state resync on reconnect.

## Hybrid WebSocket Payloads over Full Snapshots

**Why:** Sending a full 500-space state snapshot on every simulation tick is wasteful (~10-20KB per push at 2 pushes/second). Sending only deltas (e.g., "space A-3 booked") is efficient but requires the frontend to maintain and patch local state, which can drift. Hybrid approach: deltas during normal ticks, full snapshot on connect, reconnect, and after user actions. Best of both — low bandwidth during simulation, guaranteed consistency at sync points.

**Tradeoff:** Slightly more complex message handling on both sides. Worth it for smoother real-time updates.

## FastAPI over Flask/Django

**Why:** FastAPI has native async support (needed for WebSocket), auto-generates OpenAPI docs, and integrates directly with Pydantic models — which we're already using for Space, Reservation, PriceResult, etc. Flask would work but lacks async and Pydantic integration. Django is overkill with no database.

**Tradeoff:** None significant. FastAPI is the standard choice for this use case.

## React Context + useReducer over Redux/Zustand

**Why:** The app has one main state tree (garage state from WebSocket) with a handful of UI-local states (selected spot, modal open). Context + useReducer handles this cleanly with zero dependencies. Redux Toolkit would add boilerplate and bundle size for no benefit at this complexity level. Zustand is lighter but still an unnecessary dependency.

**Tradeoff:** If the app grows significantly in complexity, Context re-renders could become a performance concern. At 100-500 spaces with one WebSocket stream, this won't be an issue.

## Tailwind CSS over CSS Modules/Styled Components

**Why:** Utility-first approach enables fast iteration toward a polished dashboard look. The World Cup theme (deep blue, red, white, dark backgrounds) maps naturally to Tailwind's color system. No separate CSS files to manage, no naming conventions to invent. Large ecosystem of dashboard-style component examples to reference.

**Tradeoff:** HTML can get verbose with many utility classes. Acceptable for a demo codebase where development speed matters more than template elegance.

## Server-Side Spot Hold over Optimistic UI

**Why:** When simulation is running, a race condition exists between the user selecting a spot and the simulation booking it. A server-side 30-second hold is the most realistic approach — it mirrors how production booking systems work (temporary reservation locks). The alternative (optimistic UI with "spot taken" error) creates a frustrating user experience during a demo, which is unacceptable for a portfolio piece.

**Tradeoff:** Adds server state (held_space_ids dict with expiry timestamps). Minimal complexity for a much better UX.

## Price Lock on Selection over Live Pricing

**Why:** If the price updates in real-time while the user is reading the breakdown and deciding on duration, it feels unstable and creates decision anxiety. Locking the price when they click the spot (tied to the 30-second hold) gives a predictable, comfortable booking experience. This also matches real-world parking apps where the quoted price is honored for a window.

**Tradeoff:** User might miss a price drop during the 30-second hold. For a demo, predictability > optimization.

## No Price Smoothing (Dropped ±20% Guardrail)

**Why:** The ±20% max change per interval guardrail exists in production to avoid "price shock" for returning customers. In a demo context, dramatic price swings are a feature, not a bug — they make the pricing engine's responsiveness visible and impressive. Watching prices jump from $12 to $35 as occupancy spikes is the whole point of the demo.

**Tradeoff:** Less realistic than a production system. Acceptable because this is a demo showcasing the engine's range, not a deployed product.

## Rigorous Pricing Model with Tunable Parameters

**Why:** This is a portfolio piece for a PM role at an AI company. Reviewers will likely inspect the pricing logic. The elasticity model needs to be economically sound (real demand curves, proper PED math) so it holds up under scrutiny. But the parameters (elasticity coefficients, multiplier curves, base prices) need to be tunable so we can calibrate the output to look dramatic during the demo.

**Tradeoff:** More implementation effort than just hardcoding impressive-looking price curves. Worth it — the intellectual rigor is the differentiator.

## 10x10 MVP Grid Scaling to 25x20

**Why:** Getting the full architecture working (WebSocket, pricing engine, booking flow, time simulation) is the hard part. Whether the grid is 100 or 500 cells doesn't change the architecture. Starting with 100 spaces means faster iteration, easier debugging, and quicker visual feedback during development. The grid size is a config parameter — scaling to 500 is a one-line change.

**Tradeoff:** The 100-space grid looks less visually impressive during early development. We scale up before any demo.

## Recharts over Plotly/D3/Chart.js

**Why:** Recharts is React-native (declarative JSX API), lightweight, and covers our chart needs (line charts for trends, bar charts for distribution, sparklines for metric cards). Plotly is heavier and less React-idiomatic. D3 offers maximum flexibility but requires significant time investment for custom implementations. Chart.js works but its imperative API is less natural in React.

**Tradeoff:** Less interactive than Plotly (no built-in zoom/pan). Our charts are small dashboard widgets, not analytical tools — we don't need zoom/pan.

## Railway for Cloud Deployment

**Why:** Supports both static frontends and Python backends with simple GitHub-based deploys. Free tier available. No cold starts on paid plans. Simple enough to set up in an afternoon. The demo needs to be accessible via a URL so viewers can try it without any local setup.

**Tradeoff:** Less control than a VPS. Docker Compose option provides a fallback for local deployment and full control when needed.

## Monorepo over Separate Repos

**Why:** Single repo keeps everything together — one git history, one PR for cross-cutting changes, shared Docker Compose file at root. For a portfolio piece, a reviewer can clone one repo and see the entire project. Separate repos add coordination overhead with zero benefit at this scale.

**Tradeoff:** Frontend and backend share a CI pipeline. Not a concern for a demo project.

## Demand-Curve-Weighted Revenue Projection

**Why:** Simple linear extrapolation (current revenue / elapsed hours * total hours) is misleading — it doesn't account for the demand ramp toward game time. Since we already have the pre-loaded demand forecast curve, we can weight remaining hours by expected demand. This produces a projection that feels intelligent and accounts for the known demand pattern, which is more impressive in a demo.

**Tradeoff:** Slightly more complex than linear extrapolation. The demand curve is already loaded in memory, so the additional computation is trivial.

## Simulation Engine: Price-Weighted Spot Selection

**Why:** Real customers are price-sensitive — they're more likely to book cheaper spots. The simulation mimics this by weighting spot selection inversely by price (`probability ∝ 1/price`). This creates realistic booking patterns where Zone C (cheaper, far from entrance) fills first, and premium Zone A spots are booked by customers willing to pay more or arriving last-minute.

**Tradeoff:** Slightly more complex than random selection. Worth it because it demonstrates the pricing engine's effect on consumer behavior.

## Simulation Engine: Demand Curve Modulation

**Why:** Booking rate varies throughout the day based on the DEMAND_FORECAST curve (peaks at 7 PM game time). This creates realistic patterns — few bookings early morning, gradual ramp-up in afternoon, surge near game time. The garage should reach ~90%+ occupancy by kickoff.

**Tradeoff:** Requires tuning the base booking rate to achieve target occupancy. Parameters are configurable in simulation.py.

## Simulation Enabled by Default

**Why:** This is a demo meant to be impressive on first view. Auto-booking should be running immediately when a viewer opens the page and hits Play. If simulation were disabled by default, the demo would appear static and unimpressive until the viewer discovered the toggle.

**Tradeoff:** Manual-only testing requires explicitly disabling simulation. Acceptable because the primary use case is demo viewing, not development.

## Early Departure Probability

**Why:** Real parking garages see early departures — people leave before their reservation ends. A 2% per-tick chance creates realistic turnover, frees up spots for new bookings, and makes the simulation more dynamic. At ~2 ticks per second, this translates to roughly 10% chance of early departure over a 5-tick window.

**Tradeoff:** Can create unexpected vacancy during peak times. Acceptable because it mirrors real-world unpredictability.

## Target Occupancy Curve for Realistic Patterns

**Why:** A base booking rate alone doesn't produce realistic parking patterns for a sporting event. Real parking garages for major events follow a predictable curve: nearly empty in early morning, gradual buildup through the day, rapid filling in the hours before game time, near-capacity during the game, and mass exodus afterwards. We implemented a TARGET_OCCUPANCY_CURVE that defines what percentage full the garage should be at each hour, and the simulation books aggressively when behind target.

**Tradeoff:** More complex than a simple random booking rate. Worth it because the demo shows exactly what you'd expect at a World Cup match — the garage fills up as kickoff approaches.

## Post-Game Mass Exodus

**Why:** After a sporting event ends, there's a well-known "mass exodus" where most attendees leave within 30-60 minutes. We model this with a separate POST_GAME_DEPARTURE_RATE (15% per tick) that kicks in after hour 22 (10 PM), compared to the normal 2% early departure rate. During the game itself, early departures are reduced to 0.6% (people don't leave mid-game).

**Tradeoff:** Creates a dramatic drop in occupancy post-game. This is realistic — anyone who's attended a major event knows the parking lot empties quickly afterward.

## Game-Time Duration Bias

**Why:** When people arrive near game time (2 hours before to game end), they typically stay for the entire event. The simulation biases toward longer booking durations during this window, ensuring reservations extend through game end rather than expiring mid-game.

**Tradeoff:** Less duration variety during peak hours. Acceptable because it matches real behavior — nobody books 1-hour parking for a 3-hour game.
