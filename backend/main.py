"""FastAPI backend for the Parking Garage Pricing Demo.

Provides a WebSocket endpoint for real-time communication with the frontend,
including spot selection/booking, time simulation (play/pause/scrub), and
full state snapshot broadcasting. All garage state lives in memory — no database.
"""

import asyncio
import time
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import (
    ReservationStatus,
    garage_config,
)
from backend.engine.pricing import PriceResult, calculate_price
from backend.models.garage import GarageState, initialize_garage
from backend.models.reservation import Reservation

app = FastAPI(title="Parking Garage Pricing Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Module-level state ──────────────────────────────────────────────
garage_state: GarageState = initialize_garage()

# spot_holds maps space_id -> {ws_id, price_result, hold_expires_at}
spot_holds: dict[str, dict] = {}

# Background tick task reference
_tick_task: asyncio.Task | None = None


# ── ConnectionManager ───────────────────────────────────────────────
class ConnectionManager:
    """Manages active WebSocket connections, keyed by unique client ID.

    Provides methods to send targeted messages to a single client or
    broadcast to all connected clients. Automatically removes clients
    that fail during broadcast.
    """

    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket) -> str:
        """Accept a WebSocket connection and assign it a unique ID."""
        await ws.accept()
        ws_id = str(uuid.uuid4())
        self.active_connections[ws_id] = ws
        return ws_id

    def disconnect(self, ws_id: str) -> None:
        """Remove a client from the active connections pool."""
        self.active_connections.pop(ws_id, None)

    async def send_json(self, ws_id: str, data: dict) -> None:
        """Send a JSON message to a specific client by ID."""
        ws = self.active_connections.get(ws_id)
        if ws:
            await ws.send_json(data)

    async def broadcast(self, data: dict) -> None:
        """Send a JSON message to all connected clients.

        Clients that raise an exception during send are silently removed.
        """
        disconnected: list[str] = []
        for ws_id, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws_id)
        for ws_id in disconnected:
            self.active_connections.pop(ws_id, None)


manager = ConnectionManager()


# ── Helper Functions ────────────────────────────────────────────────
def is_space_occupied(space_id: str, current_time: float) -> bool:
    """Check if a space has an ACTIVE reservation covering the given time."""
    for r in garage_state.reservations:
        if (
            r.space_id == space_id
            and r.status == ReservationStatus.ACTIVE
            and r.start_time <= current_time < r.end_time
        ):
            return True
    return False


def is_space_held(space_id: str) -> bool:
    """Check if a space has a non-expired hold. Cleans up expired holds on access."""
    hold = spot_holds.get(space_id)
    if hold is None:
        return False
    if time.time() > hold["hold_expires_at"]:
        del spot_holds[space_id]
        return False
    return True


def cleanup_expired_holds() -> None:
    """Remove all holds whose wall-clock expiry has passed."""
    now = time.time()
    expired = [sid for sid, h in spot_holds.items() if now > h["hold_expires_at"]]
    for sid in expired:
        del spot_holds[sid]


def compute_metrics() -> dict:
    """Calculate dashboard metrics: revenue, occupancy, avg price, bookings this hour."""
    total_spaces = len(garage_state.spaces)
    ct = garage_state.current_time

    active_reservations = [
        r
        for r in garage_state.reservations
        if r.status == ReservationStatus.ACTIVE and r.start_time <= ct < r.end_time
    ]
    occupancy_count = len(active_reservations)
    occupancy_rate = occupancy_count / total_spaces if total_spaces > 0 else 0.0

    total_revenue = sum(r.total_cost for r in garage_state.reservations)

    # Bookings this hour: reservations starting in current hour window
    hour_start = float(int(ct))
    hour_end = hour_start + 1.0
    bookings_this_hour = [
        r
        for r in garage_state.reservations
        if r.start_time >= hour_start and r.start_time < hour_end
    ]

    avg_price = 0.0
    if bookings_this_hour:
        avg_price = sum(r.price_locked for r in bookings_this_hour) / len(
            bookings_this_hour
        )

    return {
        "total_revenue": round(total_revenue, 2),
        "occupancy_rate": round(occupancy_rate, 4),
        "occupancy_count": occupancy_count,
        "total_spaces": total_spaces,
        "avg_price_this_hour": round(avg_price, 2),
        "bookings_this_hour": len(bookings_this_hour),
    }


