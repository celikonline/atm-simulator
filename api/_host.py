r"""
ATM Host Simülatörü
====================

Gerçek bir banka ortamında ATM'nin konuştuğu arka uç zincirini taklit eder:

    ATM uygulaması -> ATM Switch -> (BKM) -> InterAPI -> Core Banking
                                  \-> HSM (PIN doğrulama)
                                  \-> Fraud izleme

Vercel fonksiyonları stateless (durumsuz) olduğu için hesap bakiyeleri ve
kaset durumları istemcide tutulur ve her istekte gönderilir. Host bunları
"bankanın defteri" gibi doğrular, kuralları uygular ve yeni durumu döner.
Oturum, HMAC ile imzalı bir token ile taşınır; PIN'ler yalnızca hash olarak
burada bulunur.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import random
import time
from datetime import datetime, timezone

SECRET = os.environ.get("SESSION_SECRET", "dev-only-secret-change-me").encode()
SESSION_TTL = 300  # saniye
DAILY_LIMIT = 10_000
MAX_PIN_TRIES = 3
DENOMS = [200, 100, 50, 20, 10, 5]
DISPENSE_DENOMS = [200, 100, 50, 20]


def _pin_hash(card_id: str, pin: str) -> str:
    return hashlib.sha256(f"{card_id}:{pin}:demo-salt".encode()).hexdigest()


# Demo kart veritabanı. PIN'ler yalnızca hash olarak tutulur.
CARDS = {
    "4543-0001": {
        "holder": "AYŞE YILMAZ",
        "pan_masked": "4543 •••• •••• 0001",
        "scheme": "VISA",
        "issuer": "own",
        "pin_hash": _pin_hash("4543-0001", "1234"),
        "account": "TR33 0006 1005 1978 6457 8413 26",
    },
    "9792-0042": {
        "holder": "MEHMET KAYA",
        "pan_masked": "9792 •••• •••• 0042",
        "scheme": "TROY",
        "issuer": "own",
        "pin_hash": _pin_hash("9792-0042", "4321"),
        "account": "TR21 0006 1005 1978 1122 3344 55",
    },
    "5170-7788": {
        "holder": "ELİF DEMİR",
        "pan_masked": "5170 •••• •••• 7788",
        "scheme": "MASTERCARD",
        "issuer": "other",  # başka banka kartı -> BKM üzerinden
        "pin_hash": _pin_hash("5170-7788", "0000"),
        "account": "Başka banka hesabı",
    },
}

BILLERS = {
    "elektrik": "Elektrik Dağıtım A.Ş.",
    "su": "İSKİ Su İdaresi",
    "dogalgaz": "İGDAŞ Doğalgaz",
    "gsm": "GSM Operatörü",
}

RESPONSE_TEXT = {
    "00": "Onaylandı",
    "05": "İşlem reddedildi",
    "13": "Geçersiz tutar",
    "14": "Geçersiz kart",
    "51": "Yetersiz bakiye",
    "54": "Oturum süresi doldu",
    "55": "Hatalı PIN",
    "61": "Günlük çekim limiti aşıldı",
    "75": "PIN deneme sayısı aşıldı, kart bloke",
    "86": "Banknot dağıtılamıyor (kaset yetersiz)",
    "91": "Kurum sistemine ulaşılamıyor",
}


class HostError(Exception):
    def __init__(self, code: str, message: str | None = None):
        self.code = code
        self.message = message or RESPONSE_TEXT.get(code, "Bilinmeyen hata")
        super().__init__(self.message)


# --------------------------------------------------------------------------- #
# Yardımcılar
# --------------------------------------------------------------------------- #

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token(card_id: str) -> str:
    payload = _b64(json.dumps({"card": card_id, "exp": int(time.time()) + SESSION_TTL}).encode())
    sig = _b64(hmac.new(SECRET, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_token(token: str | None) -> str:
    if not token or "." not in token:
        raise HostError("54")
    payload, sig = token.split(".", 1)
    expected = _b64(hmac.new(SECRET, payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        raise HostError("54", "Oturum doğrulanamadı")
    data = json.loads(_unb64(payload))
    if data["exp"] < time.time():
        raise HostError("54")
    return data["card"]


def _stan() -> str:
    return f"{random.randint(0, 999_999):06d}"


def _rrn() -> str:
    return datetime.now(timezone.utc).strftime("%y%j%H") + f"{random.randint(0, 99_999):05d}"


def _amount_field(amount: float) -> str:
    """ISO 8583 alan 4: 12 hane, kuruş cinsinden."""
    return f"{int(round(amount * 100)):012d}"


def _iso(mti: str, fields: dict) -> dict:
    return {"mti": mti, "fields": fields}


def _route(card: dict, extra: list[dict] | None = None) -> list[dict]:
    """İşlemin host tarafında izlediği yolu (trace) üretir."""
    hops = [{"from": "atm", "to": "switch", "proto": "NDC / ISO 8583 · TLS 1.2", "ms": random.randint(18, 40)}]
    if card["issuer"] == "other":
        hops.append({"from": "switch", "to": "bkm", "proto": "ISO 8583 · BKM hattı", "ms": random.randint(40, 90)})
        hops.append({"from": "bkm", "to": "issuer", "proto": "Kartı çıkaran banka", "ms": random.randint(60, 120)})
        return hops  # PIN, bakiye ve provizyon karşı bankada yapılır
    hops.append({"from": "switch", "to": "interapi", "proto": "REST/JSON · mTLS", "ms": random.randint(8, 20)})
    hops.extend(extra or [])
    return hops


def _get_card(card_id: str) -> dict:
    card = CARDS.get(card_id)
    if not card:
        raise HostError("14")
    return card


def _public_card(card_id: str) -> dict:
    c = CARDS[card_id]
    return {k: c[k] for k in ("holder", "pan_masked", "scheme", "issuer", "account")} | {"id": card_id}


def _base_fields(card: dict, terminal: str, processing: str, amount: float = 0) -> dict:
    now = datetime.now()
    return {
        "2": card["pan_masked"].replace(" ", ""),
        "3": processing,
        "4": _amount_field(amount),
        "7": now.strftime("%m%d%H%M%S"),
        "11": _stan(),
        "12": now.strftime("%H%M%S"),
        "13": now.strftime("%m%d"),
        "41": terminal,
        "49": "949",  # TRY
    }


# --------------------------------------------------------------------------- #
# İş kuralları
# --------------------------------------------------------------------------- #

def plan_dispense(amount: int, cassettes: dict[str, int]) -> dict[int, int] | None:
    """
    Kasetlerdeki adetleri dikkate alarak tutarı banknotlara böler.
    Büyük banknottan başlayan açgözlü yaklaşım, olmazsa geri izleme (backtracking).
    """
    stock = {d: int(cassettes.get(str(d), 0)) for d in DISPENSE_DENOMS}

    def solve(i: int, remaining: int) -> dict[int, int] | None:
        if remaining == 0:
            return {}
        if i == len(DISPENSE_DENOMS):
            return None
        d = DISPENSE_DENOMS[i]
        for n in range(min(remaining // d, stock[d]), -1, -1):
            rest = solve(i + 1, remaining - n * d)
            if rest is not None:
                return ({d: n} if n else {}) | rest
        return None

    return solve(0, amount)


def card_info(card_id: str) -> dict:
    card = _get_card(card_id)
    return {"card": _public_card(card_id), "chip": {"aid": "A0000000031010" if card["scheme"] == "VISA" else "A0000006723010", "emv": "EMV L2 · çip okundu"}}


def verify_pin(card_id: str, pin: str, tries: int, terminal: str) -> dict:
    card = _get_card(card_id)
    fields = _base_fields(card, terminal, "310000")
    fields["52"] = "•••••••••••••••• (EPP'de 3DES/AES ile şifreli PIN bloğu)"
    extra = [{"from": "interapi", "to": "hsm", "proto": "PIN doğrulama · HSM", "ms": random.randint(4, 12)}]
    trace = _route(card, extra)

    if tries >= MAX_PIN_TRIES:
        raise HostError("75")
    ok = hmac.compare_digest(_pin_hash(card_id, pin), card["pin_hash"])
    code = "00" if ok else ("75" if tries + 1 >= MAX_PIN_TRIES else "55")
    resp = {"39": code, "37": _rrn(), "38": f"{random.randint(0, 999_999):06d}" if ok else ""}
    result = {
        "approved": ok,
        "code": code,
        "message": RESPONSE_TEXT[code],
        "tries_left": max(0, MAX_PIN_TRIES - (tries + (0 if ok else 1))),
        "trace": trace,
        "iso": {"request": _iso("0100", fields), "response": _iso("0110", resp)},
    }
    if ok:
        result["token"] = issue_token(card_id)
    return result


def balance(token: str, ledger: dict, terminal: str) -> dict:
    card_id = verify_token(token)
    card = _get_card(card_id)
    bal = float(ledger.get("balance", 0))
    fields = _base_fields(card, terminal, "310000")
    trace = _route(card, [{"from": "interapi", "to": "core", "proto": "Bakiye sorgu", "ms": random.randint(15, 35)}])
    return {
        "approved": True,
        "code": "00",
        "message": RESPONSE_TEXT["00"],
        "balance": bal,
        "available": bal,
        "trace": trace,
        "iso": {"request": _iso("0100", fields), "response": _iso("0110", {"39": "00", "37": _rrn(), "54": f"1002949C{_amount_field(bal)}"})},
    }


def withdraw(token: str, amount: int, ledger: dict, cassettes: dict, terminal: str) -> dict:
    card_id = verify_token(token)
    card = _get_card(card_id)
    fields = _base_fields(card, terminal, "010000", amount)
    extra = [
        {"from": "interapi", "to": "fraud", "proto": "Risk skoru", "ms": random.randint(5, 15)},
        {"from": "interapi", "to": "core", "proto": "Provizyon + borç kaydı", "ms": random.randint(20, 45)},
    ]
    trace = _route(card, extra)
    bal = float(ledger.get("balance", 0))
    withdrawn = float(ledger.get("daily_withdrawn", 0))

    def fail(code):
        return {"approved": False, "code": code, "message": RESPONSE_TEXT[code], "trace": trace,
                "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": code, "37": _rrn()})}}

    if amount <= 0 or amount % 10:
        return fail("13")
    if amount > bal:
        return fail("51")
    if withdrawn + amount > DAILY_LIMIT:
        return fail("61")
    plan = plan_dispense(amount, cassettes)
    if plan is None:
        return fail("86")

    new_cassettes = {str(d): int(cassettes.get(str(d), 0)) - plan.get(d, 0) for d in DISPENSE_DENOMS}
    auth = f"{random.randint(0, 999_999):06d}"
    return {
        "approved": True,
        "code": "00",
        "message": RESPONSE_TEXT["00"],
        "notes": {str(k): v for k, v in plan.items()},
        "ledger": {"balance": bal - amount, "daily_withdrawn": withdrawn + amount},
        "cassettes": new_cassettes,
        "auth_code": auth,
        "trace": trace,
        "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "00", "37": _rrn(), "38": auth})},
    }


def deposit(token: str, notes: dict, suspect: int, ledger: dict, cassettes: dict, terminal: str) -> dict:
    card_id = verify_token(token)
    card = _get_card(card_id)
    accepted = {str(d): int(notes.get(str(d), 0)) for d in DENOMS if int(notes.get(str(d), 0)) > 0}
    amount = sum(int(d) * n for d, n in accepted.items())
    fields = _base_fields(card, terminal, "210000", amount)
    trace = _route(card, [{"from": "interapi", "to": "core", "proto": "Alacak kaydı", "ms": random.randint(20, 40)}])
    if amount <= 0:
        return {"approved": False, "code": "13", "message": RESPONSE_TEXT["13"], "trace": trace,
                "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "13"})}}
    new_cassettes = dict(cassettes)
    for d, n in accepted.items():
        if int(d) in DISPENSE_DENOMS:  # recycler: bu banknotlar tekrar dağıtılabilir
            new_cassettes[d] = int(new_cassettes.get(d, 0)) + n
    bal = float(ledger.get("balance", 0))
    return {
        "approved": True,
        "code": "00",
        "message": RESPONSE_TEXT["00"],
        "amount": amount,
        "accepted": accepted,
        "retained_suspect": suspect,
        "ledger": {**ledger, "balance": bal + amount},
        "cassettes": new_cassettes,
        "trace": trace,
        "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "00", "37": _rrn()})},
    }


def bill_inquiry(token: str, biller: str, subscriber: str, terminal: str) -> dict:
    card_id = verify_token(token)
    card = _get_card(card_id)
    if biller not in BILLERS or not subscriber.isdigit() or len(subscriber) < 6:
        raise HostError("13", "Kurum veya abone numarası geçersiz")
    trace = _route(card, [{"from": "interapi", "to": "biller", "proto": "Fatura sorgu · kurum API", "ms": random.randint(60, 140)}])
    seed = sum(ord(c) for c in biller + subscriber)
    rnd = random.Random(seed)
    amount = round(rnd.uniform(180, 1450), 2)
    return {
        "approved": True,
        "code": "00",
        "message": "Borç bulundu",
        "biller": BILLERS[biller],
        "subscriber": subscriber,
        "amount": amount,
        "due": f"{rnd.randint(1, 28):02d}.11.2026",
        "trace": trace,
    }


def bill_pay(token: str, biller: str, subscriber: str, amount: float, ledger: dict, terminal: str) -> dict:
    card_id = verify_token(token)
    card = _get_card(card_id)
    fields = _base_fields(card, terminal, "500000", amount)
    trace = _route(card, [
        {"from": "interapi", "to": "core", "proto": "Hesaptan borç", "ms": random.randint(20, 40)},
        {"from": "interapi", "to": "biller", "proto": "Tahsilat bildirimi", "ms": random.randint(60, 140)},
    ])
    bal = float(ledger.get("balance", 0))
    if amount > bal:
        return {"approved": False, "code": "51", "message": RESPONSE_TEXT["51"], "trace": trace,
                "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "51"})}}
    return {
        "approved": True,
        "code": "00",
        "message": "Fatura ödendi",
        "biller": BILLERS.get(biller, biller),
        "ledger": {**ledger, "balance": round(bal - amount, 2)},
        "trace": trace,
        "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "00", "37": _rrn()})},
    }


def cheque(token: str, amount: float, cheque_no: str, terminal: str) -> dict:
    card_id = verify_token(token)
    card = _get_card(card_id)
    if amount <= 0 or not cheque_no.isdigit():
        raise HostError("13", "Çek tutarı veya numarası geçersiz")
    trace = _route(card, [
        {"from": "interapi", "to": "core", "proto": "Çek görüntüsü + MICR", "ms": random.randint(80, 160)},
    ])
    return {
        "approved": True,
        "code": "00",
        "message": "Çek alındı, takas sonrası hesaba geçecek",
        "micr": f"⑈{cheque_no}⑈ ⑆0006100⑆ 12345678⑈",
        "status": "Takasa gönderildi",
        "trace": trace,
    }
