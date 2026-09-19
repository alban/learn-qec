/**
 * Reusable image export utilities for quantum circuit and lattice visualizers.
 * Supports high-DPI PNGs (300 DPI print-ready) and self-contained vector SVGs.
 */

import { QecDiagramMetadata, embedMetadataInPng, embedMetadataInSvg } from './metadata';

export interface ExportImageOptions {
  filename?: string;
  scale?: number; // Scaling factor for high-DPI rasterization (default: 3 for ~300 DPI)
  width?: number; // Optional explicit canvas width
  height?: number; // Optional explicit canvas height
  background?: 'dark' | 'light' | 'transparent';
  metadata?: QecDiagramMetadata; // Embedded Excalidraw-style metadata
}

/**
 * Triggers a client-side file download for a given Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Clones and sanitizes an SVG element for standalone file export or canvas drawing.
 */
export function sanitizeSvgClone(
  svgEl: SVGSVGElement,
  background: 'dark' | 'light' | 'transparent' = 'dark',
): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Ensure standard SVG XML namespace
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Determine intrinsic dimensions from viewBox or client rect
  const viewBox = svgEl.viewBox?.baseVal;
  const width = viewBox && viewBox.width > 0 ? viewBox.width : svgEl.clientWidth || 880;
  const height = viewBox && viewBox.height > 0 ? viewBox.height : svgEl.clientHeight || 520;

  clone.setAttribute('width', `${width}`);
  clone.setAttribute('height', `${height}`);

  // Insert background rectangle if not transparent
  if (background !== 'transparent') {
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', background === 'light' ? '#FFFFFF' : '#0F172A');
    clone.insertBefore(bgRect, clone.firstChild);
  }

  // If paper/light mode is requested, transform all elements into high-contrast print-ready styling
  if (background === 'light') {
    // 1. Block cards
    const rects = clone.querySelectorAll('rect');
    rects.forEach((r) => {
      const fill = r.getAttribute('fill');
      const stroke = r.getAttribute('stroke');
      if (fill && (fill.includes('url(#blockBg)') || fill === '#0F172A' || fill === '#1E293B')) {
        r.setAttribute('fill', '#F8FAFC');
      }
      if (stroke && (stroke === '#334155' || stroke === '#475569')) {
        r.setAttribute('stroke', '#CBD5E1');
      }
    });

    // 2. Qubit circles (neutral qubits get clean light background and border)
    const circles = clone.querySelectorAll('circle');
    circles.forEach((c) => {
      const fill = c.getAttribute('fill');
      if (fill === '#1E293B') {
        c.setAttribute('fill', '#F1F5F9');
        c.setAttribute('stroke', '#94A3B8');
      }
    });

    // 3. Check nodes and badges
    const paths = clone.querySelectorAll('path');
    paths.forEach((p) => {
      const stroke = p.getAttribute('stroke');
      if (stroke === '#334155' || stroke === '#475569') {
        p.setAttribute('stroke', '#94A3B8');
      }
    });

    // 4. Text labels: neutral text becomes dark slate (#0F172A), active error/defect text remains white
    const texts = clone.querySelectorAll('text');
    texts.forEach((t) => {
      const fill = t.getAttribute('fill');
      // If it's neutral text (light grey/slate), turn it dark for high contrast
      if (fill === '#E2E8F0' || fill === '#CBD5E1' || fill === '#94A3B8' || !fill) {
        t.setAttribute('fill', '#0F172A');
      }
      // Check node text
      if (fill === '#64748B') {
        t.setAttribute('fill', '#334155');
      }
    });
  }

  return clone;
}

/**
 * Exports an SVG element to a standalone .svg file.
 */
export function exportSvg(
  svgEl: SVGSVGElement,
  options: ExportImageOptions = {},
): void {
  const {
    filename = 'shor-code-lattice',
    background = 'dark',
    metadata,
  } = options;

  const sanitized = sanitizeSvgClone(svgEl, background);
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(sanitized);

  // Prepend standard XML declaration
  if (!svgString.startsWith('<?xml')) {
    svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
  }

  // Embed lossless learn-qec metadata if available
  if (metadata) {
    svgString = embedMetadataInSvg(svgString, metadata);
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${filename}.svg`);
}

/**
 * Renders an SVG element onto an HTML5 Canvas at high DPI or exact target dimensions.
 */
export function renderSvgToCanvas(
  svgEl: SVGSVGElement,
  canvas: HTMLCanvasElement,
  options: ExportImageOptions = {},
): Promise<void> {
  const { scale, width: targetW, height: targetH, background = 'dark' } = options;

  return new Promise((resolve, reject) => {
    const sanitized = sanitizeSvgClone(svgEl, background);
    const viewBox = svgEl.viewBox?.baseVal;
    const baseW = viewBox && viewBox.width > 0 ? viewBox.width : svgEl.clientWidth || 880;
    const baseH = viewBox && viewBox.height > 0 ? viewBox.height : svgEl.clientHeight || 520;

    const newW = targetW ? Math.round(targetW) : scale !== undefined ? Math.round(baseW * scale) : (canvas.width > 0 ? canvas.width : Math.round(baseW * 3));
    const newH = targetH ? Math.round(targetH) : scale !== undefined ? Math.round(baseH * scale) : (canvas.height > 0 ? canvas.height : Math.round(baseH * 3));

    if (canvas.width !== newW) canvas.width = newW;
    if (canvas.height !== newH) canvas.height = newH;

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(sanitized);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Failed to acquire 2D canvas context'));
      }

      if (background !== 'transparent') {
        ctx.fillStyle = background === 'light' ? '#FFFFFF' : '#0F172A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve();
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Exports an SVG or Canvas element to a high-DPI .png file.
 */
export async function exportPng(
  source: SVGSVGElement | HTMLCanvasElement,
  options: ExportImageOptions = {},
): Promise<void> {
  const {
    filename = 'shor-code-lattice',
    scale = 3,
    background = 'dark',
    metadata,
  } = options;

  let canvas: HTMLCanvasElement;

  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    canvas = document.createElement('canvas');
    await renderSvgToCanvas(source, canvas, { scale, background });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        return reject(new Error('Failed to create PNG blob from canvas'));
      }

      let finalBlob = blob;
      if (metadata) {
        try {
          const buffer = await blob.arrayBuffer();
          const taggedBytes = embedMetadataInPng(new Uint8Array(buffer), metadata);
          finalBlob = new Blob([taggedBytes.buffer as ArrayBuffer], { type: 'image/png' });
        } catch (err) {
          console.warn('Failed to embed learn-qec metadata in PNG:', err);
        }
      }

      downloadBlob(finalBlob, `${filename}.png`);
      resolve();
    }, 'image/png');
  });
}
