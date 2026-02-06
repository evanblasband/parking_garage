from backend.config.settings import SpotType, GarageConfig
from backend.models.garage import initialize_garage


def test_total_spaces():
    """initialize_garage produces exactly 100 spaces for a 10x10 grid."""
    state = initialize_garage()
    assert len(state.spaces) == 100


def test_zone_distribution():
    """Zones are assigned correctly: A=rows 0-2, B=rows 3-6, C=rows 7-9."""
    state = initialize_garage()
    for space in state.spaces:
        if space.row <= 2:
            assert space.zone == "A", f"Row {space.row} should be zone A"
        elif space.row <= 6:
            assert space.zone == "B", f"Row {space.row} should be zone B"
        else:
            assert space.zone == "C", f"Row {space.row} should be zone C"


def test_zone_counts():
    """Zone sizes: A=30 (3 rows), B=40 (4 rows), C=30 (3 rows)."""
    state = initialize_garage()
    zone_counts = {"A": 0, "B": 0, "C": 0}
    for space in state.spaces:
        zone_counts[space.zone] += 1
    assert zone_counts["A"] == 30
    assert zone_counts["B"] == 40
    assert zone_counts["C"] == 30


def test_ev_spots_near_entrance():
    """EV spots are in Zone A, columns 0-1."""
    state = initialize_garage()
    ev_spaces = [s for s in state.spaces if s.type == SpotType.EV]
    assert len(ev_spaces) > 0
    for space in ev_spaces:
        assert space.zone == "A", f"EV spot {space.id} should be in zone A"
        assert space.col <= 1, f"EV spot {space.id} should be in columns 0-1"


def test_ev_spot_count():
    """Should have 6 EV spots (Zone A rows 0-2, columns 0-1)."""
    state = initialize_garage()
    ev_count = sum(1 for s in state.spaces if s.type == SpotType.EV)
    assert ev_count == 6


def test_motorcycle_spots_far_side():
    """Motorcycle spots are in Zone C, columns 8-9."""
    state = initialize_garage()
    moto_spaces = [s for s in state.spaces if s.type == SpotType.MOTORCYCLE]
    assert len(moto_spaces) > 0
    for space in moto_spaces:
        assert space.zone == "C", f"Motorcycle spot {space.id} should be in zone C"
        assert space.col >= 8, f"Motorcycle spot {space.id} should be in columns 8-9"


def test_motorcycle_spot_count():
    """Should have 6 motorcycle spots (Zone C rows 7-9, columns 8-9)."""
    state = initialize_garage()
    moto_count = sum(1 for s in state.spaces if s.type == SpotType.MOTORCYCLE)
    assert moto_count == 6


def test_standard_spots_are_remainder():
    """Standard spots fill everything not EV or motorcycle."""
    state = initialize_garage()
    standard_count = sum(1 for s in state.spaces if s.type == SpotType.STANDARD)
    ev_count = sum(1 for s in state.spaces if s.type == SpotType.EV)
    moto_count = sum(1 for s in state.spaces if s.type == SpotType.MOTORCYCLE)
    assert standard_count + ev_count + moto_count == 100
    assert standard_count == 88  # 100 - 6 EV - 6 motorcycle


def test_distance_increases_with_row():
    """Spaces farther from entrance (higher rows) have greater distance."""
    state = initialize_garage()
    # Compare same-column spaces across rows
    col = 5  # center column
    col_spaces = sorted(
        [s for s in state.spaces if s.col == col], key=lambda s: s.row
    )
    for i in range(1, len(col_spaces)):
        assert col_spaces[i].distance_to_entrance > col_spaces[i - 1].distance_to_entrance, (
            f"Row {col_spaces[i].row} should be farther than row {col_spaces[i-1].row}"
        )


def test_distance_row_zero_center():
    """Row 0, center column should have minimal distance to entrance."""
    state = initialize_garage()
    center_space = next(s for s in state.spaces if s.row == 0 and s.col == 5)
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
