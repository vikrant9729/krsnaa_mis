"""Center Copy Service - Copy DOS from base center to new centers."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Center, DosDataset, DosRow
from app.services.audit import log_change


def copy_dos_to_center(
    db: Session,
    source_center_id: int,
    target_center_id: int,
    user_id: int,
    categories: list[str] | None = None,
) -> dict:
    """
    Copy DOS data from source center to target center.
    Maintains Bill_Rate as-is (base MRP).
    """
    # Get source active dataset
    source_dataset = (
        db.query(DosDataset)
        .filter(
            DosDataset.center_id == source_center_id,
            DosDataset.is_active.is_(True),
        )
        .order_by(DosDataset.version.desc())
        .first()
    )
    
    if not source_dataset:
        raise ValueError("Source center has no active DOS dataset")
    
    # Get source rows
    source_rows = db.query(DosRow).filter(
        DosRow.dataset_id == source_dataset.id
    ).all()
    
    if not source_rows:
        raise ValueError("Source center has no DOS data")
    
    # Filter by categories if specified
    if categories:
        filtered_rows = []
        for row in source_rows:
            row_category = str(row.data_json.get("TestCategory_Mapped", "")).strip()
            if row_category in categories:
                filtered_rows.append(row)
        source_rows = filtered_rows
    
    # Create new dataset for target center
    max_version = (
        db.query(DosDataset.version)
        .filter(DosDataset.center_id == target_center_id)
        .order_by(DosDataset.version.desc())
        .first()
    )
    new_version = (max_version[0] if max_version else 0) + 1
    
    target_dataset = DosDataset(
        center_id=target_center_id,
        version=new_version,
        source_filename=f"Copied from center {source_center_id}",
        columns_json=source_dataset.columns_json.copy(),
        copied_from=source_dataset.id,
        created_by=user_id,
        is_active=True,
    )
    
    # Deactivate previous active datasets
    db.query(DosDataset).filter(
        DosDataset.center_id == target_center_id,
        DosDataset.is_active.is_(True),
    ).update({"is_active": False})
    
    db.add(target_dataset)
    db.flush()  # Get dataset ID
    
    # Copy rows
    copied_count = 0
    for source_row in source_rows:
        new_row = DosRow(
            dataset_id=target_dataset.id,
            row_hash=source_row.row_hash,
            data_json=source_row.data_json.copy(),  # Copy data as-is
            version_snapshot=new_version,
        )
        db.add(new_row)
        copied_count += 1
    
    db.commit()
    
    # Log audit
    log_change(
        db,
        entity_type="dos_copy",
        entity_id=str(target_center_id),
        action="COPY_DOS",
        old_value={"source_center_id": source_center_id},
        new_value={
            "target_center_id": target_center_id,
            "rows_copied": copied_count,
            "version": new_version,
        },
        actor_id=user_id,
        change_summary=f"Copied {copied_count} DOS rows from center {source_center_id} to {target_center_id}",
    )
    
    return {
        "dataset_id": target_dataset.id,
        "version": new_version,
        "rows_copied": copied_count,
    }


def set_base_center(
    db: Session,
    center_id: int,
    is_base: bool = True,
) -> Center:
    """Mark/unmark a center as base center."""
    center = db.query(Center).filter(Center.id == center_id).first()
    if not center:
        raise ValueError("Center not found")
    
    center.is_base_center = is_base
    db.commit()
    db.refresh(center)
    
    return center
