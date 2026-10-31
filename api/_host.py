r"""
ATM Host Simülatörü
====================

Gerçek bir banka ortamında ATM'nin konuştuğu arka uç zincirini taklit eder:

    ATM uygulaması -> ATM Switch -> (BKM) -> InterAPI -> Core Banking
                                  \-> HSM (PIN doğrulama)
                                  \-> Fraud izleme
    Mobil uygulama ------------------------> InterAPI   (kartsız QR onayı)

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
import secrets
import time
from datetime import datetime, timezone

SECRET = os.environ.get("SESSION_SECRET", "dev-only-secret-change-me").encode()
SESSION_TTL = 300  # saniye
QR_TTL = 120  # ekrandaki QR ve mobil onayın geçerlilik süresi (saniye)
REVERSAL_TTL = 24 * 3600  # bekleyen iptal mesajı bu süre içinde tekrar gönderilebilir
RECORD_TTL = 7 * 24 * 3600  # host defter kaydı bu süre içinde gün sonu / takasa girebilir
DAILY_LIMIT = 10_000
MAX_PIN_TRIES = 3
DENOMS = [200, 100, 50, 20, 10, 5]
DISPENSE_DENOMS = [200, 100, 50, 20]

# Ücret ve limitler demo değerlerdir, gerçek tarifeleri yansıtmaz.
OFF_US_FEES = {"withdraw": 25.0, "balance": 3.0}  # başka banka ATM'si kullanım ücreti
TRANSFER_FEES = {"havale": 0.0, "fast": 5.0, "eft": 15.0}
FAST_LIMIT = 50_000  # üstü EFT ile gider
EFT_HOURS = (9, 17)  # hafta içi, yerel saat


def _pin_hash(card_id: str, pin: str) -> str:
    return hashlib.sha256(f"{card_id}:{pin}:demo-salt".encode()).hexdigest()


def _iban(bank_code: str, account: str) -> str:
    """TR IBAN üretir: TR + kontrol + 5 hane banka kodu + 0 + 16 hane hesap (ISO 13616, mod 97)."""
    bban = f"{bank_code}0{account}"
    check = 98 - int(bban + "292700") % 97  # T=29, R=27
    return f"TR{check:02d}{bban}"


def _iban_valid(iban: str) -> bool:
    if len(iban) != 26 or not iban.startswith("TR") or not iban[2:].isdigit():
        return False
    return int(iban[4:] + "2927" + iban[2:4]) % 97 == 1


BANKS = {"00061": "Demo Bank", "00099": "Atlas Bank", "00123": "Marmara Bank"}
# Terminal kimliği hangi bankanın (acquirer) ATM'si olduğunu belirler.
TERMINALS = {"ATM00684": "00061", "ATM77120": "00099"}

# Demo kart veritabanı. PIN'ler yalnızca hash olarak tutulur.
CARDS = {
    "4543-0001": {
        "holder": "AYŞE YILMAZ",
        "pan_masked": "4543 •••• •••• 0001",
        "scheme": "VISA",
        "type": "debit",
        "bank": "00061",
        "pin_hash": _pin_hash("4543-0001", "1234"),
        "account": _iban("00061", "0000001978645784"),
    },
    "9792-0042": {
        "holder": "MEHMET KAYA",
        "pan_masked": "9792 •••• •••• 0042",
        "scheme": "TROY",
        "type": "debit",
        "bank": "00061",
        "pin_hash": _pin_hash("9792-0042", "4321"),
        "account": _iban("00061", "0000001978112233"),
    },
    "5170-7788": {
        "holder": "ELİF DEMİR",
        "pan_masked": "5170 •••• •••• 7788",
        "scheme": "MASTERCARD",
        "type": "debit",
        "bank": "00099",  # Atlas Bank kartı: Demo Bank ATM'sinde BKM üzerinden
        "pin_hash": _pin_hash("5170-7788", "0000"),
        "account": _iban("00099", "0000004410278100"),
    },
    "5400-3311": {
        "holder": "AYŞE YILMAZ",
        "pan_masked": "5400 •••• •••• 3311",
        "scheme": "MASTERCARD",
        "type": "credit",
        "bank": "00061",
        "pin_hash": _pin_hash("5400-3311", "2580"),
        "account": "Demo Bank Kredi Kartı",
    },
}

# Transferde alıcı olarak seçilebilen hesaplar (IBAN -> sahibi). Kart sahiplerine ek olarak
# cüzdanda kartı olmayan bir kurumsal alıcı vardır.
RECIPIENTS = {c["account"]: {"name": c["holder"], "card": cid}
              for cid, c in CARDS.items() if c["type"] == "debit"}
RECIPIENTS[_iban("00123", "0000000052001907")] = {"name": "DENİZ YAPI A.Ş.", "card": None}

for _cid, _card in CARDS.items():
    _card["id"] = _cid

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
    "33": "QR kodun süresi doldu",
    "51": "Yetersiz bakiye",
    "54": "Oturum süresi doldu",
    "55": "Hatalı PIN",
    "57": "Bu işlem müşteriye kapalı",
    "58": "Bu işlem bu terminalde yapılamaz",
    "61": "Günlük çekim limiti aşıldı",
    "75": "PIN deneme sayısı aşıldı, kart bloke",
    "86": "Banknot dağıtılamıyor (kaset yetersiz)",
    "91": "Kurum sistemine ulaşılamıyor",
    "95": "Mutabakat farkı",
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


def _sign(data: dict) -> str:
    payload = _b64(json.dumps(data).encode())
    sig = _b64(hmac.new(SECRET, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def _unsign(token: str | None, typ: str, expired_code: str) -> dict:
    """İmzayı ve türü doğrular; süresi geçmişse `expired_code` ile reddeder."""
    if not token or "." not in token:
        raise HostError(expired_code)
    payload, sig = token.split(".", 1)
    expected = _b64(hmac.new(SECRET, payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        raise HostError(expired_code, "İmza doğrulanamadı")
    data = json.loads(_unb64(payload))
    if data.get("typ") != typ:
        raise HostError(expired_code, "Geçersiz token türü")
    if data["exp"] < time.time():
        raise HostError(expired_code)
    return data


def _record(kind: str, **data) -> dict:
    """Hostun kendi defterine yazdığı kayıt. Host durumsuz olduğu için kayıt imzalanıp istemcide
    saklanır; gün sonu ve takasta geri gelir, host yalnızca imzası tutan kayıtlara güvenir."""
    rec = {"kind": kind, "ts": int(time.time()), **data}
    return {**rec, "token": _sign({"typ": "record", **rec, "exp": int(time.time()) + RECORD_TTL})}


def _records(items: list | None) -> list[dict]:
    out, seen = [], set()
    for item in items or []:
        try:
            data = _unsign(item.get("token") if isinstance(item, dict) else item, "record", "05")
        except (HostError, ValueError, KeyError):
            continue  # imzası tutmayan ya da süresi geçen kayıt yok sayılır
        if data["id"] not in seen:
            seen.add(data["id"])
            out.append(data)
    return out


def issue_token(card_id: str) -> str:
    return _sign({"typ": "session", "card": card_id, "exp": int(time.time()) + SESSION_TTL})


def verify_token(token: str | None) -> str:
    return _unsign(token, "session", "54")["card"]


def _stan() -> str:
    return f"{random.randint(0, 999_999):06d}"


def _rrn() -> str:
    return datetime.now(timezone.utc).strftime("%y%j%H") + f"{random.randint(0, 99_999):05d}"


def _amount_field(amount: float) -> str:
    """ISO 8583 alan 4: 12 hane, kuruş cinsinden."""
    return f"{int(round(amount * 100)):012d}"


def _iso(mti: str, fields: dict) -> dict:
    return {"mti": mti, "fields": fields}


def _terminal_bank(terminal: str) -> str:
    return TERMINALS.get(terminal, "00061")


def _on_us(card: dict, terminal: str) -> bool:
    """Kart, ATM'nin sahibi olan bankaya mı ait (on-us), yoksa başka bankanın mı (not-on-us)?"""
    return card["bank"] == _terminal_bank(terminal)


