"""Create editable PowerPoint and PDF competition materials from versioned sources."""
import json
import re
from html import escape
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"
INK, CARD, CYAN, WHITE, MUTED = "0A1020", "121B2E", "31BDF2", "EDF1FA", "ADB9CE"


FONT = "Arial"
CARD2, MINT, AMBER, RED = "1A2540", "3DDC97", "F5B84B", "FF6B7A"
TONES = {"risk": RED, "safe": MINT, "warn": AMBER, "info": CYAN}


def text(slide, value, x, y, width, height, size=18, color=WHITE, bold=False, align=None, anchor=None):
    """Add a text box; value may be a string or a list of (text, color, bold) runs."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(width), Inches(height))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    if anchor:
        tf.vertical_anchor = anchor
    paragraph = tf.paragraphs[0]
    if align:
        paragraph.alignment = align
    runs = value if isinstance(value, list) else [(value, color, bold)]
    for part, part_color, part_bold in runs:
        run = paragraph.add_run()
        run.text = part
        run.font.name = FONT
        run.font.size = Pt(size)
        run.font.bold = part_bold
        run.font.color.rgb = RGBColor.from_string(part_color)
    return box


def shape(slide, x, y, width, height, color, kind=MSO_SHAPE.ROUNDED_RECTANGLE, radius=.08):
    item = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(width), Inches(height))
    item.fill.solid()
    item.fill.fore_color.rgb = RGBColor.from_string(color)
    item.line.fill.background()
    item.shadow.inherit = False
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        item.adjustments[0] = radius
    return item


def card(slide, x, y, width, height, accent=CYAN, fill=CARD):
    shape(slide, x, y, width, height, fill)
    shape(slide, x + .22, y, min(.9, width - .44), .05, accent, MSO_SHAPE.RECTANGLE)


def chip(slide, label, x, y, color=CYAN, size=12):
    width = .34 + len(label) * .105 * size / 12
    shape(slide, x, y, width, .38, CARD2, radius=.5)
    text(slide, label, x, y + .095, width, .25, size, color, True, PP_ALIGN.CENTER)
    return width


def frame(slide, entry, index, total):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = RGBColor.from_string(INK)
    shape(slide, 11.6, -1.0, 3.2, 3.2, "0F1A33", MSO_SHAPE.OVAL)
    shape(slide, 12.4, -.4, 2.0, 2.0, CARD, MSO_SHAPE.OVAL)
    shape(slide, 0, 0, .14, 7.5, CYAN, MSO_SHAPE.RECTANGLE)
    if entry["layout"] != "title":
        text(slide, entry["kicker"], .75, .46, 10, .3, 12, CYAN, True)
        size = 30 if len(entry["title"]) < 58 else 26
        text(slide, entry["title"], .75, .82, 11.2, 1.0, size, WHITE, True)
    text(slide, "QALQAN FINANCE SECURITY  /  RESEARCH PROTOTYPE", .75, 7.06, 8, .22, 9, MUTED)
    text(slide, f"{index:02d} / {total}", 11.6, 7.06, 1.2, .22, 10, CYAN, True, PP_ALIGN.RIGHT)


def footer(slide, value, y=6.45, color=MUTED):
    text(slide, value, .75, y, 11.8, .5, 14, color)


def highlighted(message, marks):
    runs, pos = [], 0
    spans = sorted((message.index(m), message.index(m) + len(m)) for m in marks if m in message)
    for a, b in spans:
        if a < pos:
            continue
        runs.append((message[pos:a], WHITE, False))
        runs.append((message[a:b], AMBER, True))
        pos = b
    runs.append((message[pos:], WHITE, False))
    return runs


def title_slide(slide, e):
    text(slide, e["kicker"], .85, .9, 11, .3, 12, CYAN, True)
    shape(slide, .85, 1.55, .95, 1.1, CYAN, MSO_SHAPE.PENTAGON if hasattr(MSO_SHAPE, "PENTAGON") else MSO_SHAPE.OVAL)
    shape(slide, 1.0, 1.7, .65, .8, INK, MSO_SHAPE.OVAL)
    text(slide, "Q", 1.0, 1.82, .65, .6, 30, CYAN, True, PP_ALIGN.CENTER)
    text(slide, e["title"], 2.1, 1.5, 10.2, 1.0, 46, WHITE, True)
    text(slide, e["subtitle"], 2.1, 2.55, 10, .9, 22, MUTED)
    x = .85
    for label in e["chips"]:
        x += chip(slide, label, x, 4.0) + .18
    shape(slide, .85, 5.15, 11.6, .015, CARD2, MSO_SHAPE.RECTANGLE)
    text(slide, e["people"][0], .85, 5.4, 11, .3, 15, CYAN, True)
    text(slide, "   ·   ".join(e["people"][1:]), .85, 5.85, 11.6, .35, 16, WHITE)


def problem_slide(slide, e):
    card(slide, .75, 2.0, 5.6, 4.1, AMBER)
    text(slide, "ПРИМЕР СООБЩЕНИЯ", 1.05, 2.3, 4, .25, 11, MUTED, True)
    shape(slide, 1.05, 2.8, 4.95, 2.1, CARD2, radius=.1)
    text(slide, highlighted(e["message"], e["highlights"]), 1.3, 3.05, 4.45, 1.7, 19)
    text(slide, "Подсвечено то, на что реагируют правила.", 1.05, 5.25, 4.9, .6, 13, MUTED)
    for i, (head, body) in enumerate(e["cards"]):
        x, y = 6.75 + (i % 2) * 3.0, 2.0 + (i // 2) * 2.1
        card(slide, x, y, 2.85, 1.95, CYAN)
        text(slide, f"{i+1:02d}", x + .25, y + .3, .6, .3, 13, CYAN, True)
        text(slide, head, x + .25, y + .7, 2.4, .4, 16, WHITE, True)
        text(slide, body, x + .25, y + 1.1, 2.4, .8, 12, MUTED)


def audience_slide(slide, e):
    for i, (head, body, tag) in enumerate(e["cards"]):
        x = .75 + i * 4.0
        card(slide, x, 2.1, 3.8, 3.7, [CYAN, MINT, AMBER][i])
        text(slide, tag.upper(), x + .3, 2.45, 3.2, .25, 11, [CYAN, MINT, AMBER][i], True)
        text(slide, head, x + .3, 2.9, 3.3, .5, 19, WHITE, True)
        text(slide, body, x + .3, 3.6, 3.2, 2.0, 15, MUTED)
    footer(slide, e["footer"], 6.2, AMBER)


def flow_slide(slide, e):
    for i, (num, head, body) in enumerate(e["steps"]):
        x = .75 + i * 3.05
        card(slide, x, 2.2, 2.75, 3.3)
        shape(slide, x + .3, 2.6, .62, .62, CYAN, MSO_SHAPE.OVAL)
        text(slide, num, x + .3, 2.72, .62, .4, 18, INK, True, PP_ALIGN.CENTER)
        text(slide, head, x + .3, 3.45, 2.2, .4, 20, WHITE, True)
        text(slide, body, x + .3, 3.95, 2.2, 1.4, 13, MUTED)
        if i < 3:
            text(slide, "\u2192", x + 2.77, 3.65, .3, .4, 22, CYAN, True)
    footer(slide, e["footer"], 5.95, WHITE)


def weights_slide(slide, e):
    top = 2.0
    for i, (label, weight, kind) in enumerate(e["weights"]):
        y = top + i * .37
        color = CYAN if kind == "text" else AMBER
        text(slide, label, .75, y, 3.5, .3, 12, WHITE)
        shape(slide, 4.3, y + .04, 3.9, .22, CARD, radius=.5)
        shape(slide, 4.3, y + .04, max(.25, 3.9 * weight / 45), .22, color, radius=.5)
        text(slide, str(weight), 8.3, y, .5, .3, 12, color, True)
    text(slide, [("\u25a0 ", CYAN, True), ("текст   ", MUTED, False), ("\u25a0 ", AMBER, True), ("ссылка", MUTED, False)], 4.3, 1.62, 4, .25, 11)
    card(slide, 9.2, 1.95, 3.4, 4.5, MINT)
    text(slide, "ПРАВИЛА СЧЁТА", 9.5, 2.3, 3, .25, 11, MINT, True)
    for i, line in enumerate(e["rules"]):
        text(slide, line, 9.5, 2.75 + i * .95, 2.9, .9, 13, WHITE)


def modules_slide(slide, e):
    colors = [CYAN, MINT, AMBER, CYAN, MINT, AMBER]
    for i, (head, body) in enumerate(e["modules"]):
        x, y = .75 + (i % 3) * 4.0, 2.0 + (i // 3) * 2.35
        card(slide, x, y, 3.8, 2.15, colors[i])
        text(slide, head, x + .3, y + .35, 3.3, .4, 19, WHITE, True)
        text(slide, body, x + .3, y + .95, 3.25, 1.1, 13, MUTED)


def demo_slide(slide, e):
    for side, x in ((e["left"], .75), (e["right"], 6.85)):
        tone = TONES[side["tone"]]
        card(slide, x, 1.95, 5.75, 4.55, tone)
        text(slide, side["label"], x + .3, 2.3, 3.5, .25, 11, tone, True)
        text(slide, str(side["score"]), x + 3.9, 2.05, 1.6, .9, 54, tone, True, PP_ALIGN.RIGHT)
        shape(slide, x + .3, 3.1, 5.15, 1.05, CARD2, radius=.1)
        text(slide, side["text"], x + .5, 3.25, 4.75, .8, 12, WHITE)
        for j, (name, weight) in enumerate(side["signals"]):
            y = 4.4 + j * .3
            text(slide, name, x + .3, y, 3.6, .28, 12, WHITE)
            if weight:
                text(slide, f"+{weight}", x + 4.5, y, .95, .28, 12, tone, True, PP_ALIGN.RIGHT)
        text(slide, side["total"], x + .3, 6.05, 5.1, .3, 11, MUTED)


def architecture_slide(slide, e):
    for block, y, accent in ((e["now"], 1.95, MINT), (e["legacy"], 4.25, AMBER)):
        card(slide, .75, y, 11.85, 2.1, accent)
        text(slide, block["title"].upper(), 1.05, y + .3, 6, .25, 11, accent, True)
        for j, step in enumerate(block["steps"]):
            x = 1.05 + j * 2.0
            shape(slide, x, y + .8, 1.8, .75, CARD2)
            text(slide, step, x, y + 1.04, 1.8, .3, 10, WHITE, True, PP_ALIGN.CENTER)
            if j < 2:
                text(slide, "\u2192", x + 1.82, y + .95, .25, .3, 16, accent, True)
        for j, line in enumerate(block["points"]):
            text(slide, [("\u2022 ", accent, True), (line, WHITE, False)], 7.1, y + .35 + j * .5, 5.3, .45, 13)


def dataset_slide(slide, e):
    for i, (num, label) in enumerate(e["stats"]):
        x = .75 + i * 2.7
        card(slide, x, 2.0, 2.5, 1.6)
        text(slide, num, x + .3, 2.3, 2, .7, 40, CYAN, True)
        text(slide, label, x + .3, 3.05, 2.1, .4, 12, MUTED)
    total = 90 + 42
    shape(slide, .75, 4.0, 7.9 * 90 / total, .55, CYAN)
    shape(slide, .75 + 7.9 * 90 / total, 4.0, 7.9 * 42 / total, .55, AMBER)
    text(slide, e["split"][0][0] + " \u00b7 " + e["split"][0][1], .75, 4.7, 5, .3, 13, CYAN, True)
    text(slide, e["split"][1][0] + " \u00b7 " + e["split"][1][1], .75, 5.05, 5, .3, 13, AMBER, True)
    card(slide, 8.9, 2.0, 3.7, 4.2, MINT)
    text(slide, "МЕТОДИКА", 9.2, 2.35, 3, .25, 11, MINT, True)
    for j, line in enumerate(e["points"]):
        text(slide, line, 9.2, 2.8 + j * .83, 3.15, .8, 12, WHITE)


def results_slide(slide, e):
    for i, (name, value, source) in enumerate(e["metrics"]):
        x = .75 + i * 3.0
        accent = CYAN if i < 2 else AMBER
        card(slide, x, 1.95, 2.8, 1.75, accent)
        text(slide, f"{name.upper()} \u00b7 {source.upper()}", x + .25, 2.3, 2.4, .4, 9, MUTED, True)
        text(slide, value, x + .25, 2.85, 2.4, .7, 34, accent, True)
    card(slide, .75, 3.95, 7.1, 2.35, CYAN)
    text(slide, "RECALL БРАУЗЕРНЫХ ПРАВИЛ ПО ЯЗЫКАМ", 1.05, 4.2, 6, .25, 11, CYAN, True)
    for j, (lang, pct, detail) in enumerate(e["langs"]):
        y = 4.65 + j * .52
        text(slide, lang, 1.05, y, .6, .3, 14, WHITE, True)
        shape(slide, 1.7, y + .03, 3.7, .26, CARD2, radius=.5)
        shape(slide, 1.7, y + .03, 3.7 * pct / 100, .26, MINT if pct == 100 else AMBER, radius=.5)
        text(slide, f"{pct:.1f}%".replace(".", ","), 5.55, y, .9, .3, 13, WHITE, True)
        text(slide, detail, 6.35, y + .02, 1.4, .3, 10, MUTED)
    card(slide, 8.1, 3.95, 4.5, 2.35, AMBER)
    text(slide, "КАК ЧИТАТЬ", 8.4, 4.2, 3, .25, 11, AMBER, True)
    text(slide, e["confusion"], 8.4, 4.65, 3.9, .3, 12, WHITE, True)
    text(slide, "Три пропуска — русскоязычные примеры. Именно там правилам нужна доработка.", 8.4, 5.1, 3.9, .9, 12, MUTED)
    footer(slide, e["footer"], 6.55, AMBER)


def errors_slide(slide, e):
    text(slide, e["intro"], .75, 1.8, 8, .3, 14, CYAN, True)
    for i, (kind, body, score) in enumerate(e["errors"]):
        y = 2.3 + i * .78
        tone = RED if kind == "Пропуск" else AMBER
        shape(slide, .75, y, 7.5, .66, CARD)
        shape(slide, .75, y, .08, .66, tone, MSO_SHAPE.RECTANGLE)
        text(slide, kind.upper(), 1.05, y + .2, 1.6, .25, 10, tone, True)
        text(slide, body, 2.65, y + .12, 4.5, .5, 12, WHITE)
        text(slide, score, 7.2, y + .2, 0.95, .25, 10, MUTED, True, PP_ALIGN.RIGHT)
    card(slide, 8.55, 2.3, 4.05, 3.9, RED)
    text(slide, "ОГРАНИЧЕНИЯ", 8.85, 2.65, 3, .25, 11, RED, True)
    for j, line in enumerate(e["limits"]):
        text(slide, line, 8.85, 3.15 + j * 1.0, 3.5, .95, 13, WHITE)


def compare_slide(slide, e):
    widths = [2.1, 3.1, 3.1, 3.55]
    xs = [.75]
    for w in widths[:-1]:
        xs.append(xs[-1] + w + .0)
    shape(slide, xs[3] - .05, 1.95, widths[3] + .1, 4.3, "0F2A3F")
    for j, name in enumerate(e["cols"]):
        text(slide, name.upper(), xs[j] + .15, 2.15, widths[j] - .2, .3, 11, CYAN if j == 3 else MUTED, True)
    for i, row in enumerate(e["rows"]):
        y = 2.65 + i * .72
        shape(slide, .75, y - .08, 11.85, .01, CARD2, MSO_SHAPE.RECTANGLE)
        for j, cell in enumerate(row):
            text(slide, cell, xs[j] + .15, y + .05, widths[j] - .3, .6, 12 if j else 12, MUTED if j == 0 else (WHITE if j == 3 else MUTED), j == 3 or j == 0)
    footer(slide, e["footer"], 6.45)


def rollout_slide(slide, e):
    for i, (num, head, body) in enumerate(e["phases"]):
        x = .75 + i * 4.0
        card(slide, x, 2.0, 3.8, 2.6, [CYAN, MINT, AMBER][i])
        text(slide, num, x + .3, 2.35, .6, .6, 32, [CYAN, MINT, AMBER][i], True)
        text(slide, head, x + .3, 3.1, 3.3, .4, 18, WHITE, True)
        text(slide, body, x + .3, 3.6, 3.2, 1.0, 13, MUTED)
    text(slide, "КАК ИЗМЕРЯТЬ ЭФФЕКТ", .75, 4.95, 6, .25, 11, CYAN, True)
    x = .75
    for label in e["kpi"]:
        x += chip(slide, label, x, 5.4, WHITE, 11) + .15
        if x > 10.5:
            break
    footer(slide, "Реальные платежи автоматически блокировать нельзя: итоговое решение остаётся за человеком.", 6.2, AMBER)


def roadmap_slide(slide, e):
    for i, (big, small) in enumerate(e["facts"]):
        x = .75 + i * 4.0
        card(slide, x, 1.95, 3.8, 1.45, [CYAN, MINT, AMBER][i])
        text(slide, big, x + .3, 2.25, 3.3, .6, 28, [CYAN, MINT, AMBER][i], True)
        text(slide, small, x + .3, 2.95, 3.3, .4, 11, MUTED)
    for j, (head, items, accent) in enumerate((("СДЕЛАНО", e["done"], MINT), ("СЛЕДУЮЩИЙ ЭТАП", e["next"], CYAN))):
        x = .75 + j * 3.1
        text(slide, head, x, 3.75, 2.9, .25, 11, accent, True)
        for k, item in enumerate(items):
            text(slide, [("\u2713 " if j == 0 else "\u2192 ", accent, True), (item, WHITE, False)], x, 4.15 + k * .45, 2.9, .4, 12)
    card(slide, 7.0, 3.6, 5.6, 2.6, CYAN)
    text(slide, "КОМАНДА", 7.3, 3.95, 3, .25, 11, CYAN, True)
    for k, line in enumerate(e["team"]):
        text(slide, line, 7.3, 4.35 + k * .42, 5.0, .4, 13 if k else 14, WHITE if k else CYAN, True)
    text(slide, e["link"], 7.3, 5.75, 5, .3, 12, MUTED)


LAYOUTS = {
    "title": title_slide, "problem": problem_slide, "audience": audience_slide, "flow": flow_slide,
    "weights": weights_slide, "modules": modules_slide, "demo": demo_slide, "architecture": architecture_slide,
    "dataset": dataset_slide, "results": results_slide, "errors": errors_slide, "compare": compare_slide,
    "rollout": rollout_slide, "roadmap": roadmap_slide,
}


def build_deck():
    content = json.loads((ROOT / "presentation/deck.json").read_text(encoding="utf-8"))
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    total = len(content["slides"])
    for i, entry in enumerate(content["slides"], 1):
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        frame(slide, entry, i, total)
        LAYOUTS[entry["layout"]](slide, entry)
        slide.notes_slide.notes_text_frame.text = entry["notes"]
    prs.save(OUTPUT / "Qalqan-pitch-deck.pptx")


def build_pdf(source):
    font = ROOT / "backend/fonts/QalqanSans.ttf"
    pdfmetrics.registerFont(TTFont("Qalqan", str(font)))
    styles = {
        "title": ParagraphStyle("title", fontName="Qalqan", fontSize=20, leading=26, textColor=colors.HexColor("#" + INK)),
        # A darker cyan remains legible on the white printable page.
        "subtitle": ParagraphStyle("subtitle", fontName="Qalqan", fontSize=11, leading=16, textColor=colors.HexColor("#087BA5")),
        "body": ParagraphStyle("body", fontName="Qalqan", fontSize=9.5, leading=14, textColor=colors.HexColor("#" + CARD)),
    }
    story = []
    for block in source.read_text(encoding="utf-8").split("\n\n"):
        body = []
        for line in block.splitlines():
            if line.startswith(("# ", "## ")):
                if body:
                    value = re.sub(r"\*\*(.*?)\*\*", r"\1", " ".join(body))
                    story.extend((Paragraph(escape(value), styles["body"]), Spacer(1, 8)))
                    body = []
                style, value = ("subtitle", line[3:]) if line.startswith("## ") else ("title", line[2:])
                story.extend((Paragraph(escape(value), styles[style]), Spacer(1, 8)))
            elif line.strip():
                body.append(line.strip())
        if body:
            value = re.sub(r"\*\*(.*?)\*\*", r"\1", " ".join(body))
            story.extend((Paragraph(escape(value), styles["body"]), Spacer(1, 8)))
    SimpleDocTemplate(str(OUTPUT / (source.stem + ".pdf")), pagesize=A4, leftMargin=36, rightMargin=36, topMargin=32, bottomMargin=30, title=source.stem).build(story)


if __name__ == "__main__":
    OUTPUT.mkdir(exist_ok=True)
    build_deck()
    for name in ("summary-ru.md", "summary-en.md", "one-pager.md"):
        build_pdf(ROOT / "presentation" / name)
    print(f"Built PowerPoint and three PDFs in {OUTPUT}")
