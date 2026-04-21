from __future__ import annotations

import hashlib
from io import BytesIO

import pandas as pd

REQUIRED_COLUMNS = {
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
}


def parse_upload(content: bytes, filename: str) -> list[dict]:
    if filename.lower().endswith(".csv"):
        df = pd.read_csv(BytesIO(content))
        return _validate_and_convert(df)

    workbook = pd.read_excel(BytesIO(content), sheet_name=None)
    rows: list[dict] = []
    for _, sheet_df in workbook.items():
        rows.extend(_validate_and_convert(sheet_df, strict=False))
    return rows


def _validate_and_convert(df: pd.DataFrame, strict: bool = True) -> list[dict]:
    # Drop rows that are completely empty
    df = df.dropna(how="all")
    df = df.fillna("")
    
    present = set(df.columns.astype(str).tolist())
    missing = REQUIRED_COLUMNS - present
    if strict and missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    rows: list[dict] = []
    for row in df.to_dict(orient="records"):
        normalized = {str(k).strip(): v for k, v in row.items()}
        
        # Skip completely empty rows or rows without a center code/test code
        if not str(normalized.get("CC_Code", "")).strip() and not str(normalized.get("Test_Code", "")).strip():
            continue
            
        normalized["__row_hash"] = hashlib.sha256(str(normalized).encode()).hexdigest()
        rows.append(normalized)
    return rows
