from datetime import date
from decimal import Decimal

from sqlalchemy import Numeric, case, cast, delete, func, select
from sqlalchemy.orm import Session
from sqlalchemy.types import Date

from app.models.gold import DailyEmployeeStat, DailySummary
from app.models.silver import Call


def rebuild_gold(db: Session) -> tuple[int, int]:
    day = cast(Call.call_datetime, Date)
    answered = case((Call.status == "answered", 1), else_=0)
    missed = case((Call.status == "missed", 1), else_=0)
    talk_seconds = case(
        (Call.status == "answered", Call.duration_sec),
        else_=0,
    )
    incoming = case((Call.call_type == "incoming", 1), else_=0)
    outgoing = case((Call.call_type == "outgoing", 1), else_=0)

    employee_rows = db.execute(
        select(
            day.label("date"),
            Call.employee_id,
            func.count().label("total"),
            func.sum(incoming).label("incoming"),
            func.sum(outgoing).label("outgoing"),
            func.sum(missed).label("missed"),
            func.sum(talk_seconds).label("talk_seconds"),
            func.coalesce(
                func.round(
                    cast(func.sum(answered) * 100, Numeric)
                    / func.nullif(func.count(), 0),
                    2,
                ),
                0,
            ).label("answered_pct"),
        )
        .group_by(day, Call.employee_id)
    ).all()

    summary_rows = db.execute(
        select(
            day.label("date"),
            func.count().label("total"),
            func.sum(incoming).label("incoming"),
            func.sum(outgoing).label("outgoing"),
            func.sum(missed).label("missed"),
            func.sum(talk_seconds).label("talk_seconds"),
            func.coalesce(
                func.round(
                    cast(func.sum(answered) * 100, Numeric)
                    / func.nullif(func.count(), 0),
                    2,
                ),
                0,
            ).label("answered_pct"),
        ).group_by(day)
    ).all()

    db.execute(delete(DailyEmployeeStat))
    db.execute(delete(DailySummary))
    db.add_all(
        DailyEmployeeStat(
            date=date_value,
            employee_id=employee_id,
            total=total,
            incoming=incoming_count,
            outgoing=outgoing_count,
            missed=missed_count,
            talk_seconds=talk_total,
            answered_pct=Decimal(str(answered_percent)),
        )
        for (
            date_value,
            employee_id,
            total,
            incoming_count,
            outgoing_count,
            missed_count,
            talk_total,
            answered_percent,
        ) in employee_rows
    )
    db.add_all(
        DailySummary(
            date=date_value,
            total=total,
            incoming=incoming_count,
            outgoing=outgoing_count,
            missed=missed_count,
            talk_seconds=talk_total,
            answered_pct=Decimal(str(answered_percent)),
        )
        for (
            date_value,
            total,
            incoming_count,
            outgoing_count,
            missed_count,
            talk_total,
            answered_percent,
        ) in summary_rows
    )
    db.flush()
    return len(employee_rows), len(summary_rows)
