# Pricing Engine Documentation

## 🎯 Core Objective

The system aims to maximize: **Revenue = Price × Expected_Bookings(Price)**

The key insight: raising prices increases revenue per booking, but decreases the number of bookings. The optimal price depends on how **price-sensitive** (elastic) each customer segment is.

---

## Three-Layer Pricing Architecture

### Layer 1: Base Price

**Location**: Lines 50-51 in [pricing.py](backend/engine/pricing.py)

Starting point based purely on spot type:
- **Standard**: $10/hour (baseline)
- **EV**: $15/hour (premium for charging infrastructure)
- **Motorcycle**: $5/hour (smaller space, less valuable)

**Reasoning**: Different spot types have different inherent costs and value propositions. EV spots require expensive charging equipment, so they command a premium.

---

### Layer 2: Context Multipliers

**Location**: Lines 53-60 in [pricing.py](backend/engine/pricing.py)

Five multipliers that adjust the base price based on market conditions:

#### 1. Occupancy Multiplier (non-linear curve)

```python
# Breakpoints from settings.py:
(0%, 1.0x), (50%, 1.0x), (70%, 1.5x), (85%, 2.5x), (95%, 3.5x), (100%, 4.0x)
```

**How it works**: Calculates current occupancy rate, then uses linear interpolation between breakpoints.

**Reasoning**:
- **0-50% occupancy**: Flat 1.0x (plenty of availability, no scarcity premium)
- **50-70%**: Gentle ramp to 1.5x (scarcity starting to matter)
- **70-100%**: **Aggressive non-linear surge** (4x at full capacity)
- This creates dramatic price movements for demo effect
- Economically: scarcity increases willingness to pay

**Real behavior**: At 60% occupancy, price is between 1.0x and 1.5x (interpolated). At 95%, you're at 3.5x.

#### 2. Time Multiplier (proximity to game time)

```python
# Breakpoints (hours_before_game -> multiplier):
(13hr+, 0.5x), (8hr, 0.7x), (4hr, 1.0x), (2hr, 1.5x), (1hr, 2.0x), (0hr, 2.5x), (-1hr, 1.5x)
```

**How it works**: Calculates `hours_before_game = game_hour - current_time`, interpolates multiplier.

**Reasoning**:
- **Early morning (6 AM, 13hrs before)**: 0.5x discount (soft demand)
- **4 hours before (3 PM)**: 1.0x baseline
- **1 hour before (6 PM)**: 2.0x (time pressure, last-minute panic)
- **Game time (7 PM)**: 2.5x peak
- **After game starts**: Drops to 1.5x then 0.8x (demand collapses)

**Economic logic**: Time pressure reduces price sensitivity. People arriving close to game time have fewer alternatives and will pay more.

#### 3. Demand Forecast Multiplier (pre-loaded hourly curve)

```python
# From DEMAND_FORECAST in settings.py:
# 6 AM: 0.05, 12 PM: 0.25, 4 PM: 0.60, 7 PM: 1.00, 11 PM: 0.10
```

**How it works**: Looks up the demand factor for the current hour (with interpolation for fractional hours).

**Reasoning**: This represents **predicted volume** of people looking to park. High demand hours justify higher prices even if current occupancy is low (forward-looking pricing). At 18.5 (6:30 PM), demand is 0.95, meaning prices are already elevated even before occupancy hits capacity.

**Why separate from time multiplier?** Time multiplier captures time-pressure psychology. Demand multiplier captures volume/traffic patterns. They're correlated but conceptually different.

#### 4. Location Multiplier (zone-based)

```python
Zone A (near entrance): 1.3x
Zone B (middle): 1.0x
Zone C (far): 0.8x
```

**How it works**: Simple lookup based on space's zone assignment.

**Reasoning**: Convenience matters. Spots near the entrance are worth more because they save customers time walking. Zone C gets a 20% discount to compensate for the long walk.

#### 5. Event Multiplier (World Cup)

```python
event_multiplier: 2.0
```

**How it works**: Flat 2.0x multiplier applied to all spots.

**Reasoning**: Special events command premium pricing. World Cup at MetLife Stadium creates extraordinary demand. This is a global multiplier for the entire demo scenario.

#### Context Price Calculation

```python
context_price = base_price × occ_mult × time_mult × demand_mult × location_mult × event_mult
```

All five multipliers are **multiplicative**, creating compounding effects. A 100% full garage (4.0x) at game time (2.5x) for an EV spot ($15 base) in Zone A (1.3x) during World Cup (2.0x) with peak demand (1.0x):

`$15 × 4.0 × 2.5 × 1.0 × 1.3 × 2.0 = $390/hour` (before elasticity adjustment and guardrails)

---

### Layer 3: Elasticity Optimization

**Location**: Lines 62-77 in [pricing.py](backend/engine/pricing.py)

This is where the **revenue maximization magic** happens.

**Economic Theory**: Price elasticity of demand (ε) measures how quantity demanded responds to price changes:
- **ε < 1.0 (Inelastic)**: Demand is insensitive to price → **raise prices** (revenue goes up)
- **ε > 1.0 (Elastic)**: Demand is sensitive to price → **lower prices** (volume compensates for lower price)
- **ε = 1.0 (Unit elastic)**: No adjustment needed → optimal price

#### Elasticity Calculation

**Function**: `_get_elasticity()` (lines 172-203)

Three factors determine elasticity for a booking:

**1. Base elasticity by spot type:**
- Standard: 1.0 (neutral baseline)
- EV: 0.7 (inelastic - EV drivers have limited options, need charging)
- Motorcycle: 1.1 (slightly elastic)

**2. Zone modifier:**
- Zone A: 0.9× (near entrance = convenience premium = inelastic)
- Zone B: 1.0× (neutral)
- Zone C: 1.3× (far away = price-sensitive = elastic)

