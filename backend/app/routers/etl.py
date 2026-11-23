from fastapi import APIRouter

from app.etl.pipeline import rebuild_gold_layer
from app.security import AdminUser


router = APIRouter(prefix="/api/etl", tags=["etl"])


@router.post(
    "/run",
    summary="Rebuild Gold aggregates from Silver calls",
    description="Example: send an empty POST to `/api/etl/run` using an admin bearer token.",
)
def run_gold_etl(_: AdminUser) -> dict[str, int | str]:
    employee_days, summary_days = rebuild_gold_layer()
    return {
        "status": "completed",
        "employeeDays": employee_days,
        "summaryDays": summary_days,
    }
