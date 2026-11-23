import csv
import io
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import Date, case, cast, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.silver import Call, Employee
from app.schemas.calls import CallResponse, PaginatedCalls
from app.security import ManagementUser
from app.services.call_queries import call_conditions, filtered_call_select


router = APIRouter(prefix="/api/calls", tags=["calls"])
CallType = Literal["incoming", "outgoing", "missed", "rejected"]
CallStatus = Literal["answered", "missed"]
SortColumn = Literal[
    "dateTime",
    "durationSec",
    "employeeName",
    "phone",
    "callType",
    "status",
]


def _conditions(
    employee_id: str | None,
    call_type: CallType | None,
    status: CallStatus | None,
    from_value: str | None,
    to_value: str | None,
    min_duration: int | None,
    max_duration: int | None,
    phone: str | None,
    query: str | None,
):
    if (
        min_duration is not None
        and max_duration is not None
        and min_duration > max_duration
    ):
        raise HTTPException(
            status_code=422,
            detail="minDuration must be less than or equal to maxDuration.",
        )
    return call_conditions(
        employee_id=employee_id,
        call_type=call_type,
        status=status,
        from_value=from_value,
        to_value=to_value,
        min_duration=min_duration,
        max_duration=max_duration,
        phone=phone,
        query=query,
    )


def _response(call: Call, employee_name: str) -> CallResponse:
    return CallResponse(
        id=f"CALL-{call.id:06d}",
        employee_id=call.employee_id,
        employee_name=employee_name,
        phone=call.phone_normalized,
        call_type=call.call_type,
        status=call.status,
        duration_sec=call.duration_sec,
        date_time=call.call_datetime.isoformat(),
    )


def _sort_expression(sort_by: SortColumn):
    return {
        "dateTime": Call.call_datetime,
        "durationSec": Call.duration_sec,
        "employeeName": Employee.name,
        "phone": Call.phone_normalized,
        "callType": Call.call_type,
        "status": Call.status,
    }[sort_by]


