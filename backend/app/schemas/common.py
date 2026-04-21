from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.entities import CenterTypeEnum, RoleEnum


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: RoleEnum


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: RoleEnum
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool


class CenterCreate(BaseModel):
    center_code: str
    name: str
    center_type: CenterTypeEnum
    owner_id: str | None = None
    parent_id: int | None = None
    is_base_center: bool = False
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class CenterOut(CenterCreate):
    id: int
    created_at: datetime


class TestCreate(BaseModel):
    code: str
    name: str
    rate: float = 0
    description: str | None = None


class TestOut(TestCreate):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TestUpdate(BaseModel):
    name: str | None = None
    rate: float | None = None
    description: str | None = None
    is_active: bool | None = None


class CenterTestCreate(BaseModel):
    center_id: int
    test_id: int
    custom_rate: float | None = None


class CenterTestOut(BaseModel):
    id: int
    center_id: int
    test_id: int
    custom_rate: float | None
    added_at: datetime
    test: TestOut

    class Config:
        from_attributes = True

    class Config:
        from_attributes = True


class RateUpdateRequest(BaseModel):
    center_id: int
    category: str | None = None
    column_name: str = "Bill_Rate"
    percentage: float


class RateUpdateRule(BaseModel):
    column_name: str = "Bill_Rate"
    category: str | None = None
    percentage: float


class RateUpdateBatchRequest(BaseModel):
    updates: list[RateUpdateRule]


class AIQueryRequest(BaseModel):
    query: str
    center_id: int | None = None


class AISuggestionApplyRequest(BaseModel):
    suggestion_id: int
    approved: bool = False
