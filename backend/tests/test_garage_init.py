"""Tests for garage initialization with horizontal layout.

Layout: Entrance on left side, zones based on column position.
- Zone A (cols 0-2): Premium, near entrance
- Zone B (cols 3-6): Standard, middle
- Zone C (cols 7-9): Economy, far from entrance

Spot types:
- EV: Zone A, rows 0-2 (top-left near entrance)
- Motorcycle: Zone A, rows 7-9 (bottom-left near entrance)
- Standard: Everything else
"""

from backend.config.settings import SpotType, GarageConfig
from backend.models.garage import initialize_garage


def test_total_spaces():
    """initialize_garage produces exactly 100 spaces for a 10x10 grid."""
    state = initialize_garage()
    assert len(state.spaces) == 100


def test_zone_distribution():
    """Zones are assigned by column: A=cols 0-2, B=cols 3-6, C=cols 7-9."""
    state = initialize_garage()
    for space in state.spaces:
        if space.col <= 2:
            assert space.zone == "A", f"Col {space.col} should be zone A"
        elif space.col <= 6:
            assert space.zone == "B", f"Col {space.col} should be zone B"
        else:
            assert space.zone == "C", f"Col {space.col} should be zone C"


def test_zone_counts():
    """Zone sizes: A=30 (3 cols), B=40 (4 cols), C=30 (3 cols)."""
    state = initialize_garage()
    zone_counts = {"A": 0, "B": 0, "C": 0}
    for space in state.spaces:
        zone_counts[space.zone] += 1
    assert zone_counts["A"] == 30
    assert zone_counts["B"] == 40
    assert zone_counts["C"] == 30


def test_ev_spots_near_entrance():
    """EV spots are in Zone A, rows 0-2 (top-left near entrance)."""
    state = initialize_garage()
    ev_spaces = [s for s in state.spaces if s.type == SpotType.EV]
    assert len(ev_spaces) > 0
    for space in ev_spaces:
        assert space.zone == "A", f"EV spot {space.id} should be in zone A"
        assert space.row <= 2, f"EV spot {space.id} should be in rows 0-2"


def test_ev_spot_count():
    """Should have 9 EV spots (Zone A cols 0-2, rows 0-2 = 3x3)."""
    state = initialize_garage()
    ev_count = sum(1 for s in state.spaces if s.type == SpotType.EV)
    assert ev_count == 9


def test_motorcycle_spots_near_entrance():
    """Motorcycle spots are in Zone A, rows 7-9 (bottom-left near entrance)."""
    state = initialize_garage()
    moto_spaces = [s for s in state.spaces if s.type == SpotType.MOTORCYCLE]
    assert len(moto_spaces) > 0
    for space in moto_spaces:
        assert space.zone == "A", f"Motorcycle spot {space.id} should be in zone A"
        assert space.row >= 7, f"Motorcycle spot {space.id} should be in rows 7-9"


def test_motorcycle_spot_count():
    """Should have 9 motorcycle spots (Zone A cols 0-2, rows 7-9 = 3x3)."""
    state = initialize_garage()
    moto_count = sum(1 for s in state.spaces if s.type == SpotType.MOTORCYCLE)
    assert moto_count == 9


def test_standard_spots_are_remainder():
    """Standard spots fill everything not EV or motorcycle."""
    state = initialize_garage()
    standard_count = sum(1 for s in state.spaces if s.type == SpotType.STANDARD)
    ev_count = sum(1 for s in state.spaces if s.type == SpotType.EV)
    moto_count = sum(1 for s in state.spaces if s.type == SpotType.MOTORCYCLE)
    assert standard_count + ev_count + moto_count == 100
    assert standard_count == 82  # 100 - 9 EV - 9 motorcycle


def test_distance_increases_with_column():
    """Spaces farther from entrance (higher cols) have greater distance."""
    state = initialize_garage()
    # Compare same-row spaces across columns
    row = 5  # center row
    row_spaces = sorted(
        [s for s in state.spaces if s.row == row], key=lambda s: s.col
    )
    for i in range(1, len(row_spaces)):
        assert row_spaces[i].distance_to_entrance > row_spaces[i - 1].distance_to_entrance, (
            f"Col {row_spaces[i].col} should be farther than col {row_spaces[i-1].col}"
        )


def test_distance_col_zero_center():
    """Column 0, center row should have minimal distance to entrance."""
    state = initialize_garage()
    center_space = next(s for s in state.spaces if s.row == 5 and s.col == 0)
    assert center_space.distance_to_entrance == 0.0


def test_initial_state_time():
    """Initial time should be 6 AM (6.0)."""
    state = initialize_garage()
    assert state.current_time == 6.0


def test_initial_state_not_playing():
    """Simulation should not be playing on init."""
    state = initialize_garage()
    assert state.is_playing is False


def test_initial_state_no_reservations():
    """No reservations on init."""
    state = initialize_garage()
    assert len(state.reservations) == 0


def test_initial_state_simulation_disabled():
    """Simulation should be disabled on init."""
    state = initialize_garage()
    assert state.simulation_enabled is False


def test_initial_state_no_held_spaces():
    """No held spaces on init."""
    state = initialize_garage()
    assert len(state.held_space_ids) == 0


def test_initial_state_no_event_log():
    """Event log should be empty on init."""
    state = initialize_garage()
    assert len(state.event_log) == 0


def test_space_ids_unique():
    """All space IDs should be unique."""
    state = initialize_garage()
    ids = [s.id for s in state.spaces]
    assert len(ids) == len(set(ids))


def test_space_id_format():
    """Space IDs should follow R{row}C{col} format."""
    state = initialize_garage()
    for space in state.spaces:
        assert space.id == f"R{space.row}C{space.col}"


def test_custom_config():
    """initialize_garage respects custom GarageConfig."""
    config = GarageConfig(rows=5, cols=5)
    state = initialize_garage(config)
    assert len(state.spaces) == 25
