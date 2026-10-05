"""Offline hybrid risk analysis. URLs are parsed, never opened or resolved."""
import ipaddress
import re
from difflib import SequenceMatcher
from time import perf_counter
from urllib.parse import urlsplit, unquote

from ai.model import predict

OFFICIAL = {"kaspi.kz": "Kaspi", "halykbank.kz": "Halyk", "homebank.kz": "Homebank", "bcc.kz": "BCC", "forte.kz": "Forte"}
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "clck.ru", "cutt.ly"}
URL_PATTERN = re.compile(r"(?:https?://|www\.)[^\s<>\"']+", re.I)
TEXT_RULES = [
    ("secret_request", "Запрос секретных данных", 45,
     r"(?:сообщи\w*|отправ\w*|введ\w*|укаж\w*|подтверд\w*|назов\w*|пришл\w*|send|enter|share|confirm|provide|жіб\w*|енгіз\w*|айтың\w*).{0,65}(?:cvv|cvc|парол\w*|password|pin|пин|код\w*|otp|карт\w*|card|құпия|кодты)"),
    ("urgency", "Давление и срочность", 18,
     r"сроч\w*|немедлен\w*|urgent|immediately|шұғыл|дереу|в течение \d+ минут|within \d+ minutes"),
    ("account_threat", "Угроза блокировки счёта", 22,
     r"заблокир\w*|блокиров\w*|suspend\w*|account.{0,20}block|бұғат\w*"),
    ("reward", "Обещание выигрыша или выплаты", 15,
     r"выигр\w*|розыгрыш|получите.{0,20}бонус|won.{0,25}prize|claim.{0,25}reward|ұтып|сыйақы"),
    ("transfer", "Предложение перевести деньги", 35,
     r"(?:перевед\w*|перевести|transfer|аудар\w*).{0,65}(?:безопасн\w*|резервн\w*|safe account|secure account|қауіпсіз)"),
]


def official_domain(host):
    return next((d for d in OFFICIAL if host == d or host.endswith("." + d)), None)


def inspect_url(raw):
    flags = []
    def add(code, title, weight):
        flags.append({"code": code, "title": title, "weight": weight, "source": "url"})
    try:
        parts = urlsplit(raw if "://" in raw else "https://" + raw)
        host = (parts.hostname or "").rstrip(".").lower()
        _ = parts.port
        if parts.scheme not in ("http", "https") or not host or any(c.isspace() for c in host):
            raise ValueError("Invalid URL")
        host = host.encode("idna").decode("ascii")
    except (ValueError, UnicodeError):
        add("malformed_url", "Некорректный адрес ссылки", 25)
        return {"host": "Некорректный URL", "official": False, "signals": flags}
    if parts.scheme == "http":
        add("no_https", "Ссылка использует HTTP без TLS", 10)
    if parts.username is not None:
        add("userinfo", "Имя пользователя в URL может скрывать настоящий домен", 30)
    try:
        ipaddress.ip_address(host)
        add("ip_host", "IP-адрес вместо домена", 25)
    except ValueError:
        if host == "localhost" or host.endswith(".local"):
            add("local_host", "Локальный адрес вместо сайта банка", 25)
    if host in SHORTENERS:
        add("shortener", "Сокращённая ссылка скрывает адрес назначения", 18)
    if any(label.startswith("xn--") for label in host.split(".")):
        add("idn", "Международный домен: проверьте похожие символы", 18)
    official = official_domain(host)
    if not official:
        labels = host.split(".")
        looks_similar = any(
            brand in unquote(host) or any(SequenceMatcher(None, brand, label).ratio() >= .78 for label in labels)
            for brand in (d.split(".")[0] for d in OFFICIAL)
        )
        if looks_similar:
            add("impersonation", "Домен похож на банк, но отсутствует в справочнике", 45)
    if len(raw) > 180:
        add("long_url", "Необычно длинная ссылка", 8)
    if len(host.split(".")) > 4:
        add("subdomains", "Много уровней поддоменов", 12)
    return {"host": host, "official": bool(official), "signals": flags}


def analyze(content, channel="sms", model=None):
    started = perf_counter()
    text = content.strip()
    normalized = re.sub(r"\s+", " ", text).casefold()
    signals = []
    for code, title, weight, pattern in TEXT_RULES:
        for match in re.finditer(pattern, normalized, re.I):
            # Short local negation handling; not a semantic language model.
            before = normalized[max(0, match.start() - 35):match.start()]
            if re.search(r"(?:никогда\s+(?:не\s+)?|не\s+|do not\s+|never\s+)$", before):
                continue
            signals.append({"code": code, "title": title, "weight": weight, "source": "text"})
            break
    raw_urls = [m.group().rstrip(".,;!?)»") for m in URL_PATTERN.finditer(text)]
    if channel == "url":
        raw_urls = [text]
    urls = [inspect_url(raw) for raw in list(dict.fromkeys(raw_urls))[:20]]
    for url in urls:
        signals.extend(url["signals"])
    signals = list({s["code"]: s for s in signals}.values())
    rules_score = min(100, sum(s["weight"] for s in signals))
    ml = predict(text, model) if channel != "url" else None
    ml_score = round(ml * 100) if ml is not None else None
    # Model score is uncalibrated; surface separately and cap model-only alerts.
    ml_risk = min(65, max(35, round(ml * 85))) if ml is not None and ml >= .5 else round((ml or 0) * 68)
    score = max(rules_score, ml_risk) if ml is not None else rules_score
    verdict = "high" if score >= 70 else "suspicious" if score >= 35 else "low"
    advice = {
        "high": "Не вводите данные и не переводите деньги. Свяжитесь с банком через его официальное приложение или номер на карте.",
        "suspicious": "Проверьте отправителя и адрес через официальный канал банка. Не сообщайте коды, PIN и CVV.",
        "low": "Явных признаков высокого риска мало. Это не гарантия безопасности: проверьте отправителя и никогда не передавайте секретные данные.",
    }[verdict]
    return {"score": score, "verdict": verdict, "rules_score": rules_score, "ml_score": ml_score,
            "signals": signals, "urls": urls, "advice": advice, "channel": channel,
            "duration_ms": round((perf_counter() - started) * 1000, 2),
            "model_version": "synthetic-char-tfidf-lr-v1",
            "limitations": ["Риск-балл не является вероятностью мошенничества.",
                            "Модель обучена на синтетических RU/KZ/EN сообщениях.",
                            "Ссылки не открываются; WHOIS, возраст домена, репутация и содержимое сайта не проверяются."]}
