import os
import sys
from datetime import datetime

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


def qr_approve(client, op="withdraw", amount=500, card="4543-0001", ledger=None):
    qr = client.post("/api/qr/create", json={}).get_json()["qr"]
    return client.post("/api/qr/approve", json={
        "qr": qr, "card_id": card, "op": op, "amount": amount,
        "ledger": ledger or {"balance": 1000},
    })


def test_qr_withdraw_uses_amount_from_mobile_approval(client):
    approval = qr_approve(client, amount=500).get_json()["approval"]
    r = client.post("/api/qr/withdraw", json={"approval": approval, "amount": 9000,
                                              "ledger": {"balance": 1000}, "cassettes": CASSETTES}).get_json()
    assert r["approved"]
    assert sum(int(d) * n for d, n in r["notes"].items()) == 500
    assert r["iso"]["request"]["fields"]["48"].startswith("Kartsız işlem · QR")


def test_qr_approve_checks_balance(client):
    r = qr_approve(client, amount=5000, ledger={"balance": 100}).get_json()
    assert not r["approved"] and r["code"] == "51"
    assert "approval" not in r


def test_qr_rejects_other_bank_customer(client):
    r = qr_approve(client, card="5170-7788")
    assert r.status_code == 400 and r.get_json()["code"] == "57"


def test_qr_approval_bound_to_operation(client):
    approval = qr_approve(client, op="deposit").get_json()["approval"]
    r = client.post("/api/qr/withdraw", json={"approval": approval, "ledger": {"balance": 1000}, "cassettes": CASSETTES})
    assert r.get_json()["code"] == "05"


def test_qr_deposit(client):
    approval = qr_approve(client, op="deposit").get_json()["approval"]
    r = client.post("/api/qr/deposit", json={"approval": approval, "notes": {"100": 3}, "suspect": 0,
                                             "ledger": {"balance": 1000}, "cassettes": CASSETTES}).get_json()
    assert r["approved"] and r["ledger"]["balance"] == 1300


def test_qr_expired(client, monkeypatch):
    qr = client.post("/api/qr/create", json={}).get_json()["qr"]
    monkeypatch.setattr(host.time, "time", lambda: 10**12)
    r = client.post("/api/qr/approve", json={"qr": qr, "card_id": "4543-0001", "op": "deposit"})
    assert r.get_json()["code"] == "33"


def test_qr_token_is_not_a_session(client):
    qr = client.post("/api/qr/create", json={}).get_json()["qr"]
    r = client.post("/api/balance", headers={"Authorization": f"Bearer {qr}"}, json={"ledger": {"balance": 5}})
    assert r.status_code == 401


# ------------------------------------------------------------- başka banka ATM'si
ATLAS = "ATM77120"


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_iban_checksum():
    assert host._iban_valid("TR330006100519786457841326")
    assert not host._iban_valid("TR330006100519786457841327")
    assert all(host._iban_valid(iban) for iban in host.RECIPIENTS)


def test_off_us_withdraw_routes_via_bkm_and_charges_fee(client):
    login_res = client.post("/api/pin/verify", json={"card_id": "4543-0001", "pin": "1234", "tries": 0, "terminal": ATLAS}).get_json()
    assert login_res["on_us"] is False and login_res["fees"]["withdraw"] == host.OFF_US_FEES["withdraw"]
    r = client.post("/api/withdraw", headers=auth(login_res["token"]),
                    json={"amount": 500, "ledger": {"balance": 1000}, "cassettes": CASSETTES, "terminal": ATLAS}).get_json()
    assert r["approved"] and any(h["to"] == "bkm" for h in r["trace"])
    assert r["ledger"]["balance"] == 1000 - 500 - host.OFF_US_FEES["withdraw"]
    assert r["iso"]["request"]["fields"]["28"] == "D00002500"


def test_atlas_card_is_on_us_at_atlas_atm(client):
    r = client.post("/api/pin/verify", json={"card_id": "5170-7788", "pin": "0000", "tries": 0, "terminal": ATLAS}).get_json()
    assert r["on_us"] and not any(h["to"] == "bkm" for h in r["trace"])


