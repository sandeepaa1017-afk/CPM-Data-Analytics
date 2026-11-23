from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.silver import Device, Employee, User
from app.schemas.employees import EmployeeCreate, EmployeeResponse, EmployeeUpdate
from app.security import AdminUser, ManagementUser, hash_password


router = APIRouter(prefix="/api/employees", tags=["employees"])


def _next_employee_id(db: Session) -> str:
    identifiers = db.scalars(select(Employee.id)).all()
    numbers = [
        int(value.removeprefix("EMP-"))
        for value in identifiers
        if value.startswith("EMP-") and value.removeprefix("EMP-").isdigit()
    ]
    return f"EMP-{max(numbers, default=0) + 1:03d}"


def _employee_response(db: Session, employee: Employee) -> EmployeeResponse:
    last_sync = db.scalar(
        select(func.max(Device.last_sync_at)).where(
            Device.employee_id == employee.id
        )
    )
    return EmployeeResponse(
        id=employee.id,
        name=employee.name,
        role=employee.role,
        branch=employee.branch or "",
        phone=employee.phone,
        email=employee.email or "",
        is_active=employee.is_active,
        last_sync=last_sync.isoformat() if last_sync else "Not synced",
    )


@router.get(
    "",
    response_model=list[EmployeeResponse],
    summary="List employees",
    description="Admin and manager bearer tokens can read the employee directory.",
)
def list_employees(
    db: Annotated[Session, Depends(get_db)],
    _: ManagementUser,
) -> list[EmployeeResponse]:
    employees = db.scalars(select(Employee).order_by(Employee.name)).all()
    return [_employee_response(db, employee) for employee in employees]


@router.post(
    "",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an employee",
    description="Example request: `{\"name\":\"Maya Sharma\",\"phone\":\"+919876543210\"}`.",
)
def create_employee(
    body: EmployeeCreate,
    db: Annotated[Session, Depends(get_db)],
    _: AdminUser,
) -> EmployeeResponse:
    employee_id = body.id or _next_employee_id(db)
    employee = Employee(
        id=employee_id,
        name=body.name.strip(),
        role=body.role.strip(),
        branch=body.branch.strip() if body.branch else None,
        phone=body.phone.strip(),
        email=body.email,
    )
    db.add(employee)

    if body.username is not None and body.password is not None:
        username = body.username.strip()
        if db.scalar(select(User.id).where(User.username == username)) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That username is already in use.",
            )
        db.add(
            User(
                username=username,
                password_hash=hash_password(body.password),
                role="employee",
                employee_id=employee_id,
            )
        )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The employee ID or login username already exists.",
        ) from exc
    db.refresh(employee)
    return _employee_response(db, employee)


@router.put(
    "/{employee_id}",
    response_model=EmployeeResponse,
    summary="Update an employee",
    description="Example: `PUT /api/employees/EMP-101` with `{\"active\":true}`.",
)
def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: AdminUser,
) -> EmployeeResponse:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found.")

    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one field to update.")
    username = changes.pop("username", None)
    password = changes.pop("password", None)
    active = changes.pop("active", None)
    for field in ("name", "role", "branch", "phone", "email"):
        if field in changes:
            value = changes[field]
            setattr(employee, field, value.strip() if isinstance(value, str) else value)
    if active is not None:
        employee.is_active = active

    user = db.scalar(select(User).where(User.employee_id == employee_id))
    if username is not None and password is not None:
        existing = db.scalar(
            select(User).where(
                User.username == username.strip(),
                User.employee_id != employee_id,
            )
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That username is already in use.",
            )
        if user is None:
            user = User(
                username=username.strip(),
                password_hash=hash_password(password),
                role="employee",
                employee_id=employee_id,
                is_active=employee.is_active,
            )
            db.add(user)
        else:
            user.username = username.strip()
            user.password_hash = hash_password(password)
    if user is not None and active is not None:
        user.is_active = active

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The employee login could not be saved.",
        ) from exc
    db.refresh(employee)
    return _employee_response(db, employee)


@router.patch(
    "/{employee_id}/deactivate",
    response_model=EmployeeResponse,
    summary="Deactivate an employee and their login",
    description="Example: `PATCH /api/employees/EMP-101/deactivate`.",
)
def deactivate_employee(
    employee_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: AdminUser,
) -> EmployeeResponse:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    employee.is_active = False
    user = db.scalar(select(User).where(User.employee_id == employee_id))
    if user is not None:
        user.is_active = False
    db.commit()
    db.refresh(employee)
    return _employee_response(db, employee)
