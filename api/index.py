"""
Vercel Python fonksiyonu: tüm /api/* istekleri buraya yönlenir (vercel.json).
Yerelde: `python api/index.py` -> http://localhost:5328
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request  # noqa: E402

import _host as host  # noqa: E402

app = Flask(__name__)


def body() -> dict:
    return request.get_json(silent=True) or {}


def token() -> str | None:
    auth = request.headers.get("Authorization", "")
    return auth.removeprefix("Bearer ").strip() or None


def terminal() -> str:
    return body().get("terminal", "ATM00684")


@app.errorhandler(host.HostError)
def host_error(err: host.HostError):
    status = 401 if err.code == "54" else 400
    return jsonify({"approved": False, "code": err.code, "message": err.message}), status


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "atm-host-simulator"})


@app.get("/api/cards")
def cards():
    return jsonify([host._public_card(cid) for cid in host.CARDS])


@app.post("/api/card/read")
def card_read():
    return jsonify(host.card_info(body().get("card_id", "")))


@app.post("/api/pin/verify")
def pin_verify():
    b = body()
    return jsonify(host.verify_pin(b.get("card_id", ""), str(b.get("pin", "")), int(b.get("tries", 0)), terminal()))


@app.post("/api/balance")
def balance():
    return jsonify(host.balance(token(), body().get("ledger", {}), terminal()))


@app.post("/api/withdraw")
def withdraw():
    b = body()
    return jsonify(host.withdraw(token(), int(b.get("amount", 0)), b.get("ledger", {}), b.get("cassettes", {}), terminal()))


@app.post("/api/deposit")
def deposit():
    b = body()
    return jsonify(host.deposit(token(), b.get("notes", {}), int(b.get("suspect", 0)), b.get("ledger", {}), b.get("cassettes", {}), terminal()))


@app.post("/api/bill/inquiry")
def bill_inquiry():
    b = body()
    return jsonify(host.bill_inquiry(token(), b.get("biller", ""), str(b.get("subscriber", "")), terminal()))


@app.post("/api/bill/pay")
def bill_pay():
    b = body()
    return jsonify(host.bill_pay(token(), b.get("biller", ""), str(b.get("subscriber", "")), float(b.get("amount", 0)), b.get("ledger", {}), terminal()))


@app.post("/api/cheque")
def cheque():
    b = body()
    return jsonify(host.cheque(token(), float(b.get("amount", 0)), str(b.get("cheque_no", "")), terminal()))


if __name__ == "__main__":
    app.run(port=5328, debug=True)
