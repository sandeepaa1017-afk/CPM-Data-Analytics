from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EmployeeCreate(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "EMP-101",
                    "name": "Maya Sharma",
                    "role": "Sales Executive",
                    "branch": "Bengaluru",
                    "phone": "+91 98765 43210",
                    "email": "maya@example.com",
                    "username": "EMP-101",
                    "password": "replace-this-password",
                }
            ]
        },
    )

    id: str | None = Field(default=None, min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    role: str = Field(default="Sales Executive", min_length=1, max_length=32)
    branch: str | None = Field(default=None, max_length=120)
    phone: str = Field(min_length=7, max_length=32)
    email: str | None = Field(
        default=None,
        max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    username: str | None = Field(default=None, min_length=1, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def limit_bcrypt_bytes(cls, value: str | None) -> str | None:
        if value is not None and len(value.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 UTF-8 bytes.")
        return value

    @model_validator(mode="after")
    def credentials_are_paired(self) -> "EmployeeCreate":
        if (self.username is None) != (self.password is None):
            raise ValueError("Provide both username and password to create a login.")
        return self


class EmployeeUpdate(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "examples": [{"name": "Maya Sharma", "branch": "Bengaluru", "active": True}]
        },
    )

    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, min_length=1, max_length=32)
    branch: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, min_length=7, max_length=32)
    email: str | None = Field(
        default=None,
        max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    active: bool | None = None
    username: str | None = Field(default=None, min_length=1, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @model_validator(mode="after")
    def credentials_are_paired(self) -> "EmployeeUpdate":
        if (self.username is None) != (self.password is None):
            raise ValueError("Provide both username and password to change login details.")
        return self

    @field_validator("password")
    @classmethod
    def limit_bcrypt_bytes(cls, value: str | None) -> str | None:
        if value is not None and len(value.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 UTF-8 bytes.")
        return value


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    name: str
    role: str
    branch: str | None = None
    phone: str
    email: str | None = None
    active: bool = Field(
        validation_alias="is_active",
        serialization_alias="active",
    )
    last_sync: str = Field(default="Not synced", alias="lastSync")
    pending_records: int = Field(default=0, alias="pendingRecords")
    failed_records: int = Field(default=0, alias="failedRecords")
