import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
    // Multi-page: paint the same wide image, shifted up on each new page.
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
