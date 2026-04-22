"""
ai_agent.py — Krsnaa MIS AI Agent Tool Executor
================================================
Handles intent routing, tool execution, and confirmation gates.
All destructive actions return a 'confirm_required' response first.
"""
from __future__ import annotations
import json, uuid
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import text

# In-memory pending confirmation store (replace with Redis in production)
_pending_confirmations: dict[str, dict] = {}


# ─────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """You are the Krsnaa MIS AI Assistant — an expert in diagnostic center management, pricing, and data operations for the Krsnaa diagnostic network across India.

You can answer questions AND perform real actions. When performing actions, always:
1. First present what you're about to do (confirm_required for destructive ops)
2. Show results clearly with numbers

Available tools you can invoke by returning JSON:
{
  "tool": "<tool_name>",
  "params": { ... }
}

TOOLS:
- search_centers: params: {query?, type?, bill_type?}  → List/filter centers
- search_tests: params: {query?, category?}            → Search master test catalog  
- get_dos_data: params: {center_id, search?}           → Get center DOS rows
- get_center_rates: params: {center_id}                → Show center test rates
- get_stats: params: {}                                → Network stats overview
- update_rate: params: {center_id, test_code, rate}   → ⚠️ Update single test rate [CONFIRM]
- bulk_rate_update: params: {center_id, category?, percentage?, fixed_rate?, test_code?} → ⚠️ Bulk rates [CONFIRM]
- delete_test_from_center: params: {center_test_id}   → ⚠️ Remove test [CONFIRM]
- fix_duplicates: params: {center_id}                 → ⚠️ Fix duplicates [CONFIRM]
- search_pricing_vault: params: {query?}              → Find saved pricing lists
- apply_pricing_vault: params: {list_id, center_ids}  → ⚠️ Apply saved list [CONFIRM]
- harden_master_mrp: params: {}                       → ⚠️ Permanently save center rates to Master [CONFIRM]

