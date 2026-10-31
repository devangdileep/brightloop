import io
from decimal import Decimal
from typing import Any, Dict, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class PDFService:
    @staticmethod
    def generate_invoice_pdf(invoice_data: Dict[str, Any], settings_data: Optional[Dict[str, Any]] = None) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "InvoiceTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=colors.HexColor("#4F46E5"),
            leading=26,
        )
        company_style = ParagraphStyle(
            "CompanyName",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#111827"),
            leading=20,
        )
        muted_style = ParagraphStyle(
            "MutedText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.HexColor("#6B7280"),
            leading=13,
        )
        bold_label = ParagraphStyle(
            "BoldLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=colors.HexColor("#374151"),
            leading=13,
        )
        table_header = ParagraphStyle(
            "TableHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=colors.HexColor("#374151"),
            leading=12,
        )
        table_cell = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.HexColor("#1F2937"),
            leading=12,
        )

        elements = []

        company_name = settings_data.get("company_name", "Brightloop Software") if settings_data else "Brightloop Software"
        support_email = settings_data.get("support_email", "billing@brightloop.io") if settings_data else "billing@brightloop.io"
        address = settings_data.get("address", "228 Market Street, San Francisco, CA") if settings_data else "228 Market Street, San Francisco, CA"

        customer = invoice_data.get("customer") or {}
        cust_name = customer.get("name", "Customer")
        cust_email = customer.get("email", "")
        cust_addr = customer.get("address", "")
        cust_tax = customer.get("tax_id", "")

        # Header Table: Company info on left, Invoice info on right
        header_left = [
            Paragraph(company_name, company_style),
            Paragraph(address, muted_style),
            Paragraph(support_email, muted_style),
        ]
        inv_number = invoice_data.get("number", "INV-XXXX")
        issue_date = invoice_data.get("issue_date", "")
        due_date = invoice_data.get("due_date", "")

        header_right = [
            Paragraph("INVOICE", title_style),
            Paragraph(f"<b>Invoice #:</b> {inv_number}", bold_label),
            Paragraph(f"<b>Issue Date:</b> {issue_date}", muted_style),
            Paragraph(f"<b>Due Date:</b> {due_date}", muted_style),
        ]

        header_table = Table(
            [[header_left, header_right]],
            colWidths=[300, 240],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 20))

        # Bill To & Status Section
        status_str = str(invoice_data.get("status", "open")).upper()
        bill_to = [
            Paragraph("<b>BILL TO</b>", bold_label),
            Paragraph(cust_name, bold_label),
            Paragraph(cust_email, muted_style),
        ]
        if cust_addr:
            bill_to.append(Paragraph(cust_addr, muted_style))
        if cust_tax:
            bill_to.append(Paragraph(f"Tax ID: {cust_tax}", muted_style))

        tot = Decimal(str(invoice_data.get("total", 0)))
        paid = Decimal(str(invoice_data.get("amount_paid", 0)))
        balance_due = max(Decimal("0.00"), tot - paid)

        status_box = [
            Paragraph(f"<b>STATUS:</b> {status_str}", bold_label),
            Paragraph(f"<b>Total:</b> ${tot:,.2f}", muted_style),
            Paragraph(f"<b>Paid:</b> ${paid:,.2f}", muted_style),
            Paragraph(f"<b>Balance Due:</b> ${balance_due:,.2f}", bold_label),
        ]

        info_table = Table([[bill_to, status_box]], colWidths=[300, 240])
        info_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 24))

        # Line Items Table
        items = invoice_data.get("items") or []
        table_data = [[
            Paragraph("DESCRIPTION", table_header),
            Paragraph("QTY", table_header),
            Paragraph("UNIT PRICE", table_header),
            Paragraph("AMOUNT", table_header),
        ]]

        for it in items:
            desc = it.get("description", "Item")
            qty = Decimal(str(it.get("quantity", 1)))
            u_price = Decimal(str(it.get("unit_price", 0)))
            amt = Decimal(str(it.get("amount", qty * u_price)))
            table_data.append([
                Paragraph(desc, table_cell),
                Paragraph(f"{qty:,.2f}", table_cell),
                Paragraph(f"${u_price:,.2f}", table_cell),
                Paragraph(f"${amt:,.2f}", table_cell),
            ])

        items_table = Table(table_data, colWidths=[280, 70, 95, 95])
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#374151")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 15))

        # Financial Totals Breakdown
        subtotal = Decimal(str(invoice_data.get("subtotal", 0)))
        discount_total = Decimal(str(invoice_data.get("discount_total", 0)))
        tax_total = Decimal(str(invoice_data.get("tax_total", 0)))

        totals_data = [
            ["", "Subtotal:", f"${subtotal:,.2f}"],
            ["", "Discount:", f"-${discount_total:,.2f}"],
            ["", "Tax:", f"${tax_total:,.2f}"],
            ["", "Total:", f"${tot:,.2f}"],
            ["", "Amount Paid:", f"${paid:,.2f}"],
            ["", "Balance Due:", f"${balance_due:,.2f}"],
        ]

        totals_table = Table(totals_data, colWidths=[300, 120, 120])
        totals_table.setStyle(TableStyle([
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("FONTNAME", (1, 3), (-1, 3), "Helvetica-Bold"),
            ("FONTNAME", (1, 5), (-1, 5), "Helvetica-Bold"),
            ("TEXTCOLOR", (1, 5), (-1, 5), colors.HexColor("#4F46E5")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(totals_table)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
