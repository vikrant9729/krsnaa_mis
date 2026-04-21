from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.entities import DosRow


def validate_percentage(percentage: float) -> None:
    if percentage < -100 or percentage > 1000:
        raise ValueError("Percentage must be between -100 and +1000")


def apply_percentage_update(
    db: Session,
    *,
    dataset_id: int,
    percentage: float,
    column_name: str,
    category: str | None = None,
    commit: bool = True,
) -> int:
    """Apply percentage-based rate update to DOS rows."""
    validate_percentage(percentage)
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset_id).all()
    updated = 0
    for row in rows:
        payload = row.data_json
        if category and str(payload.get("TestCategory_Mapped", "")).lower() != category.lower():
            continue

        current = payload.get(column_name)
        try:
            numeric = float(current)
        except (TypeError, ValueError):
            continue

        payload[column_name] = round(numeric + (numeric * (percentage / 100)), 2)
        row.data_json = payload
        updated += 1

    if commit:
        db.commit()
    return updated


def preview_rate_update(
    db: Session,
    *,
    dataset_id: int,
    percentage: float,
    column_name: str,
    category: Optional[str] = None,
) -> list[dict]:
    """Preview rate changes without applying them."""
    validate_percentage(percentage)

    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset_id).all()
    preview_data = []
    
    for row in rows:
        payload = row.data_json
        if category and str(payload.get("TestCategory_Mapped", "")).lower() != category.lower():
            continue
        
        current = payload.get(column_name)
        try:
            numeric = float(current)
            new_value = round(numeric + (numeric * (percentage / 100)), 2)
            preview_data.append({
                "row_id": row.id,
                "test_code": payload.get("Test_Code"),
                "test_name": payload.get("test_name"),
                "category": payload.get("TestCategory_Mapped"),
                "current_value": numeric,
                "new_value": new_value,
                "difference": new_value - numeric,
            })
        except (TypeError, ValueError):
            continue
    
    return preview_data


def bulk_rate_update(
    db: Session,
    *,
    dataset_id: int,
    updates: list[dict],
) -> dict:
    """Apply multiple rate updates at once.
    
    updates format: [
        {"column_name": "Bill_Rate", "category": "Routine", "percentage": 10},
        {"column_name": "Bill_Rate", "category": "Special", "percentage": 15},
    ]
    """
    total_updated = 0
    results = []
    
    for update in updates:
        column_name = update["column_name"]
        category = update.get("category")
        percentage = update["percentage"]
        
        updated = apply_percentage_update(
            db,
            dataset_id=dataset_id,
            percentage=percentage,
            column_name=column_name,
            category=category,
            commit=False,
        )
        
        total_updated += updated
        results.append({
            "column_name": column_name,
            "category": category,
            "percentage": percentage,
            "rows_updated": updated,
        })

    db.commit()
    
    return {
        "total_updated": total_updated,
        "details": results,
    }
