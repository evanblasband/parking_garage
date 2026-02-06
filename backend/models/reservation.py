from pydantic import BaseModel

from backend.config.settings import ReservationStatus


class Reservation(BaseModel):
    id: str
    space_id: str
    start_time: float  # Sim time as hour (e.g. 14.5 = 2:30 PM)
    end_time: float
    price_locked: float  # $/hr at time of booking
    total_cost: float
    is_simulated: bool = False
    status: ReservationStatus = ReservationStatus.ACTIVE