def build_state_snapshot() -> dict:
    """Build a full serialized state snapshot for broadcasting to clients.

    Includes all 100 space prices, current metrics, and truncated event log (last 50).
    """
    cleanup_expired_holds()

    # Sync held_space_ids into GarageState for client visibility
    garage_state.held_space_ids = {
        sid: h["hold_expires_at"] for sid, h in spot_holds.items()
    }

    # Calculate current price for every space
    prices: dict[str, dict] = {}
    for space in garage_state.spaces:
        booking_lead_time = garage_config.game_hour - garage_state.current_time
        pr = calculate_price(space, garage_state.current_time, garage_state, booking_lead_time)
        prices[space.id] = pr.model_dump()

    # Truncate event log to last 50
    event_log = garage_state.event_log[-50:]

    return {
        "type": "state_snapshot",
        "state": {
            "current_time": garage_state.current_time,
            "is_playing": garage_state.is_playing,
            "playback_speed": garage_state.playback_speed,
            "spaces": [s.model_dump() for s in garage_state.spaces],
            "reservations": [r.model_dump() for r in garage_state.reservations],
            "held_space_ids": dict(garage_state.held_space_ids),
            "simulation_enabled": garage_state.simulation_enabled,
            "event_log": [e.model_dump() for e in event_log],
        },
        "prices": prices,
        "metrics": compute_metrics(),
    }


# ── Action Handlers ─────────────────────────────────────────────────
async def handle_select_spot(ws_id: str, data: dict) -> None:
    """Validate space availability, calculate price, and create a 30-second hold."""
    space_id = data.get("space_id", "")

    space = next((s for s in garage_state.spaces if s.id == space_id), None)
    if space is None:
        await manager.send_json(ws_id, {"type": "error", "message": f"Space {space_id} not found"})
        return

    if is_space_occupied(space_id, garage_state.current_time):
        await manager.send_json(ws_id, {"type": "error", "message": f"Space {space_id} is occupied"})
        return

    if is_space_held(space_id):
        await manager.send_json(ws_id, {"type": "error", "message": f"Space {space_id} is already held"})
        return

    booking_lead_time = garage_config.game_hour - garage_state.current_time
    price_result = calculate_price(space, garage_state.current_time, garage_state, booking_lead_time)

    hold_expires_at = time.time() + garage_config.spot_hold_seconds
    spot_holds[space_id] = {
        "ws_id": ws_id,
        "price_result": price_result,
        "hold_expires_at": hold_expires_at,
    }

    await manager.send_json(ws_id, {
        "type": "spot_held",
        "space_id": space_id,
        "price_result": price_result.model_dump(),
        "hold_expires_at": hold_expires_at,
    })


async def handle_release_spot(ws_id: str, data: dict) -> None:
    """Release a held spot. Idempotent — no error if spot was not held."""
    space_id = data.get("space_id", "")
    spot_holds.pop(space_id, None)
    await manager.send_json(ws_id, {"type": "spot_released", "space_id": space_id})


async def handle_book_spot(ws_id: str, data: dict) -> None:
    """Confirm a booking using the price locked at hold time.

    Validates: hold exists, not expired, belongs to this client, duration 1-4 hours.
    Creates a Reservation, removes the hold, and broadcasts updated state.
    """
    space_id = data.get("space_id", "")
    duration_hours = data.get("duration_hours", 0)

    if not isinstance(duration_hours, (int, float)) or duration_hours < 1 or duration_hours > 4:
        await manager.send_json(ws_id, {
            "type": "booking_failed",
            "space_id": space_id,
            "reason": f"Invalid duration: {duration_hours}. Must be 1-4 hours.",
        })
        return

    hold = spot_holds.get(space_id)
    if hold is None:
        await manager.send_json(ws_id, {
            "type": "booking_failed",
            "space_id": space_id,
            "reason": "No active hold on this space. Select the spot first.",
        })
        return

    if time.time() > hold["hold_expires_at"]:
        del spot_holds[space_id]
        await manager.send_json(ws_id, {
            "type": "booking_failed",
            "space_id": space_id,
            "reason": "Hold has expired. Please re-select the spot.",
        })
        return

    if hold["ws_id"] != ws_id:
        await manager.send_json(ws_id, {
            "type": "booking_failed",
            "space_id": space_id,
            "reason": "Hold belongs to another client.",
        })
        return

    price_result: PriceResult = hold["price_result"]
    price_locked = price_result.final_price
    total_cost = round(price_locked * duration_hours, 2)

    reservation = Reservation(
        id=str(uuid.uuid4()),
        space_id=space_id,
        start_time=garage_state.current_time,
        end_time=garage_state.current_time + duration_hours,
        price_locked=price_locked,
        total_cost=total_cost,
        is_simulated=False,
        status=ReservationStatus.ACTIVE,
    )
    garage_state.reservations.append(reservation)

    del spot_holds[space_id]

    await manager.send_json(ws_id, {
        "type": "booking_confirmed",
        "reservation": reservation.model_dump(),
    })

    await manager.broadcast(build_state_snapshot())


