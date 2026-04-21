from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Center, CenterTypeEnum, User, DosRow, DosDataset
from app.services.rbac import require_permission

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/dashboard")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "center:read")

    # Get center counts
    total_centers = db.query(Center).count()
    hlm_count = db.query(Center).filter(Center.center_type == CenterTypeEnum.HLM).count()
    cc_count = db.query(Center).filter(Center.center_type == CenterTypeEnum.CC).count()
    project_count = db.query(Center).filter(Center.center_type == CenterTypeEnum.PROJECT).count()

    # Get total tests count from MasterTest table
    from app.models.entities import MasterTest
    total_master_tests = db.query(MasterTest).count()

    # Get total DOS entries count
    total_dos_rows = db.query(DosRow).count()

    return {
        "total_centers": total_centers,
        "hlm_count": hlm_count,
        "cc_count": cc_count,
        "project_count": project_count,
        "total_master_tests": total_master_tests,
        "total_dos_rows": total_dos_rows
    }