def _require_on_us(card: dict, terminal: str) -> None:
    if not _on_us(card, terminal):
        raise HostError("58", "Bu işlem yalnızca kartınızın bankasına ait ATM'lerde yapılabilir")


def _route(card: dict, terminal: str, extra: list[dict] | None = None) -> list[dict]:
    """İşlemin host tarafında izlediği yolu (trace) üretir."""
    hops = [{"from": "atm", "to": "switch", "proto": "NDC / ISO 8583 · TLS 1.2", "ms": random.randint(18, 40)}]
    if not _on_us(card, terminal):
        hops.append({"from": "switch", "to": "bkm", "proto": "ISO 8583 · BKM hattı", "ms": random.randint(40, 90)})
        hops.append({"from": "bkm", "to": "issuer", "proto": f"Kartı çıkaran banka · {BANKS[card['bank']]}", "ms": random.randint(60, 120)})
        return hops  # PIN, bakiye ve provizyon kartı çıkaran bankada yapılır
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
    return {k: c[k] for k in ("holder", "pan_masked", "scheme", "type", "bank", "account")} | {
        "id": card_id,
        "bank_name": BANKS[c["bank"]],
    }


def _fee_field(fee: float) -> str:
    """ISO 8583 alan 28: işlem ücreti, D (borç) + 8 hane kuruş."""
    return f"D{int(round(fee * 100)):08d}"


def _available(card: dict, ledger: dict) -> float:
    """Banka kartında hesap bakiyesi, kredi kartında kullanılabilir limit."""
    if card["type"] == "credit":
        return float(ledger.get("limit", 0)) - float(ledger.get("debt", 0))
    return float(ledger.get("balance", 0))


def _charge(card: dict, ledger: dict, amount: float) -> dict:
    """Tutarı hesaptan düşer ya da kredi kartı borcuna ekler."""
    if card["type"] == "credit":
        return {**ledger, "debt": round(float(ledger.get("debt", 0)) + amount, 2)}
    return {**ledger, "balance": round(float(ledger.get("balance", 0)) - amount, 2)}


def _account_type(card: dict) -> str:
    """İşlem kodunun (alan 3) hesap türü haneleri: 00 vadesiz, 30 kredi kartı."""
    return "30" if card["type"] == "credit" else "00"


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


AIDS = {"VISA": "A0000000031010", "MASTERCARD": "A0000000041010", "TROY": "A0000006723010"}


def _require_debit(card: dict) -> None:
    if card["type"] != "debit":
        raise HostError("57", "Bu işlem kredi kartıyla yapılamaz")


def _fail(code: str, trace: list[dict], fields: dict | None = None, mti: str = "0200") -> dict:
    result = {"approved": False, "code": code, "message": RESPONSE_TEXT[code], "trace": trace}
    if fields is not None:
        resp_mti = f"{int(mti) + 10:04d}"
        result["iso"] = {"request": _iso(mti, fields), "response": _iso(resp_mti, {"39": code, "37": _rrn()})}
    return result


def card_info(card_id: str) -> dict:
    card = _get_card(card_id)
    return {"card": _public_card(card_id), "chip": {"aid": AIDS[card["scheme"]], "emv": "EMV L2 · çip okundu"}}


