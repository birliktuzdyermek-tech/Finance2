from html import escape
from io import BytesIO
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

FONT = Path(__file__).resolve().parent / "fonts/QalqanSans.ttf"


def make_pdf(result):
    if "Qalqan" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Qalqan", str(FONT)))
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = "Qalqan"
    styles.add(ParagraphStyle("Detail", fontName="Qalqan", fontSize=10, leading=16, textColor=colors.HexColor("#26384b")))
    body = []
    def p(text, style="Detail"):
        body.append(Paragraph(escape(str(text)), styles[style]))
        body.append(Spacer(1, 10))
    p("Qalqan Finance Security", "Title")
    p("Отчёт об анализе финансового фишинга", "Heading2")
    p(f"ID: {result['id']} | UTC: {result['created_at']}")
    p(f"Риск-балл: {result['score']}/100 | Вердикт: {result['verdict']}")
    p('Предполагаемая схема: '+result.get('scheme',{}).get('title','Тип схемы не определён'))
    p(f"Правила: {result['rules_score']} | ML: {result['ml_score'] if result['ml_score'] is not None else 'не применяется'}")
    p("Найденные признаки", "Heading2")
    for signal in result["signals"]:
        p(f"• {signal['title']} (+{signal['weight']} к оценке правил)")
    if not result["signals"]:
        p("Эвристические признаки не обнаружены. ML-оценка показывается отдельно.")
    for url in result["urls"]:
        p(f"Домен: {url['host']}; в демонстрационном справочнике: {'да' if url['official'] else 'нет'}")
    p(result["advice"])
    p("Ограничения прототипа", "Heading2")
    for item in result["limitations"]:
        p(item)
    p("Исходный текст сообщения не сохраняется. Отчёт основан на производных признаках.")
    SimpleDocTemplate(buffer, title="Qalqan risk report", author="Qalqan", rightMargin=40, leftMargin=40).build(body)
    return buffer.getvalue()
