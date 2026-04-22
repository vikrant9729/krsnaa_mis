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

    # Read ONLY the first sheet to avoid hidden/duplicate sheets
    df = pd.read_excel(BytesIO(content), sheet_name=0)
    return _validate_and_convert(df, strict=False)


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
        
        # Must have a center identifier AND a test identifier
        cc = str(normalized.get("CC_Code", "")).strip() or str(normalized.get("OwnerID", "")).strip()
        tc = str(normalized.get("Test_Code", "")).strip() or str(normalized.get("LAB_TestID", "")).strip()
        
        if not cc or not tc:
            continue
            
        normalized["__row_hash"] = hashlib.sha256(str(normalized).encode()).hexdigest()
        rows.append(normalized)
    return rows