def verify_pin(card_id: str, pin: str, tries: int, terminal: str) -> dict:
    card = _get_card(card_id)
    fields = _base_fields(card, terminal, "31" + _account_type(card) + "00")
    fields["52"] = "•••••••••••••••• (EPP'de 3DES/AES ile şifreli PIN bloğu)"
    extra = [{"from": "interapi", "to": "hsm", "proto": "PIN doğrulama · HSM", "ms": random.randint(4, 12)}]
    trace = _route(card, terminal, extra)

    if tries >= MAX_PIN_TRIES:
        raise HostError("75")
    ok = hmac.compare_digest(_pin_hash(card_id, pin), card["pin_hash"])
    code = "00" if ok else ("75" if tries + 1 >= MAX_PIN_TRIES else "55")
    resp = {"39": code, "37": _rrn(), "38": f"{random.randint(0, 999_999):06d}" if ok else ""}
    on_us = _on_us(card, terminal)
    result = {
        "approved": ok,
        "code": code,
        "message": RESPONSE_TEXT[code],
        "tries_left": max(0, MAX_PIN_TRIES - (tries + (0 if ok else 1))),
        "on_us": on_us,
        "fees": {} if on_us else OFF_US_FEES,
        "trace": trace,
        "iso": {"request": _iso("0100", fields), "response": _iso("0110", resp)},
    }
    if ok:
        result["token"] = issue_token(card_id)
    return result


def balance(token: str, ledger: dict, terminal: str) -> dict:
    card = _get_card(verify_token(token))
    credit = card["type"] == "credit"
    fee = 0.0 if _on_us(card, terminal) else OFF_US_FEES["balance"]
    fields = _base_fields(card, terminal, "31" + _account_type(card) + "00")
    if fee:
        fields["28"] = _fee_field(fee)
    hop = {"from": "interapi", "to": "cards" if credit else "core",
           "proto": "Limit / borç sorgu" if credit else "Bakiye sorgu", "ms": random.randint(15, 35)}
    trace = _route(card, terminal, [hop])
    if fee > _available(card, ledger):
        return _fail("51", trace, fields, "0100")
    new_ledger = _charge(card, ledger, fee) if fee else ledger
    avail = _available(card, new_ledger)
    rrn = _rrn()
    result = {
        "approved": True,
        "code": "00",
        "message": RESPONSE_TEXT["00"],
        "balance": avail,
        "available": avail,
        "fee": fee,
        "ledger": new_ledger,
        "trace": trace,
        "iso": {"request": _iso("0100", fields), "response": _iso("0110", {"39": "00", "37": rrn, "54": f"10{_account_type(card)}949C{_amount_field(avail)}"})},
    }
    if fee:
        result["record"] = _record("fee", id=rrn, terminal=terminal, card=card["id"], issuer=card["bank"],
                                   acquirer=_terminal_bank(terminal), amount=0, fee=fee)
    if credit:
        result["credit"] = {k: new_ledger.get(k) for k in ("limit", "debt", "statement", "minimum", "due")}
    return result


def _withdraw_check(amount: int, available: float, ledger: dict, fee: float = 0.0) -> str | None:
    """Tutar, bakiye/limit ve günlük limit kuralları; uygunsa None, değilse yanıt kodu."""
    if amount <= 0 or amount % 10:
        return "13"
    if amount + fee > available:
        return "51"
    if float(ledger.get("daily_withdrawn", 0)) + amount > DAILY_LIMIT:
        return "61"
    return None


def withdraw(token: str, amount: int, ledger: dict, cassettes: dict, terminal: str) -> dict:
    card = _get_card(verify_token(token))
    credit = card["type"] == "credit"
    extra = [
        {"from": "interapi", "to": "fraud", "proto": "Risk skoru", "ms": random.randint(5, 15)},
        {"from": "interapi", "to": "cards" if credit else "core",
         "proto": "Nakit avans provizyonu · limit" if credit else "Provizyon + borç kaydı", "ms": random.randint(20, 45)},
    ]
    return _withdraw(card, amount, ledger, cassettes, terminal, extra)


def _withdraw(card: dict, amount: int, ledger: dict, cassettes: dict, terminal: str,
              extra: list[dict], qr_ref: str | None = None) -> dict:
    # Kredi kartıyla çekim nakit avanstır: işlem kodunda hesap türü 30 (kredi)
    fee = 0.0 if _on_us(card, terminal) else OFF_US_FEES["withdraw"]
    fields = _base_fields(card, terminal, "01" + _account_type(card) + "00", amount)
    if fee:
        fields["28"] = _fee_field(fee)
    if qr_ref:
        fields["48"] = f"Kartsız işlem · QR {qr_ref}"
    trace = _route(card, terminal, extra)

    code = _withdraw_check(amount, _available(card, ledger), ledger, fee)
    if code:
        return _fail(code, trace, fields)
    plan = plan_dispense(amount, cassettes)
    if plan is None:
        return _fail("86", trace, fields)

    new_cassettes = {str(d): int(cassettes.get(str(d), 0)) - plan.get(d, 0) for d in DISPENSE_DENOMS}
    new_ledger = _charge(card, ledger, amount + fee)
    new_ledger["daily_withdrawn"] = float(ledger.get("daily_withdrawn", 0)) + amount
    auth = f"{random.randint(0, 999_999):06d}"
    rrn = _rrn()
    return {
        "approved": True,
        "code": "00",
        "message": RESPONSE_TEXT["00"],
        "notes": {str(k): v for k, v in plan.items()},
        "fee": fee,
        "ledger": new_ledger,
        "cassettes": new_cassettes,
        "auth_code": auth,
        # Para verilemezse ATM bu token ile 0400 iptal mesajı gönderir
        "reversal_token": _sign({
            "typ": "reversal", "card": card["id"], "terminal": terminal, "processing": fields["3"],
            "amount": amount, "fee": fee, "stan": fields["11"], "date": fields["13"], "rrn": rrn,
            "exp": int(time.time()) + REVERSAL_TTL,
        }),
        "record": _record("cash_out", id=rrn, terminal=terminal, card=card["id"], issuer=card["bank"],
                          acquirer=_terminal_bank(terminal), amount=amount, fee=fee),
        "trace": trace,
        "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "00", "37": rrn, "38": auth})},
    }