**3. Timing modifier (optional, only if `booking_lead_time` provided):**
- Last-minute (<1hr before game): 0.7× modifier → **very inelastic** (desperation)
- Advance (>4hr before game): 1.2× modifier → **more elastic** (can shop around)

**Combined elasticity** = `type_elasticity × zone_modifier × timing_modifier`

**Example segments:**
- **EV Zone A, last-minute**: `0.7 × 0.9 × 0.7 = 0.44` (extremely inelastic)
- **Standard Zone C, advance**: `0.0 × 1.3 × 1.2 = 1.56` (quite elastic)
- **Standard Zone B, no timing**: `1.0 × 1.0 = 1.0` (unit elastic)

#### Price Adjustment Logic

```python
if elasticity < 1.0:
    # Inelastic: push price UP
    elasticity_adj = 1.0 + (1.0 - elasticity)
    # Example: e=0.7 → adj = 1.0 + 0.3 = 1.3 → +30% price increase

elif elasticity > 1.0:
    # Elastic: pull price DOWN for volume
    elasticity_adj = 1.0 / elasticity
    # Example: e=1.3 → adj = 0.769 → -23% price reduction

else:
    elasticity_adj = 1.0  # No change
```

**Final price**: `context_price × elasticity_adjustment`

**Economic intuition:**
- **Inelastic segments** (EV drivers, last-minute, Zone A): Can tolerate higher prices → **extract maximum revenue**
- **Elastic segments** (far spots, advance booking, motorcycles): Price-sensitive → **reduce price to capture volume**

---

### Guardrails

**Location**: Lines 79-80 in [pricing.py](backend/engine/pricing.py)

```python
final_price = max(5.0, min(50.0, final_price))
```

**Floor**: $5/hour minimum (prevents absurdly low prices)
**Ceiling**: $50/hour maximum (prevents gouging, keeps demo realistic)

**Note**: Original spec had ±20% smoothing (no sudden price jumps) but it was **intentionally removed** for dramatic demo effect. Prices can swing freely within $5-$50 range.

---

## 🔍 Full Example Walkthrough

Let's price an **EV spot in Zone A at 6 PM (18.0 hours), 70% occupancy**:

```python
# Layer 1: Base price
base_price = $15  # EV spot

# Layer 2: Context multipliers
occupancy_mult = 1.5  # 70% occupancy → 1.5x
time_mult = 2.0       # 1 hour before game → 2.0x
demand_mult = 0.90    # Hour 18 demand → 0.90
location_mult = 1.3   # Zone A → 1.3x
event_mult = 2.0      # World Cup → 2.0x

context_price = 15 × 1.5 × 2.0 × 0.90 × 1.3 × 2.0 = $105.30

# Layer 3: Elasticity
elasticity = 0.7 × 0.9 = 0.63  # EV × Zone A (assuming no timing modifier)
# Inelastic! Push price up
elasticity_adj = 1.0 + (1.0 - 0.63) = 1.37

optimized_price = 105.30 × 1.37 = $144.26

# Guardrails
final_price = min(50.0, 144.26) = $50.00  # Ceiling hit!
```

**Result**: $50/hour (at ceiling). The system wanted to charge $144 but was capped.

---

## 💡 Design Rationale

1. **Economically rigorous**: Based on real pricing theory (elasticity of demand)
2. **Revenue-maximizing**: Different segments pay different prices based on willingness to pay
3. **Transparent**: Every multiplier is visible in `PriceResult` breakdown
4. **Tunable**: All parameters (elasticities, multipliers, breakpoints) are configurable
5. **Dramatic for demo**: Non-linear occupancy curve + no smoothing = exciting price swings
6. **Self-explanatory**: Each layer has clear economic logic that reviewers can follow

---

## 🧪 Testing

The pricing engine is thoroughly tested in [test_pricing.py](backend/tests/test_pricing.py):

- **Interpolation tests**: Verify linear interpolation logic for all curves
- **Occupancy tests**: Validate occupancy rate calculation and multiplier at various levels
- **Time multiplier tests**: Check correct pricing at different times relative to game
- **Demand multiplier tests**: Verify demand curve interpolation
- **Elasticity tests**: Test all combinations of type, zone, and timing modifiers
- **Guardrail tests**: Ensure floor and ceiling are enforced
- **Full pipeline tests**: End-to-end scenarios with inelastic, elastic, and unit elastic segments
- **Edge cases**: Zero occupancy, full occupancy, cancelled reservations, etc.

Run tests with:
```bash
python3 -m pytest backend/tests/test_pricing.py -v
```

---

## 📊 Key Data Structures

### PriceResult
Returned by `calculate_price()`, contains:
- `final_price`: The price after all adjustments and guardrails
- `base_price`: Layer 1 starting price
- `context_price`: After Layer 2 multipliers, before elasticity
- `occupancy_multiplier`, `time_multiplier`, `demand_multiplier`, `location_multiplier`, `event_multiplier`: Individual Layer 2 multipliers
- `elasticity`: Calculated price elasticity for this segment
- `elasticity_adjustment`: Layer 3 adjustment factor
- `optimization_note`: Human-readable explanation of elasticity adjustment

This breakdown enables full transparency for debugging and the System Panel UI.

---

## 🔧 Configuration

All pricing parameters live in [backend/config/settings.py](backend/config/settings.py):

- `PricingConfig`: Base prices, elasticity values, multiplier breakpoints, guardrails
- `GarageConfig`: Garage dimensions, game time, simulation parameters
- `DEMAND_FORECAST`: Hourly demand curve (6 AM - 11 PM)

To tune the pricing behavior, modify these config values rather than the pricing engine code itself.
