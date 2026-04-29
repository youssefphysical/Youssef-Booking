import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { InbodyRecord } from "@shared/schema";

export type PdfExportOptions = {
  filename: string;
  /** Background colour applied to the off-screen render so dark UI keeps its look */
  background?: string;
};

/**
 * Renders the given DOM element to a multi-page A4 PDF.
 * Works well with the dashboard which uses dark colours; we paint
 * the background colour first so transparency doesn't render black.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  { filename, background = "#0c0e14" }: PdfExportOptions,
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: background,
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
  } else {
    let remaining = imgH;
    let position = 0;
    const dataUrl = canvas.toDataURL("image/png");
    while (remaining > 0) {
      pdf.addImage(dataUrl, "PNG", 0, position, imgW, imgH);
      remaining -= pageH;
      position -= pageH;
      if (remaining > 0) pdf.addPage();
    }
  }
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

// ---------------------------------------------------------------------------
// Branded InBody report
// ---------------------------------------------------------------------------

export type InbodyReportOptions = {
  clientName: string;
  records: InbodyRecord[]; // newest first or unsorted (we sort defensively)
  trendsElement?: HTMLElement | null;
  filename?: string;
};

const BRAND_TITLE = "Youssef Ahmed Personal Training";
const BRAND_SUBTITLE = "InBody Composition Report";

function fmt(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return "Not available";
  return unit ? `${value} ${unit}` : `${value}`;
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
}

/**
 * Generates a branded multi-section InBody PDF report.
 * - Header with brand and client name
 * - Latest scan metrics block
 * - Optional rendered trends chart (passed as a DOM element, captured via html2canvas)
 * - Tabular history of earlier scans
 */
export async function exportInbodyReportPdf(opts: InbodyReportOptions): Promise<void> {
  const records = [...opts.records].sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );
  const latest = records[0];

  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // --- Header band -----------------------------------------------------------
  pdf.setFillColor(12, 14, 20);
  pdf.rect(0, 0, pageW, 32, "F");
  pdf.setTextColor(245, 197, 24);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(BRAND_TITLE, margin, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(200, 200, 200);
  pdf.text(BRAND_SUBTITLE, margin, 21);
  pdf.text(`Generated ${new Date().toLocaleDateString()}`, margin, 27);
  y = 40;

  // --- Client + latest scan summary -----------------------------------------
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(`Client: ${opts.clientName}`, margin, y);
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.text(
    latest ? `Latest scan: ${fmtDate(latest.recordedAt)}` : "No InBody scans on file yet.",
    margin,
    y,
  );
  y += 8;

  if (latest) {
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, y, pageW - margin, y);
    y += 6;

    pdf.setTextColor(20, 20, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Latest Body Composition", margin, y);
    y += 6;

    const metrics: { label: string; value: string }[] = [
      { label: "Weight", value: fmt(latest.weight, "kg") },
      { label: "Body Fat", value: fmt(latest.bodyFat, "%") },
      { label: "Muscle Mass", value: fmt(latest.muscleMass, "kg") },
      { label: "BMI", value: fmt(latest.bmi) },
      { label: "Visceral Fat", value: fmt(latest.visceralFat) },
      { label: "BMR", value: fmt(latest.bmr, "kcal") },
      { label: "Body Water", value: fmt(latest.water, "L") },
      { label: "InBody Score", value: fmt(latest.score) },
    ];

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const colW = (pageW - margin * 2) / 2;
    metrics.forEach((m, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + col * colW;
      const yy = y + row * 8;
      pdf.setTextColor(110, 110, 110);
      pdf.text(`${m.label}:`, x, yy);
      pdf.setTextColor(20, 20, 20);
      pdf.setFont("helvetica", "bold");
      pdf.text(m.value, x + 35, yy);
      pdf.setFont("helvetica", "normal");
    });
    y += Math.ceil(metrics.length / 2) * 8 + 4;

    if (latest.notes) {
      pdf.setTextColor(80, 80, 80);
      pdf.setFont("helvetica", "italic");
      const lines = pdf.splitTextToSize(`Coach notes: ${latest.notes}`, pageW - margin * 2);
      pdf.text(lines, margin, y);
      y += lines.length * 5 + 4;
      pdf.setFont("helvetica", "normal");
    }
  }

  // --- Optional trends chart -------------------------------------------------
  if (opts.trendsElement) {
    try {
      const canvas = await html2canvas(opts.trendsElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      if (y + imgH + 12 > pageH) {
        pdf.addPage();
        y = margin;
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(20, 20, 20);
      pdf.text("Trends", margin, y);
      y += 5;
      pdf.addImage(imgData, "PNG", margin, y, imgW, imgH);
      y += imgH + 6;
    } catch {
      /* trends snapshot is best-effort */
    }
  }

  // --- History table ---------------------------------------------------------
  if (records.length > 1) {
    const pageH = pdf.internal.pageSize.getHeight();
    if (y + 20 > pageH) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(20, 20, 20);
    pdf.text("Scan History", margin, y);
    y += 5;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, y, pageW - margin, y);
    y += 5;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(110, 110, 110);
    pdf.text("Date", margin, y);
    pdf.text("Weight", margin + 50, y);
    pdf.text("Body Fat", margin + 80, y);
    pdf.text("Muscle", margin + 115, y);
    pdf.text("BMI", margin + 145, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(20, 20, 20);
    for (const r of records.slice(1)) {
      if (y > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(fmtDate(r.recordedAt), margin, y);
      pdf.text(fmt(r.weight, "kg"), margin + 50, y);
      pdf.text(fmt(r.bodyFat, "%"), margin + 80, y);
      pdf.text(fmt(r.muscleMass, "kg"), margin + 115, y);
      pdf.text(fmt(r.bmi), margin + 145, y);
      y += 5;
    }
  }

  // --- Footer ----------------------------------------------------------------
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    "This report is generated by Youssef Ahmed Personal Training. Values are taken from InBody scans you uploaded.",
    margin,
    pageH - 8,
  );

  const safeName = opts.clientName.replace(/\s+/g, "_");
  const filename = opts.filename || `${safeName}_InBody_Report.pdf`;
  pdf.save(filename);
}
