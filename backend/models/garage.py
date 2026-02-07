import math

from pydantic import BaseModel, Field

from backend.config.settings import SpotType, garage_config, GarageConfig
from backend.models.space import Space


class EventLogEntry(BaseModel):
    timestamp: float  # Sim time as hour
    event_type: str
    details: str


class GarageState(BaseModel):
    current_time: float = 6.0  # Start at 6 AM
    is_playing: bool = False
    playback_speed: float = 1.0
    spaces: list[Space] = Field(default_factory=list)
    reservations: list = Field(default_factory=list)  # list[Reservation]
    held_space_ids: dict[str, float] = Field(default_factory=dict)
    simulation_enabled: bool = False
    event_log: list[EventLogEntry] = Field(default_factory=list)


def _get_zone(row: int, config: GarageConfig) -> str:
    """Assign zone based on row position.

    Zone A (rows 0-2): near entrance
    Zone B (rows 3-6): middle
    Zone C (rows 7-9): far from entrance
    """
    total = config.rows
    if row < total * 0.3:
        return "A"
    elif row < total * 0.7:
        return "B"
    else:
        return "C"


def _get_spot_type(row: int, col: int, zone: str, config: GarageConfig) -> SpotType:
    """Assign spot type based on position.

    EV: Zone A, columns 0-1 (leftmost near entrance)
    Motorcycle: Zone C, columns 8-9 (rightmost far side)
    Standard: everything else
    """
    if zone == "A" and col <= 1:
        return SpotType.EV
    if zone == "C" and col >= config.cols - 2:
        return SpotType.MOTORCYCLE
    return SpotType.STANDARD


def _distance_to_entrance(row: int, col: int, config: GarageConfig) -> float:
    """Calculate Euclidean distance from space to entrance.

    Entrance is at row 0, center columns.
    """
    entrance_row = 0
    entrance_col = config.cols / 2.0
    return math.sqrt((row - entrance_row) ** 2 + (col - entrance_col) ** 2)


def initialize_garage(config: GarageConfig | None = None) -> GarageState:
    """Generate the parking garage grid and return initial state.

    Creates a rows x cols grid with zones, spot types, and distances assigned.
    """
    if config is None:
        config = garage_config

    spaces: list[Space] = []
    for row in range(config.rows):
        zone = _get_zone(row, config)
        for col in range(config.cols):
            spot_type = _get_spot_type(row, col, zone, config)
            distance = _distance_to_entrance(row, col, config)
            space = Space(
                id=f"R{row}C{col}",
                type=spot_type,
                zone=zone,
                row=row,
                col=col,
                distance_to_entrance=round(distance, 2),
            )
            spaces.append(space)

    return GarageState(
        current_time=float(config.sim_start_hour),
        spaces=spaces,
    )
