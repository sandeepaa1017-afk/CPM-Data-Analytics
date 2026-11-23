from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.gold import DailyEmployeeStat
from app.models.silver import Call, Employee
from app.security import ManagementUser
from app.services.call_queries import (
    BUSINESS_TZ,
    call_conditions,
    parse_datetime_value,
    report_full_days,
)


router = APIRouter(prefix="/api/reports", tags=["reports"])
CALL_TYPES = ("incoming", "outgoing", "missed", "rejected")


def _add_aggregate(
    aggregate: dict[tuple[date, str], dict[str, int]],
    day: date,
    employee_id: str,
    *,
    total: int = 0,
    incoming: int = 0,
    outgoing: int = 0,
    missed: int = 0,
    talk_time: int = 0,
) -> None:
    record = aggregate.setdefault(
        (day, employee_id),
        {
            "total": 0,
            "incoming": 0,
            "outgoing": 0,
            "missed": 0,
            "talkTimeSec": 0,
        },
    )
    record["total"] += total
    record["incoming"] += incoming
    record["outgoing"] += outgoing
    record["missed"] += missed
    record["talkTimeSec"] += talk_time


def _aggregate_silver_rows(
    db: Session,
    aggregate: dict[tuple[date, str], dict[str, int]],
    conditions: list,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    include_base_conditions: bool = True,
) -> None:
    statement = select(
        Call.employee_id,
        Call.call_type,
        Call.status,
        Call.duration_sec,
        Call.call_datetime,
    )
    row_conditions = list(conditions) if include_base_conditions else []
    if start is not None:
        row_conditions.append(Call.call_datetime >= start)
    if end is not None:
        row_conditions.append(Call.call_datetime <= end)
    if row_conditions:
        statement = statement.where(*row_conditions)
    rows = db.execute(statement).all()
    for employee_id, call_type, status, duration, call_datetime in rows:
        _add_aggregate(
            aggregate,
            call_datetime.date(),
            employee_id,
            total=1,
            incoming=int(call_type == "incoming"),
            outgoing=int(call_type == "outgoing"),
            missed=int(status == "missed"),
            talk_time=duration if status == "answered" else 0,
        )


def _load_aggregates(
    db: Session,
    conditions: list,
    start: datetime | None,
    end: datetime | None,
    *,
    use_gold: bool,
) -> dict[tuple[date, str], dict[str, int]]:
    aggregate: dict[tuple[date, str], dict[str, int]] = {}
    full_days = report_full_days(start, end) if use_gold else None
    if full_days is None:
        _aggregate_silver_rows(db, aggregate, conditions)
        return aggregate

    first_full, last_full = full_days
    gold_rows = db.execute(
        select(DailyEmployeeStat).where(
            DailyEmployeeStat.date >= first_full,
            DailyEmployeeStat.date <= last_full,
        )
    ).scalars()
    for item in gold_rows:
        _add_aggregate(
            aggregate,
            item.date,
            item.employee_id,
            total=item.total,
            incoming=item.incoming,
            outgoing=item.outgoing,
            missed=item.missed,
            talk_time=item.talk_seconds,
        )

    start_of_full_days = datetime.combine(
        first_full,
        time.min,
        tzinfo=BUSINESS_TZ,
    )
    end_of_full_days = datetime.combine(
        last_full + timedelta(days=1),
        time.min,
        tzinfo=BUSINESS_TZ,
    )
    if start is not None and start < start_of_full_days:
        _aggregate_silver_rows(
            db,
            aggregate,
            conditions,
            start=start,
            end=start_of_full_days - timedelta(microseconds=1),
            include_base_conditions=False,
        )
    if end is not None and end >= end_of_full_days:
        _aggregate_silver_rows(
            db,
            aggregate,
            conditions,
            start=end_of_full_days,
            end=end,
            include_base_conditions=False,
        )
    return aggregate


