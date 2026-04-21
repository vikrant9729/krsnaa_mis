from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.entities import AuditLog, DOSVersionSnapshot, DosDataset, DosRow


def log_change(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    old_value: dict | None,
    new_value: dict | None,
    actor_id: int | None,
    actor_type: str = "USER",
    change_summary: Optional[str] = None,
    can_restore: bool = False,
    snapshot_id: Optional[int] = None,
) -> AuditLog:
    """Log a change in the audit system."""
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        actor_id=actor_id,
        actor_type=actor_type,
        change_summary=change_summary,
        can_restore=can_restore,
        snapshot_id=snapshot_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def create_dos_snapshot(
    db: Session,
    dataset_id: int,
    center_id: int,
    version: int,
    user_id: int,
    reason: Optional[str] = None,
) -> DOSVersionSnapshot:
    """Create a snapshot of DOS data for restore/compare."""
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset_id).all()
    
    snapshot_data = [
        {
            "row_hash": row.row_hash,
            "data_json": row.data_json,
        }
        for row in rows
    ]
    
    snapshot = DOSVersionSnapshot(
        dataset_id=dataset_id,
        center_id=center_id,
        version=version,
        snapshot_data=snapshot_data,
        created_by=user_id,
        reason=reason,
    )
    
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    
    return snapshot