def deposit(token: str, notes: dict, suspect: int, ledger: dict, cassettes: dict, terminal: str) -> dict:
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    return _deposit(card, notes, suspect, ledger, cassettes, terminal)


def _deposit(card: dict, notes: dict, suspect: int, ledger: dict, cassettes: dict, terminal: str,
             qr_ref: str | None = None) -> dict:
    # Kredi kartıyla para yatırma, kart borcuna nakit ödemedir: alacak hesabı türü 30
    credit = card["type"] == "credit"
    accepted = {str(d): int(notes.get(str(d), 0)) for d in DENOMS if int(notes.get(str(d), 0)) > 0}
    amount = sum(int(d) * n for d, n in accepted.items())
    fields = _base_fields(card, terminal, "2100" + _account_type(card), amount)
    if qr_ref:
        fields["48"] = f"Kartsız işlem · QR {qr_ref}"
    trace = _route(card, terminal, [{"from": "interapi", "to": "cards" if credit else "core",
                                     "proto": "Kart borcuna nakit ödeme" if credit else "Alacak kaydı", "ms": random.randint(20, 40)}])
    if amount <= 0:
        return _fail("13", trace, fields)
    new_cassettes = dict(cassettes)
    for d, n in accepted.items():
        if int(d) in DISPENSE_DENOMS:  # recycler: bu banknotlar tekrar dağıtılabilir
            new_cassettes[d] = int(new_cassettes.get(d, 0)) + n
    rrn = _rrn()
    return {
        "approved": True,
        "code": "00",
        "message": RESPONSE_TEXT["00"],
        "amount": amount,
        "accepted": accepted,
        "retained_suspect": suspect,
        "ledger": _charge(card, ledger, -amount),
        "cassettes": new_cassettes,
        "record": _record("cash_in", id=rrn, terminal=terminal, card=card["id"], issuer=card["bank"],
                          acquirer=_terminal_bank(terminal), amount=amount, fee=0),
        "trace": trace,
        "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "00", "37": rrn})},
    }


def bill_inquiry(token: str, biller: str, subscriber: str, terminal: str) -> dict:
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    _require_debit(card)
    if biller not in BILLERS or not subscriber.isdigit() or len(subscriber) < 6:
        raise HostError("13", "Kurum veya abone numarası geçersiz")
    trace = _route(card, terminal, [{"from": "interapi", "to": "biller", "proto": "Fatura sorgu · kurum API", "ms": random.randint(60, 140)}])
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
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    _require_debit(card)
    fields = _base_fields(card, terminal, "500000", amount)
    trace = _route(card, terminal, [
        {"from": "interapi", "to": "core", "proto": "Hesaptan borç", "ms": random.randint(20, 40)},
        {"from": "interapi", "to": "biller", "proto": "Tahsilat bildirimi", "ms": random.randint(60, 140)},
    ])
    bal = float(ledger.get("balance", 0))
    if amount > bal:
        return _fail("51", trace, fields)
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
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    _require_debit(card)
    if amount <= 0 or not cheque_no.isdigit():
        raise HostError("13", "Çek tutarı veya numarası geçersiz")
    trace = _route(card, terminal, [
        {"from": "interapi", "to": "core", "proto": "Çek görüntüsü + MICR", "ms": random.randint(80, 160)},
    ])
    return {
        "approved": True,
        "code": "00",
        "message": "Çek alındı, takas sonrası hesaba geçecek",
        "micr": f"⑈{cheque_no}⑈ ⑆0006100⑆ 12345678⑈",
        "status": "Takasa gönderildi",
        "record": _record("cheque", id=_rrn(), terminal=terminal, card=card["id"], issuer=card["bank"],
                          amount=round(amount, 2), cheque_no=cheque_no),
        "trace": trace,
    }


# --------------------------------------------------------------------------- #
# Para transferi: havale / FAST / EFT
#
#   Aynı banka   -> havale: core banking içinde virman, anında.
#   Başka banka  -> FAST_LIMIT'e kadar FAST (TCMB, 7/24 anlık),
#                   üstü EFT (TCMB, yalnızca hafta içi mesai saatlerinde;
#                   dışında talimat kuyruğa alınır, ilk iş günü gönderilir).
# --------------------------------------------------------------------------- #

METHOD_TEXT = {"havale": "Havale", "fast": "FAST", "eft": "EFT"}


def _mask_name(name: str) -> str:
    return " ".join(w[0] + "*" * (len(w) - 1) for w in name.split())


def _eft_open(now: datetime) -> bool:
    return now.weekday() < 5 and EFT_HOURS[0] <= now.hour < EFT_HOURS[1]