def _summary(aggregate: dict[tuple[date, str], dict[str, int]]) -> dict[str, int]:
    totals = {
        "totalCalls": 0,
        "incomingCalls": 0,
        "outgoingCalls": 0,
        "missedCalls": 0,
        "talkTimeSec": 0,
    }
    for record in aggregate.values():
        totals["totalCalls"] += record["total"]
        totals["incomingCalls"] += record["incoming"]
        totals["outgoingCalls"] += record["outgoing"]
        totals["missedCalls"] += record["missed"]
        totals["talkTimeSec"] += record["talkTimeSec"]
    answered = totals["totalCalls"] - totals["missedCalls"]
    totals["answeredCalls"] = answered
    totals["answeredPercent"] = (
        round(answered / totals["totalCalls"] * 100) if totals["totalCalls"] else 0
    )
    totals["averageDurationSec"] = (
        round(totals["talkTimeSec"] / answered) if answered else 0
    )
    return totals


def _report_snapshot(
    db: Session,
    *,
    filters: dict[str, str | int | None],
    from_value: str | None,
    to_value: str | None,
    group_by: str,
) -> tuple[dict[str, object], list[dict[str, object]], list[dict[str, object]]]:
    start = parse_datetime_value(from_value)
    end = parse_datetime_value(to_value, end=True)
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="'from' must be before or equal to 'to'.")

    conditions = call_conditions(
        employee_id=filters.get("employee_id"),
        call_type=filters.get("call_type"),
        status=filters.get("status"),
        from_value=from_value,
        to_value=to_value,
        min_duration=filters.get("min_duration"),
        min_duration_exclusive=filters.get("min_duration_exclusive"),
        max_duration=filters.get("max_duration"),
    )
    use_gold = not any(
        filters.get(key) is not None
        for key in (
            "employee_id",
            "call_type",
            "status",
            "min_duration",
            "min_duration_exclusive",
            "max_duration",
        )
    )
    aggregate = _load_aggregates(
        db,
        conditions,
        start,
        end,
        use_gold=use_gold,
    )
    summary = _summary(aggregate)
    employees = db.scalars(select(Employee).order_by(Employee.name)).all()
    employee_by_id = {employee.id: employee for employee in employees}

    employee_ids = list(employee_by_id)
    if filters.get("employee_id"):
        employee_ids = [str(filters["employee_id"])]

    customer_statement = select(
        Call.employee_id,
        func.count(func.distinct(Call.phone_normalized)),
    ).where(*conditions)
    customer_counts = {
        employee_id: count
        for employee_id, count in db.execute(
            customer_statement.group_by(Call.employee_id)
        )
    }
    type_rows = db.execute(
        select(
            Call.employee_id,
            Call.call_type,
            func.count(),
        )
        .where(*conditions)
        .group_by(Call.employee_id, Call.call_type)
    ).all()
    types_by_employee: dict[str, dict[str, int]] = defaultdict(dict)
    for employee_id, call_type, count in type_rows:
        types_by_employee[employee_id][call_type] = count
    missed_rows = db.execute(
        select(Call.employee_id, func.count())
        .where(
            *conditions,
            Call.status == "missed",
            Call.call_type != "rejected",
        )
        .group_by(Call.employee_id)
    ).all()
    missed_by_employee = dict(missed_rows)

    series_totals: dict[str, dict[str, int | str]] = {}
    daily_by_employee: dict[str, list[dict[str, object]]] = defaultdict(list)
    totals_by_employee: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "total": 0,
            "answered": 0,
            "talk": 0,
        }
    )
    for (day, employee_id), record in sorted(aggregate.items()):
        employee = employee_by_id.get(employee_id)
        employee_name = employee.name if employee else employee_id
        daily_by_employee[employee_id].append(
            {
                "label": day.isoformat(),
                "totalCalls": record["total"],
                "talkTimeSec": record["talkTimeSec"],
            }
        )
        totals = totals_by_employee[employee_id]
        totals["total"] += record["total"]
        totals["answered"] += record["total"] - record["missed"]
        totals["talk"] += record["talkTimeSec"]
        if group_by == "employee":
            label = employee_name
        elif group_by == "week":
            label = (day - timedelta(days=day.weekday())).isoformat()
        else:
            label = day.isoformat()
        series_entry = series_totals.setdefault(
            label,
            {"label": label, "totalCalls": 0, "talkTimeSec": 0},
        )
        series_entry["totalCalls"] = int(series_entry["totalCalls"]) + record["total"]
        series_entry["talkTimeSec"] = (
            int(series_entry["talkTimeSec"]) + record["talkTimeSec"]
        )

    employee_results: list[dict[str, object]] = []
    for employee_id in employee_ids:
        employee = employee_by_id.get(employee_id)
        totals = totals_by_employee.get(
            employee_id,
            {"total": 0, "answered": 0, "talk": 0},
        )
        call_total = totals["total"]
        answered = totals["answered"]
        employee_results.append(
            {
                "employeeId": employee_id,
                "employeeName": employee.name if employee else employee_id,
                "role": employee.role if employee else "",
                "branch": employee.branch if employee else "",
                "active": employee.is_active if employee else False,
                "totalCalls": call_total,
                "answeredCalls": answered,
                "answeredPercent": round(answered / call_total * 100) if call_total else 0,
                "missedCalls": missed_by_employee.get(employee_id, 0),
                "rejectedCalls": types_by_employee.get(employee_id, {}).get("rejected", 0),
                "averageDurationSec": round(totals["talk"] / answered) if answered else 0,
                "talkTimeSec": totals["talk"],
                "dailySeries": daily_by_employee.get(employee_id, []),
                "callTypeBreakdown": [
                    {
                        "label": call_type.title(),
                        "callType": call_type,
                        "totalCalls": types_by_employee.get(employee_id, {}).get(
                            call_type,
                            0,
                        ),
                    }
                    for call_type in CALL_TYPES
                ],
                "uniqueCustomerCount": customer_counts.get(employee_id, 0),
            }
        )

    return (
        summary,
        sorted(series_totals.values(), key=lambda row: str(row["label"])),
        employee_results,
    )