def test_off_us_only_withdraw_and_balance(client):
    tok = client.post("/api/pin/verify", json={"card_id": "4543-0001", "pin": "1234", "tries": 0, "terminal": ATLAS}).get_json()["token"]
    r = client.post("/api/deposit", headers=auth(tok), json={"notes": {"100": 1}, "ledger": {"balance": 0}, "cassettes": CASSETTES, "terminal": ATLAS})
    assert r.status_code == 400 and r.get_json()["code"] == "58"


# ------------------------------------------------------------- havale / FAST / EFT
MEHMET = host.CARDS["9792-0042"]["account"]
ELIF = host.CARDS["5170-7788"]["account"]
DENIZ = next(i for i, r in host.RECIPIENTS.items() if r["card"] is None)


def test_transfer_method_by_bank_and_amount():
    card = host.CARDS["4543-0001"]
    weekday = datetime(2026, 10, 28, 11, 0)  # çarşamba
    saturday = datetime(2026, 10, 31, 11, 0)
    assert host._transfer_quote(card, MEHMET, 100, weekday)["method"] == "havale"
    assert host._transfer_quote(card, ELIF, 100, weekday)["method"] == "fast"
    eft = host._transfer_quote(card, DENIZ, host.FAST_LIMIT + 1, weekday)
    assert eft["method"] == "eft" and not eft["queued"]
    assert host._transfer_quote(card, DENIZ, host.FAST_LIMIT + 1, saturday)["queued"]


def test_fast_transfer_masks_name_and_charges_fee(client):
    tok = login(client)["token"]
    q = client.post("/api/transfer/inquiry", headers=auth(tok), json={"iban": ELIF, "amount": 300, "ledger": {"balance": 1000}}).get_json()
    assert q["masked_name"] == "E*** D****" and q["bank"] == "Atlas Bank" and "recipient_card" not in q
    r = client.post("/api/transfer", headers=auth(tok), json={"iban": ELIF, "amount": 300, "ledger": {"balance": 1000}}).get_json()
    assert r["approved"] and r["recipient_card"] == "5170-7788"
    assert r["ledger"]["balance"] == 1000 - 300 - host.TRANSFER_FEES["fast"]
    assert any(h["to"] == "fast" for h in r["trace"])


def test_transfer_rejects_bad_iban(client):
    tok = login(client)["token"]
    r = client.post("/api/transfer/inquiry", headers=auth(tok), json={"iban": MEHMET[:-1] + "0", "amount": 10, "ledger": {"balance": 100}})
    assert r.get_json()["code"] == "14"


# ------------------------------------------------------------- kredi kartı
CREDIT = {"limit": 40000, "debt": 8750, "statement": 6200, "minimum": 1240, "due": "15.11.2026", "daily_withdrawn": 0}


def test_cash_advance_uses_credit_limit(client):
    tok = login(client, "5400-3311", "2580")["token"]
    r = client.post("/api/withdraw", headers=auth(tok), json={"amount": 1000, "ledger": CREDIT, "cassettes": CASSETTES}).get_json()
    assert r["approved"] and r["ledger"]["debt"] == 9750
    assert r["iso"]["request"]["fields"]["3"] == "013000"
    assert any(h["to"] == "cards" for h in r["trace"])


def test_credit_card_balance_shows_limit(client):
    tok = login(client, "5400-3311", "2580")["token"]
    r = client.post("/api/balance", headers=auth(tok), json={"ledger": CREDIT}).get_json()
    assert r["balance"] == 40000 - 8750 and r["credit"]["minimum"] == 1240


def test_pay_credit_card_from_account(client):
    tok = login(client)["token"]
    r = client.post("/api/credit/pay", headers=auth(tok), json={
        "credit_card_id": "5400-3311", "amount": 6200, "ledger": {"balance": 12500}, "credit_ledger": CREDIT}).get_json()
    assert r["approved"]
    assert r["ledger"]["balance"] == 6300 and r["credit_ledger"]["debt"] == 2550
    assert r["credit_ledger"]["statement"] == 0 and r["credit_ledger"]["minimum"] == 0


