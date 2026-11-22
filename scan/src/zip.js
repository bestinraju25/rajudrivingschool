const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function makeHeader(size, write) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  write(view);
  return bytes;
}

/** Builds a standards-compliant ZIP using STORE (no recompression).
 * Source documents are already compressed JPG/PDF files, so STORE avoids
 * wasting CPU/battery on phones and preserves their exact bytes.
 */
export async function createZipBlob(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('There are no documents to include in this ZIP.');
  if (files.length > 65535) throw new Error('Too many files for this ZIP export.');

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const path = String(file.path || file.name || 'document.bin').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.split('/').some(part => part === '..')) throw new Error('A document has an invalid ZIP path.');
    const nameBytes = encoder.encode(path);
    if (nameBytes.length > 65535) throw new Error('A document filename is too long.');
    const data = new Uint8Array(await file.blob.arrayBuffer());
    if (data.length > 0xFFFFFFFF) throw new Error('A document is too large for this ZIP format.');
    const crc = crc32(data);
    const localHeader = makeHeader(30, view => {
      view.setUint32(0, 0x04034B50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true); // UTF-8 filename
      view.setUint16(8, 0, true); // STORE
      view.setUint16(10, stamp.time, true);
      view.setUint16(12, stamp.day, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
    });
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = makeHeader(46, view => {
      view.setUint32(0, 0x02014B50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, stamp.time, true);
      view.setUint16(14, stamp.day, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, data.length, true);
      view.setUint32(24, data.length, true);
      view.setUint16(28, nameBytes.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, localOffset, true);
    });
    centralParts.push(centralHeader, nameBytes);
    localOffset += localHeader.length + nameBytes.length + data.length;
    if (localOffset > 0xFFFFFFFF) throw new Error('The ZIP is too large for this phone export.');
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = makeHeader(22, view => {
    view.setUint32(0, 0x06054B50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, localOffset, true);
    view.setUint16(20, 0, true);
  });
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

export function safeZipName(value) {
  return String(value || 'Student').trim().replace(/[\\/:*?"<>|#%{}~]/g, '-').replace(/\s+/g, ' ').slice(0, 70) || 'Student';
}
