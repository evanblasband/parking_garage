from pydantic import BaseModel

from backend.config.settings import SpotType


class Space(BaseModel):
    id: str
    type: SpotType
    zone: str  # "A", "B", or "C"
    row: int
    col: int
    distance_to_entrance: float
