from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.etl.pipeline import estimate_batch, insert_raw_calls, process_batch
from app.models.bronze import RawCall
from app.models.silver import Device, Employee
from app.services.firebase_push import (
    FirebasePushError,
    FirebasePushNotConfigured,
    send_manager_sync,
)
from app.schemas.sync import (
    DeviceRegistrationRequest,
    DeviceSyncStatus,
    ManagerSyncCompletionRequest,
    ManagerSyncRequestResponse,
    SyncCallsResponse,
    SyncLastResponse,
)
from app.security import EmployeeUser, ManagementUser


router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post(
    "/device/register",
    status_code=204,
    summary="Register an employee device for management-triggered sync",
)
def register_device(
    body: DeviceRegistrationRequest,
    db: Annotated[Session, Depends(get_db)],
    user: EmployeeUser,
) -> None:
    if not user.employee_id:
        raise HTTPException(
            status_code=403,
            detail="This employee login is not linked to an employee record.",
        )
    employee = db.get(Employee, user.employee_id)
    if employee is None or not employee.is_active:
        raise HTTPException(status_code=403, detail="This employee account is inactive.")

    device = db.get(Device, body.device_id)
    if device is not None and device.employee_id != employee.id:
        raise HTTPException(
            status_code=403,
            detail="This device is registered to another employee.",
        )

    if device is None:
        device = Device(
            id=body.device_id,
            employee_id=employee.id,
            fcm_token=body.fcm_token,
        )
        db.add(device)
    else:
        device.fcm_token = body.fcm_token
    db.commit()


@router.post(
    "/devices/{device_id}/request",
    response_model=ManagerSyncRequestResponse,
    summary="Start a device sync from management",
)
def request_device_sync(
    device_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
) -> ManagerSyncRequestResponse:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device is not registered.")
    employee = db.get(Employee, device.employee_id)
    if employee is None or not employee.is_active:
        raise HTTPException(status_code=403, detail="This employee account is inactive.")
    if not device.fcm_token:
        raise HTTPException(
            status_code=409,
            detail="This device has not registered for management sync.",
        )

    request_id = str(uuid4())
    device.sync_request_id = request_id
    device.sync_requested_at = datetime.now(timezone.utc)
    device.sync_request_status = "pending"
    device.sync_request_message = "Sync started by management."
    db.commit()

    try:
        send_manager_sync(
            token=device.fcm_token,
            device_id=device.id,
            request_id=request_id,
        )
    except FirebasePushNotConfigured as exc:
        device.sync_request_status = "failed"
        device.sync_request_message = str(exc)
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except FirebasePushError as exc:
        device.sync_request_status = "failed"
        device.sync_request_message = str(exc)
        db.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ManagerSyncRequestResponse(request_id=request_id, status="pending")


@router.post(
    "/devices/{device_id}/complete",
    response_model=SyncCallsResponse,
    summary="Accept the device result for a manager-started sync",
)
def complete_manager_sync(
    device_id: str,
    body: ManagerSyncCompletionRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
) -> SyncCallsResponse:
    device = db.get(Device, device_id)
    if (
        device is None
        or device.fcm_token != body.fcm_token
        or device.sync_request_id != body.request_id
        or device.sync_request_status != "pending"
    ):
        raise HTTPException(
            status_code=403,
            detail="This sync command is invalid or has expired.",
        )

    if body.error:
        device.sync_request_status = "failed"
        device.sync_request_message = body.error
        db.commit()
        return SyncCallsResponse(received=0, inserted=0, duplicates=0, rejected=0)

    employee = db.get(Employee, device.employee_id)
    if employee is None or not employee.is_active:
        raise HTTPException(status_code=403, detail="This employee account is inactive.")

    if not body.calls:
        device.last_sync_at = datetime.now(timezone.utc)
        device.sync_request_status = "completed"
        device.sync_request_message = "No new eligible calls were found."
        db.commit()
        return SyncCallsResponse(received=0, inserted=0, duplicates=0, rejected=0)

    inserted, duplicates, rejected = estimate_batch(db, employee.id, body.calls)
    batch_id = insert_raw_calls(
        db,
        device_id=device.id,
        employee_id=employee.id,
        calls=body.calls,
    )
    device.sync_request_status = "completed"
    device.sync_request_message = f"{len(body.calls)} records received."
    db.commit()
    background_tasks.add_task(process_batch, batch_id)
    return SyncCallsResponse(
        received=len(body.calls),
        inserted=inserted,
        duplicates=duplicates,
        rejected=rejected,
    )


@router.get(
    "/last",
    response_model=SyncLastResponse,
    summary="Get this device's last sync time",
    description="Example: `/api/sync/last?deviceId=android-device-01`.",
)
def get_last_sync(
    db: Annotated[Session, Depends(get_db)],
    user: EmployeeUser,
    device_id: str = Query(alias="deviceId", min_length=1, max_length=128),
) -> SyncLastResponse:
    if not user.employee_id:
        raise HTTPException(
            status_code=403,
            detail="This employee login is not linked to an employee record.",
        )
    device = db.get(Device, device_id)
    if device is not None and device.employee_id != user.employee_id:
        raise HTTPException(status_code=403, detail="This device belongs to another employee.")
    return SyncLastResponse(
        last_synced_at=device.last_sync_at.isoformat()
        if device and device.last_sync_at
        else None
    )


@router.get(
    "/status",
    response_model=list[DeviceSyncStatus],
    summary="List employee device sync status",
    description="Admin and manager bearer tokens can read device sync status.",
)
def get_sync_status(
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
) -> list[DeviceSyncStatus]:
    rows = db.execute(
        select(
            Employee,
            Device,
            func.max(RawCall.received_at).label("last_received_at"),
        )
        .outerjoin(Device, Device.employee_id == Employee.id)
        .outerjoin(RawCall, RawCall.device_id == Device.id)
        .group_by(Employee.id, Device.id)
        .order_by(Employee.name, Device.id)
    ).all()
    results = []
    for employee, device, last_received_at in rows:
        last_sync = device.last_sync_at if device else None
        is_pending = last_received_at is not None and (
            last_sync is None or last_received_at > last_sync
        )
        results.append(
            DeviceSyncStatus(
                employee_id=employee.id,
                employee_name=employee.name,
                device_id=device.id if device else "",
                last_sync=last_sync.isoformat() if last_sync else "Not synced",
                push_registered=bool(device and device.fcm_token),
                sync_request_status=device.sync_request_status if device else None,
                sync_requested_at=(
                    device.sync_requested_at.isoformat()
                    if device and device.sync_requested_at
                    else None
                ),
                sync_request_message=(
                    device.sync_request_message if device else None
                ),
                status=(
                    "pending"
                    if is_pending
                    else "synced"
                    if last_sync
                    else "never_synced"
                ),
            )
        )
    return results
