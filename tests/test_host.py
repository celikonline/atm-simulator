import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

import pytest  # noqa: E402

import _host as host  # noqa: E402
from index import app  # noqa: E402

CASSETTES = {"200": 10, "100": 10, "50": 10, "20": 10}


@pytest.fixture
def client():
    return app.test_client()


def login(client, card="4543-0001", pin="1234"):
    r = client.post("/api/pin/verify", json={"card_id": card, "pin": pin, "tries": 0})
    return r.get_json()


def test_health(client):
    assert client.get("/api/health").get_json()["status"] == "ok"


def test_wrong_pin_then_block(client):
    r = client.post("/api/pin/verify", json={"card_id": "4543-0001", "pin": "9999", "tries": 0}).get_json()
    assert r["code"] == "55" and r["tries_left"] == 2
    r = client.post("/api/pin/verify", json={"card_id": "4543-0001", "pin": "9999", "tries": 2}).get_json()
    assert r["code"] == "75"


def test_withdraw_and_dispense_plan(client):
    tok = login(client)["token"]
    r = client.post("/api/withdraw", headers={"Authorization": f"Bearer {tok}"},
                    json={"amount": 570, "ledger": {"balance": 1000}, "cassettes": CASSETTES}).get_json()
    assert r["approved"]
    assert sum(int(d) * n for d, n in r["notes"].items()) == 570
    assert r["ledger"]["balance"] == 430


def test_insufficient_funds(client):
    tok = login(client)["token"]
    r = client.post("/api/withdraw", headers={"Authorization": f"Bearer {tok}"},
                    json={"amount": 2000, "ledger": {"balance": 100}, "cassettes": CASSETTES}).get_json()
    assert r["code"] == "51"


def test_daily_limit(client):
    tok = login(client)["token"]
    r = client.post("/api/withdraw", headers={"Authorization": f"Bearer {tok}"},
                    json={"amount": 1000, "ledger": {"balance": 50000, "daily_withdrawn": 9500}, "cassettes": CASSETTES}).get_json()
    assert r["code"] == "61"


def test_dispense_needs_backtracking():
    # 60 TL: 50 kullanılırsa kalan 10 verilemez; 3x20 olmalı
    assert host.plan_dispense(60, CASSETTES) == {20: 3}
    assert host.plan_dispense(30, CASSETTES) is None


def test_tampered_token_rejected(client):
    tok = login(client)["token"] + "x"
    r = client.post("/api/balance", headers={"Authorization": f"Bearer {tok}"}, json={"ledger": {"balance": 5}})
    assert r.status_code == 401


def test_foreign_card_routes_via_bkm(client):
    r = login(client, "5170-7788", "0000")
    assert any(h["to"] == "bkm" for h in r["trace"])
