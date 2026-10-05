"""Printable reports containing derived analysis fields only."""

from datetime import datetime, timezone
from html import escape
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

FONT = Path(__file__).resolve().parent / "fonts/QalqanSans.ttf"
NAVY = colors.HexColor("#172239")
MUTED = colors.HexColor("#617087")
CYAN = colors.HexColor("#19A5D8")
LINE = colors.HexColor("#DCE4ED")
VERDICTS = {
    "high": ("Высокий риск", colors.HexColor("#CE3043")),
    "suspicious": ("Подозрительно", colors.HexColor("#9E6800")),
    "low": ("Низкий риск", colors.HexColor("#14714D")),
}
CHANNELS = {"sms": "SMS", "whatsapp": "WhatsApp", "email": "Письмо", "url": "Ссылка", "manual": "Вручную"}


def _text(value):
    # No derived value may introduce ReportLab tags, links or embedded images.
    return escape(str(value)).replace("\n", "<br/>")


def _utc_timestamp(value):
    try:
        stamp = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        return stamp.astimezone(timezone.utc).strftime("%d.%m.%Y · %H:%M:%S UTC")
    except (TypeError, ValueError):
        return f"{value} · UTC"


def _footer(canvas, doc):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, 54, width - doc.rightMargin, 54)
    canvas.setFont("Qalqan", 7.3)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 40, "Конкурсный прототип · Оценка не является гарантией безопасности.")
    canvas.drawString(doc.leftMargin, 28, "Исходный текст не сохраняется. Ссылки не открываются.")
    canvas.setFillColor(NAVY)
    canvas.drawRightString(width - doc.rightMargin, 28, f"{doc.page}")
    if doc.page > 1:
        canvas.setFont("Qalqan", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(doc.leftMargin, A4[1] - 30, "Qalqan Finance Security · Продолжение отчёта")
    canvas.restoreState()


def make_pdf(result):
    if "Qalqan" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Qalqan", str(FONT)))

    base = dict(fontName="Qalqan", textColor=NAVY, alignment=TA_LEFT, splitLongWords=True)
    styles = {
        "title": ParagraphStyle("ReportTitle", **base, fontSize=19, leading=26, spaceAfter=5),
        "subtitle": ParagraphStyle("ReportSubtitle", **base, fontSize=10, leading=15, spaceAfter=13),
        "meta": ParagraphStyle("ReportMeta", **{**base, "textColor": MUTED}, fontSize=8, leading=12, spaceAfter=3),
        "score": ParagraphStyle("ReportScore", **base, fontSize=38, leading=49, spaceBefore=12, spaceAfter=1),
        "verdict": ParagraphStyle("ReportVerdict", **base, fontSize=13, leading=20, spaceAfter=6),
        "section": ParagraphStyle("ReportSection", **base, fontSize=12, leading=18, spaceBefore=17, spaceAfter=8, keepWithNext=True),
        "body": ParagraphStyle("ReportBody", **base, fontSize=9, leading=14, spaceAfter=7),
        "finding": ParagraphStyle("ReportFinding", **base, fontSize=9, leading=14, spaceAfter=6, leftIndent=12, firstLineIndent=-12),
        "note": ParagraphStyle("ReportNote", **{**base, "textColor": MUTED}, fontSize=8, leading=12, spaceAfter=5),
    }
    body = []

    def p(value, style="body"):
        body.append(Paragraph(_text(value), styles[style]))

    def rule(color=LINE, space_before=7, space_after=6):
        body.append(HRFlowable(width="100%", thickness=0.7, color=color, spaceBefore=space_before, spaceAfter=space_after))

    p("Qalqan Finance Security", "title")
    p("Отчёт об анализе финансового фишинга", "subtitle")
    p(f"Дата проверки: {_utc_timestamp(result['created_at'])}", "meta")
    p(f"ID проверки: {result['id']}", "meta")
    channel = CHANNELS.get(result.get("channel"), result.get("channel", "Не указан"))
    p(f"Источник: {channel}", "meta")
    rule(CYAN, 10, 0)

    verdict_title, verdict_color = VERDICTS.get(result["verdict"], ("Оценка риска", NAVY))
    # Only fixed design markup is interpolated; values are escaped separately.
    body.append(Paragraph(f'{_text(result["score"])} <font size="17">из 100</font>', styles["score"]))
    body.append(Paragraph(f'<font color="{verdict_color.hexval()}">{verdict_title}</font>', styles["verdict"]))
    p("Риск-балл — оценка признаков, а не вероятность мошенничества.", "note")
    ml_score = result.get("ml_score")
    p(f"Правила: {result['rules_score']}/100 · ML-оценка: {str(ml_score) + '/100' if ml_score is not None else 'не применяется'}", "note")
    p(f"Предполагаемая схема: {result.get('scheme', {}).get('title', 'Тип схемы не определён')}", "body")

    p("Почему так решено?", "section")
    for signal in result["signals"]:
        p(f"•  {signal['title']} · +{signal['weight']} к оценке правил", "finding")
    if not result["signals"]:
        p("Эвристические признаки не обнаружены. ML-оценка показана отдельно.")

    if result["urls"]:
        p("Домены в сообщении", "section")
        for url in result["urls"]:
            # Hosts are printed as plain text; never create clickable suspect links.
            p(url["host"], "body")
            match = "есть совпадение" if url["official"] else "совпадение не найдено"
            p(f"Демонстрационный справочник официальных доменов: {match}.", "note")
        p("Совпадение со справочником само по себе не подтверждает безопасность сообщения.", "note")

    rule(space_before=11, space_after=0)
    p("Что делать?", "section")
    p(result["advice"])
    if result["verdict"] in {"high", "suspicious"}:
        p("Если уже передали реквизиты или перевели деньги, сразу обратитесь в свой банк через официальное приложение или номер на карте.")

    p("Границы проверки", "section")
    for item in result["limitations"]:
        p(f"•  {item}", "note")
    p("Отчёт содержит только производные признаки и домены; исходное сообщение и параметры ссылок в него не включаются.", "note")
    body.append(Spacer(1, 5))

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, title="Qalqan Finance Security — отчёт о проверке",
        author="Qalqan", subject="Производные признаки финансового фишинга",
        leftMargin=44, rightMargin=44, topMargin=48, bottomMargin=74,
    )
    doc.build(body, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