async def handle_set_playing(_ws_id: str, data: dict) -> None:
    """Start or stop the simulation tick loop and broadcast updated state."""
    global _tick_task
    is_playing = data.get("is_playing", False)
    garage_state.is_playing = bool(is_playing)

    if garage_state.is_playing:
        if _tick_task is None or _tick_task.done():
            _tick_task = asyncio.create_task(tick_loop())

    await manager.broadcast(build_state_snapshot())


async def handle_set_time(_ws_id: str, data: dict) -> None:
    """Scrub simulation to a specific time. Pauses playback and clamps to sim bounds."""
    global _tick_task
    new_time = data.get("time", garage_state.current_time)

    garage_state.is_playing = False
    if _tick_task and not _tick_task.done():
        _tick_task.cancel()
        try:
            await _tick_task
        except asyncio.CancelledError:
            pass
        _tick_task = None

    sim_end = garage_config.sim_end_hour + garage_config.sim_end_minute / 60.0
    garage_state.current_time = max(
        float(garage_config.sim_start_hour),
        min(sim_end, float(new_time)),
    )

    await manager.broadcast(build_state_snapshot())


async def handle_reset(_ws_id: str, _data: dict) -> None:
    """Re-initialize garage to 6 AM defaults, clear holds, stop playback."""
    global garage_state, _tick_task

    if _tick_task and not _tick_task.done():
        _tick_task.cancel()
        try:
            await _tick_task
        except asyncio.CancelledError:
            pass
        _tick_task = None

    garage_state = initialize_garage()
    spot_holds.clear()

    await manager.broadcast(build_state_snapshot())


async def handle_get_state(ws_id: str, _data: dict) -> None:
    """Send a full state snapshot to the requesting client (e.g. on reconnect)."""
    await manager.send_json(ws_id, build_state_snapshot())


ACTION_HANDLERS = {
    "select_spot": handle_select_spot,
    "release_spot": handle_release_spot,
    "book_spot": handle_book_spot,
    "set_playing": handle_set_playing,
    "set_time": handle_set_time,
    "reset": handle_reset,
    "get_state": handle_get_state,
}


# ── Tick Loop ───────────────────────────────────────────────────────
async def tick_loop() -> None:
    """Advance simulation time while garage_state.is_playing.

    Runs at 500ms per tick. At 1x speed: 1 sim-hour per 10 real-seconds,
    so each tick advances 0.05 sim-hours. Full day (6 AM-11:59 PM) in ~3 min.
    """
    sim_end = garage_config.sim_end_hour + garage_config.sim_end_minute / 60.0

    while garage_state.is_playing:
        await asyncio.sleep(0.5)

        if not garage_state.is_playing:
            break

        # Advance time: 0.05 sim-hours per tick at 1x speed
        time_step = 0.05 * garage_state.playback_speed
        garage_state.current_time = min(
            garage_state.current_time + time_step, sim_end
        )

        # Expire completed reservations
        for r in garage_state.reservations:
            if (
                r.status == ReservationStatus.ACTIVE
                and garage_state.current_time >= r.end_time
            ):
                r.status = ReservationStatus.COMPLETED

        cleanup_expired_holds()

        # Auto-stop at sim end
        if garage_state.current_time >= sim_end:
            garage_state.is_playing = False

        # Broadcast full snapshot to all clients
        # NOTE: Full snapshots per tick for MVP simplicity. Delta optimization deferred to post-MVP.
        await manager.broadcast(build_state_snapshot())


# ── WebSocket Endpoint ──────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """Main WebSocket endpoint for client-server communication.

    On connect: sends a full state snapshot.
    Then loops receiving JSON messages and dispatching to action handlers.
    On disconnect: removes from manager and cleans up any held spots.
    """
    ws_id = await manager.connect(ws)
    try:
        await manager.send_json(ws_id, build_state_snapshot())

        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "")

            handler = ACTION_HANDLERS.get(msg_type)
            if handler:
                await handler(ws_id, data)
            else:
                await manager.send_json(ws_id, {
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}",
                })

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws_id)
        # Clean up any holds owned by this connection
        expired = [sid for sid, h in spot_holds.items() if h["ws_id"] == ws_id]
        for sid in expired:
            del spot_holds[sid]


# ── Health Check ────────────────────────────────────────────────────
@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint returning server status, space count, and current sim time."""
    return {
        "status": "ok",
        "spaces": len(garage_state.spaces),
        "time": garage_state.current_time,
    }