def _transfer_quote(card: dict, iban: str, amount: float, now: datetime | None) -> dict:
    iban = iban.replace(" ", "").upper()
    if not _iban_valid(iban):
        raise HostError("14", "IBAN geçersiz (kontrol basamakları tutmuyor)")
    recipient = RECIPIENTS.get(iban)
    if not recipient:
        raise HostError("14", "Alıcı hesap bulunamadı")
    if iban == card["account"]:
        raise HostError("13", "Kendi hesabınıza transfer yapamazsınız")
    if amount <= 0:
        raise HostError("13")
    bank = iban[4:9]
    method = "havale" if bank == card["bank"] else "fast" if amount <= FAST_LIMIT else "eft"
    return {
        "iban": iban,
        "masked_name": _mask_name(recipient["name"]),
        "bank": BANKS.get(bank, bank),
        "method": method,
        "method_text": METHOD_TEXT[method],
        "fee": TRANSFER_FEES[method],
        "queued": method == "eft" and not _eft_open(now or datetime.now()),
        "recipient_card": recipient["card"],
    }


def transfer_inquiry(token: str, iban: str, amount: float, ledger: dict, terminal: str,
                     now: datetime | None = None) -> dict:
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    _require_debit(card)
    quote = _transfer_quote(card, iban, amount, now)
    hop = ({"from": "interapi", "to": "core", "proto": "Alıcı hesap sorgu", "ms": random.randint(10, 25)}
           if quote["method"] == "havale" else
           {"from": "interapi", "to": "fast", "proto": "Alıcı adı sorgu · karşı banka", "ms": random.randint(60, 120)})
    trace = _route(card, terminal, [hop])
    if amount + quote["fee"] > float(ledger.get("balance", 0)):
        return _fail("51", trace)
    quote.pop("recipient_card")
    return {"approved": True, "code": "00", "message": "Alıcı bulundu", **quote, "trace": trace}


def transfer(token: str, iban: str, amount: float, ledger: dict, terminal: str,
             now: datetime | None = None) -> dict:
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    _require_debit(card)
    quote = _transfer_quote(card, iban, amount, now)
    method, fee = quote["method"], quote["fee"]
    fields = _base_fields(card, terminal, "400000", amount)
    fields["103"] = quote["iban"]
    if fee:
        fields["28"] = _fee_field(fee)

    extra = [{"from": "interapi", "to": "fraud", "proto": "Risk skoru · alıcı ve tutar", "ms": random.randint(5, 15)}]
    if method == "havale":
        extra.append({"from": "interapi", "to": "core", "proto": "Virman · borç + alacak, anında", "ms": random.randint(20, 40)})
    else:
        extra.append({"from": "interapi", "to": "core", "proto": "Hesaptan borç", "ms": random.randint(20, 40)})
        if quote["queued"]:
            extra.append({"from": "interapi", "to": "fast", "proto": "EFT mesai dışı · talimat kuyruğa alındı", "ms": random.randint(10, 25)})
        else:
            proto = "FAST · ISO 20022 pacs.008 · anlık" if method == "fast" else "EFT · ISO 20022 pacs.008 · TCMB"
            extra.append({"from": "interapi", "to": "fast", "proto": proto, "ms": random.randint(40, 90)})
            extra.append({"from": "fast", "to": "issuer", "proto": f"Alıcı bankaya alacak · {quote['bank']}", "ms": random.randint(40, 90)})
    trace = _route(card, terminal, extra)

    bal = float(ledger.get("balance", 0))
    if amount + fee > bal:
        return _fail("51", trace, fields)
    rrn = _rrn()
    return {
        "approved": True,
        "code": "00",
        "message": "Transfer talimatı alındı" if quote["queued"] else "Transfer gerçekleşti",
        **quote,
        # Kuyruktaki EFT henüz alıcıya ulaşmadı; yalnızca gerçekleşen transfer alıcıya yazılır
        "recipient_card": None if quote["queued"] else quote["recipient_card"],
        "status": "İlk iş günü gönderilecek" if quote["queued"] else "Alıcı hesaba geçti",
        "ledger": {**ledger, "balance": round(bal - amount - fee, 2)},
        "record": _record("transfer", id=rrn, terminal=terminal, card=card["id"], issuer=card["bank"],
                          to_bank=quote["iban"][4:9], method=method, amount=round(amount, 2), fee=fee,
                          queued=quote["queued"], recipient_card=quote["recipient_card"]),
        "trace": trace,
        "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "00", "37": rrn})},
    }


# --------------------------------------------------------------------------- #
# Kredi kartı borcu: banka kartıyla hesaptan ödeme
# (Kredi kartının kendisiyle nakit avans ve nakit ödeme withdraw / deposit içinde.)
# --------------------------------------------------------------------------- #

def _owned_credit_card(card: dict, credit_card_id: str) -> dict:
    cc = CARDS.get(credit_card_id)
    if not cc or cc["type"] != "credit" or cc["holder"] != card["holder"] or cc["bank"] != card["bank"]:
        raise HostError("14", "Size ait kredi kartı bulunamadı")
    return cc


def credit_inquiry(token: str, credit_card_id: str, credit_ledger: dict, terminal: str) -> dict:
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    _require_debit(card)
    cc = _owned_credit_card(card, credit_card_id)
    trace = _route(card, terminal, [{"from": "interapi", "to": "cards", "proto": "Kart borç sorgu", "ms": random.randint(15, 35)}])
    return {
        "approved": True,
        "code": "00",
        "message": "Kart borcu bulundu",
        "pan_masked": cc["pan_masked"],
        **{k: credit_ledger.get(k) for k in ("limit", "debt", "statement", "minimum", "due")},
        "trace": trace,
    }


