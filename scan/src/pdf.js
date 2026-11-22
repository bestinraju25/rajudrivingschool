import { PDFDocument } from 'pdf-lib';

const PAGE_W = 595.28; // A4 points
const PAGE_H = 841.89;
export const MAX_PDF_BYTES = 480 * 1024;

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name || 'one selected image'}. Choose a JPG or PNG image and try again.`)); };
    image.src = url;
  });
}

function toJpeg(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not compress a selected page.')), 'image/jpeg', quality));
}

function drawPages(pdf, images, layout) {
  if (layout === 'single') {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const slotH = PAGE_H / Math.max(images.length, 1);
    images.forEach((img, i) => {
      const scale = Math.min((PAGE_W - 44) / img.width, (slotH - 24) / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      page.drawImage(img, {
        x: (PAGE_W - width) / 2,
        y: PAGE_H - (i + 1) * slotH + (slotH - height) / 2,
        width,
        height
      });
    });
    return;
  }
  for (const img of images) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const scale = Math.min((PAGE_W - 48) / img.width, (PAGE_H - 56) / img.height);
    const width = img.width * scale;
    const height = img.height * scale;
    page.drawImage(img, { x: (PAGE_W - width) / 2, y: (PAGE_H - height) / 2, width, height });
  }
}

// Every PDF export path uses this compressor: Merge Files, Aadhaar, Licence and named documents.
// It retries at progressively smaller dimensions/quality and refuses to return an oversized file.
export async function imagesToPdf(files, layout = 'separate') {
  if (!files?.length) throw new Error('Add at least one image before creating the PDF.');
  const attempts = [
    [1800, 0.74], [1650, 0.69], [1500, 0.65], [1400, 0.61],
    [1300, 0.57], [1200, 0.54], [1100, 0.51], [1000, 0.48],
    [900, 0.45], [800, 0.42], [700, 0.39], [600, 0.36], [500, 0.34],
    [450, 0.32], [400, 0.30], [350, 0.28], [300, 0.26]
  ];
  let lastSize = 0;
  const decoded = await Promise.all(files.map(decodeImage));

  for (const [maxEdge, quality] of attempts) {
    const pdf = await PDFDocument.create();
    const embedded = [];
    for (let i = 0; i < files.length; i++) {
      const image = decoded[i];
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      const ratio = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
      canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const jpeg = await toJpeg(canvas, quality);
      embedded.push(await pdf.embedJpg(new Uint8Array(await jpeg.arrayBuffer())));
    }
    drawPages(pdf, embedded, layout);
    const bytes = new Uint8Array(await pdf.save({ useObjectStreams: true }));
    lastSize = bytes.byteLength;
    if (lastSize <= MAX_PDF_BYTES) return new Blob([bytes], { type: 'application/pdf' });
  }
  throw new Error(`This PDF is still ${Math.ceil(lastSize / 1024)} KB after compression. The maximum allowed is 480 KB. Try fewer pages or crop the documents closer to the details. Nothing oversized was saved.`);
}
