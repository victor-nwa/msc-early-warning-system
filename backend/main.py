from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas import AssistantRequest, HealthResponse

from backend.auth import (
    LoginRequest,
    LoginResponse,
    authenticate_user,
    create_access_token,
    get_user_from_token,
)
from backend.services import (
    PREDICTIONS_PATH,
    build_local_assistant_response,
    clear_cache,
    get_explainability,
    get_intervention_summary,
    get_model_performance,
    get_student,
    get_students,
    get_summary,
)


app = FastAPI(
    title="AI Student Early Warning API",
    description=(
        "FastAPI backend for the OULAD AI-powered early warning and "
        "intervention system."
    ),
    version="1.0.0",
)

# Allows the future React frontend to call the backend during local development.
app.add_middleware(
    CORSMiddleware,
    # Development mode: allow local frontend/Lovable/Vite origins.
    # Tighten this before production deployment.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/auth/login", response_model=LoginResponse, tags=["Authentication"])
def login(payload: LoginRequest):
    user = authenticate_user(payload.email, payload.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@app.get("/auth/me", tags=["Authentication"])
def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token.")

    token = authorization.split(" ", 1)[1]
    user = get_user_from_token(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token.")

    return user


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "AI Student Early Warning API is running.",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health():
    if not PREDICTIONS_PATH.exists():
        return {
            "status": "warning",
            "message": (
                "API is running, but the OULAD predictions file is missing. "
                "Run scripts/06_generate_oulad_interventions.py first."
            ),
        }

    return {
        "status": "ok",
        "message": "API is running and OULAD prediction data is available.",
    }


@app.post("/refresh-cache", tags=["Utility"])
def refresh_cache():
    clear_cache()
    return {
        "message": "Backend cache cleared. Data will be reloaded on next request."
    }


@app.get("/summary", tags=["Dashboard"])
def summary():
    try:
        return get_summary()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/students", tags=["Students"])
def students(
    limit: int = Query(default=100, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    risk_level: Optional[str] = None,
    risk_status: Optional[str] = None,
    module: Optional[str] = None,
    presentation: Optional[str] = None,
    search: Optional[str] = None,
):
    try:
        return get_students(
            limit=limit,
            offset=offset,
            risk_level=risk_level,
            risk_status=risk_status,
            module=module,
            presentation=presentation,
            search=search,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/students/{student_record_key}", tags=["Students"])
def student_detail(student_record_key: str):
    try:
        student = get_student(student_record_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if student is None:
        raise HTTPException(
            status_code=404,
            detail=f"Student record not found: {student_record_key}",
        )

    return student


@app.get("/model-performance", tags=["Model"])
def model_performance():
    return get_model_performance()


@app.get("/explainability", tags=["Model"])
def explainability():
    return get_explainability()


@app.get("/intervention-summary", tags=["Interventions"])
def intervention_summary():
    return get_intervention_summary()


@app.post("/assistant", tags=["AI Support Assistant"])
def assistant(request: AssistantRequest):
    try:
        response = build_local_assistant_response(
            student_record_key=request.student_record_key,
            question=request.question,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if response is None:
        raise HTTPException(
            status_code=404,
            detail=f"Student record not found: {request.student_record_key}",
        )

    return response


@app.get("/interventions", tags=["Interventions"])
def interventions_action_centre():
    from backend.services import get_interventions_action_centre
    return get_interventions_action_centre()


@app.get("/overview", tags=["Overview"])
def overview_data():
    from backend.services import get_overview_data
    return get_overview_data()


@app.get("/model-evaluation", tags=["Model Evaluation"])
def model_evaluation_page():
    from backend.services import get_model_evaluation_page
    return get_model_evaluation_page()


@app.post("/assistant/query", tags=["Assistant"])
def assistant_query(payload: dict):
    from backend.services import get_portal_assistant_response
    question = payload.get("question") or payload.get("message") or payload.get("query") or ""
    return get_portal_assistant_response(question)

