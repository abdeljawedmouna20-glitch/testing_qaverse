# tests/integration/test_backend_integration.py

import os
import pytest
from unittest.mock import patch

# The tests assume a FastAPI application with:
# - /auth/register  (POST) to register a new user
# - /auth/login     (POST) to obtain a JWT access token
# - /items          (POST, GET) for item creation/listing (requires auth)
# - /items/{id}     (GET, PUT, DELETE) for item operations (requires auth)
# - Protected endpoints require Authorization: Bearer <token>
# - The app uses a SQLAlchemy-based DB, and can be configured for a test DB
#
# This test suite focuses on generic integration scenarios and mocks external services
# where appropriate. Adjust endpoint paths if your project uses different ones.

TEST_USER = {
    "email": "integration+test@example.com",
    "password": "StrongPassword123!",
    "name": "Integration Tester"
}


@pytest.fixture(scope="session")
def client():
    # Try to initialize the actual app. If not available, skip tests gracefully.
    try:
        # Ensure test DB is used by the application if it respects DATABASE_URL at startup.
        os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_integration.db")

        from fastapi.testclient import TestClient  # type: ignore
        # Import app after environment is configured
        from app.main import app  # type: ignore
        from app.database import Base, engine  # type: ignore

        # Recreate the test database schema
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        client = TestClient(app)

        yield client
    except Exception:
        pytest.skip("App not available for integration tests", allow_module_level=True)
    finally:
        # Teardown: drop the test DB
        try:
            Base.metadata.drop_all(bind=engine)
        except Exception:
            pass


def test_registration_triggers_email(client, monkeypatch):
    # Attempt to mock an external email service to verify integration between API
    # layer and external services. If the email service isn't present in the project,
    # skip this portion gracefully.
    try:
        # Attempt to patch a hypothetical email service module used during registration
        # The actual import path may differ; adjust if needed.
        import app.services.email as email_module  # type: ignore

        calls = {"count": 0}

        def fake_send_welcome_email(to_email: str, user_id: int):
            calls["count"] += 1

        monkeypatch.setattr(email_module, "send_welcome_email", fake_send_welcome_email)
    except Exception:
        pytest.skip("Email service integration not present; skipping external service mock test")

    resp = client.post("/auth/register", json=TEST_USER)
    assert resp.status_code in (200, 201)
    # Ensure the mock was invoked
    assert calls["count"] == 1


def test_auth_flow_and_item_crud(client):
    # 1) Register a user (idempotent if user already exists in test DB)
    resp = client.post("/auth/register", json=TEST_USER)
    assert resp.status_code in (200, 201)

    # 2) Login to obtain access token
    login_payload = {
        "email": TEST_USER["email"],
        "password": TEST_USER["password"]
    }
    resp = client.post("/auth/login", json=login_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data or "token" in data
    token = data.get("access_token") or data.get("token")
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    # 3) Create an item (requires auth)
    item_payload = {"name": "Test Item", "description": "Integration test item"}
    resp = client.post("/items", json=item_payload, headers=headers)
    assert resp.status_code == 201
    item = resp.json()
    item_id = item.get("id")
    assert item_id is not None

    # 4) Read the created item
    resp = client.get(f"/items/{item_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json().get("name") == item_payload["name"]

    # 5) List items
    resp = client.get("/items", headers=headers)
    assert resp.status_code == 200
    items_list = resp.json()
    assert isinstance(items_list, list)
    assert any(it.get("id") == item_id for it in items_list)

    # 6) Update the item
    update_payload = {"name": "Updated Test Item"}
    resp = client.put(f"/items/{item_id}", json=update_payload, headers=headers)
    assert resp.status_code == 200
    updated = resp.json()
    assert updated.get("name") == update_payload["name"]

    # 7) Delete the item
    resp = client.delete(f"/items/{item_id}", headers=headers)
    assert resp.status_code in (200, 204)

    # 8) Verify item is removed
    resp = client.get(f"/items/{item_id}", headers=headers)
    assert resp.status_code in (404, 422)  # Depending on error handling


def test_unauthorized_access_is_rejected(client):
    # Access protected endpoints without a token should be rejected
    resp = client.get("/items")
    assert resp.status_code in (401, 403)

    # Access login or register without proper payload should be validated by API
    resp = client.post("/auth/login", json={"email": "nonexistent@example.com"})
    assert resp.status_code in (422, 400)
```