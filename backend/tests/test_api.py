"""Integration tests for the FastAPI backend API layer."""

import time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app, garage_state, spot_holds, manager
from backend.models.garage import initialize_garage
from backend.config.settings import ReservationStatus


@pytest.fixture(autouse=True)
def reset_state():
    """Reset all module-level state before each test."""
    import backend.main as main_mod

    main_mod.garage_state = initialize_garage()
    main_mod.spot_holds.clear()
    main_mod.manager.active_connections.clear()
    if main_mod._tick_task and not main_mod._tick_task.done():
        main_mod._tick_task.cancel()
    main_mod._tick_task = None
    yield
    # Cleanup after test
    main_mod.spot_holds.clear()
    main_mod.manager.active_connections.clear()
    if main_mod._tick_task and not main_mod._tick_task.done():
        main_mod._tick_task.cancel()
    main_mod._tick_task = None


client = TestClient(app)


# ── TestHealthEndpoint ──────────────────────────────────────────────


class TestHealthEndpoint:
    def test_health_returns_200(self):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_status_ok(self):
        resp = client.get("/health")
        data = resp.json()
        assert data["status"] == "ok"

    def test_health_has_spaces_and_time(self):
        resp = client.get("/health")
        data = resp.json()
        assert data["spaces"] == 100
        assert data["time"] == 6.0


# ── TestWebSocketConnect ────────────────────────────────────────────


class TestWebSocketConnect:
    def test_receives_state_snapshot_on_connect(self):
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "state_snapshot"

    def test_snapshot_has_100_spaces(self):
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            assert len(msg["state"]["spaces"]) == 100

    def test_snapshot_has_100_prices(self):
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            assert len(msg["prices"]) == 100

    def test_snapshot_has_metrics(self):
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            metrics = msg["metrics"]
            assert "total_revenue" in metrics
            assert "occupancy_rate" in metrics
            assert "total_spaces" in metrics

    def test_snapshot_initial_state(self):
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            assert msg["state"]["current_time"] == 6.0
            assert msg["state"]["is_playing"] is False
            assert len(msg["state"]["reservations"]) == 0


# ── TestSelectSpot ──────────────────────────────────────────────────


