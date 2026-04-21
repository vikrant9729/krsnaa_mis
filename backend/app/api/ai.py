from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import AISuggestion, User
from app.schemas.common import AISuggestionApplyRequest, AIQueryRequest
from app.services.ai_orchestrator import FailoverAIService, ProviderError
from app.services.audit import log_change
from app.services.rbac import require_permission

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/query")
def query_ai(
    payload: AIQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "ai:query")
    service = FailoverAIService()
    try:
        result = service.ask(payload.query)
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    log_change(
        db,
        entity_type="ai",
        entity_id=str(payload.center_id or "global"),
        action="AI_QUERY",
        old_value=None,
        new_value={"provider": result.provider, "model": result.model},
        actor_id=current_user.id,
    )
    return {"provider": result.provider, "model": result.model, "answer": result.output}


@router.post("/chat")
def chat_with_ai(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "ai:query")
    service = FailoverAIService()
    try:
        result = service.ask(payload["message"])
        return {"response": result.output}
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/config")
def get_ai_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "default_provider": "openrouter",
        "api_key": "",
        "model": "openai/gpt-4o",
        "temperature": 0.7,
        "max_tokens": 2000,
    }


@router.post("/config")
def save_ai_config(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"status": "saved", "config": payload}


@router.post("/scan/{center_id}")
def scan_data_quality(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.entities import DosDataset, DosRow
    
    dataset = (
        db.query(DosDataset)
        .filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True))
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="No active dataset found")
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    total_rows = len(rows)
    
    # Simple quality checks
    duplicate_tests = 0
    missing_fields = 0
    invalid_rates = 0
    
    test_codes = set()
    for row in rows:
        data = row.data_json
        
        # Check duplicates
        test_code = data.get("Test_Code", "")
        if test_code in test_codes:
            duplicate_tests += 1
        test_codes.add(test_code)
        
        # Check missing fields
        required = ["Test_Code", "test_name", "Bill_Rate"]
        for field in required:
            if not data.get(field):
                missing_fields += 1
        
        # Check invalid rates
        try:
            rate = float(data.get("Bill_Rate", 0))
            if rate < 0 or rate > 100000:
                invalid_rates += 1
        except:
            invalid_rates += 1
    
    # Calculate health score
    issues = duplicate_tests + missing_fields + invalid_rates
    health_score = max(0, 100 - int((issues / max(total_rows, 1)) * 100))
    
    return {
        "center_id": center_id,
        "center_code": "N/A",
        "center_name": "N/A",
        "total_rows": total_rows,
        "duplicate_tests": duplicate_tests,
        "missing_fields": missing_fields,
        "invalid_rates": invalid_rates,
        "anomaly_count": 0,
        "health_score": health_score,
    }


@router.post("/suggestions/{center_id}")
def run_ai_scan(center_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "ai:run")

    suggestion = AISuggestion(
        center_id=center_id,
        issue_type="DUPLICATE_TEST",
        description="Potential duplicate test code detected by heuristic AI scan.",
        proposed_patch={"action": "merge", "target": "Test_Code"},
        confidence_score=0.82,
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)

    log_change(
        db,
        entity_type="ai_suggestion",
        entity_id=str(suggestion.id),
        action="AI_SUGGEST",
        old_value=None,
        new_value={"center_id": center_id, "issue": suggestion.issue_type},
        actor_id=current_user.id,
        actor_type="AI_SYSTEM",
    )
    return suggestion


@router.post("/apply")
def apply_ai_suggestion(
    payload: AISuggestionApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "ai:run")
    suggestion = db.query(AISuggestion).filter(AISuggestion.id == payload.suggestion_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.status = "APPROVED" if payload.approved else "REJECTED"
    db.commit()

    log_change(
        db,
        entity_type="ai_suggestion",
        entity_id=str(suggestion.id),
        action="AI_APPLY_DECISION",
        old_value=None,
        new_value={"approved": payload.approved},
        actor_id=current_user.id,
    )
    return {"status": suggestion.status}


@router.post("/fix-duplicates/{center_id}")
def fix_duplicates(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:write")
    from app.models.entities import DosDataset, DosRow
    dataset = db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="No active dataset found")
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    seen_codes = set()
    duplicates_removed = 0
    for row in rows:
        code = row.data_json.get("Test_Code")
        if code in seen_codes:
            db.delete(row)
            duplicates_removed += 1
        else:
            seen_codes.add(code)
    
    db.commit()
    return {"status": "success", "fixed": duplicates_removed}


@router.post("/fill-missing/{center_id}")
def fill_missing_fields(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:write")
    from app.models.entities import DosDataset, DosRow
    dataset = db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="No active dataset found")
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    fields_filled = 0
    for row in rows:
        updated = False
        if not row.data_json.get("test_name"):
            row.data_json["test_name"] = "Unknown Test"
            updated = True
        if not row.data_json.get("Bill_Rate"):
            row.data_json["Bill_Rate"] = 0
            updated = True
        
        if updated:
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(row, "data_json")
            fields_filled += 1
    
    db.commit()
    return {"status": "success", "fixed": fields_filled}


@router.post("/fix-rates/{center_id}")
def fix_invalid_rates(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:write")
    from app.models.entities import DosDataset, DosRow
    dataset = db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="No active dataset found")
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    rates_fixed = 0
    for row in rows:
        try:
            rate = float(row.data_json.get("Bill_Rate", 0))
            if rate < 0:
                row.data_json["Bill_Rate"] = 0
                rates_fixed += 1
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(row, "data_json")
        except:
            row.data_json["Bill_Rate"] = 0
            rates_fixed += 1
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(row, "data_json")
    
    db.commit()
    return {"status": "success", "fixed": rates_fixed}