def test_cannot_pay_someone_elses_credit_card(client):
    tok = login(client, "9792-0042", "4321")["token"]
    r = client.post("/api/credit/inquiry", headers=auth(tok), json={"credit_card_id": "5400-3311", "credit_ledger": CREDIT})
    assert r.get_json()["code"] == "14"


# ------------------------------------------------------------- iptal ve gün sonu
def test_reversal_restores_balance_fee_and_daily_limit(client):
    tok = client.post("/api/pin/verify", json={"card_id": "4543-0001", "pin": "1234", "tries": 0, "terminal": ATLAS}).get_json()["token"]
    w = client.post("/api/withdraw", headers=auth(tok),
                    json={"amount": 500, "ledger": {"balance": 1000}, "cassettes": CASSETTES, "terminal": ATLAS}).get_json()
    r = client.post("/api/reversal", json={"reversal_token": w["reversal_token"], "reason": "22",
                                           "ledger": w["ledger"], "terminal": ATLAS}).get_json()
    assert r["approved"] and r["ledger"]["balance"] == 1000 and r["ledger"]["daily_withdrawn"] == 0
    req = r["iso"]["request"]
    assert req["mti"] == "0400" and req["fields"]["39"] == "22"
    assert req["fields"]["90"].startswith("0200" + w["iso"]["request"]["fields"]["11"])
    assert r["iso"]["response"]["mti"] == "0410"


def test_repeat_reversal_is_0420(client):
    tok = login(client)["token"]
    w = client.post("/api/withdraw", headers=auth(tok), json={"amount": 100, "ledger": {"balance": 1000}, "cassettes": CASSETTES}).get_json()
    r = client.post("/api/reversal", json={"reversal_token": w["reversal_token"], "reason": "68", "ledger": w["ledger"], "repeat": True}).get_json()
    assert r["iso"]["request"]["mti"] == "0420" and r["iso"]["response"]["mti"] == "0430"


def test_reversal_of_cash_advance_reduces_debt(client):
    tok = login(client, "5400-3311", "2580")["token"]
    w = client.post("/api/withdraw", headers=auth(tok), json={"amount": 1000, "ledger": CREDIT, "cassettes": CASSETTES}).get_json()
    r = client.post("/api/reversal", json={"reversal_token": w["reversal_token"], "reason": "17", "ledger": w["ledger"]}).get_json()
    assert r["ledger"]["debt"] == CREDIT["debt"]


def test_reversal_bound_to_terminal(client):
    tok = login(client)["token"]
    w = client.post("/api/withdraw", headers=auth(tok), json={"amount": 100, "ledger": {"balance": 1000}, "cassettes": CASSETTES}).get_json()
    r = client.post("/api/reversal", json={"reversal_token": w["reversal_token"], "reason": "22", "ledger": w["ledger"], "terminal": ATLAS})
    assert r.get_json()["code"] == "05"


def test_settlement_fields(client):
    r = client.post("/api/settlement", json={"batch": 3, "totals": {"debits": {"count": 2, "amount": 700}, "credits": {"count": 1, "amount": 200}}}).get_json()
    f = r["iso"]["request"]["fields"]
    assert r["iso"]["request"]["mti"] == "0500"
    assert f["76"] == "0000000002" and f["97"] == "D" + f"{50000:016d}"


def withdraw_record(client, amount=500, terminal="ATM00684"):
    tok = client.post("/api/pin/verify", json={"card_id": "4543-0001", "pin": "1234", "tries": 0, "terminal": terminal}).get_json()["token"]
    return client.post("/api/withdraw", headers=auth(tok),
                       json={"amount": amount, "ledger": {"balance": 5000}, "cassettes": CASSETTES, "terminal": terminal}).get_json()


