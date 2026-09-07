
import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from pydantic import BaseModel
from backend.database import get_connection

SECRET_KEY = "early-warning-demo-secret-key"
TOKEN_EXPIRY_SECONDS = 60 * 60 * 8


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _sign_payload(payload: dict) -> str:
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()
    signature = hmac.new(
        SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_b64}.{signature}"


def _verify_token(token: str) -> Optional[dict]:
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError:
        return None

    expected_signature = hmac.new(
        SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
        payload = json.loads(payload_json)
    except Exception:
        return None

    if payload.get("exp", 0) < int(time.time()):
        return None

    return payload


def authenticate_user(email: str, password: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT user_id, full_name, email, password_hash, role, is_active
            FROM users
            WHERE lower(email) = lower(?)
            """,
            [email],
        ).fetchone()

    if row is None:
        return None

    user = dict(row)

    if not user.get("is_active"):
        return None

    if user["password_hash"] != hash_password(password):
        return None

    user.pop("password_hash", None)
    return user


def create_access_token(user: dict) -> str:
    payload = {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS,
    }
    return _sign_payload(payload)


def get_user_from_token(token: str) -> Optional[dict]:
    payload = _verify_token(token)

    if not payload:
        return None

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT user_id, full_name, email, role, is_active
            FROM users
            WHERE user_id = ? AND is_active = 1
            """,
            [payload["user_id"]],
        ).fetchone()

    return dict(row) if row else None
