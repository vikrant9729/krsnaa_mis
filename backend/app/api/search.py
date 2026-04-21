from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Center, User
from app.services.rbac import require_permission

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search_centers(
    q: str = Query(""),
    center_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "search:read")
    query = db.query(Center)
    if q:
        query = query.filter(or_(Center.name.ilike(f"%{q}%"), Center.center_code.ilike(f"%{q}%")))
    if center_type:
        query = query.filter(Center.center_type == center_type)
    return query.limit(100).all()
