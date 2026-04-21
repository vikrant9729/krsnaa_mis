"""AI Analysis Service - Intelligent DOS data analysis."""

from __future__ import annotations

from collections import Counter
from typing import Optional

from sqlalchemy.orm import Session

from app.models.entities import Center, DosDataset, DosRow


def detect_duplicate_tests(
    db: Session,
    center_id: int,
) -> list[dict]:
    """Detect duplicate test codes or names in DOS data."""
    # Get active dataset
    dataset = (
        db.query(DosDataset)
        .filter(
            DosDataset.center_id == center_id,
            DosDataset.is_active.is_(True),
        )
        .first()
    )
    
    if not dataset:
        return []
    
    # Get all rows
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    
    # Check for duplicate Test_Code
    test_codes = [str(row.data_json.get("Test_Code", "")).strip() for row in rows]
    code_counts = Counter(test_codes)
    
    duplicates = []
    for code, count in code_counts.items():
        if count > 1 and code:  # Skip empty codes
            # Find all rows with this code
            matching_rows = [
                {
                    "row_id": row.id,
                    "test_name": row.data_json.get("test_name"),
                    "bill_rate": row.data_json.get("Bill_Rate"),
                }
                for row in rows
                if str(row.data_json.get("Test_Code", "")).strip() == code
            ]
            
            duplicates.append({
                "type": "duplicate_test_code",
                "test_code": code,
                "count": count,
                "severity": "high",
                "rows": matching_rows,
                "suggestion": f"Test code '{code}' appears {count} times. Consider merging or removing duplicates.",
            })
    
    # Check for duplicate test names (different codes)
    test_names = [str(row.data_json.get("test_name", "")).strip().lower() for row in rows]
    name_counts = Counter(test_names)
    
    for name, count in name_counts.items():
        if count > 1 and name:
            duplicates.append({
                "type": "duplicate_test_name",
                "test_name": name,
                "count": count,
                "severity": "medium",
                "suggestion": f"Test name '{name}' appears {count} times with different codes. Verify if these are actually different tests.",
            })
    
    return duplicates


def detect_rate_anomalies(
    db: Session,
    center_id: int,
    threshold_std: float = 2.0,
) -> list[dict]:
    """Detect abnormally high or low Bill_Rate values."""
    dataset = (
        db.query(DosDataset)
        .filter(
            DosDataset.center_id == center_id,
            DosDataset.is_active.is_(True),
        )
        .first()
    )
    
    if not dataset:
        return []
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    
    # Extract rates by category
    category_rates = {}
    for row in rows:
        category = str(row.data_json.get("TestCategory_Mapped", "Unknown")).strip()
        try:
            rate = float(row.data_json.get("Bill_Rate", 0))
            if rate > 0:
                if category not in category_rates:
                    category_rates[category] = []
                category_rates[category].append({
                    "row_id": row.id,
                    "test_code": row.data_json.get("Test_Code"),
                    "test_name": row.data_json.get("test_name"),
                    "rate": rate,
                })
        except (ValueError, TypeError):
            continue
    
    anomalies = []
    for category, rates_data in category_rates.items():
        if len(rates_data) < 3:  # Need at least 3 samples
            continue
        
        rates = [r["rate"] for r in rates_data]
        mean_rate = sum(rates) / len(rates)
        std_dev = (sum((r - mean_rate) ** 2 for r in rates) / len(rates)) ** 0.5
        
        if std_dev == 0:
            continue
        
        # Find anomalies (beyond threshold standard deviations)
        for rate_data in rates_data:
            deviation = abs(rate_data["rate"] - mean_rate) / std_dev
            if deviation > threshold_std:
                anomalies.append({
                    "type": "rate_anomaly",
                    "category": category,
                    "test_code": rate_data["test_code"],
                    "test_name": rate_data["test_name"],
                    "rate": rate_data["rate"],
                    "category_mean": round(mean_rate, 2),
                    "deviation": round(deviation, 2),
                    "severity": "high" if deviation > 3 else "medium",
                    "suggestion": f"Rate {rate_data['rate']} is {deviation:.1f} std deviations from mean ({mean_rate:.2f}). Verify if correct.",
                })
    
    return anomalies


def analyze_center_health(
    db: Session,
    center_id: int,
) -> dict:
    """Generate comprehensive health report for a center."""
    center = db.query(Center).filter(Center.id == center_id).first()
    if not center:
        raise ValueError("Center not found")
    
    dataset = (
        db.query(DosDataset)
        .filter(
            DosDataset.center_id == center_id,
            DosDataset.is_active.is_(True),
        )
        .first()
    )
    
    if not dataset:
        return {
            "center_id": center_id,
            "center_name": center.name,
            "status": "no_data",
            "message": "No DOS data uploaded",
        }
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    
    # Statistics
    total_tests = len(rows)
    categories = Counter([
        str(row.data_json.get("TestCategory_Mapped", "Unknown")).strip()
        for row in rows
    ])
    
    rates = []
    for row in rows:
        try:
            rate = float(row.data_json.get("Bill_Rate", 0))
            if rate > 0:
                rates.append(rate)
        except (ValueError, TypeError):
            continue
    
    avg_rate = sum(rates) / len(rates) if rates else 0
    min_rate = min(rates) if rates else 0
    max_rate = max(rates) if rates else 0
    
    # Run analyses
    duplicates = detect_duplicate_tests(db, center_id)
    anomalies = detect_rate_anomalies(db, center_id)
    
    return {
        "center_id": center_id,
        "center_name": center.name,
        "center_type": center.center_type.value,
        "status": "healthy" if not duplicates and not anomalies else "issues_found",
        "dataset_version": dataset.version,
        "total_tests": total_tests,
        "categories": dict(categories),
        "rate_statistics": {
            "average": round(avg_rate, 2),
            "minimum": round(min_rate, 2),
            "maximum": round(max_rate, 2),
        },
        "issues": {
            "duplicate_tests": len(duplicates),
            "rate_anomalies": len(anomalies),
            "total_issues": len(duplicates) + len(anomalies),
        },
        "duplicates": duplicates[:5],  # Top 5
        "anomalies": anomalies[:5],  # Top 5
    }


def build_ai_context(
    db: Session,
    center_id: int,
    max_rows: int = 50,
) -> str:
    """Build context string for AI queries with center and DOS info."""
    center = db.query(Center).filter(Center.id == center_id).first()
    if not center:
        return "Center not found"
    
    dataset = (
        db.query(DosDataset)
        .filter(
            DosDataset.center_id == center_id,
            DosDataset.is_active.is_(True),
        )
        .first()
    )
    
    if not dataset:
        return f"Center: {center.name} ({center.center_type.value}) - No DOS data available"
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).limit(max_rows).all()
    
    # Build context
    context = f"""
Center Information:
- Name: {center.name}
- Type: {center.center_type.value}
- Code: {center.code}

DOS Dataset:
- Version: {dataset.version}
- Total Columns: {len(dataset.columns_json)}
- Columns: {', '.join(dataset.columns_json[:10])}...

Sample Data (first {len(rows)} rows):
"""
    
    for i, row in enumerate(rows[:10], 1):
        context += f"\n{i}. Test: {row.data_json.get('test_name')}, Code: {row.data_json.get('Test_Code')}, Rate: {row.data_json.get('Bill_Rate')}"
    
    if len(rows) > 10:
        context += f"\n... and {len(rows) - 10} more rows"
    
    return context