@router.get(
    "",
    summary="Build call and employee performance reports",
    description=(
        "Example: `/api/reports?from=2026-11-01&to=2026-11-21&groupBy=week`. "
        "Call filters combine; `minDurationExclusive` is a strict lower bound."
    ),
)
def get_report(
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
    from_value: str | None = Query(default=None, alias="from"),
    to_value: str | None = Query(default=None, alias="to"),
    group_by: Literal["day", "week", "employee"] = Query(
        default="day",
        alias="groupBy",
    ),
    employee_id: str | None = Query(default=None, alias="employeeId"),
    call_type: Literal["incoming", "outgoing", "missed", "rejected"] | None = Query(
        default=None,
        alias="callType",
    ),
    status: Literal["answered", "missed"] | None = None,
    min_duration: int | None = Query(default=None, ge=0, alias="minDuration"),
    min_duration_exclusive: int | None = Query(
        default=None,
        ge=0,
        alias="minDurationExclusive",
    ),
    max_duration: int | None = Query(default=None, ge=0, alias="maxDuration"),
) -> dict[str, object]:
    if (
        min_duration is not None
        and max_duration is not None
        and min_duration > max_duration
    ):
        raise HTTPException(
            status_code=422,
            detail="minDuration must be less than or equal to maxDuration.",
        )
    filters: dict[str, str | int | None] = {
        "employee_id": employee_id,
        "call_type": call_type,
        "status": status,
        "min_duration": min_duration,
        "min_duration_exclusive": min_duration_exclusive,
        "max_duration": max_duration,
    }
    summary, series, employee_rows = _report_snapshot(
        db,
        filters=filters,
        from_value=from_value,
        to_value=to_value,
        group_by=group_by,
    )
    team_filters = dict(filters)
    team_filters["employee_id"] = None
    team_summary, _, _ = _report_snapshot(
        db,
        filters=team_filters,
        from_value=from_value,
        to_value=to_value,
        group_by=group_by,
    )
    return {
        "summary": summary,
        "series": series,
        "employees": employee_rows,
        "teamSummary": team_summary,
    }
