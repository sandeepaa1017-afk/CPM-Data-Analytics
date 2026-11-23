from pydantic import BaseModel, ConfigDict, Field


class CallResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    employee_id: str = Field(alias="employeeId")
    employee_name: str = Field(alias="employeeName")
    phone: str
    call_type: str = Field(alias="callType")
    status: str
    duration_sec: int = Field(alias="durationSec")
    date_time: str = Field(alias="dateTime")


class PaginatedCalls(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[CallResponse]
    total: int
    page: int
    page_size: int = Field(alias="pageSize")


class CustomerResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customer_id: str = Field(alias="customerId")
    phone: str
    interaction_count: int = Field(alias="interactionCount")
    answered_calls: int = Field(alias="answeredCalls")
    missed_calls: int = Field(alias="missedCalls")
    rejected_calls: int = Field(alias="rejectedCalls")
    talk_time_sec: int = Field(alias="talkTimeSec")
    employee_ids: list[str] = Field(alias="employeeIds")
    first_call_at: str = Field(alias="firstCallAt")
    last_call_at: str = Field(alias="lastCallAt")
    last_call_type: str = Field(alias="lastCallType")
    last_status: str = Field(alias="lastStatus")
