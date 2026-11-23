from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.silver import Call, Customer, Employee
from app.schemas.calls import CustomerResponse
from app.security import ManagementUser
from app.services.call_queries import call_conditions


router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get(
    "",
    response_model=list[CustomerResponse],
    summary="List phone-based customers",
    description=(
        "Example: `/api/customers?employeeId=EMP-101&minDurationExclusive=60`. "
        "Repeated calls to the same normalized phone are grouped as one customer."
    ),
)
def list_customers(
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
    employee_id: str | None = Query(default=None, alias="employeeId"),
    call_type: Literal["incoming", "outgoing", "missed", "rejected"] | None = Query(
        default=None,
        alias="callType",
    ),
    status: Literal["answered", "missed"] | None = None,
    from_value: str | None = Query(default=None, alias="from"),
    to_value: str | None = Query(default=None, alias="to"),
    min_duration: int | None = Query(default=None, ge=0, alias="minDuration"),
    min_duration_exclusive: int | None = Query(
        default=None,
        ge=0,
        alias="minDurationExclusive",
    ),
    max_duration: int | None = Query(default=None, ge=0, alias="maxDuration"),
    phone: str | None = None,
    query: str | None = Query(default=None, alias="q"),
) -> list[CustomerResponse]:
    conditions = call_conditions(
        employee_id=employee_id,
        call_type=call_type,
        status=status,
        from_value=from_value,
        to_value=to_value,
        min_duration=min_duration,
        min_duration_exclusive=min_duration_exclusive,
        max_duration=max_duration,
        phone=phone,
        query=query,
    )
    latest = (
        select(
            Call.phone_normalized,
            Call.call_type,
            Call.status,
            func.row_number()
            .over(
                partition_by=Call.phone_normalized,
                order_by=(Call.call_datetime.desc(), Call.id.desc()),
            )
            .label("rank"),
        )
        .join(Employee, Employee.id == Call.employee_id)
        .where(*conditions)
        .subquery()
    )
    latest_by_phone = {
        phone_number: (call_type_value, status_value)
        for phone_number, call_type_value, status_value in db.execute(
            select(
                latest.c.phone_normalized,
                latest.c.call_type,
                latest.c.status,
            ).where(latest.c.rank == 1)
        )
    }

    answered = func.sum(case((Call.status == "answered", 1), else_=0))
    missed = func.sum(
        case(
            (
                (Call.status == "missed") & (Call.call_type != "rejected"),
                1,
            ),
            else_=0,
        )
    )
    rejected = func.sum(case((Call.call_type == "rejected", 1), else_=0))
    talk_time = func.sum(
        case((Call.status == "answered", Call.duration_sec), else_=0)
    )
    query_statement = (
        select(
            Customer.id,
            Customer.phone_normalized,
            func.count().label("interactions"),
            answered.label("answered"),
            missed.label("missed"),
            rejected.label("rejected"),
            talk_time.label("talk_time"),
            func.array_agg(func.distinct(Call.employee_id)).label("employee_ids"),
            func.min(Call.call_datetime).label("first_call"),
            func.max(Call.call_datetime).label("last_call"),
        )
        .join(Call, Call.phone_normalized == Customer.phone_normalized)
        .join(Employee, Employee.id == Call.employee_id)
        .where(*conditions)
        .group_by(Customer.id, Customer.phone_normalized)
        .order_by(func.max(Call.call_datetime).desc())
    )
    results = db.execute(query_statement).all()
    return [
        CustomerResponse(
            customer_id=customer_id,
            phone=phone_number,
            interaction_count=interaction_count,
            answered_calls=answered_count or 0,
            missed_calls=missed_count or 0,
            rejected_calls=rejected_count or 0,
            talk_time_sec=talk_time or 0,
            employee_ids=sorted(employee_ids or []),
            first_call_at=first_call.isoformat(),
            last_call_at=last_call.isoformat(),
            last_call_type=latest_by_phone[phone_number][0],
            last_status=latest_by_phone[phone_number][1],
        )
        for (
            customer_id,
            phone_number,
            interaction_count,
            answered_count,
            missed_count,
            rejected_count,
            talk_time,
            employee_ids,
            first_call,
            last_call,
        ) in results
    ]
