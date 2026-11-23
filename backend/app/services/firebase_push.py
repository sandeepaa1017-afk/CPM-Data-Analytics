from threading import Lock

import firebase_admin
from firebase_admin import credentials, exceptions, messaging

from app.config import get_settings


class FirebasePushNotConfigured(Exception):
    pass


class FirebasePushError(Exception):
    pass


_app_lock = Lock()


def _firebase_app():
    settings = get_settings()
    credential_file = settings.firebase_service_account_file
    if not credential_file:
        raise FirebasePushNotConfigured(
            "Firebase push is not configured on the backend."
        )

    try:
        return firebase_admin.get_app("cpm-manager-sync")
    except ValueError:
        pass

    with _app_lock:
        try:
            return firebase_admin.get_app("cpm-manager-sync")
        except ValueError:
            try:
                credential = credentials.Certificate(credential_file)
                return firebase_admin.initialize_app(
                    credential,
                    name="cpm-manager-sync",
                )
            except (FileNotFoundError, ValueError) as exc:
                raise FirebasePushNotConfigured(
                    "The Firebase service-account file is missing or invalid."
                ) from exc


def send_manager_sync(*, token: str, device_id: str, request_id: str) -> None:
    app = _firebase_app()
    try:
        messaging.send(
            messaging.Message(
                token=token,
                data={
                    "type": "manager_sync",
                    "deviceId": device_id,
                    "requestId": request_id,
                },
                android=messaging.AndroidConfig(priority="high"),
            ),
            app=app,
        )
    except exceptions.FirebaseError as exc:
        raise FirebasePushError(
            "Firebase could not deliver the sync command to this device."
        ) from exc