def test_settlement_matches_host_records(client):
    w = withdraw_record(client)
    r = client.post("/api/settlement", json={"batch": 3, "records": [w["record"]],
                                             "totals": {"debits": {"count": 1, "amount": 500}, "credits": {}}}).get_json()
    assert r["approved"] and r["batch"] == 4 and r["settled_ids"] == [w["record"]["id"]]
    assert r["iso"]["response"]["fields"]["39"] == "00"


def test_settlement_mismatch_until_reversal_arrives(client):
    # Yanıtı kaybolan çekim: host borçladı, ATM para vermedi ve saymadı, iptal SAF kuyruğunda
    w = withdraw_record(client)
    totals = {"debits": {"count": 0, "amount": 0}, "credits": {}}
    r = client.post("/api/settlement", json={"batch": 3, "records": [w["record"]], "totals": totals}).get_json()
    assert not r["approved"] and r["code"] == "95" and r["batch"] == 3
    assert r["reconciliation"]["diff"]["debits"] == {"count": -1, "amount": -500}
    rev = client.post("/api/reversal", json={"reversal_token": w["reversal_token"], "reason": "68",
                                             "ledger": w["ledger"], "repeat": True}).get_json()
    r = client.post("/api/settlement", json={"batch": 3, "records": [w["record"], rev["record"]], "totals": totals}).get_json()
    assert r["approved"] and r["batch"] == 4


def test_settlement_ignores_forged_records(client):
    w = withdraw_record(client)
    forged = {**w["record"], "token": w["record"]["token"][:-4] + "AAAA"}
    r = client.post("/api/settlement", json={"batch": 1, "records": [forged],
                                             "totals": {"debits": {"count": 1, "amount": 500}, "credits": {}}}).get_json()
    assert r["code"] == "95"


def test_clearing_bkm_positions_and_reversal(client):
    off_us = withdraw_record(client, 1000, ATLAS)  # Demo Bank kartı, Atlas Bank ATM'si
    on_us = withdraw_record(client, 200)
    r = client.post("/api/clearing", json={"records": [off_us["record"], on_us["record"]]}).get_json()
    assert r["bkm"] == [{"issuer": "00061", "issuer_name": "Demo Bank", "acquirer": "00099", "acquirer_name": "Atlas Bank",
                         "count": 1, "amount": 1000.0, "fee": 25.0}]
    net = {p["bank"]: p["net"] for p in r["positions"]}
    assert net["00061"] == -1025 and net["00099"] == 1025
    # Takastan sonra gelen iptal bir sonraki oturumda ters kayıt olarak girer
    rev = client.post("/api/reversal", json={"reversal_token": off_us["reversal_token"], "reason": "68",
                                             "ledger": off_us["ledger"], "terminal": ATLAS}).get_json()
    r = client.post("/api/clearing", json={"records": [rev["record"]]}).get_json()
    assert r["bkm"][0]["count"] == -1 and {p["bank"]: p["net"] for p in r["positions"]}["00099"] == -1025


def test_clearing_releases_queued_eft_and_clears_cheques(client):
    tok = host.issue_token("4543-0001")
    eft = host.transfer(tok, ELIF, host.FAST_LIMIT + 1, {"balance": 100_000}, "ATM00684", now=datetime(2026, 10, 31, 11, 0))
    assert eft["queued"] and eft["recipient_card"] is None
    good = client.post("/api/cheque", headers=auth(tok), json={"amount": 750, "cheque_no": "1234561"}).get_json()
    bad = client.post("/api/cheque", headers=auth(tok), json={"amount": 300, "cheque_no": "1234569"}).get_json()
    r = client.post("/api/clearing", json={"records": [eft["record"], good["record"], bad["record"]]}).get_json()
    assert r["payments"][0]["method"] == "eft" and r["payments"][0]["released"] == 1
    assert [c["status"] for c in r["cheques"]] == ["Karşılıklı", "Karşılıksız"]
    assert {(p["card"], p["amount"]) for p in r["postings"]} == {("5170-7788", host.FAST_LIMIT + 1), ("4543-0001", 750)}
