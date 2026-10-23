import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CREDITWISE_DB_PATH", str(tmp_path / "test.db"))
    return TestClient(app)