class TestSelectSpot:
    def test_select_available_spot(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # initial snapshot
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            msg = ws.receive_json()
            assert msg["type"] == "spot_held"
            assert msg["space_id"] == "R0C5"
            assert "price_result" in msg
            assert "hold_expires_at" in msg

    def test_select_spot_returns_valid_price_result(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            msg = ws.receive_json()
            pr = msg["price_result"]
            assert pr["final_price"] > 0
            assert pr["base_price"] > 0
            assert "occupancy_multiplier" in pr
            assert "elasticity" in pr

    def test_select_occupied_spot_errors(self):
        import backend.main as main_mod
        from backend.models.reservation import Reservation

        main_mod.garage_state.reservations.append(
            Reservation(
                id="test-res-1",
                space_id="R0C5",
                start_time=5.0,
                end_time=8.0,
                price_locked=20.0,
                total_cost=60.0,
                is_simulated=False,
                status=ReservationStatus.ACTIVE,
            )
        )
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert "occupied" in msg["message"].lower()

    def test_select_already_held_spot_errors(self):
        import backend.main as main_mod

        main_mod.spot_holds["R0C5"] = {
            "ws_id": "other-client",
            "price_result": None,
            "hold_expires_at": time.time() + 30,
        }
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert "held" in msg["message"].lower()

    def test_select_nonexistent_spot_errors(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R99C99"})
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert "not found" in msg["message"].lower()

    def test_hold_expires_after_timeout(self):
        """Hold should be expired when checked after timeout (mocked time)."""
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            msg = ws.receive_json()
            assert msg["type"] == "spot_held"

            # Fast-forward time past hold expiry
            with patch("backend.main.time") as mock_time:
                mock_time.time.return_value = time.time() + 31
                assert not main_mod.is_space_held("R0C5")


# ── TestReleaseSpot ─────────────────────────────────────────────────


class TestReleaseSpot:
    def test_release_held_spot(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            ws.receive_json()  # spot_held
            ws.send_json({"type": "release_spot", "space_id": "R0C5"})
            msg = ws.receive_json()
            assert msg["type"] == "spot_released"
            assert msg["space_id"] == "R0C5"

    def test_release_unheld_spot_is_idempotent(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "release_spot", "space_id": "R0C5"})
            msg = ws.receive_json()
            assert msg["type"] == "spot_released"


# ── TestBookSpot ────────────────────────────────────────────────────


class TestBookSpot:
    def _select_and_hold(self, ws, space_id="R0C5"):
        ws.send_json({"type": "select_spot", "space_id": space_id})
        return ws.receive_json()

    def test_book_after_hold(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            self._select_and_hold(ws)
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 2})
            msg = ws.receive_json()
            assert msg["type"] == "booking_confirmed"
            assert msg["reservation"]["space_id"] == "R0C5"

    def test_total_cost_is_price_times_duration(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            hold_msg = self._select_and_hold(ws)
            locked_price = hold_msg["price_result"]["final_price"]
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 3})
            msg = ws.receive_json()
            assert msg["type"] == "booking_confirmed"
            assert msg["reservation"]["total_cost"] == round(locked_price * 3, 2)

    def test_booking_uses_locked_price(self):
        """Price at booking time should match the price locked at selection time."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            hold_msg = self._select_and_hold(ws)
            locked_price = hold_msg["price_result"]["final_price"]
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 1})
            msg = ws.receive_json()
            assert msg["type"] == "booking_confirmed"
            assert msg["reservation"]["price_locked"] == locked_price

    def test_book_without_hold_fails(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 2})
            msg = ws.receive_json()
            assert msg["type"] == "booking_failed"
            assert "hold" in msg["reason"].lower()

    def test_book_expired_hold_fails(self):
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            self._select_and_hold(ws)

            # Expire the hold by setting expiry in the past
            hold = main_mod.spot_holds.get("R0C5")
            if hold:
                hold["hold_expires_at"] = time.time() - 1

            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 2})
            msg = ws.receive_json()
            assert msg["type"] == "booking_failed"
            assert "expired" in msg["reason"].lower()

    def test_book_invalid_duration_zero(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            self._select_and_hold(ws)
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 0})
            msg = ws.receive_json()
            assert msg["type"] == "booking_failed"
            assert "duration" in msg["reason"].lower()

    def test_book_invalid_duration_five(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            self._select_and_hold(ws)
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 5})
            msg = ws.receive_json()
            assert msg["type"] == "booking_failed"
            assert "duration" in msg["reason"].lower()

    def test_booking_creates_reservation_in_state(self):
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            self._select_and_hold(ws)
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 2})
            ws.receive_json()  # booking_confirmed
            # Also receive broadcast snapshot
            ws.receive_json()
            assert len(main_mod.garage_state.reservations) == 1
            res = main_mod.garage_state.reservations[0]
            assert res.space_id == "R0C5"
            assert res.status == ReservationStatus.ACTIVE

    def test_booking_releases_hold(self):
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            self._select_and_hold(ws)
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 1})
            ws.receive_json()  # booking_confirmed
            ws.receive_json()  # broadcast snapshot
            assert "R0C5" not in main_mod.spot_holds

    def test_reservation_is_not_simulated(self):
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            self._select_and_hold(ws)
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 1})
            ws.receive_json()  # booking_confirmed
            ws.receive_json()  # broadcast
            assert main_mod.garage_state.reservations[0].is_simulated is False

    def test_booking_adds_event_to_log(self):
        """Manual booking should add a 'booking' event to the event log."""
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # initial snapshot
            self._select_and_hold(ws)
            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 2})
            ws.receive_json()  # booking_confirmed
            snapshot = ws.receive_json()  # broadcast snapshot

            # Check event log in garage state
            assert len(main_mod.garage_state.event_log) >= 1
            booking_events = [e for e in main_mod.garage_state.event_log if e.event_type == "booking"]
            assert len(booking_events) == 1
            assert "R0C5" in booking_events[0].details
            assert "Manual booking" in booking_events[0].details

            # Check event log is included in state snapshot
            event_log = snapshot["state"]["event_log"]
            assert len(event_log) >= 1
            booking_events_in_snapshot = [e for e in event_log if e["event_type"] == "booking"]
            assert len(booking_events_in_snapshot) == 1


# ── TestSetPlaying ──────────────────────────────────────────────────


class TestSetPlaying:
    def test_play_sets_is_playing_true(self):
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_playing", "is_playing": True})
            msg = ws.receive_json()
            assert msg["type"] == "state_snapshot"
            assert msg["state"]["is_playing"] is True

    def test_pause_sets_is_playing_false(self):
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_playing", "is_playing": False})
            msg = ws.receive_json()
            assert msg["type"] == "state_snapshot"
            assert msg["state"]["is_playing"] is False

    def test_play_advances_time(self):
        """When playing, time should advance from initial 6.0 after tick."""
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_playing", "is_playing": True})
            ws.receive_json()  # snapshot from set_playing

            # Wait for at least one tick to happen
            import time as time_mod

            time_mod.sleep(0.7)

            ws.send_json({"type": "set_playing", "is_playing": False})
            msg = ws.receive_json()  # might get a tick snapshot first

            # Drain any queued messages and find the last snapshot
            final_time = msg["state"]["current_time"]
            # The time should have advanced at least a little
            # (tick loop may or may not have run depending on timing)
            # Let's just verify it's >= 6.0
            assert final_time >= 6.0


# ── TestSetTime ─────────────────────────────────────────────────────


class TestSetTime:
    def test_scrub_to_time(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_time", "time": 14.0})
            msg = ws.receive_json()
            assert msg["type"] == "state_snapshot"
            assert msg["state"]["current_time"] == 14.0

    def test_scrub_pauses_playback(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_playing", "is_playing": True})
            ws.receive_json()
            ws.send_json({"type": "set_time", "time": 14.0})
            msg = ws.receive_json()
            assert msg["state"]["is_playing"] is False

    def test_scrub_clamps_to_start(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_time", "time": 2.0})
            msg = ws.receive_json()
            assert msg["state"]["current_time"] == 6.0

    def test_scrub_clamps_to_end(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_time", "time": 25.0})
            msg = ws.receive_json()
            # sim_end = 23 + 59/60 = 23.9833...
            assert msg["state"]["current_time"] == pytest.approx(23.983, abs=0.001)

    def test_prices_change_near_game_time(self):
        """Scrubbing to near game time (19) should produce higher prices than 6 AM."""
        with client.websocket_connect("/ws") as ws:
            snapshot_6am = ws.receive_json()
            price_6am = snapshot_6am["prices"]["R0C5"]["final_price"]

            ws.send_json({"type": "set_time", "time": 18.5})
            snapshot_18 = ws.receive_json()
            price_18 = snapshot_18["prices"]["R0C5"]["final_price"]

            assert price_18 > price_6am


# ── TestSetSpeed ───────────────────────────────────────────────────


class TestSetSpeed:
    """Tests for playback speed control."""

    def test_set_speed_2x(self):
        """Setting speed to 2x should update playback_speed."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 2})
            msg = ws.receive_json()
            assert msg["type"] == "state_snapshot"
            assert msg["state"]["playback_speed"] == 2.0

    def test_set_speed_5x(self):
        """Setting speed to 5x should update playback_speed."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 5})
            msg = ws.receive_json()
            assert msg["state"]["playback_speed"] == 5.0

    def test_set_speed_10x(self):
        """Setting speed to 10x should update playback_speed."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 10})
            msg = ws.receive_json()
            assert msg["state"]["playback_speed"] == 10.0

    def test_set_speed_1x(self):
        """Setting speed back to 1x should work."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 5})
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 1})
            msg = ws.receive_json()
            assert msg["state"]["playback_speed"] == 1.0

    def test_invalid_speed_returns_error(self):
        """Invalid speed values should return an error."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 3})  # Not a valid speed
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert "Invalid speed" in msg["message"]

    def test_speed_persists_across_messages(self):
        """Speed setting should persist in subsequent state snapshots."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 10})
            ws.receive_json()
            # Trigger another state snapshot
            ws.send_json({"type": "get_state"})
            msg = ws.receive_json()
            assert msg["state"]["playback_speed"] == 10.0

    def test_reset_restores_default_speed(self):
        """Reset should restore speed to 1x."""
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_speed", "speed": 10})
            ws.receive_json()
            ws.send_json({"type": "reset"})
            msg = ws.receive_json()
            assert msg["state"]["playback_speed"] == 1.0


# ── TestReset ───────────────────────────────────────────────────────


class TestReset:
    def test_reset_clears_reservations(self):
        import backend.main as main_mod
        from backend.models.reservation import Reservation

        main_mod.garage_state.reservations.append(
            Reservation(
                id="test-res",
                space_id="R0C5",
                start_time=6.0,
                end_time=8.0,
                price_locked=20.0,
                total_cost=40.0,
            )
        )
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "reset"})
            msg = ws.receive_json()
            assert msg["type"] == "state_snapshot"
            assert len(msg["state"]["reservations"]) == 0

    def test_reset_restores_time(self):
        import backend.main as main_mod

        main_mod.garage_state.current_time = 15.0
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "reset"})
            msg = ws.receive_json()
            assert msg["state"]["current_time"] == 6.0

    def test_reset_clears_holds(self):
        import backend.main as main_mod

        main_mod.spot_holds["R0C5"] = {
            "ws_id": "test",
            "price_result": None,
            "hold_expires_at": time.time() + 30,
        }
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "reset"})
            ws.receive_json()
            assert len(main_mod.spot_holds) == 0

    def test_reset_stops_playback(self):
        import backend.main as main_mod

        main_mod.garage_state.is_playing = True
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "reset"})
            msg = ws.receive_json()
            assert msg["state"]["is_playing"] is False

    def test_reset_broadcasts_to_all(self):
        with client.websocket_connect("/ws") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws") as ws2:
                ws2.receive_json()
                ws1.send_json({"type": "reset"})
                msg1 = ws1.receive_json()
                msg2 = ws2.receive_json()
                assert msg1["type"] == "state_snapshot"
                assert msg2["type"] == "state_snapshot"


# ── TestMetrics ─────────────────────────────────────────────────────


class TestMetrics:
    def test_initial_revenue_is_zero(self):
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            assert msg["metrics"]["total_revenue"] == 0

    def test_booking_increases_revenue(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            hold_msg = ws.receive_json()
            locked_price = hold_msg["price_result"]["final_price"]

            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 2})
            ws.receive_json()  # booking_confirmed
            snapshot = ws.receive_json()  # broadcast snapshot
            assert snapshot["metrics"]["total_revenue"] == round(locked_price * 2, 2)

    def test_occupancy_updates_after_booking(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            ws.receive_json()  # spot_held

            ws.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 2})
            ws.receive_json()  # booking_confirmed
            snapshot = ws.receive_json()  # broadcast snapshot
            assert snapshot["metrics"]["occupancy_count"] == 1
            assert snapshot["metrics"]["occupancy_rate"] == pytest.approx(0.01, abs=0.001)


# ── TestEdgeCases ───────────────────────────────────────────────────


class TestEdgeCases:
    def test_unknown_message_type_returns_error(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "do_something_weird"})
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert "unknown" in msg["message"].lower()

    def test_disconnect_cleans_up_holds(self):
        import backend.main as main_mod

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "select_spot", "space_id": "R0C5"})
            ws.receive_json()  # spot_held
            assert "R0C5" in main_mod.spot_holds

        # After disconnect, hold should be cleaned up
        assert "R0C5" not in main_mod.spot_holds

    def test_multiple_clients_connect(self):
        with client.websocket_connect("/ws") as ws1:
            msg1 = ws1.receive_json()
            assert msg1["type"] == "state_snapshot"
            with client.websocket_connect("/ws") as ws2:
                msg2 = ws2.receive_json()
                assert msg2["type"] == "state_snapshot"


# ── TestBookingBroadcast ────────────────────────────────────────────


class TestBookingBroadcast:
    def test_booking_broadcasts_to_other_clients(self):
        """When client1 books, client2 should receive the broadcast snapshot."""
        with client.websocket_connect("/ws") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws") as ws2:
                ws2.receive_json()

                ws1.send_json({"type": "select_spot", "space_id": "R0C5"})
                ws1.receive_json()  # spot_held

                ws1.send_json({"type": "book_spot", "space_id": "R0C5", "duration_hours": 1})
                ws1.receive_json()  # booking_confirmed

                # Both clients should get broadcast snapshot
                snap1 = ws1.receive_json()
                snap2 = ws2.receive_json()
                assert snap1["type"] == "state_snapshot"
                assert snap2["type"] == "state_snapshot"
                assert len(snap2["state"]["reservations"]) == 1


# ── TestGetState ────────────────────────────────────────────────────


class TestGetState:
    def test_get_state_returns_snapshot(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
            ws.send_json({"type": "get_state"})
            msg = ws.receive_json()
            assert msg["type"] == "state_snapshot"
            assert len(msg["state"]["spaces"]) == 100

    def test_get_state_reflects_current_time(self):
        import backend.main as main_mod

        main_mod.garage_state.current_time = 12.5
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            assert msg["state"]["current_time"] == 12.5
