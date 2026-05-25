from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_head_to_head_endpoint():
    response = client.get("/api/head-to-head?driver1=VER&driver2=HAM")
    assert response.status_code == 200
    data = response.json()
    assert "driver1" in data
    assert "driver2" in data
    assert data["driver1"]["code"] == "VER"
    assert data["driver2"]["code"] == "HAM"
