/**
 * DocumentPage Component
 *
 * Displays full project documentation as a scrollable page.
 * Used when user navigates to README, PRD, or Pricing Logic tabs.
 * Simulation continues running in the background.
 */

import type { ReactNode } from 'react';

type DocType = 'readme' | 'prd' | 'pricing';

interface DocumentPageProps {
  docType: DocType;
}

// Full document content
const DOCUMENTS: Record<DocType, { title: string; content: ReactNode }> = {
  readme: {
    title: 'README - Variable Pricing Parking Garage Demo',
    content: (
      <div className="prose prose-invert max-w-none">
        <h1>Variable Pricing Parking Garage Demo</h1>

        <p className="lead">
          Interactive demo showcasing a revenue-maximizing variable pricing system for a parking garage,
          themed around FIFA World Cup 2026 at MetLife Stadium, New Jersey. Built as a portfolio piece
          demonstrating dynamic pricing algorithms, real-time WebSocket communication, and modern React development.
        </p>

        <h2>Overview</h2>
        <p>
          A simulated parking garage where prices adjust dynamically based on occupancy, time of day,
          demand forecasts, location, and event context. The core is a three-layer pricing engine that
          uses price elasticity of demand to find the revenue-maximizing price point for each spot.
        </p>

        <h3>Key Features</h3>
        <ul>
          <li>Three-layer pricing engine (base price, context multipliers, elasticity optimization)</li>
          <li>Real-time garage visualization with 10x10 CSS Grid (100 spaces)</li>
          <li>Auto-booking simulation with price-sensitive demand modeling</li>
          <li>Manual booking flow with 30-second price locking and full breakdowns</li>
          <li>Time simulation (6 AM - 11:59 PM) with play/pause and speed controls (1x, 2x, 5x, 10x)</li>
          <li>Operator dashboard with revenue, occupancy, and pricing metrics</li>
          <li>End-of-day summary with final statistics</li>
          <li>WebSocket-driven real-time updates with auto-reconnect</li>
          <li>FIFA World Cup 2026 themed dark dashboard aesthetic</li>
        </ul>

        <h2>Tech Stack</h2>
        <table>
          <thead>
            <tr><th>Layer</th><th>Technology</th></tr>
          </thead>
          <tbody>
            <tr><td>Frontend</td><td>React 18, TypeScript, Tailwind CSS v4, Vite</td></tr>
            <tr><td>Backend</td><td>FastAPI (Python), WebSocket</td></tr>
            <tr><td>State</td><td>In-memory (no database)</td></tr>
            <tr><td>Real-time</td><td>WebSocket push from server</td></tr>
            <tr><td>Testing</td><td>pytest (169 tests)</td></tr>
          </tbody>
        </table>

        <h2>Garage Layout</h2>
        <p>10×10 grid (100 spaces) with three zones:</p>
        <table>
          <thead>
            <tr><th>Zone</th><th>Rows</th><th>Description</th><th>Spot Types</th></tr>
          </thead>
          <tbody>
            <tr><td>A</td><td>0-2</td><td>Near entrance (Premium)</td><td>Standard + EV (cols 0-1)</td></tr>
            <tr><td>B</td><td>3-6</td><td>Middle (Standard)</td><td>Standard</td></tr>
            <tr><td>C</td><td>7-9</td><td>Far from entrance (Economy)</td><td>Standard + Motorcycle (cols 8-9)</td></tr>
          </tbody>
        </table>
        <p>Entrance is at row 0, center columns.</p>

        <h2>WebSocket Protocol</h2>
        <h3>Client → Server</h3>
        <pre>{`select_spot    { space_id }           # Select and hold a spot
release_spot   { space_id }           # Release a held spot
book_spot      { space_id, duration } # Confirm booking (1-4 hours)
set_playing    { is_playing }         # Play/pause simulation
set_time       { time }               # Scrub to specific time
set_speed      { speed }              # Set playback speed (1, 2, 5, or 10)
set_simulation { enabled }            # Toggle auto-booking simulation
reset          {}                     # Reset to 6 AM
get_state      {}                     # Request full state snapshot`}</pre>

        <h3>Server → Client</h3>
        <pre>{`state_snapshot    { state, prices, metrics }  # Full state
spot_held         { space_id, price_result }  # Spot selected, price locked
spot_released     { space_id }                # Hold released
booking_confirmed { reservation }             # Booking successful
booking_failed    { space_id, reason }        # Booking failed
day_complete      { stats }                   # Simulation reached 11:59 PM
error             { message }                 # Generic error`}</pre>
      </div>
    ),
  },
  prd: {
    title: 'Product Requirements Document',
    content: (
      <div className="prose prose-invert max-w-none">
        <h1>Product Requirements Document</h1>
        <p className="lead">
          FIFA World Cup 2026 Parking Garage - Dynamic Pricing Demo
        </p>

        <h2>Business Context</h2>
        <p>
          Major sporting events create intense, time-bounded demand for parking. A FIFA World Cup match
          at MetLife Stadium draws 80,000+ fans, most arriving by car within a 3-hour window before kickoff.
          Static pricing leaves money on the table during peak demand and fails to incentivize early arrival.
        </p>
        <p>
          Dynamic pricing addresses these inefficiencies by adjusting prices in real-time based on supply,
          demand, and market conditions. This demo showcases how such a system would work in practice.
        </p>

        <h2>Target Behavior</h2>
        <ul>
          <li><strong>Gradual fill-up:</strong> Garage should reach ~95% occupancy by game time (7 PM)</li>
          <li><strong>Price responsiveness:</strong> Prices increase visibly as occupancy rises</li>
          <li><strong>Zone differentiation:</strong> Premium spots (Zone A) command higher prices</li>
          <li><strong>Time pressure pricing:</strong> Last-minute bookers pay surge prices</li>
          <li><strong>Post-game exodus:</strong> Mass departures after game ends (~10 PM)</li>
        </ul>

        <h2>User Personas</h2>

        <h3>The Early Planner</h3>
        <ul>
          <li>Books hours ahead of game time</li>
          <li>Price-sensitive, willing to walk farther for savings</li>
          <li>Targets Zone C (Economy) spots at $15-20/hr</li>
          <li>Values predictability over convenience</li>
        </ul>

        <h3>The Convenience Seeker</h3>
        <ul>
          <li>Willing to pay premium for proximity</li>
          <li>Books Zone A (Premium) near entrance</li>
          <li>Accepts $35-45/hr for reduced walking</li>
          <li>Often arrives 1-2 hours before game</li>
        </ul>

        <h3>The Last-Minute Arrival</h3>
        <ul>
          <li>Arrives within 1 hour of kickoff</li>
          <li>Has no choice but to pay surge pricing</li>
          <li>Takes whatever spot is available</li>
          <li>Pays peak prices ($40-50/hr)</li>
        </ul>

        <h2>System Requirements</h2>

        <h3>Functional Requirements</h3>
        <ol>
          <li>Display real-time garage occupancy visualization</li>
          <li>Calculate and display dynamic prices for each spot</li>
          <li>Allow manual spot selection and booking</li>
          <li>Run automated simulation with realistic booking patterns</li>
          <li>Show operator metrics (revenue, occupancy, avg price)</li>
          <li>Support time simulation with variable speed playback</li>
        </ol>

        <h3>Non-Functional Requirements</h3>
        <ol>
          <li>Real-time updates via WebSocket (sub-second latency)</li>
          <li>Smooth UI animations for price changes</li>
          <li>Support for 100+ concurrent spot updates</li>
          <li>Graceful reconnection on connection loss</li>
        </ol>

        <h2>Success Metrics</h2>
        <ul>
          <li>Garage reaches 90-95% occupancy by game time</li>
          <li>Average price increases 3-4x from morning to game time</li>
          <li>Zone A spots consistently priced 30-50% above Zone C</li>
          <li>Simulation completes full day in ~3 minutes at 1x speed</li>
        </ul>
      </div>
    ),
  },
  pricing: {
    title: 'Pricing Engine Documentation',
    content: (
      <div className="prose prose-invert max-w-none">
        <h1>Pricing Engine Documentation</h1>

        <h2>Core Objective</h2>
        <p>The system aims to maximize:</p>
        <pre className="text-lg">Revenue = Price × Expected_Bookings(Price)</pre>
        <p>
          The key insight: raising prices increases revenue per booking, but decreases the number of bookings.
          The optimal price depends on how <strong>price-sensitive</strong> (elastic) each customer segment is.
        </p>

        <h2>Three-Layer Pricing Architecture</h2>

        <h3>Layer 1: Base Price</h3>
        <p>Starting point based purely on spot type:</p>
        <ul>
          <li><strong>Standard:</strong> $10/hour (baseline)</li>
          <li><strong>EV:</strong> $15/hour (premium for charging infrastructure)</li>
          <li><strong>Motorcycle:</strong> $5/hour (smaller space, less valuable)</li>
        </ul>
        <p>
          <em>Reasoning:</em> Different spot types have different inherent costs and value propositions.
          EV spots require expensive charging equipment, so they command a premium.
        </p>

        <h3>Layer 2: Context Multipliers</h3>
        <p>Five multipliers that adjust the base price based on market conditions:</p>

        <h4>1. Occupancy Multiplier (non-linear curve)</h4>
        <pre>{`Breakpoints:
0%   → 1.0x (plenty of availability)
50%  → 1.0x (no scarcity premium yet)
70%  → 1.5x (scarcity starting to matter)
85%  → 2.5x (aggressive surge begins)
95%  → 3.5x (near capacity)
100% → 4.0x (maximum surge)`}</pre>
        <p>
          <em>Reasoning:</em> Scarcity increases willingness to pay. The non-linear curve creates dramatic
          price movements at high occupancy for demo effect while maintaining economic soundness.
        </p>

        <h4>2. Time Multiplier (proximity to game time)</h4>
        <pre>{`Hours before game → Multiplier:
13+ hours (6 AM)  → 0.5x (soft demand)
8 hours (11 AM)   → 0.7x
4 hours (3 PM)    → 1.0x (baseline)
2 hours (5 PM)    → 1.5x
1 hour (6 PM)     → 2.0x (time pressure)
0 hours (7 PM)    → 2.5x (peak)
-1 hour (8 PM)    → 1.5x (game started)`}</pre>
        <p>
          <em>Economic logic:</em> Time pressure reduces price sensitivity. People arriving close to
          game time have fewer alternatives and will pay more.
        </p>

        <h4>3. Demand Forecast Multiplier</h4>
        <pre>{`Hourly demand curve:
6 AM  → 0.05 (minimal)
12 PM → 0.25 (building)
4 PM  → 0.60 (pre-game rush)
7 PM  → 1.00 (peak - game time)
11 PM → 0.10 (post-game)`}</pre>
        <p>
          <em>Reasoning:</em> Represents predicted volume of people looking to park. High demand hours
          justify higher prices even if current occupancy is low (forward-looking pricing).
        </p>

        <h4>4. Location Multiplier (zone-based)</h4>
        <pre>{`Zone A (near entrance): 1.3x (premium)
Zone B (middle):        1.0x (baseline)
Zone C (far):           0.8x (discount)`}</pre>
        <p>
          <em>Reasoning:</em> Convenience matters. Spots near the entrance save customers time walking,
          justifying a premium. Zone C gets a discount to compensate for the long walk.
        </p>

        <h4>5. Event Multiplier</h4>
        <pre>{`World Cup match: 2.0x`}</pre>
        <p>
          <em>Reasoning:</em> Major events create extraordinary demand. A FIFA World Cup match justifies
          a flat 2x multiplier on all spots.
        </p>

        <h3>Layer 3: Elasticity Optimization</h3>
        <p>
          After applying context multipliers, the engine adjusts prices based on price elasticity of demand
          (PED) for each customer segment:
        </p>
        <table>
          <thead>
            <tr><th>Segment</th><th>Elasticity</th><th>Behavior</th></tr>
          </thead>
          <tbody>
            <tr><td>Zone C (far)</td><td>~1.3 (elastic)</td><td>Reduce price for volume</td></tr>
            <tr><td>Zone A (near)</td><td>~0.9 (inelastic)</td><td>Convenience premium holds</td></tr>
            <tr><td>EV charging</td><td>0.7 (inelastic)</td><td>Captive demand, push price up</td></tr>
            <tr><td>Last-minute (&lt;1hr)</td><td>Modified ×0.7</td><td>Very inelastic, max surge</td></tr>
            <tr><td>Advance (&gt;4hr)</td><td>Modified ×1.2</td><td>Elastic, can shop around</td></tr>
          </tbody>
        </table>

        <h3>Guardrails</h3>
        <ul>
          <li><strong>Price Floor:</strong> $5/hr (minimum viable price)</li>
          <li><strong>Price Ceiling:</strong> $50/hr (regulatory/PR cap)</li>
        </ul>
        <p>
          Note: Price smoothing (±20% max change per interval) was dropped for the demo to allow
          dramatic price swings that showcase the engine's responsiveness.
        </p>

        <h2>Example Calculation</h2>
        <p>Standard spot in Zone A at 6:30 PM (30 min before game), 85% occupancy:</p>
        <pre>{`Base price:           $10.00
× Occupancy (85%):    × 2.50 = $25.00
× Time (0.5hr before): × 2.25 = $56.25
× Demand (0.95):      × 0.95 = $53.44
× Location (Zone A):  × 1.30 = $69.47
× Event (World Cup):  × 2.00 = $138.94
→ Capped at ceiling:          $50.00

Final price: $50.00/hr`}</pre>
      </div>
    ),
  },
};

export function DocumentPage({ docType }: DocumentPageProps) {
  const doc = DOCUMENTS[docType];

  return (
    <div className="h-full overflow-y-auto bg-wc-blue">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-wc-accent mb-6">{doc.title}</h1>
        <div className="text-gray-300 text-sm leading-relaxed">
          {doc.content}
        </div>
      </div>
    </div>
  );
}

// Keep the old modal export for backwards compatibility but it's no longer used
export function DocumentationModal(_props: { isOpen: boolean; onClose: () => void }) {
  return null;
}
