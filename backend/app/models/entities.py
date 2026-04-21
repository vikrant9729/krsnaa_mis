from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"
    AI_SYSTEM = "AI_SYSTEM"


class CenterTypeEnum(str, enum.Enum):
    HLM = "HLM"
    CC = "CC"
    PROJECT = "PROJECT"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Center(Base):
    __tablename__ = "centers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    center_code: Mapped[str] = mapped_column(String(100), name="code", unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    center_type: Mapped[CenterTypeEnum] = mapped_column(Enum(CenterTypeEnum), index=True)
    owner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("centers.id"), nullable=True, index=True)
    base_center_id: Mapped[Optional[int]] = mapped_column(ForeignKey("centers.id"), nullable=True, index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    is_base_center: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent: Mapped[Optional["Center"]] = relationship("Center", remote_side=[id], foreign_keys=[parent_id])
    base_center: Mapped[Optional["Center"]] = relationship("Center", remote_side=[id], foreign_keys=[base_center_id])


class DosDataset(Base):
    __tablename__ = "dos_datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    center_id: Mapped[int] = mapped_column(ForeignKey("centers.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    source_filename: Mapped[str] = mapped_column(String(255))
    columns_json: Mapped[list] = mapped_column(JSON, default=list)
    copied_from: Mapped[Optional[int]] = mapped_column(ForeignKey("dos_datasets.id"), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class DosRow(Base):
    __tablename__ = "dos_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("dos_datasets.id"), index=True)
    row_hash: Mapped[str] = mapped_column(String(128), index=True)
    data_json: Mapped[dict] = mapped_column(JSON)
    version_snapshot: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[str] = mapped_column(String(100), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    old_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor_type: Mapped[str] = mapped_column(String(30), default="USER")
    change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    can_restore: Mapped[bool] = mapped_column(Boolean, default=False)
    snapshot_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AIProviderConfig(Base):
    __tablename__ = "ai_provider_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(50), unique=True)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    priority: Mapped[int] = mapped_column(Integer)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    center_id: Mapped[int] = mapped_column(ForeignKey("centers.id"), index=True)
    issue_type: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text)
    proposed_patch: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(30), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    rate: Mapped[float] = mapped_column(Float, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CenterTest(Base):
    __tablename__ = "center_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    center_id: Mapped[int] = mapped_column(ForeignKey("centers.id"), index=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id"), index=True)
    custom_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DOSVersionSnapshot(Base):
    __tablename__ = "dos_version_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("dos_datasets.id"), index=True)
    center_id: Mapped[int] = mapped_column(ForeignKey("centers.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    snapshot_data: Mapped[list] = mapped_column(JSON)  # Complete DOS rows snapshot
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class MasterTest(Base):
    __tablename__ = "master_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    LAB_TestID: Mapped[str] = mapped_column(String(100), name="test_code", unique=True, index=True)
    test_name: Mapped[str] = mapped_column(String(255), index=True)
    TestCategory_Mapped: Mapped[Optional[str]] = mapped_column(String(100), name="category", nullable=True)
    specimen_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserCenterAssignment(Base):
    __tablename__ = "user_center_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    center_id: Mapped[int] = mapped_column(ForeignKey("centers.id"), index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
