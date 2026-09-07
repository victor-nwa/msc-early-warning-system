from pydantic import BaseModel
from typing import Optional


class AssistantRequest(BaseModel):
    student_record_key: str
    question: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    message: str