@router.get(
    "",
    response_model=PaginatedCalls,
    summary="Search and paginate call records",
    description=(
        "Example: `/api/calls?employeeId=EMP-101&callType=incoming"
        "&status=answered&page=1&pageSize=25`."
    ),
)
def list_calls(
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
    employee_id: str | None = Query(default=None, alias="employeeId"),
    call_type: CallType | None = Query(default=None, alias="callType"),
    status: CallStatus | None = None,
    from_value: str | None = Query(default=None, alias="from"),
    to_value: str | None = Query(default=None, alias="to"),
    min_duration: int | None = Query(default=None, ge=0, alias="minDuration"),
    max_duration: int | None = Query(default=None, ge=0, alias="maxDuration"),
    phone: str | None = None,
    query: str | None = Query(default=None, alias="q"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=5000, alias="pageSize"),
    sort_by: SortColumn = Query(default="dateTime", alias="sortBy"),
    order: Literal["asc", "desc"] = "desc",
) -> PaginatedCalls:
    conditions = _conditions(
        employee_id,
        call_type,
        status,
        from_value,
        to_value,
        min_duration,
        max_duration,
        phone,
        query,
    )
    statement = filtered_call_select(conditions)
    total = db.scalar(
        select(func.count()).select_from(statement.subquery())
    ) or 0
    expression = _sort_expression(sort_by)
    statement = statement.order_by(
        expression.asc() if order == "asc" else expression.desc(),
        Call.id.desc(),
    )
    rows = db.execute(
        statement.offset((page - 1) * page_size).limit(page_size)
    ).all()
    return PaginatedCalls(
        items=[_response(call, employee_name) for call, employee_name in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/export",
    summary="Export filtered call records as CSV",
    description="Accepts the same filters as `/api/calls`; pagination is omitted from the export.",
)
def export_calls(
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
    employee_id: str | None = Query(default=None, alias="employeeId"),
    call_type: CallType | None = Query(default=None, alias="callType"),
    status: CallStatus | None = None,
    from_value: str | None = Query(default=None, alias="from"),
    to_value: str | None = Query(default=None, alias="to"),
    min_duration: int | None = Query(default=None, ge=0, alias="minDuration"),
    max_duration: int | None = Query(default=None, ge=0, alias="maxDuration"),
    phone: str | None = None,
    query: str | None = Query(default=None, alias="q"),
    sort_by: SortColumn = Query(default="dateTime", alias="sortBy"),
    order: Literal["asc", "desc"] = "desc",
) -> StreamingResponse:
    conditions = _conditions(
        employee_id,
        call_type,
        status,
        from_value,
        to_value,
        min_duration,
        max_duration,
        phone,
        query,
    )
    expression = _sort_expression(sort_by)
    statement = filtered_call_select(conditions).order_by(
        expression.asc() if order == "asc" else expression.desc(),
        Call.id.desc(),
    )
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "employeeId",
            "employeeName",
            "phone",
            "callType",
            "status",
            "durationSec",
            "dateTime",
        ]
    )
    for call, employee_name in db.execute(statement).yield_per(1000):
        writer.writerow(
            [
                f"CALL-{call.id:06d}",
                call.employee_id,
                employee_name,
                call.phone_normalized,
                call.call_type,
                call.status,
                call.duration_sec,
                call.call_datetime.isoformat(),
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="cpm-calls.csv"'},
    )


@router.get(
    "/stats",
    summary="Get KPI totals and grouped call statistics",
    description="Example: `/api/calls/stats?from=2026-11-01&to=2026-11-21`.",
)
def call_stats(
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
    employee_id: str | None = Query(default=None, alias="employeeId"),
    call_type: CallType | None = Query(default=None, alias="callType"),
    status: CallStatus | None = None,
    from_value: str | None = Query(default=None, alias="from"),
    to_value: str | None = Query(default=None, alias="to"),
    min_duration: int | None = Query(default=None, ge=0, alias="minDuration"),
    max_duration: int | None = Query(default=None, ge=0, alias="maxDuration"),
    phone: str | None = None,
    query: str | None = Query(default=None, alias="q"),
) -> dict[str, object]:
    conditions = _conditions(
        employee_id,
        call_type,
        status,
        from_value,
        to_value,
        min_duration,
        max_duration,
        phone,
        query,
    )
    answered = case((Call.status == "answered", 1), else_=0)
    missed = case(
        ((Call.status == "missed") | (Call.call_type == "missed"), 1),
        else_=0,
    )
    talk = case((Call.status == "answered", Call.duration_sec), else_=0)
    totals = db.execute(
        select(
            func.count().label("total"),
            func.sum(case((Call.call_type == "incoming", 1), else_=0)).label("incoming"),
            func.sum(case((Call.call_type == "outgoing", 1), else_=0)).label("outgoing"),
            func.sum(missed).label("missed"),
            func.sum(answered).label("answered"),
            func.sum(talk).label("talk"),
        )
        .select_from(Call)
        .join(Employee, Employee.id == Call.employee_id)
        .where(*conditions)
    ).one()
    total = totals.total or 0
    answered_calls = totals.answered or 0
    talk_time = totals.talk or 0

    day_expression = cast(Call.call_datetime, Date)
    trend_rows = db.execute(
        select(
            day_expression.label("day"),
            func.count().label("calls"),
            func.sum(talk).label("talk"),
        )
        .select_from(Call)
        .join(Employee, Employee.id == Call.employee_id)
        .where(*conditions)
        .group_by(day_expression)
        .order_by(day_expression)
    ).all()
    type_rows = db.execute(
        select(Call.call_type, func.count())
        .select_from(Call)
        .join(Employee, Employee.id == Call.employee_id)
        .where(*conditions)
        .group_by(Call.call_type)
    ).all()
    employee_rows = db.execute(
        select(
            Call.employee_id,
            Employee.name,
            func.count().label("calls"),
            func.sum(talk).label("talk"),
        )
        .select_from(Call)
        .join(Employee, Employee.id == Call.employee_id)
        .where(*conditions)
        .group_by(Call.employee_id, Employee.name)
        .order_by(func.count().desc(), Employee.name)
        .limit(5)
    ).all()

    return {
        "totalCalls": total,
        "incomingCalls": totals.incoming or 0,
        "outgoingCalls": totals.outgoing or 0,
        "missedCalls": totals.missed or 0,
        "answeredCalls": answered_calls,
        "answeredPercent": round(answered_calls / total * 100) if total else 0,
        "averageDurationSec": round(talk_time / answered_calls) if answered_calls else 0,
        "talkTimeSec": talk_time,
        "trend": [
            {
                "label": day.isoformat() if isinstance(day, date) else str(day),
                "totalCalls": count,
                "talkTimeSec": talk_time_for_day or 0,
            }
            for day, count, talk_time_for_day in trend_rows
        ],
        "callTypeBreakdown": [
            {"callType": call_type_value, "totalCalls": count}
            for call_type_value, count in type_rows
        ],
        "topEmployees": [
            {
                "employeeId": employee_id_value,
                "employeeName": name,
                "calls": count,
                "talkTimeSec": talk_time_for_employee or 0,
            }
            for employee_id_value, name, count, talk_time_for_employee in employee_rows
        ],
    }