def credit_pay(token: str, credit_card_id: str, amount: float, ledger: dict, credit_ledger: dict, terminal: str) -> dict:
    card = _get_card(verify_token(token))
    _require_on_us(card, terminal)
    _require_debit(card)
    cc = _owned_credit_card(card, credit_card_id)
    fields = _base_fields(card, terminal, "400030", amount)  # vadesiz hesaptan (00) kredi kartına (30)
    fields["103"] = cc["pan_masked"].replace(" ", "")
    trace = _route(card, terminal, [
        {"from": "interapi", "to": "core", "proto": "Hesaptan borç", "ms": random.randint(20, 40)},
        {"from": "interapi", "to": "cards", "proto": "Kart borcuna alacak", "ms": random.randint(20, 40)},
    ])
    debt = float(credit_ledger.get("debt", 0))
    bal = float(ledger.get("balance", 0))
    if amount <= 0 or amount > debt:
        return {**_fail("13", trace, fields), "message": "Tutar kart borcundan fazla olamaz"}
    if amount > bal:
        return _fail("51", trace, fields)
    new_credit = {**credit_ledger, "debt": round(debt - amount, 2)}
    # Ödeme önce dönem borcunu ve asgariyi kapatır
    new_credit["statement"] = max(0.0, round(float(credit_ledger.get("statement", 0)) - amount, 2))
    new_credit["minimum"] = max(0.0, round(float(credit_ledger.get("minimum", 0)) - amount, 2))
    return {
        "approved": True,
        "code": "00",
        "message": "Kart borcu ödendi",
        "pan_masked": cc["pan_masked"],
        "ledger": {**ledger, "balance": round(bal - amount, 2)},
        "credit_ledger": new_credit,
        "trace": trace,
        "iso": {"request": _iso("0200", fields), "response": _iso("0210", {"39": "00", "37": _rrn()})},
    }


# --------------------------------------------------------------------------- #
# Kartsız işlem: QR ile para çekme / yatırma
#
#   1. ATM hosttan imzalı, kısa ömürlü bir QR oturumu ister ve ekranda gösterir.
#   2. Müşteri mobil uygulamada QR'ı okutur, işlemi ve tutarı seçip onaylar.
#      Mobil API onayı InterAPI'ye iletir; fraud ve bakiye ön kontrolü yapılır.
#   3. ATM onayı alır ve işlemi tamamlar. Tutar ATM'den değil, mobil onaydan
#      okunur; kart takılmadığı için kart-önce-para adımı yoktur.
#
# Gerçek sistemde onay hostta saklanır ve ATM durumu sorgular (polling).
# Burada host durumsuz olduğu için onay imzalı token olarak istemcide taşınır.
# --------------------------------------------------------------------------- #

QR_OPS = ("withdraw", "deposit")


def qr_create(terminal: str) -> dict:
    ref = secrets.token_hex(4).upper()
    qr = _sign({"typ": "qr", "ref": ref, "terminal": terminal, "exp": int(time.time()) + QR_TTL})
    return {
        "approved": True,
        "code": "00",
        "message": "QR oturumu açıldı",
        "qr": qr,
        "ref": ref,
        "payload": f"DEMOBANK://atm-qr?t={terminal}&r={ref}",
        "expires_in": QR_TTL,
        "trace": [
            {"from": "atm", "to": "switch", "proto": "NDC · kartsız işlem isteği", "ms": random.randint(18, 40)},
            {"from": "switch", "to": "interapi", "proto": "QR servisi · imzalı tek kullanımlık oturum", "ms": random.randint(8, 20)},
        ],
    }


def qr_approve(qr: str, card_id: str, op: str, amount: int, ledger: dict) -> dict:
    session = _unsign(qr, "qr", "33")
    card = _get_card(card_id)
    if card["type"] != "debit" or not _on_us(card, session["terminal"]):
        bank = BANKS[_terminal_bank(session["terminal"])]
        raise HostError("57", f"QR ile işlem yalnızca {bank} müşterilerine açık")
    if op not in QR_OPS:
        raise HostError("13", "Geçersiz işlem türü")
    trace = [
        {"from": "mobile", "to": "interapi", "proto": "Mobil API · cihaz bağlama + biyometrik onay", "ms": random.randint(40, 90)},
        {"from": "interapi", "to": "fraud", "proto": "Risk skoru · kartsız işlem", "ms": random.randint(5, 15)},
    ]
    if op == "withdraw":
        trace.append({"from": "interapi", "to": "core", "proto": "Bakiye / limit ön kontrolü", "ms": random.randint(15, 35)})
        code = _withdraw_check(amount, _available(card, ledger), ledger)
        if code:
            return _fail(code, trace)
    else:
        amount = 0  # yatırılacak tutar ATM'de sayıldıktan sonra belli olur
    approval = _sign({
        "typ": "qr-approval",
        "ref": session["ref"],
        "terminal": session["terminal"],
        "card": card_id,
        "op": op,
        "amount": amount,
        "exp": int(time.time()) + QR_TTL,
    })
    return {
        "approved": True,
        "code": "00",
        "message": "Mobil onay verildi",
        "approval": approval,
        "op": op,
        "amount": amount,
        "trace": trace,
    }


def _qr_approval(approval: str, op: str, terminal: str) -> tuple[dict, dict]:
    data = _unsign(approval, "qr-approval", "33")
    if data["op"] != op or data["terminal"] != terminal:
        raise HostError("05", "QR onayı bu işlem veya terminal ile eşleşmiyor")
    return _get_card(data["card"]), data


def qr_withdraw(approval: str, ledger: dict, cassettes: dict, terminal: str) -> dict:
    card, data = _qr_approval(approval, "withdraw", terminal)
    extra = [{"from": "interapi", "to": "core", "proto": "QR onayı doğrulandı · provizyon + borç kaydı", "ms": random.randint(20, 45)}]
    return _withdraw(card, data["amount"], ledger, cassettes, terminal, extra, qr_ref=data["ref"])


