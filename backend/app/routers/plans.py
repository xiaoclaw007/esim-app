"""Plan listing endpoint — serves available eSIM plans to the frontend."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Plan
from app.schemas import PlanResponse

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("", response_model=list[PlanResponse])
def list_plans(db: Session = Depends(get_db)):
    """Return all active, non-test eSIM plans.

    The frontend calls this to populate the customer-facing plan
    selection UI. Internal test plans (Plan.is_test == True) are
    hidden — those only show up in the admin catalog.
    """
    plans = (
        db.query(Plan)
        .filter(Plan.active == True, Plan.is_test == False)
        .all()
    )
    return plans
