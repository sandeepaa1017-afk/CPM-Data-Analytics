import hashlib
import re
from datetime import datetime, timezone
from typing import Any


CALL_TYPE_MAP = {
    "1": "incoming",
    "incoming": "incoming",
    "in": "incoming",
    "received": "incoming",
    "2": "outgoing",
    "outgoing": "outgoing",
    "out": "outgoing",
    "3": "missed",
    "missed": "missed",
    "5": "rejected",
    "6": "rejected",
    "rejected": "rejected",
    "declined": "rejected",
}


def normalize_phone(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("phone is required")
    raw = value.strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if raw.startswith("+") and 8 <= len(digits) <= 15:
        return f"+{digits}"
    raise ValueError("phone must be a valid 10-digit Indian or international number")


def _call_time(value: Any) -> datetime:
    if isinstance(value, bool) or value is None:
        raise ValueError("call date/time is required")
    if isinstance(value, (int, float)):
        epoch = float(value)
        if epoch > 10_000_000_000:
            epoch /= 1000
        return datetime.fromtimestamp(epoch, timezone.utc)
    if not isinstance(value, str):
        raise ValueError("call date/time must be an ISO string or epoch")

    text = value.strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("call date/time must be a valid ISO string") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _first(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload and payload[key] is not None:
            return payload[key]
    return None


def transform_call(
    payload: dict[str, Any],
    employee_id: str,
) -> dict[str, Any]:
    phone = normalize_phone(
        _first(payload, "phone", "phoneNumber", "number", "phone_number")
    )
    raw_type = _first(payload, "callType", "call_type", "type")
    call_type_key = str(raw_type).strip().lower() if raw_type is not None else ""
    call_type = CALL_TYPE_MAP.get(call_type_key)
    if call_type is None:
        raise ValueError("call type must be incoming, outgoing, missed, or rejected")

    raw_time = _first(
        payload,
        "dateTime",
        "callDateTime",
        "call_datetime",
        "datetime",
        "timestamp",
        "date",
    )
    call_datetime = _call_time(raw_time)

    raw_duration = _first(
        payload,
        "durationSec",
        "durationSeconds",
        "duration_sec",
        "duration",
    )
    if isinstance(raw_duration, bool) or raw_duration is None:
        raise ValueError("duration in seconds is required")
    try:
        duration_sec = int(raw_duration)
    except (TypeError, ValueError) as exc:
        raise ValueError("duration must be a non-negative number of seconds") from exc
    if duration_sec < 0:
        raise ValueError("duration must be a non-negative number of seconds")

    raw_status = _first(payload, "status", "callStatus", "call_status")
    if raw_status is not None:
        status_value = str(raw_status).strip().lower()
        if status_value not in {"answered", "missed"}:
            raise ValueError("status must be answered or missed")
        status = status_value
    else:
        status = (
            "missed"
            if call_type in {"missed", "rejected"} or duration_sec == 0
            else "answered"
        )

    identity = "|".join(
        (
            employee_id,
            phone,
            call_datetime.isoformat(),
            str(duration_sec),
        )
    )
    source_hash = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    return {
        "employee_id": employee_id,
        "phone_normalized": phone,
        "call_type": call_type,
        "status": status,
        "duration_sec": duration_sec,
        "call_datetime": call_datetime,
        "source_hash": source_hash,
    }
