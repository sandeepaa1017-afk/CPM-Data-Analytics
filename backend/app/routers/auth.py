from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.silver import Employee, User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserCreate,
    UserSummary,
)
from app.security import (
    AdminUser,
    AuthenticatedUser,
    create_access_token,
    hash_password,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse, summary="Sign in and receive a JWT")
def login(
    body: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == body.username.strip()))
    if (
        user is None
        or not user.is_active
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    employee_name = None
    if user.employee_id:
        employee = db.get(Employee, user.employee_id)
        employee_name = employee.name if employee else None
    summary = UserSummary(
        id=user.id,
        username=user.username,
        role=user.role,
        employee_id=user.employee_id,
        name=employee_name or user.username,
    )
    return TokenResponse(access_token=create_access_token(user), user=summary)


@router.post(
    "/change-password",
    summary="Change the authenticated user's password",
)
def change_password(
    body: PasswordChangeRequest,
    db: Annotated[Session, Depends(get_db)],
    user: AuthenticatedUser,
) -> dict[str, str]:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


@router.post(
    "/users",
    response_model=UserSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Create a manager login",
)
def create_manager(
    body: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    _: AdminUser,
) -> UserSummary:
    username = body.username.strip()
    existing = db.scalar(select(User).where(User.username == username))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already in use.",
        )
    user = User(
        username=username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserSummary(
        id=user.id,
        username=user.username,
        role=user.role,
        employee_id=user.employee_id,
        name=user.username,
    )
