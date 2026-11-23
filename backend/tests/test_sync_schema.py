import unittest

from app.schemas.sync import (
    DeviceRegistrationRequest,
    ManagerSyncCompletionRequest,
    SyncLastResponse,
)


class SyncSchemaTests(unittest.TestCase):
    def test_last_sync_response_accepts_python_field_name(self):
        response = SyncLastResponse(last_synced_at=None)
        self.assertEqual(response.model_dump(by_alias=True), {"lastSyncedAt": None})

    def test_device_registration_uses_mobile_api_aliases(self):
        registration = DeviceRegistrationRequest(
            deviceId="device-01",
            fcmToken="push-token",
        )
        self.assertEqual(registration.device_id, "device-01")
        self.assertEqual(registration.fcm_token, "push-token")

    def test_manager_sync_can_report_no_new_calls(self):
        completion = ManagerSyncCompletionRequest(
            requestId="request-01",
            fcmToken="push-token",
        )
        self.assertEqual(completion.calls, [])


if __name__ == "__main__":
    unittest.main()
