"""Plan listing endpoint — serves available eSIM plans to the frontend."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Plan
from app.schemas import PlanResponse

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("", response_model=list[PlanResponse])
def list_plans(db: Session = Depends(get_db)):
    """Return all active eSIM plans.

    The frontend calls this to populate the plan selection UI.
    For M1, we'll likely have just one plan.
    """
    plans = db.query(Plan).filter(Plan.active == True).all()
    return plans
