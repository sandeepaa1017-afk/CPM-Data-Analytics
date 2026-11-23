from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routers import auth
from app.schemas.auth import PasswordChangeRequest


class FakeDb:
    def __init__(self):
        self.commits = 0

    def commit(self):
        self.commits += 1


def test_password_change_requires_eight_characters():
    with pytest.raises(ValidationError):
        PasswordChangeRequest(current_password="current", new_password="short")


def test_password_change_rejects_more_than_72_utf8_bytes():
    with pytest.raises(ValidationError):
        PasswordChangeRequest(current_password="current", new_password="é" * 37)


def test_password_change_rejects_incorrect_current_password(monkeypatch):
    user = SimpleNamespace(password_hash="existing-hash")
    db = FakeDb()
    monkeypatch.setattr(auth, "verify_password", lambda _password, _hash: False)

    with pytest.raises(HTTPException) as error:
        auth.change_password(
            PasswordChangeRequest(
                current_password="incorrect",
                new_password="new-password",
            ),
            db,
            user,
        )

    assert error.value.status_code == 400
    assert db.commits == 0
    assert user.password_hash == "existing-hash"


def test_password_change_hashes_new_password_and_commits(monkeypatch):
    user = SimpleNamespace(password_hash="existing-hash")
    db = FakeDb()
    monkeypatch.setattr(
        auth,
        "verify_password",
        lambda password, _hash: password == "current-password",
    )
    monkeypatch.setattr(auth, "hash_password", lambda password: f"hashed:{password}")
    body = PasswordChangeRequest(
        current_password="current-password",
        new_password="new-password",
    )

    result = auth.change_password(body, db, user)

    assert result == {"message": "Password changed successfully."}
    assert user.password_hash == "hashed:new-password"
    assert db.commits == 1
