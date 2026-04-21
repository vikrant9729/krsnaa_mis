"""DOS Template Service - Generate template Excel files."""

from __future__ import annotations

from io import BytesIO

import pandas as pd

REQUIRED_COLUMNS = [
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

SAMPLE_DATA = {
    "OwnerID": [100302, 100302, 100302, 100302, 100302, 100302],
    "LAB_Name": ["HR HISAR", "HR HISAR", "HR HISAR", "HR HISAR", "HR HISAR", "HR HISAR"],
    "CC_Code": [100302, 100302, 100302, 100302, 100302, 100302],
    "CC_Name": ["HR HISAR", "HR HISAR", "HR HISAR", "HR HISAR", "HR HISAR", "HR HISAR"],
    "Partner_Status": ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"],
    "type": ["HLM", "HLM", "HLM", "HLM", "HLM", "HLM"],
    "bill type": ["CASH / MRP", "CASH / MRP", "CASH / MRP", "CASH / MRP", "CASH / MRP", "CASH / MRP"],
    "dos avilablety": ["in dos", "in dos", "in dos", "in dos", "in dos", "in dos"],
    "Centre_OperationType": ["", "", "", "", "", ""],
    "Centre_Sub_OperationType": ["", "", "", "", "", ""],
    "Test_Code": ["P157676", "P157677", "P157678", "P157679", "P157680", "P157684"],
    "test_name": [
        "LIPID PROFILE",
        "RENAL FUNCTION TEST (RFT)",
        "WIDAL TEST",
        "BLOOD UREA NITROGEN - SERUM",
        "BODY FLUIDS ROUTINE ANALYSIS",
        "CD3/CD4/CD8 COUNTS",
    ],
    "Specimen_Type": ["SERUM", "SERUM", "PLAIN", "SERUM", "FLUID", "EDTA"],
    "Bill_Rate": [450, 600, 200, 130, 50, 1800],
    "TestCategory_Mapped": ["Routine", "Routine", "Special", "Routine", "Routine", "Outsource"],
    "LAB_TestId_MIS": ["KDPL3129", "KDPL3177", "KDPL3241", "KDPL1418", "KDPL2755", "KDPL5774"],
    "LAB_TestID": ["KDPL3129", "KDPL3177", "KDPL3241", "KDPL1418", "KDPL2755", "KDPL5774"],
    "center type": ["HR CC RATE", "HR CC RATE", "HR CC RATE", "HR CC RATE", "HR CC RATE", "HR CC RATE"],
}


def generate_template_excel() -> bytes:
    """Generate DOS template Excel file with sample data and instructions."""
    # Create DataFrame with sample data
    df = pd.DataFrame(SAMPLE_DATA)
    
    # Create instructions sheet
    instructions = pd.DataFrame({
        "Column Name": REQUIRED_COLUMNS,
        "Description": [
            "Owner ID of the center",
            "Laboratory name",
            "Cost Center code",
            "Cost Center name",
            "Partner status (ACTIVE/INACTIVE)",
            "Center type (HLM/CC/PROJECT)",
            "Billing type (CASH / MRP)",
            "DOS availability status",
            "Center operation type",
            "Center sub-operation type",
            "Test code (unique identifier)",
            "Test name",
            "Specimen type (SERUM/PLAIN/etc.)",
            "Bill rate (numeric value)",
            "Test category (Routine/Special/etc.)",
            "LAB Test ID in MIS",
            "LAB Test ID",
            "Center type label",
        ],
        "Required": ["Yes"] * len(REQUIRED_COLUMNS),
        "Example": [
            "100302", "HR HISAR", "100302", "HR HISAR",
            "ACTIVE", "HLM", "CASH / MRP", "in dos",
            "", "", "P157676", "LIPID PROFILE",
            "SERUM", "450", "Routine",
            "KDPL3129", "KDPL3129", "HR CC RATE",
        ],
    })
    
    # Export to Excel with multiple sheets
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="DOS Data Template")
        instructions.to_excel(writer, index=False, sheet_name="Instructions")
        
        # Add validation rules sheet
        validation_rules = pd.DataFrame({
            "Rule": [
                "All columns are required",
                "Bill_Rate must be numeric",
                "type must be HLM, CC, or PROJECT",
                "Partner_Status must be ACTIVE or INACTIVE",
                "Test_Code should be unique within a center",
                "Excel files can have multiple sheets",
                "CSV files are also supported",
            ],
            "Priority": ["Critical"] * 4 + ["Warning"] * 3,
        })
        validation_rules.to_excel(writer, index=False, sheet_name="Validation Rules")
    
    output.seek(0)
    return output.getvalue()
