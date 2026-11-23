from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SyncCallsResponse(BaseModel):
    received: int
    inserted: int
    duplicates: int
    rejected: int


class DeviceRegistrationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    device_id: str = Field(alias="deviceId", min_length=1, max_length=128)
    fcm_token: str = Field(alias="fcmToken", min_length=1, max_length=512)


class ManagerSyncCompletionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    request_id: str = Field(alias="requestId", min_length=1, max_length=36)
    fcm_token: str = Field(alias="fcmToken", min_length=1, max_length=512)
    calls: list[dict[str, Any]] = Field(default_factory=list, max_length=5000)
    error: str | None = Field(default=None, max_length=500)


class ManagerSyncRequestResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    status: str


class SyncLastResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    last_synced_at: str | None = Field(alias="lastSyncedAt")


class DeviceSyncStatus(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    employee_id: str = Field(alias="employeeId")
    employee_name: str = Field(alias="employeeName")
    device_id: str = Field(alias="deviceId")
    last_sync: str = Field(alias="lastSync")
    pending_records: int = Field(default=0, alias="pendingRecords")
    failed_records: int = Field(default=0, alias="failedRecords")
    push_registered: bool = Field(default=False, alias="pushRegistered")
    sync_request_status: str | None = Field(default=None, alias="syncRequestStatus")
    sync_requested_at: str | None = Field(default=None, alias="syncRequestedAt")
    sync_request_message: str | None = Field(default=None, alias="syncRequestMessage")
    status: str