If user asks a question that maps to a tool, respond ONLY with the JSON tool call.
If user asks a general question, respond in plain text in English/Hindi as appropriate.
Always be concise and professional. Use ₹ for amounts, mention center names by name.
"""

DESTRUCTIVE_TOOLS = {
    "update_rate", "bulk_rate_update", "delete_test_from_center",
    "fix_duplicates", "apply_pricing_vault"
}

TOOL_DESCRIPTIONS = {
    "update_rate": "Update rate for a specific test at a center",
    "bulk_rate_update": "Update rates for multiple tests at a center by category or percentage",
    "delete_test_from_center": "Remove a test from a center's catalog",
    "fix_duplicates": "Remove duplicate test entries from a center's dataset",
    "apply_pricing_vault": "Apply a saved pricing list to selected centers",
}


# ─────────────────────────────────────────────
# TOOL IMPLEMENTATIONS
# ─────────────────────────────────────────────

def tool_search_centers(params: dict, db: Session) -> dict:
    from app.models.entities import Center
    query = db.query(Center)
    if params.get("query"):
        q = f"%{params['query']}%"
        query = query.filter(
            Center.name.ilike(q) | Center.center_code.ilike(q)
        )
    if params.get("type"):
        query = query.filter(Center.type == params["type"])
    if params.get("bill_type"):
        query = query.filter(Center.bill_type == params["bill_type"])

    centers = query.limit(20).all()
    rows = [
        {"id": c.id, "name": c.name, "code": c.center_code,
         "type": c.type or c.center_type, "bill_type": c.bill_type}
        for c in centers
    ]
    return {
        "type": "table",
        "text": f"Found **{len(rows)}** centers matching your query.",
        "columns": ["name", "code", "type", "bill_type"],
        "data": rows,
    }


def tool_search_tests(params: dict, db: Session) -> dict:
    from app.models.entities import MasterTest
    query = db.query(MasterTest)
    if params.get("query"):
        q = f"%{params['query']}%"
        query = query.filter(
            MasterTest.LAB_TestID.ilike(q) | MasterTest.test_name.ilike(q)
        )
    if params.get("category") and params["category"] != "All":
        query = query.filter(MasterTest.TestCategory_Mapped == params["category"])

    tests = query.limit(25).all()
    rows = [
        {"code": t.LAB_TestID, "name": t.test_name,
         "category": t.TestCategory_Mapped, "mrp": f"₹{t.custom_mrp or 0}"}
        for t in tests
    ]
    return {
        "type": "table",
        "text": f"Found **{len(rows)}** tests.",
        "columns": ["code", "name", "category", "mrp"],
        "data": rows,
    }


def tool_get_dos_data(params: dict, db: Session) -> dict:
    from app.models.entities import DosDataset, DosRow
    ds = db.query(DosDataset).filter(
        DosDataset.center_id == params["center_id"],
        DosDataset.is_active == True
    ).first()
    if not ds:
        return {"type": "answer", "text": "No active DOS dataset found for this center."}

    query = db.query(DosRow).filter(DosRow.dataset_id == ds.id)
    if params.get("search"):
        q = f"%{params['search']}%"
        query = query.filter(DosRow.test_code.ilike(q))
    rows_data = query.limit(20).all()

    rows = []
    for r in rows_data:
        rate = r.data_json.get("Bill_Rate") or r.data_json.get("Rate") or 0
        rows.append({
            "code": r.test_code,
            "name": r.data_json.get("test_name") or r.data_json.get("Test_Name") or "-",
            "rate": f"₹{rate}",
        })

    return {
        "type": "table",
        "text": f"Showing {len(rows)} DOS records for center {params['center_id']}.",
        "columns": ["code", "name", "rate"],
        "data": rows,
    }


def tool_get_center_rates(params: dict, db: Session) -> dict:
    from app.models.entities import Center, CenterTest, MasterTest
    from sqlalchemy.orm import joinedload
    center = db.query(Center).filter(Center.id == params["center_id"]).first()
    if not center:
        return {"type": "answer", "text": "Center not found."}

    cts = (
        db.query(CenterTest)
        .options(joinedload(CenterTest.test))
        .filter(CenterTest.center_id == params["center_id"])
        .limit(25)
        .all()
    )
    rows = [
        {
            "code": ct.test.LAB_TestID if ct.test else "-",
            "name": ct.test.test_name if ct.test else "-",
            "rate": f"₹{ct.custom_rate or 0}",
        }
        for ct in cts
    ]
    return {
        "type": "table",
        "text": f"Rates for **{center.name}** — showing {len(rows)} tests.",
        "columns": ["code", "name", "rate"],
        "data": rows,
    }


def tool_get_stats(params: dict, db: Session) -> dict:
    from app.models.entities import Center, MasterTest, DosDataset, CenterTest
    total_centers = db.query(Center).count()
    total_tests = db.query(MasterTest).count()
    total_datasets = db.query(DosDataset).filter(DosDataset.is_active == True).count()
    zero_rates = db.query(CenterTest).filter(
        (CenterTest.custom_rate == None) | (CenterTest.custom_rate == 0)
    ).count()

    return {
        "type": "stats",
        "text": "Network-wide statistics:",
        "data": {
            "Total Centers": total_centers,
            "Total Tests (Master)": total_tests,
            "Active DOS Datasets": total_datasets,
            "Tests with ₹0 Rate": zero_rates,
        }
    }


def tool_update_rate(params: dict, db: Session, pending_id: str) -> dict:
    from app.models.entities import CenterTest, MasterTest, Center
    center = db.query(Center).filter(Center.id == params["center_id"]).first()
    mt = db.query(MasterTest).filter(MasterTest.LAB_TestID == params["test_code"].upper()).first()
    if not center or not mt:
        return {"type": "answer", "text": "Center or test not found."}

    return {
        "type": "confirm_required",
        "text": f"Are you sure you want to update **{mt.test_name}** ({mt.LAB_TestID}) rate to **₹{params['rate']}** at **{center.name}**?",
        "action_summary": f"Set {mt.LAB_TestID} rate = ₹{params['rate']} at {center.name}",
        "confirm_id": pending_id,
        "params": params,
        "tool": "update_rate",
    }


def execute_update_rate(params: dict, db: Session) -> dict:
    from app.models.entities import CenterTest, MasterTest
    mt = db.query(MasterTest).filter(MasterTest.LAB_TestID == params["test_code"].upper()).first()
    if not mt:
        return {"type": "error", "text": "Test not found."}
    ct = db.query(CenterTest).filter(
        CenterTest.center_id == params["center_id"],
        CenterTest.test_id == mt.id
    ).first()
    if not ct:
        return {"type": "error", "text": "Test not assigned to this center."}
    ct.custom_rate = params["rate"]
    db.commit()
    return {"type": "action_done", "text": f"✅ Rate updated to ₹{params['rate']} for {params['test_code']}."}


def tool_bulk_rate_update(params: dict, db: Session, pending_id: str) -> dict:
    from app.models.entities import Center
    center = db.query(Center).filter(Center.id == params["center_id"]).first()
    if not center:
        return {"type": "answer", "text": "Center not found."}

    desc = []
    if params.get("category"):
        desc.append(f"Category: {params['category']}")
    if params.get("test_code"):
        desc.append(f"Test: {params['test_code']}")
    if params.get("percentage") is not None:
        desc.append(f"Change: {params['percentage']:+.1f}%")
    if params.get("fixed_rate") is not None:
        desc.append(f"New Rate: ₹{params['fixed_rate']}")

    return {
        "type": "confirm_required",
        "text": f"Bulk rate update at **{center.name}**:\n" + "\n".join(f"• {d}" for d in desc),
        "action_summary": f"Bulk update at {center.name} — " + ", ".join(desc),
        "confirm_id": pending_id,
        "params": params,
        "tool": "bulk_rate_update",
    }


def execute_bulk_rate_update(params: dict, db: Session) -> dict:
    from app.models.entities import DosDataset, DosRow, CenterTest, MasterTest
    import requests as req_lib
    # Reuse the existing category-update logic
    from app.api.rate_management import update_by_category
    # Call it directly via DB
    active_ds = db.query(DosDataset).filter(
        DosDataset.center_id == params["center_id"],
        DosDataset.is_active == True
    ).first()
    if not active_ds:
        return {"type": "error", "text": "No active DOS for this center."}

    rows = db.query(DosRow).filter(DosRow.dataset_id == active_ds.id).all()
    updated = 0
    category = (params.get("category") or "").lower()
    test_code = (params.get("test_code") or "").upper()

    for row in rows:
        row_cat = str(row.data_json.get("TestCategory_Mapped") or row.data_json.get("Category") or "").lower()
        row_code = str(row.test_code or "").upper()

        if category and row_cat != category:
            continue
        if test_code and row_code != test_code:
            continue

        rate_key = next((k for k in row.data_json if k.lower() in ["bill_rate", "rate", "mrp"]), "Bill_Rate")
        try:
            current = float(row.data_json.get(rate_key, 0))
        except (ValueError, TypeError):
            current = 0

        if params.get("percentage") is not None:
            new_rate = round(current * (1 + params["percentage"] / 100), 2)
        else:
            new_rate = params.get("fixed_rate", current)

        new_data = dict(row.data_json)
        new_data[rate_key] = new_rate
        row.data_json = new_data

        # Update CenterTest
        mt = db.query(MasterTest).filter(MasterTest.LAB_TestID == row_code).first()
        if mt:
            ct = db.query(CenterTest).filter(
                CenterTest.center_id == params["center_id"],
                CenterTest.test_id == mt.id
            ).first()
            if ct:
                ct.custom_rate = new_rate
        updated += 1

    db.commit()
    return {"type": "action_done", "text": f"✅ Updated **{updated}** test rates successfully."}


def tool_fix_duplicates(params: dict, db: Session, pending_id: str) -> dict:
    from app.models.entities import Center
    center_id = params.get("center_id", 0)
    name = "All Centers" if center_id == 0 else (
        db.query(Center).filter(Center.id == center_id).first().name
        if center_id > 0 else "Master Data"
    )
    return {
        "type": "confirm_required",
        "text": f"Fix duplicate test entries in **{name}**? This will permanently delete duplicate rows.",
        "action_summary": f"Remove duplicates from {name}",
        "confirm_id": pending_id,
        "params": params,
        "tool": "fix_duplicates",
    }


def execute_fix_duplicates(params: dict, db: Session) -> dict:
    from sqlalchemy import text as sql_text
    center_id = params.get("center_id", 0)
    if center_id == -1:
        ds_filter = "true"
    elif center_id == 0:
        ds_filter = "is_active = true"
    else:
        ds_filter = f"center_id = {center_id} AND is_active = true"

    result = db.execute(sql_text(f"""
        DELETE FROM dos_rows r
        USING (
            SELECT id, ROW_NUMBER() OVER(
                PARTITION BY dataset_id, test_code
                ORDER BY id ASC
            ) as rn
            FROM dos_rows
            WHERE dataset_id IN (SELECT id FROM dos_datasets WHERE {ds_filter})
        ) t
        WHERE r.id = t.id AND t.rn > 1
    """))
    db.commit()
    return {"type": "action_done", "text": f"✅ Removed **{result.rowcount}** duplicate rows."}


def tool_delete_test_from_center(params: dict, db: Session, pending_id: str) -> dict:
    from app.models.entities import CenterTest, MasterTest, Center
    ct = db.query(CenterTest).filter(CenterTest.id == params["center_test_id"]).first()
    if not ct:
        return {"type": "answer", "text": "Center test assignment not found."}
    
    return {
        "type": "confirm_required",
        "text": f"Are you sure you want to delete **{ct.test.test_name if ct.test else 'test'}** from **{ct.center.name if ct.center else 'center'}**?",
        "action_summary": f"Delete test mapping (ID: {params['center_test_id']})",
        "confirm_id": pending_id,
        "params": params,
        "tool": "delete_test_from_center",
    }


def execute_delete_test_from_center(params: dict, db: Session) -> dict:
    from app.models.entities import CenterTest
    ct = db.query(CenterTest).filter(CenterTest.id == params["center_test_id"]).first()
    if not ct:
        return {"type": "error", "text": "Test mapping not found."}
    db.delete(ct)
    db.commit()
    return {"type": "action_done", "text": "✅ Test removed from center successfully."}


def tool_search_pricing_vault(params: dict, db: Session) -> dict:
    from app.models.entities import SpecialRateList
    query = db.query(SpecialRateList)
    if params.get("query"):
        query = query.filter(SpecialRateList.name.ilike(f"%{params['query']}%"))
    
    lists = query.limit(10).all()
    rows = [
        {"id": l.id, "name": l.name, "created_at": l.created_at.strftime("%Y-%m-%d")}
        for l in lists
    ]
    return {
        "type": "table",
        "text": f"Found **{len(rows)}** pricing lists in vault.",
        "columns": ["id", "name", "created_at"],
        "data": rows,
    }


def tool_apply_pricing_vault(params: dict, db: Session, pending_id: str) -> dict:
    from app.models.entities import SpecialRateList, Center
    vault = db.query(SpecialRateList).filter(SpecialRateList.id == params["list_id"]).first()
    if not vault:
        return {"type": "answer", "text": "Pricing list not found in vault."}
    
    center_ids = params.get("center_ids", [])
    centers = db.query(Center).filter(Center.id.in_(center_ids)).all()
    names = ", ".join([c.name for c in centers])
    
    return {
        "type": "confirm_required",
        "text": f"Apply pricing list **'{vault.name}'** to centers: **{names}**?",
        "action_summary": f"Apply vault list {vault.id} to {len(centers)} centers",
        "confirm_id": pending_id,
        "params": params,
        "tool": "apply_pricing_vault",
    }


def execute_apply_pricing_vault(params: dict, db: Session) -> dict:
    from app.models.entities import SpecialRateList, CenterTest, MasterTest, Center
    vault = db.query(SpecialRateList).filter(SpecialRateList.id == params["list_id"]).first()
    if not vault:
        return {"type": "error", "text": "Pricing list not found."}
    
    # data_json is list of {code, rate}
    updates = 0
    center_ids = params.get("center_ids", [])
    
    for center_id in center_ids:
        for item in vault.data_json:
            code = str(item.get("code") or "").strip().upper()
            rate = item.get("rate")
            if not code or rate is None: continue
            
            mt = db.query(MasterTest).filter(MasterTest.LAB_TestID == code).first()
            if not mt: continue
            
            ct = db.query(CenterTest).filter(
                CenterTest.center_id == center_id,
                CenterTest.test_id == mt.id
            ).first()
            
            if not ct:
                ct = CenterTest(center_id=center_id, test_id=mt.id, custom_rate=rate)
                db.add(ct)
            else:
                ct.custom_rate = rate
            updates += 1
            
    db.commit()
    return {"type": "action_done", "text": f"✅ Applied vault successfully. Updated/Created **{updates}** test rates across {len(center_ids)} centers."}


def tool_harden_master_mrp(params: dict, db: Session, pending_id: str) -> dict:
    return {
        "type": "confirm_required",
        "text": "Are you sure you want to **Harden** Master MRP? This will permanently save the current best center rates into the Master Registry so they stay even if centers are deleted.",
        "action_summary": "Harden Master MRP from center data",
        "confirm_id": pending_id,
        "params": params,
        "tool": "harden_master_mrp",
    }


def execute_harden_master_mrp(params: dict, db: Session) -> dict:
    sql = """
        UPDATE master_tests mt
        SET custom_mrp = sub.rate,
            mrp_source = sub.cname
        FROM (
            SELECT DISTINCT ON (dr.test_code)
                dr.test_code,
                CAST(COALESCE(NULLIF(dr.data_json->>'Bill_Rate',''), NULLIF(dr.data_json->>'Rate',''), NULLIF(dr.data_json->>'MRP',''), '0') AS FLOAT) as rate,
                c.name as cname
            FROM dos_rows dr
            JOIN dos_datasets dd ON dr.dataset_id = dd.id
            JOIN centers c ON dd.center_id = c.id
            WHERE dd.is_active = true
              AND CAST(COALESCE(NULLIF(dr.data_json->>'Bill_Rate',''), NULLIF(dr.data_json->>'Rate',''), NULLIF(dr.data_json->>'MRP',''), '0') AS FLOAT) > 0
            ORDER BY dr.test_code, (c.name ILIKE '%HR HISAR%') DESC, 2 DESC
        ) sub
        WHERE mt.test_code = sub.test_code
          AND (mt.custom_mrp IS NULL OR mt.custom_mrp = 0)
    """
    result = db.execute(text(sql))
    db.commit()
    return {"type": "action_done", "text": f"✅ Success! Hardened **{result.rowcount}** Master MRP entries."}


# ─────────────────────────────────────────────
# TOOL ROUTER
# ─────────────────────────────────────────────

TOOL_MAP = {
    "search_centers": tool_search_centers,
    "search_tests": tool_search_tests,
    "get_dos_data": tool_get_dos_data,
    "get_center_rates": tool_get_center_rates,
    "get_stats": tool_get_stats,
    "search_pricing_vault": tool_search_pricing_vault,
}

CONFIRM_TOOL_MAP = {
    "update_rate": (tool_update_rate, execute_update_rate),
    "bulk_rate_update": (tool_bulk_rate_update, execute_bulk_rate_update),
    "fix_duplicates": (tool_fix_duplicates, execute_fix_duplicates),
    "delete_test_from_center": (tool_delete_test_from_center, execute_delete_test_from_center),
    "apply_pricing_vault": (tool_apply_pricing_vault, execute_apply_pricing_vault),
    "harden_master_mrp": (tool_harden_master_mrp, execute_harden_master_mrp),
}


def run_agent(messages: list[dict], db: Session, ai_service) -> dict:
    """
    Main agent loop:
    1. Call LLM with messages + system prompt
    2. Parse response for tool call JSON
    3. Execute tool or return confirm_required
    """
    # Build messages for LLM
    llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    # Get LLM response
    full_prompt = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in llm_messages if m['role'] != 'system'
    )
    result = ai_service.ask(SYSTEM_PROMPT + "\n\n" + full_prompt)
    raw = result.output.strip()

    # Try to parse as tool call
    tool_call = None
    try:
        # Extract JSON from markdown code blocks if present
        if "```json" in raw:
            raw_json = raw.split("```json")[1].split("```")[0].strip()
        elif raw.startswith("{"):
            raw_json = raw
        else:
            raw_json = None

        if raw_json:
            tool_call = json.loads(raw_json)
    except (json.JSONDecodeError, IndexError):
        pass

    # Plain text response
    if not tool_call or "tool" not in tool_call:
        return {"type": "answer", "text": raw}

    tool_name = tool_call.get("tool")
    params = tool_call.get("params", {})

    # Non-destructive tools
    if tool_name in TOOL_MAP:
        try:
            return TOOL_MAP[tool_name](params, db)
        except Exception as e:
            return {"type": "error", "text": f"Tool error: {str(e)}"}

    # Destructive tools → require confirmation
    if tool_name in CONFIRM_TOOL_MAP:
        pending_id = str(uuid.uuid4())
        _pending_confirmations[pending_id] = {
            "tool": tool_name,
            "params": params
        }
        confirm_fn, _ = CONFIRM_TOOL_MAP[tool_name]
        try:
            return confirm_fn(params, db, pending_id)
        except Exception as e:
            return {"type": "error", "text": f"Confirmation setup error: {str(e)}"}

    return {"type": "answer", "text": raw}


def confirm_action(confirm_id: str, db: Session) -> dict:
    """Execute a previously confirmed action."""
    pending = _pending_confirmations.pop(confirm_id, None)
    if not pending:
        return {"type": "error", "text": "Confirmation expired or not found. Please try again."}

    tool_name = pending["tool"]
    params = pending["params"]

    if tool_name in CONFIRM_TOOL_MAP:
        _, execute_fn = CONFIRM_TOOL_MAP[tool_name]
        try:
            return execute_fn(params, db)
        except Exception as e:
            return {"type": "error", "text": f"Execution error: {str(e)}"}

    return {"type": "error", "text": "Unknown action."}
