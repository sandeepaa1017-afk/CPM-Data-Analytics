import logging
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.etl.gold import rebuild_gold
from app.etl.transform import transform_call
from app.models.bronze import RawCall
from app.models.silver import Call, Customer, Device


logger = logging.getLogger(__name__)


def insert_raw_calls(
    db: Session,
    *,
    device_id: str,
    employee_id: str,
    calls: Sequence[dict[str, Any]],
    batch_id: uuid.UUID | None = None,
) -> uuid.UUID:
    selected_batch = batch_id or uuid.uuid4()
    db.add_all(
        RawCall(
            device_id=device_id,
            employee_id=employee_id,
            payload=payload,
            batch_id=selected_batch,
        )
        for payload in calls
    )
    db.flush()
    return selected_batch


def estimate_batch(
    db: Session,
    employee_id: str,
    calls: Sequence[dict[str, Any]],
) -> tuple[int, int, int]:
    transformed: dict[str, dict[str, Any]] = {}
    rejected = 0
    for payload in calls:
        try:
            record = transform_call(payload, employee_id)
        except ValueError:
            rejected += 1
            continue
        transformed.setdefault(record["source_hash"], record)

    if not transformed:
        return 0, 0, rejected
    existing = set(
        db.scalars(
            select(Call.source_hash).where(
                Call.source_hash.in_(tuple(transformed.keys()))
            )
        )
    )
    inserted = len(transformed.keys() - existing)
    duplicates = len(calls) - rejected - inserted
    return inserted, duplicates, rejected


def transform_batch(
    db: Session,
    batch_id: uuid.UUID,
) -> tuple[int, int, int]:
    raw_rows = db.scalars(
        select(RawCall).where(RawCall.batch_id == batch_id).order_by(RawCall.id)
    ).all()
    prepared: list[dict[str, Any]] = []
    rejected = 0
    for row in raw_rows:
        try:
            prepared.append(transform_call(row.payload, row.employee_id))
        except ValueError as exc:
            rejected += 1
            logger.warning(
                "Rejecting invalid raw call id=%s batch_id=%s: %s",
                row.id,
                batch_id,
                exc,
            )

    unique_by_hash = {record["source_hash"]: record for record in prepared}
    if unique_by_hash:
        phone_numbers = {record["phone_normalized"] for record in unique_by_hash.values()}
        db.execute(
            insert(Customer)
            .values([{"phone_normalized": phone} for phone in phone_numbers])
            .on_conflict_do_nothing(index_elements=[Customer.phone_normalized])
        )
        inserted_ids = db.scalars(
            insert(Call)
            .values(list(unique_by_hash.values()))
            .on_conflict_do_nothing(constraint="uq_silver_calls_source_hash")
            .returning(Call.id)
        ).all()
        inserted_count = len(inserted_ids)
    else:
        inserted_count = 0

    duplicate_count = len(raw_rows) - rejected - inserted_count
    return len(raw_rows), inserted_count, duplicate_count


def process_batch(batch_id: uuid.UUID) -> None:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT pg_advisory_xact_lock(73192841)"))
            transform_batch(db, batch_id)
            batch = db.execute(
                select(
                    RawCall.device_id,
                    func.max(RawCall.received_at).label("received_at"),
                )
                .where(RawCall.batch_id == batch_id)
                .group_by(RawCall.device_id)
            ).first()
            if batch is not None:
                device = db.get(Device, batch.device_id)
                if device is not None and (
                    device.last_sync_at is None
                    or batch.received_at > device.last_sync_at
                ):
                    device.last_sync_at = batch.received_at
            rebuild_gold(db)
            db.commit()
    except SQLAlchemyError:
        logger.exception("ETL failed for batch_id=%s", batch_id)
        raise


def rebuild_gold_layer() -> tuple[int, int]:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT pg_advisory_xact_lock(73192841)"))
            counts = rebuild_gold(db)
            db.commit()
            return counts
    except SQLAlchemyError:
        logger.exception("Gold layer rebuild failed")
        raise
