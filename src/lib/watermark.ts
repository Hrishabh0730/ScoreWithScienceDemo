import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Stamps every page with the buyer's identity and order number:
 * a small footer line plus a faint diagonal mark.
 */
export async function watermarkPdf(input: ArrayBuffer | Uint8Array, label: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const text = label.replace(/[^\x20-\x7E]/g, "?"); // standard fonts are ASCII-only
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const footerSize = Math.max(6, Math.min(9, width / 70));
    page.drawText(text, {
      x: 18,
      y: 10,
      size: footerSize,
      font,
      color: rgb(0.35, 0.35, 0.45),
      opacity: 0.8,
    });
    const diagSize = Math.max(10, Math.min(22, width / 28));
    const textWidth = font.widthOfTextAtSize(text, diagSize);
    page.drawText(text, {
      x: width / 2 - (textWidth / 2) * Math.cos(Math.PI / 6),
      y: height / 2 - (textWidth / 2) * Math.sin(Math.PI / 6),
      size: diagSize,
      font,
      color: rgb(0.1, 0.2, 0.45),
      opacity: 0.08,
      rotate: degrees(30),
    });
  }
  pdf.setProducer("ScoreWithScience");
  return pdf.save();
}