def qr_deposit(approval: str, notes: dict, suspect: int, ledger: dict, cassettes: dict, terminal: str) -> dict:
    card, data = _qr_approval(approval, "deposit", terminal)
    return _deposit(card, notes, suspect, ledger, cassettes, terminal, qr_ref=data["ref"])


# --------------------------------------------------------------------------- #
# İptal (reversal) ve gün sonu mutabakatı
#
# Host provizyonu onaylayıp hesabı borçlandırdıktan sonra para müşteriye
# ulaşmazsa (sıkışma, müşteri almadı, yanıt kayboldu) ATM 0400 iptal mesajı
# gönderir. 0400'e yanıt alınamazsa mesaj ATM'de saklanır (store-and-forward)
# ve 0420 olarak tekrar gönderilir. Host her durumda borcu geri alır.
#
# Gerçek host aynı iptali iki kez işlememek için orijinal işlemi (STAN, RRN)
# kaydeder. Bu host durumsuz olduğu için bu kontrol istemcide yapılır.
# --------------------------------------------------------------------------- #

REVERSAL_REASONS = {
    "68": "Yanıt zaman aşımına uğradı",
    "22": "Cihaz arızası: banknot verilemedi",
    "17": "Müşteri parayı almadı, geri çekildi",
}


def reverse(reversal_token: str, reason: str, ledger: dict, terminal: str, repeat: bool = False) -> dict:
    data = _unsign(reversal_token, "reversal", "05")
    if data["terminal"] != terminal:
        raise HostError("05", "İptal mesajı başka bir terminale ait")
    if reason not in REVERSAL_REASONS:
        raise HostError("13", "Geçersiz iptal nedeni")
    card = _get_card(data["card"])
    mti = "0420" if repeat else "0400"
    fields = _base_fields(card, terminal, data["processing"], data["amount"])
    if data["fee"]:
        fields["28"] = _fee_field(data["fee"])
    fields["39"] = reason
    # Alan 90: orijinal işlemin MTI, STAN, tarih ve kazanan (acquirer) kurum kodu
    fields["90"] = f"0200{data['stan']}{data['date']}{_terminal_bank(terminal)}"
    credit = card["type"] == "credit"
    trace = _route(card, terminal, [{"from": "interapi", "to": "cards" if credit else "core",
                                     "proto": f"İptal · borç kaydı geri alındı ({REVERSAL_REASONS[reason]})", "ms": random.randint(20, 40)}])
    new_ledger = _charge(card, ledger, -(data["amount"] + data["fee"]))
    new_ledger["daily_withdrawn"] = max(0.0, float(ledger.get("daily_withdrawn", 0)) - data["amount"])
    return {
        "approved": True,
        "code": "00",
        "message": "İşlem iptal edildi, tutar iade edildi",
        "card": data["card"],
        "amount": data["amount"] + data["fee"],
        "rrn": data["rrn"],
        "ledger": new_ledger,
        "record": _record("reversal", id="R" + data["rrn"], orig=data["rrn"], terminal=terminal, card=data["card"],
                          issuer=card["bank"], acquirer=_terminal_bank(terminal), amount=data["amount"], fee=data["fee"]),
        "trace": trace,
        "iso": {"request": _iso(mti, fields), "response": _iso(f"{int(mti) + 10:04d}", {"39": "00", "37": data["rrn"]})},
    }


def _counter(items: list[dict]) -> dict:
    return {"count": len(items), "amount": round(sum(float(r["amount"]) for r in items), 2)}


def settlement(terminal: str, totals: dict, batch: int, records: list | None = None) -> dict:
    """0500 gün sonu: ATM sayaçlarını hosta bildirir. Host kendi defterindeki (imzalı kayıtlar)
    nakit işlemlerle karşılaştırır; tutarsa dönem kapanır (39=00), tutmazsa 39=95 döner."""
    debits = totals.get("debits", {})
    credits = totals.get("credits", {})
    fields = {
        "15": datetime.now().strftime("%m%d"),
        "41": terminal,
        "50": "949",
        "74": f"{int(credits.get('count', 0)):010d}",
        "76": f"{int(debits.get('count', 0)):010d}",
        "86": f"{int(round(float(credits.get('amount', 0)) * 100)):016d}",
        "88": f"{int(round(float(debits.get('amount', 0)) * 100)):016d}",
        "97": f"{'D' if debits.get('amount', 0) >= credits.get('amount', 0) else 'C'}"
              f"{int(round(abs(float(debits.get('amount', 0)) - float(credits.get('amount', 0))) * 100)):016d}",
        "100": _terminal_bank(terminal),
    }
    recs = [r for r in _records(records) if r.get("terminal") == terminal]
    reversed_ids = {r["orig"] for r in recs if r["kind"] == "reversal"}
    host = {
        "debits": _counter([r for r in recs if r["kind"] == "cash_out" and r["id"] not in reversed_ids]),
        "credits": _counter([r for r in recs if r["kind"] == "cash_in"]),
    }
    atm = {k: {"count": int(v.get("count", 0)), "amount": round(float(v.get("amount", 0)), 2)}
           for k, v in (("debits", debits), ("credits", credits))}
    diff = {k: {"count": atm[k]["count"] - host[k]["count"], "amount": round(atm[k]["amount"] - host[k]["amount"], 2)}
            for k in ("debits", "credits")}
    matched = all(not d["count"] and not d["amount"] for d in diff.values())
    code = "00" if matched else "95"
    trace = [
        {"from": "atm", "to": "switch", "proto": "NDC · gün sonu sayaçları", "ms": random.randint(18, 40)},
        {"from": "switch", "to": "interapi", "proto": "REST/JSON · mTLS", "ms": random.randint(8, 20)},
        {"from": "interapi", "to": "core",
         "proto": f"Mutabakat · dönem {batch} kapatıldı" if matched else f"Mutabakat · dönem {batch} FARK VAR",
         "ms": random.randint(30, 60)},
    ]
    return {
        "approved": matched,
        "code": code,
        "message": "Gün sonu tamamlandı" if matched else "Mutabakat farkı: ATM sayaçları host kayıtlarıyla tutmuyor",
        "batch": batch + 1 if matched else batch,
        "reconciliation": {"batch": batch, "atm": atm, "host": host, "diff": diff, "matched": matched},
        "settled_ids": [r["id"] for r in recs] if matched else [],
        "trace": trace,
        "iso": {"request": _iso("0500", fields), "response": _iso("0510", {"39": code, "15": fields["15"]})},
    }


