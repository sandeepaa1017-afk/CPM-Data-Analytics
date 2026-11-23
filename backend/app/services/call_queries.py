import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import Select, select
from sqlalchemy.sql import ColumnElement

from app.models.silver import Call, Employee


BUSINESS_TZ = ZoneInfo("Asia/Kolkata")


def parse_datetime_value(value: str | None, *, end: bool = False) -> datetime | None:
    if value is None or value == "":
        return None
    try:
        if len(value) == 10:
            day = date.fromisoformat(value)
            parsed = datetime.combine(
                day,
                time.max if end else time.min,
                tzinfo=BUSINESS_TZ,
            )
        else:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if end and len(value) == 16:
                parsed = parsed.replace(second=59, microsecond=999999)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=BUSINESS_TZ)
            parsed = parsed.astimezone(timezone.utc)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {'to' if end else 'from'} date/time value.",
        ) from exc
    return parsed


def call_conditions(
    *,
    employee_id: str | None = None,
    call_type: str | None = None,
    status: str | None = None,
    from_value: str | None = None,
    to_value: str | None = None,
    min_duration: int | None = None,
    min_duration_exclusive: int | None = None,
    max_duration: int | None = None,
    phone: str | None = None,
    query: str | None = None,
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    start = parse_datetime_value(from_value)
    end = parse_datetime_value(to_value, end=True)
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="'from' must be before or equal to 'to'.")
    if employee_id:
        conditions.append(Call.employee_id == employee_id)
    if call_type:
        conditions.append(Call.call_type == call_type)
    if status:
        conditions.append(Call.status == status)
    if start:
        conditions.append(Call.call_datetime >= start)
    if end:
        conditions.append(Call.call_datetime <= end)
    if min_duration is not None:
        conditions.append(Call.duration_sec >= min_duration)
    if min_duration_exclusive is not None:
        conditions.append(Call.duration_sec > min_duration_exclusive)
    if max_duration is not None:
        conditions.append(Call.duration_sec <= max_duration)
    if phone:
        phone_digits = re.sub(r"\D", "", phone)
        if phone_digits:
            conditions.append(Call.phone_normalized.ilike(f"%{phone_digits}%"))
        else:
            conditions.append(Call.phone_normalized == "")
    if query and query.strip():
        term = f"%{query.strip()}%"
        conditions.append(
            (Employee.name.ilike(term))
            | (Call.phone_normalized.ilike(term))
        )
    return conditions


def filtered_call_select(
    conditions: list[ColumnElement[bool]],
) -> Select[tuple[Any, ...]]:
    statement = select(Call, Employee.name).join(
        Employee,
        Employee.id == Call.employee_id,
    )
    if conditions:
        statement = statement.where(*conditions)
    return statement


def date_only(value: datetime) -> bool:
    return (
        value.hour,
        value.minute,
        value.second,
        value.microsecond,
    ) == (0, 0, 0, 0)


def covers_end_of_day(value: datetime) -> bool:
    return (value.hour, value.minute) >= (23, 59)


def report_full_days(
    start: datetime | None,
    end: datetime | None,
) -> tuple[date, date] | None:
    if start is None or end is None:
        return None
    local_start = start.astimezone(BUSINESS_TZ)
    local_end = end.astimezone(BUSINESS_TZ)
    first = local_start.date()
    if not date_only(local_start):
        first += timedelta(days=1)
    last = local_end.date()
    if not covers_end_of_day(local_end):
        last -= timedelta(days=1)
    return (first, last) if first <= last else None


def normalize_phone_filter(phone: str) -> str:
    return re.sub(r"\D", "", phone)
