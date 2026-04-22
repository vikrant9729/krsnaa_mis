from fastapi import APIRouter

router = APIRouter(prefix="/jobs", tags=["jobs"])

# Global progress tracker (in-memory)
UPLOAD_JOBS = {}

@router.get("/progress/{job_id}")
async def get_upload_progress(job_id: str):
    return UPLOAD_JOBS.get(job_id, {"status": "not_found", "progress": 0})