# --------------------------------------------------------------------------- #
# Takas (bankalar arası): gün sonunda bankanın kendi defterinden
#
#   BKM          başka banka kartıyla yapılan ATM işlemleri: kartı çıkaran banka (issuer),
#                ATM sahibi bankaya (acquirer) çekilen tutarı ve ücreti öder.
#   FAST / EFT   giden transferlerin TCMB üzerinden bankalar arası netleşmesi; mesai
#                dışında kuyruğa alınan EFT'ler bu oturumda gönderilip alıcıya yazılır.
#   Çek takası   takastaki çekler sonuçlanır; karşılıklı olan hesaba geçer.
#                Demo kuralı: numarası 9 ile biten çek karşılıksızdır.
# --------------------------------------------------------------------------- #

def clearing(records: list | None) -> dict:
    recs = _records(records)
    outs = {r["id"]: r for r in recs if r["kind"] in ("cash_out", "fee")}
    adjust = []  # önceki oturumda takasa girmiş işlemin sonradan gelen iptali
    for r in recs:
        if r["kind"] == "reversal" and outs.pop(r["orig"], None) is None:
            adjust.append(r)

    positions = {b: 0.0 for b in BANKS}
    bkm: dict[tuple, dict] = {}
    for r, sign in [(r, 1) for r in outs.values()] + [(r, -1) for r in adjust]:
        if r["issuer"] == r["acquirer"]:
            continue  # on-us: banka içi, takasa girmez
        row = bkm.setdefault((r["issuer"], r["acquirer"]), {"count": 0, "amount": 0.0, "fee": 0.0})
        row["count"] += sign
        row["amount"] += sign * float(r["amount"])
        row["fee"] += sign * float(r["fee"])
        total = sign * (float(r["amount"]) + float(r["fee"]))
        positions[r["issuer"]] -= total
        positions[r["acquirer"]] += total

    payments: dict[tuple, dict] = {}
    postings = []
    for r in recs:
        if r["kind"] != "transfer" or r["method"] == "havale":
            continue
        row = payments.setdefault((r["method"], r["issuer"], r["to_bank"]), {"count": 0, "amount": 0.0, "released": 0})
        row["count"] += 1
        row["amount"] += float(r["amount"])
        positions[r["issuer"]] -= float(r["amount"])
        positions[r["to_bank"]] += float(r["amount"])
        if r["queued"]:
            row["released"] += 1
            if r["recipient_card"]:
                postings.append({"card": r["recipient_card"], "amount": float(r["amount"]), "reason": "EFT takası"})

    cheques = []
    for r in recs:
        if r["kind"] != "cheque":
            continue
        bounced = str(r["cheque_no"]).endswith("9")
        cheques.append({"cheque_no": r["cheque_no"], "card": r["card"], "amount": float(r["amount"]),
                        "status": "Karşılıksız" if bounced else "Karşılıklı"})
        if not bounced:
            postings.append({"card": r["card"], "amount": float(r["amount"]), "reason": "Çek takası"})

    def name(b):
        return BANKS.get(b, b)

    trace = [
        {"from": "interapi", "to": "core", "proto": f"Gün sonu takas dosyası · {len(recs)} kayıt", "ms": random.randint(40, 80)},
        {"from": "switch", "to": "bkm", "proto": f"BKM takas · {sum(v['count'] for v in bkm.values())} işlem", "ms": random.randint(40, 90)},
        {"from": "bkm", "to": "issuer", "proto": "Bankalar arası net borç / alacak", "ms": random.randint(30, 60)},
        {"from": "interapi", "to": "fast",
         "proto": f"FAST / EFT netleşme · {sum(v['released'] for v in payments.values())} EFT gönderildi", "ms": random.randint(40, 90)},
        {"from": "fast", "to": "issuer", "proto": "TCMB hesaplarında mutabakat", "ms": random.randint(30, 60)},
    ]
    return {
        "approved": True,
        "code": "00",
        "message": "Takas oturumu tamamlandı",
        "date": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "bkm": [{"issuer": i, "issuer_name": name(i), "acquirer": a, "acquirer_name": name(a),
                 "count": v["count"], "amount": round(v["amount"], 2), "fee": round(v["fee"], 2)}
                for (i, a), v in sorted(bkm.items())],
        "payments": [{"method": m, "method_text": METHOD_TEXT[m], "from": f, "from_name": name(f), "to": t, "to_name": name(t),
                      "count": v["count"], "amount": round(v["amount"], 2), "released": v["released"]}
                     for (m, f, t), v in sorted(payments.items())],
        "cheques": cheques,
        "positions": [{"bank": b, "name": name(b), "net": round(v, 2)} for b, v in positions.items()],
        "postings": postings,
        "cleared_ids": [r["id"] for r in recs],
        "trace": trace,
    }
