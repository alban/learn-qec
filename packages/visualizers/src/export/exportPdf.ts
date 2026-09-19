/**
 * Pure client-side PDF export for quantum lattice diagrams.
 * Embeds high-DPI rasterization into a standard PDF 1.4 document.
 */

import { downloadBlob, renderSvgToCanvas } from './exportImage';
import { QecDiagramMetadata } from './metadata';

export interface ExportPdfOptions {
  filename?: string;
  scale?: number; // Scaling factor (default: 3 for ~300 DPI)
  background?: 'dark' | 'light';
  title?: string;
  metadata?: QecDiagramMetadata;
}

/**
 * Creates a valid standalone PDF 1.4 file containing an image and embedded state metadata.
 */
export async function createPdfFromCanvas(
  canvas: HTMLCanvasElement,
  options: { title?: string; metadata?: QecDiagramMetadata } = {},
): Promise<Blob> {
  const { title = 'Quantum Error Correction Lattice', metadata } = options;
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create JPEG blob from canvas'))),
      'image/jpeg',
      0.95,
    );
  });

  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

  // PDF coordinate system is in points (72 points = 1 inch)
  const aspect = canvas.width / canvas.height;
  const widthPt = 600;
  const heightPt = Math.round(widthPt / aspect);

  const chunks: (string | Uint8Array)[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  function addString(s: string) {
    chunks.push(s);
    currentOffset += new TextEncoder().encode(s).length;
  }

  function addBytes(b: Uint8Array) {
    chunks.push(b);
    currentOffset += b.length;
  }

  function recordObject() {
    offsets.push(currentOffset);
  }

  // PDF Header
  addString('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  if (metadata) {
    addString(`% learn-qec-state: ${JSON.stringify(metadata)}\n`);
  }

  // Object 1: Catalog
  recordObject();
  addString('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  recordObject();
  addString('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page
  recordObject();
  addString(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
  );

  // Object 4: Page Content Stream
  const streamContent = `q ${widthPt} 0 0 ${heightPt} 0 0 cm /Im1 Do Q`;
  recordObject();
  addString(
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  );

  // Object 5: Image XObject
  recordObject();
  const header = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  addString(header);
  addBytes(jpegBytes);
  addString('\nendstream\nendobj\n');

  // Object 6: Info Dictionary
  recordObject();
  const safeTitle = title.replace(/[()\\]/g, '');
  addString(`6 0 obj\n<< /Title (${safeTitle}) /Producer (learn-qec) /Subject (learn-qec-state) >>\nendobj\n`);

  // Cross-reference table (xref)
  const xrefOffset = currentOffset;
  addString('xref\n0 7\n0000000000 65535 f \n');
  for (const off of offsets) {
    addString(`${String(off).padStart(10, '0')} 00000 n \n`);
  }

  // Trailer
  addString(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

/**
 * Exports an SVG element to a standalone .pdf file with embedded state metadata.
 */
export async function exportPdf(
  svgEl: SVGSVGElement,
  options: ExportPdfOptions = {},
): Promise<void> {
  const {
    filename = 'shor-code-lattice',
    scale = 3,
    background = 'light', // PDFs default to paper/print light mode
    title = 'Quantum Error Correction Lattice',
    metadata,
  } = options;

  const canvas = document.createElement('canvas');
  await renderSvgToCanvas(svgEl, canvas, { scale, background });

  const blob = await createPdfFromCanvas(canvas, { title, metadata });
  downloadBlob(blob, `${filename}.pdf`);
}
