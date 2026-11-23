import unittest
from datetime import datetime, timezone

from app.etl.transform import normalize_phone, transform_call
from app.services.call_queries import parse_datetime_value, report_full_days


class CallTransformTests(unittest.TestCase):
    def test_normalizes_indian_phone_numbers(self):
        self.assertEqual(normalize_phone(" 98765 43210 "), "+919876543210")
        self.assertEqual(normalize_phone("+91 (98765) 43210"), "+919876543210")

    def test_maps_android_call_type_and_infers_missed_status(self):
        call = transform_call(
            {
                "phoneNumber": "9876543210",
                "type": 3,
                "duration": 0,
                "timestamp": 1795262400000,
            },
            "EMP-101",
        )
        self.assertEqual(call["call_type"], "missed")
        self.assertEqual(call["status"], "missed")
        self.assertEqual(call["duration_sec"], 0)
        self.assertEqual(call["phone_normalized"], "+919876543210")

    def test_hash_is_stable_and_employee_scoped(self):
        payload = {
            "phone": "+91 98765 43210",
            "callType": "outgoing",
            "durationSec": 65,
            "dateTime": "2026-11-21T09:30:00+05:30",
        }
        first = transform_call(payload, "EMP-101")
        repeated = transform_call(payload, "EMP-101")
        other_employee = transform_call(payload, "EMP-102")
        self.assertEqual(first["source_hash"], repeated["source_hash"])
        self.assertNotEqual(first["source_hash"], other_employee["source_hash"])
        self.assertEqual(
            first["call_datetime"],
            datetime(2026, 11, 21, 4, 0, tzinfo=timezone.utc),
        )

    def test_rejects_invalid_duration_and_call_type(self):
        base = {
            "phone": "9876543210",
            "callType": "incoming",
            "durationSec": -1,
            "dateTime": "2026-11-21T09:30:00Z",
        }
        with self.assertRaises(ValueError):
            transform_call(base, "EMP-101")
        base["durationSec"] = 1
        base["callType"] = "unknown"
        with self.assertRaises(ValueError):
            transform_call(base, "EMP-101")

    def test_report_date_bounds_use_india_business_days(self):
        start = parse_datetime_value("2026-11-21T00:00")
        end = parse_datetime_value("2026-11-21T23:59", end=True)
        self.assertEqual(
            start,
            datetime(2026, 11, 20, 18, 30, tzinfo=timezone.utc),
        )
        self.assertEqual(
            end,
            datetime(2026, 11, 21, 18, 29, 59, 999999, tzinfo=timezone.utc),
        )
        self.assertEqual(
            report_full_days(start, end),
            (datetime(2026, 11, 21).date(), datetime(2026, 11, 21).date()),
        )


if __name__ == "__main__":
    unittest.main()
