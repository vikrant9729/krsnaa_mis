"""DOS Export Service - Export DOS data in required format."""

from __future__ import annotations

from io import BytesIO
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.models.entities import DosDataset, DosRow

REQUIRED_EXPORT_COLUMNS = [
    "OwnerID",
    "LAB_Name",
    "CC_Code",
    "CC_Name",
    "Partner_Status",
    "type",
    "bill type",
    "dos avilablety",
    "Centre_OperationType",
    "Centre_Sub_OperationType",
    "Test_Code",
    "test_name",
    "Specimen_Type",
    "Bill_Rate",
    "TestCategory_Mapped",
    "LAB_TestId_MIS",
    "LAB_TestID",
    "center type",
]


def export_dos_to_excel(
    db: Session,
    center_id: int,
    version: Optional[int] = None,
    category: Optional[str] = None,
) -> bytes:
    """Export DOS data to Excel in required format."""
    # Get dataset
    query = db.query(DosDataset).filter(
        DosDataset.center_id == center_id,
        DosDataset.is_active.is_(True)
    )
    
    if version:
        query = query.filter(DosDataset.version == version)
    else:
        query = query.order_by(DosDataset.version.desc())
    
    dataset = query.first()
    if not dataset:
        raise ValueError("No active DOS dataset found")
    
    # Get rows
    rows_query = db.query(DosRow).filter(DosRow.dataset_id == dataset.id)
    dos_rows = rows_query.all()
    
    # Convert to DataFrame
    data = []
    for row in dos_rows:
        row_data = row.data_json.copy()
        
        # Filter by category if specified
        if category:
            row_category = str(row_data.get("TestCategory_Mapped", "")).strip()
            if row_category.lower() != category.lower():
                continue
        
        data.append(row_data)
    
    if not data:
        raise ValueError("No data to export")
    
    df = pd.DataFrame(data)
    
    # Ensure all required columns exist
    for col in REQUIRED_EXPORT_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    
    # Select and order columns
    df = df[REQUIRED_EXPORT_COLUMNS]
    
    # Export to Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="DOS Data")
    
    output.seek(0)
    return output.getvalue()


def export_dos_to_csv(
    db: Session,
    center_id: int,
    version: Optional[int] = None,
    category: Optional[str] = None,
) -> str:
    """Export DOS data to CSV in required format (tab-separated)."""
    excel_bytes = export_dos_to_excel(db, center_id, version, category)
    
    # Convert Excel bytes to CSV
    df = pd.read_excel(BytesIO(excel_bytes))
    
    # Convert to tab-separated string
    csv_output = BytesIO()
    df.to_csv(csv_output, sep="\t", index=False, encoding="utf-8")
    csv_output.seek(0)
    
    return csv_output.getvalue().decode("utf-8")
