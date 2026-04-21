from datetime import datetime
import pandas as pd
import io

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import AuditLog, User
from app.services.rbac import require_permission

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/export")
def export_audit_logs(
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "audit:read_limited")
    query = db.query(AuditLog)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)
    
    logs = query.order_by(AuditLog.created_at.desc()).all()
    
    # Convert to DataFrame
    data = []
    for log in logs:
        data.append({
            "Date": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "Entity Type": log.entity_type,
            "Entity ID": log.entity_id,
            "Action": log.action,
            "Actor ID": log.actor_id,
            "Actor Type": log.actor_type,
            "Summary": log.change_summary
        })
    
    df = pd.DataFrame(data)
    
    # Export to Excel
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Audit Logs")
    
    output.seek(0)
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=Audit_Logs.xlsx"
        },
    )


@router.get("/logs")
def list_audit_logs(
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "audit:read_limited")
    query = db.query(AuditLog)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)
    return query.order_by(AuditLog.created_at.desc()).limit(1000).all()
