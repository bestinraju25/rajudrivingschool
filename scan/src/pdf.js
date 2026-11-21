import { PDFDocument } from 'pdf-lib';

const PAGE_W = 595.28; // A4 points
const PAGE_H = 841.89;

async function imageBytes(file) { return new Uint8Array(await file.arrayBuffer()); }

export async function imagesToPdf(files, layout = 'separate') {
  if (!files?.length) throw new Error('Add at least one image before creating the PDF.');
  const pdf = await PDFDocument.create();
  const embedded = [];
  for (const file of files) {
    const bytes = await imageBytes(file);
    let image;
    try { image = await pdf.embedJpg(bytes); }
    catch { image = await pdf.embedPng(bytes); }
    embedded.push(image);
  }
  if (layout === 'single') {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const slots = embedded.length <= 2 ? 2 : embedded.length;
    const slotH = PAGE_H / slots;
    embedded.forEach((img, i) => {
      const scale = Math.min((PAGE_W - 44) / img.width, (slotH - 28) / img.height);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: (PAGE_W-w)/2, y: PAGE_H - (i+1)*slotH + (slotH-h)/2, width: w, height: h });
    });
  } else {
    for (const img of embedded) {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      const scale = Math.min((PAGE_W - 48) / img.width, (PAGE_H - 56) / img.height);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: (PAGE_W-w)/2, y: (PAGE_H-h)/2, width: w, height: h });
    }
  }
  return new Blob([await pdf.save({ useObjectStreams: true })], { type: 'application/pdf' });
}
