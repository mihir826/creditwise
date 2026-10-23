"""CSV and PDF exports generated from the finance engine's results."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .finance import LoanResult, round_money

FONT_DIR = Path(__file__).resolve().parent / "assets" / "fonts"
IST = ZoneInfo("Asia/Kolkata")

INK = colors.HexColor("#17171A")
MUTED = colors.HexColor("#6B6A74")
RULE = colors.HexColor("#E3E1EA")
LAVENDER = colors.HexColor("#8B6CE0")
LAVENDER_SOFT = colors.HexColor("#EFE9FF")
MINT = colors.HexColor("#6FA552")
MINT_SOFT = colors.HexColor("#EEF7E7")
AMBER = colors.HexColor("#C9A54A")

_fonts_registered = False


def _register_fonts() -> None:
    global _fonts_registered
    if _fonts_registered:
        return
    pdfmetrics.registerFont(TTFont("Inter", str(FONT_DIR / "Inter-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Inter-SemiBold", str(FONT_DIR / "Inter-SemiBold.ttf")))
    addMapping("Inter", 0, 0, "Inter")
    addMapping("Inter", 1, 0, "Inter-SemiBold")
    # Instrument Serif has no ₹ glyph: use it for words only, never for amounts.
    pdfmetrics.registerFont(TTFont("InstrumentSerif", str(FONT_DIR / "InstrumentSerif-Regular.ttf")))
    _fonts_registered = True


def format_inr(value: Decimal | float, decimals: int = 2, symbol: bool = True) -> str:
    """Indian digit grouping: 12,50,000.00"""
    d = round_money(Decimal(str(value))) if decimals == 2 else Decimal(str(value)).quantize(Decimal(1))
    negative = d < 0
    d = abs(d)
    whole, _, frac = f"{d:.{decimals}f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    text = whole + (f".{frac}" if decimals else "")
    return ("-" if negative else "") + ("₹" if symbol else "") + text


def tenure_label(months: int) -> str:
    years, rem = divmod(months, 12)
    parts = []
    if years:
        parts.append(f"{years} year{'s' if years != 1 else ''}")
    if rem:
        parts.append(f"{rem} month{'s' if rem != 1 else ''}")
    return f"{' '.join(parts)} ({months} months)"


def fee_label(result: LoanResult) -> str:
    loan = result.input
    if result.summary.fee_amount == 0:
        return "None"
    if loan.fee_type == "percent":
        return f"{format_inr(result.summary.fee_amount)} ({loan.fee_value.normalize():f}% of principal)"
    return f"{format_inr(result.summary.fee_amount)} (flat)"


# --------------------------------------------------------------------------- CSV


def schedule_csv(result: LoanResult) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Month", "Opening balance (INR)", "Payment (INR)", "Principal (INR)", "Interest (INR)", "Closing balance (INR)"])
    for r in result.schedule:
        w.writerow([r.month, f"{r.opening_balance:.2f}", f"{r.payment:.2f}", f"{r.principal:.2f}", f"{r.interest:.2f}", f"{r.closing_balance:.2f}"])
    s = result.summary
    w.writerow([])
    w.writerow(["Total", "", f"{s.total_payment:.2f}", f"{s.principal:.2f}", f"{s.total_interest:.2f}", ""])
    return buf.getvalue()


# --------------------------------------------------------------------------- PDF


def _styles() -> dict[str, ParagraphStyle]:
    def sans(name: str, size: float, leading: float, color=INK, font: str = "Inter") -> ParagraphStyle:
        return ParagraphStyle(name, fontName=font, fontSize=size, leading=leading, textColor=color, alignment=TA_LEFT)

    def serif(name: str, size: float, leading: float, before: float = 0, after: float = 0) -> ParagraphStyle:
        return ParagraphStyle(
            name, fontName="InstrumentSerif", fontSize=size, leading=leading, textColor=INK,
            spaceBefore=before, spaceAfter=after,
        )

    return {
        "title": serif("title", 34, 38, after=4),
        "h2": serif("h2", 20, 24, before=14, after=8),
        "body": sans("body", 9.5, 14),
        "value": sans("value", 9.5, 14, font="Inter-SemiBold"),
        "muted": sans("muted", 8.5, 12, MUTED),
        "label": sans("label", 8, 10, MUTED),
        "metric_hero": sans("metric_hero", 16, 20, font="Inter-SemiBold"),
        "disclaimer": sans("disclaimer", 8.5, 12.5),
    }


def _metric_cell(label: str, value: str, st: dict[str, ParagraphStyle]) -> list:
    return [Paragraph(label, st["label"]), Spacer(1, 3), Paragraph(value, st["metric_hero"])]


def _breakdown_chart(result: LoanResult) -> Drawing:
    s = result.summary
    d = Drawing(170 * mm, 62 * mm)
    pie = Pie()
    pie.x, pie.y, pie.width, pie.height = 6 * mm, 4 * mm, 52 * mm, 52 * mm
    parts = [(float(s.principal), "Principal", LAVENDER), (float(s.total_interest), "Interest", MINT)]
    if s.fee_amount > 0:
        parts.append((float(s.fee_amount), "Processing fee", AMBER))
    pie.data = [p[0] for p in parts]
    pie.labels = None
    pie.innerRadiusFraction = 0.58
    pie.slices.strokeWidth = 1.5
    pie.slices.strokeColor = colors.white
    for i, (_, _, c) in enumerate(parts):
        pie.slices[i].fillColor = c
    d.add(pie)

    total = s.total_outflow
    amounts = [s.principal, s.total_interest] + ([s.fee_amount] if s.fee_amount > 0 else [])
    y = 46 * mm
    for (_, label, c), amount in zip(parts, amounts):
        d.add(Rect(70 * mm, y, 3 * mm, 3 * mm, fillColor=c, strokeColor=None))
        d.add(String(76 * mm, y + 0.4 * mm, label, fontName="Inter", fontSize=9, fillColor=MUTED))
        d.add(String(118 * mm, y + 0.4 * mm, format_inr(amount), fontName="Inter-SemiBold", fontSize=9.5, fillColor=INK))
        share = (amount / total * 100) if total else Decimal(0)
        d.add(String(156 * mm, y + 0.4 * mm, f"{share:.1f}%", fontName="Inter", fontSize=9, fillColor=MUTED))
        y -= 9 * mm
    d.add(String(70 * mm, y - 2 * mm, "Share of total outflow (instalments + fee)", fontName="Inter", fontSize=7.5, fillColor=MUTED))
    return d


def _yearly_chart(result: LoanResult) -> Drawing:
    years = result.yearly
    d = Drawing(170 * mm, 70 * mm)
    chart = VerticalBarChart()
    chart.x, chart.y, chart.width, chart.height = 16 * mm, 10 * mm, 150 * mm, 52 * mm
    chart.data = [[float(y.principal) for y in years], [float(y.interest) for y in years]]
    chart.categoryAxis.style = "stacked"
    chart.categoryAxis.categoryNames = [str(y.year) if (len(years) <= 15 or y.year % 5 == 0 or y.year == 1) else "" for y in years]
    chart.categoryAxis.labels.fontName = "Inter"
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.fillColor = MUTED
    chart.categoryAxis.strokeColor = RULE
    chart.valueAxis.labels.fontName = "Inter"
    chart.valueAxis.labels.fontSize = 7
    chart.valueAxis.labels.fillColor = MUTED
    chart.valueAxis.strokeColor = RULE
    chart.valueAxis.gridStrokeColor = RULE
    chart.valueAxis.visibleGrid = True
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labelTextFormat = lambda v: format_inr(v, decimals=0)
    chart.bars[0].fillColor = LAVENDER
    chart.bars[1].fillColor = MINT
    chart.bars.strokeColor = None
    chart.barSpacing = 0
    chart.groupSpacing = max(1, 8 - len(years) // 5)
    d.add(chart)
    d.add(String(16 * mm, 2 * mm, "Loan year", fontName="Inter", fontSize=7.5, fillColor=MUTED))
    d.add(Rect(110 * mm, 66 * mm, 3 * mm, 3 * mm, fillColor=LAVENDER, strokeColor=None))
    d.add(String(115 * mm, 66.4 * mm, "Principal repaid", fontName="Inter", fontSize=8, fillColor=MUTED))
    d.add(Rect(142 * mm, 66 * mm, 3 * mm, 3 * mm, fillColor=MINT, strokeColor=None))
    d.add(String(147 * mm, 66.4 * mm, "Interest paid", fontName="Inter", fontSize=8, fillColor=MUTED))
    return d


def _page_decor(generated: str):
    def draw(canvas, doc):
        canvas.saveState()
        w, h = A4
        canvas.setFont("InstrumentSerif", 14)
        canvas.setFillColor(INK)
        canvas.drawString(18 * mm, h - 14 * mm, "CreditWise")
        canvas.setFillColor(LAVENDER)
        canvas.circle(16 * mm - 2.5 * mm, h - 13 * mm, 1.3 * mm, stroke=0, fill=1)
        canvas.setFont("Inter", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(w - 18 * mm, h - 14 * mm, f"Loan estimate report · {generated}")
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(18 * mm, h - 17 * mm, w - 18 * mm, h - 17 * mm)
        canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
        canvas.drawString(18 * mm, 9 * mm, "Estimate only. Not a lender-issued sanction letter or offer of credit.")
        canvas.drawRightString(w - 18 * mm, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()

    return draw


def loan_report_pdf(result: LoanResult, title: str | None = None, now: datetime | None = None) -> bytes:
    _register_fonts()
    st = _styles()
    now = now or datetime.now(IST)
    generated = now.strftime("%d %b %Y, %I:%M %p IST")
    loan, s = result.input, result.summary

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=24 * mm,
        bottomMargin=20 * mm,
        title=f"CreditWise loan report{' — ' + title if title else ''}",
        author="CreditWise",
        subject="Loan EMI estimate",
    )
    width = doc.width
    story: list = []

    story.append(Paragraph(title or "Loan estimate", st["title"]))
    story.append(Paragraph(f"Generated {generated}", st["muted"]))
    story.append(Spacer(1, 10 * mm))

    # Headline metrics
    hero = Table(
        [
            [
                _metric_cell("Monthly EMI", format_inr(s.emi), st),
                _metric_cell("Total interest", format_inr(s.total_interest), st),
                _metric_cell("Total repayment", format_inr(s.total_payment), st),
            ]
        ],
        colWidths=[width / 3] * 3,
    )
    hero.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LAVENDER_SOFT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ("LINEAFTER", (0, 0), (1, 0), 0.6, colors.white),
            ]
        )
    )
    story.append(hero)
    story.append(Spacer(1, 8 * mm))

    # Loan details
    story.append(Paragraph("Loan details", st["h2"]))
    details = [
        ("Principal amount", format_inr(s.principal)),
        ("Annual interest rate", f"{loan.annual_rate.normalize():f}% p.a. (fixed, monthly reducing balance)"),
        ("Loan tenure", tenure_label(loan.tenure_months)),
        ("Monthly EMI", format_inr(s.emi)),
        ("Final instalment", format_inr(s.final_payment) + ("  (adjusted for rounding)" if s.final_payment != s.emi else "")),
        ("Total interest payable", format_inr(s.total_interest)),
        ("Total repayment (principal + interest)", format_inr(s.total_payment)),
        ("Processing fee (upfront)", fee_label(result)),
        ("Total borrowing cost (interest + fee)", format_inr(s.total_borrowing_cost)),
        ("Total outflow (instalments + fee)", format_inr(s.total_outflow)),
        ("Effective monthly cost (total outflow ÷ months)", format_inr(s.effective_monthly_cost)),
        ("Interest as share of total repayment", f"{s.interest_share_pct:.2f}%"),
        ("Effective annual rate incl. fee", f"{s.effective_annual_rate:.2f}%"),
    ]
    t = Table(
        [[Paragraph(k, st["body"]), Paragraph(v, st["value"])] for k, v in details],
        colWidths=[width * 0.52, width * 0.48],
    )
    t.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 8 * mm))
    disclaimer = Table(
        [[Paragraph(
            "<b>Disclaimer.</b> This report is an estimate generated from the figures you entered. It is not a "
            "loan offer, sanction letter or credit decision from any lender. Actual EMIs, fees and charges are set "
            "by the lender and may differ.",
            st["disclaimer"],
        )]],
        colWidths=[width],
    )
    disclaimer.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), MINT_SOFT), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(disclaimer)

    story.append(KeepTogether([Paragraph("Principal versus interest", st["h2"]), _breakdown_chart(result)]))
    story.append(KeepTogether([Paragraph("Repayment by year", st["h2"]), _yearly_chart(result)]))

    # Methodology and disclaimer
    method = [
        "EMI is computed with the standard formula for a fixed-rate amortising loan: "
        "EMI = P × r × (1 + r)<super>n</super> ÷ ((1 + r)<super>n</super> − 1), where P is the principal, "
        "r the monthly rate (annual rate ÷ 12 ÷ 100) and n the number of monthly instalments. "
        "With a 0% rate, EMI = P ÷ n.",
        "Each month, interest is charged on the outstanding balance and rounded to the nearest paisa; "
        "the rest of the EMI repays principal. The EMI is rounded to the nearest paisa, and the final "
        "instalment is adjusted so that the closing balance is exactly zero.",
        "Total interest and total repayment are exact sums of the schedule below. The processing fee is "
        "treated as paid upfront and is excluded from the EMI; it is included in the total borrowing cost "
        "and the effective annual rate (the rate at which the instalments equal the amount received after the fee).",
        "Not modelled: GST on fees, insurance, prepayments, rate resets on floating-rate loans, "
        "late-payment charges, broken-period interest and lender-specific day-count conventions.",
    ]
    block = [Paragraph("Assumptions and methodology", st["h2"])] + [
        Paragraph(m, st["body"]) for m in method
    ]
    for i in range(len(block) - 1, 1, -1):
        block.insert(i, Spacer(1, 4))
    story.append(KeepTogether(block))

    # Full schedule
    story.append(PageBreak())
    story.append(Paragraph("Repayment schedule", st["h2"]))
    story.append(Paragraph(f"{len(result.schedule)} monthly instalments. Amounts in INR.", st["muted"]))
    story.append(Spacer(1, 4 * mm))
    header = ["#", "Opening balance", "Payment", "Principal", "Interest", "Closing balance"]
    rows = [header] + [
        [
            str(r.month),
            format_inr(r.opening_balance),
            format_inr(r.payment),
            format_inr(r.principal),
            format_inr(r.interest),
            format_inr(r.closing_balance),
        ]
        for r in result.schedule
    ]
    rows.append(["Total", "", format_inr(s.total_payment), format_inr(s.principal), format_inr(s.total_interest), ""])
    col = [width * 0.07] + [width * 0.186] * 5
    sched = Table(rows, colWidths=col, repeatRows=1)
    style = [
        ("FONT", (0, 0), (-1, 0), "Inter-SemiBold", 7.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("FONT", (0, 1), (-1, -1), "Inter", 7.5),
        ("FONT", (0, -1), (-1, -1), "Inter-SemiBold", 7.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, INK),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]
    for i in range(2, len(rows) - 1, 2):
        style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F7F6FA")))
    sched.setStyle(TableStyle(style))
    story.append(sched)

    decor = _page_decor(generated)
    doc.build(story, onFirstPage=decor, onLaterPages=decor)
    return buf.getvalue()
