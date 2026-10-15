// 견본 데이터 스크립트(seed-demo, seed-accounts)가 함께 쓰는 기사 서류 견본.
import { deflateSync } from 'node:zlib';

/** 단색 PNG 한 장. 서류 사진 자리에 쓴다. */
function png(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes) =>
    (bytes.reduce((c, byte) => crcTable[(c ^ byte) & 0xff] ^ (c >>> 8), 0xffffffff) ^
      0xffffffff) >>>
    0;
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x += 1) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 한 쪽짜리 PDF. 자동차등록증 자리에 쓴다. */
function pdf(title) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 28 Tf 72 740 Td (${title}) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const at = out.length;
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** 기사 서류 세 가지의 견본 — [내용, 형식, 파일 이름]. */
export const DRIVER_DOCUMENTS = {
  DRIVER_LICENSE: [png(960, 600, [221, 226, 214]), 'image/png', 'driver_license.png'],
  VEHICLE_REGISTRATION: [pdf('Vehicle Registration (sample)'), 'application/pdf', 'vehicle_registration.pdf'],
  FREIGHT_QUALIFICATION: [png(960, 600, [226, 220, 208]), 'image/png', 'cargo_qualification.png'],
};
