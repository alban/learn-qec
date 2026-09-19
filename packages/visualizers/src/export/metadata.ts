/**
 * Metadata management and Excalidraw-style state embedding/extraction
 * for quantum error correction diagrams across PNG, SVG, LaTeX, and JSON.
 */

export interface QecDiagramMetadata {
  format: 'learn-qec';
  version: 1;
  code: string; // e.g. 'shor' | 'steane' | 'surface'
  numQubits: number;
  errors: number[]; // 0: I, 1: X, 2: Y, 3: Z
  syndromes?: number[];
  title?: string;
  description?: string;
  timestamp?: string;
}

// Precomputed CRC32 table for PNG chunk generation
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a standard metadata object for the current quantum lattice state.
 */
export function createDiagramMetadata(
  code: string,
  errors: Uint8Array | number[],
  syndromes?: Uint8Array | number[],
  options?: { title?: string; description?: string },
): QecDiagramMetadata {
  return {
    format: 'learn-qec',
    version: 1,
    code,
    numQubits: errors.length,
    errors: Array.from(errors),
    syndromes: syndromes ? Array.from(syndromes) : undefined,
    title: options?.title || `${code.toUpperCase()} Code Lattice`,
    description: options?.description,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Injects a 'tEXt' chunk containing JSON metadata into a PNG byte buffer.
 * Places the chunk immediately after the 25-byte IHDR chunk.
 */
export function embedMetadataInPng(pngBytes: Uint8Array, metadata: QecDiagramMetadata): Uint8Array {
  // Verify 8-byte PNG header
  if (
    pngBytes[0] !== 0x89 ||
    pngBytes[1] !== 0x50 ||
    pngBytes[2] !== 0x4e ||
    pngBytes[3] !== 0x47 ||
    pngBytes[4] !== 0x0d ||
    pngBytes[5] !== 0x0a ||
    pngBytes[6] !== 0x1a ||
    pngBytes[7] !== 0x0a
  ) {
    throw new Error('Provided buffer is not a valid PNG image');
  }

  const keyword = 'learn-qec';
  const jsonText = JSON.stringify(metadata);

  const encoder = new TextEncoder();
  const keywordBytes = encoder.encode(keyword);
  const textBytes = encoder.encode(jsonText);

  // tEXt data = keyword + null byte (0x00) + text
  const dataLength = keywordBytes.length + 1 + textBytes.length;
  // Total chunk size = 4 (length) + 4 (type) + dataLength + 4 (crc)
  const chunkTotalLength = 12 + dataLength;

  const chunk = new Uint8Array(chunkTotalLength);
  const dv = new DataView(chunk.buffer);

  // 1. Length (Big Endian)
  dv.setUint32(0, dataLength);

  // 2. Type: 'tEXt'
  chunk[4] = 116; // 't'
  chunk[5] = 69;  // 'E'
  chunk[6] = 88;  // 'X'
  chunk[7] = 116; // 't'

  // 3. Data
  chunk.set(keywordBytes, 8);
  chunk[8 + keywordBytes.length] = 0; // null separator
  chunk.set(textBytes, 8 + keywordBytes.length + 1);

  // 4. CRC32 calculated on type + data
  const typeAndData = chunk.subarray(4, 8 + dataLength);
  const crc = computeCrc32(typeAndData);
  dv.setUint32(8 + dataLength, crc);

  // Determine end of IHDR chunk (offset 8 + 4 len + 4 type + IHDR_len + 4 crc)
  const ihdrLen = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength).getUint32(8);
  const ihdrEndOffset = 8 + 4 + 4 + ihdrLen + 4;

  // Combine: [Header + IHDR] + [tEXt Chunk] + [Rest of PNG]
  const result = new Uint8Array(pngBytes.length + chunkTotalLength);
  result.set(pngBytes.subarray(0, ihdrEndOffset), 0);
  result.set(chunk, ihdrEndOffset);
  result.set(pngBytes.subarray(ihdrEndOffset), ihdrEndOffset + chunkTotalLength);

  return result;
}

/**
 * Extracts QecDiagramMetadata from a PNG's 'tEXt' chunks if present.
 */
export function extractMetadataFromPng(pngBytes: Uint8Array): QecDiagramMetadata | null {
  if (
    pngBytes[0] !== 0x89 ||
    pngBytes[1] !== 0x50 ||
    pngBytes[2] !== 0x4e ||
    pngBytes[3] !== 0x47
  ) {
    return null;
  }

  const dv = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  let offset = 8;
  const decoder = new TextDecoder();

  while (offset + 8 <= pngBytes.length) {
    const chunkLength = dv.getUint32(offset);
    const chunkType = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7],
    );

    if (chunkType === 'tEXt') {
      const dataStart = offset + 8;
      const dataEnd = dataStart + chunkLength;
      let nullIdx = dataStart;
      while (nullIdx < dataEnd && pngBytes[nullIdx] !== 0) {
        nullIdx++;
      }
      if (nullIdx < dataEnd) {
        const keyword = decoder.decode(pngBytes.subarray(dataStart, nullIdx));
        if (keyword === 'learn-qec' || keyword === 'qec-state') {
          const rawJson = decoder.decode(pngBytes.subarray(nullIdx + 1, dataEnd));
          try {
            const parsed = JSON.parse(rawJson);
            if (parsed && parsed.format === 'learn-qec' && Array.isArray(parsed.errors)) {
              return parsed as QecDiagramMetadata;
            }
          } catch {
            // Ignore parse errors on corrupted chunks
          }
        }
      }
    }

    offset += 12 + chunkLength;
  }

  return null;
}

/**
 * Injects metadata into an SVG document as both a `<metadata>` tag and an XML comment.
 */
export function embedMetadataInSvg(svgString: string, metadata: QecDiagramMetadata): string {
  const json = JSON.stringify(metadata);
  const metadataTag = `<metadata id="learn-qec"><![CDATA[${json}]]></metadata>`;
  const commentTag = `<!-- learn-qec-state: ${json} -->`;

  // Insert comment right after opening <svg ...> tag
  const svgOpenTagMatch = svgString.match(/<svg[^>]*>/);
  if (svgOpenTagMatch && svgOpenTagMatch.index !== undefined) {
    const insertIdx = svgOpenTagMatch.index + svgOpenTagMatch[0].length;
    return (
      svgString.slice(0, insertIdx) +
      '\n  ' +
      commentTag +
      '\n  ' +
      metadataTag +
      svgString.slice(insertIdx)
    );
  }

  return `${commentTag}\n${svgString}`;
}

/**
 * Extracts QecDiagramMetadata from an SVG string.
 */
export function extractMetadataFromSvg(svgString: string): QecDiagramMetadata | null {
  // 1. Check comment pattern
  const commentMatch = svgString.match(/<!--\s*learn-qec-state:\s*(\{.+?\})\s*-->/s);
  if (commentMatch && commentMatch[1]) {
    try {
      const parsed = JSON.parse(commentMatch[1]);
      if (parsed && parsed.format === 'learn-qec' && Array.isArray(parsed.errors)) {
        return parsed as QecDiagramMetadata;
      }
    } catch {
      // Continue to next check
    }
  }

  // 2. Check <metadata id="learn-qec"> tag
  const metadataTagMatch = svgString.match(/<metadata[^>]*id=["']learn-qec["'][^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/metadata>/s);
  if (metadataTagMatch && metadataTagMatch[1]) {
    try {
      const parsed = JSON.parse(metadataTagMatch[1].trim());
      if (parsed && parsed.format === 'learn-qec' && Array.isArray(parsed.errors)) {
        return parsed as QecDiagramMetadata;
      }
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Embeds metadata comment at the top of a LaTeX / TikZ document.
 */
export function embedMetadataInLatex(latexString: string, metadata: QecDiagramMetadata): string {
  const comment = `% learn-qec-state: ${JSON.stringify(metadata)}\n`;
  return comment + latexString;
}

/**
 * Extracts QecDiagramMetadata from a LaTeX / TikZ string or file.
 */
export function extractMetadataFromLatex(latexString: string): QecDiagramMetadata | null {
  const match = latexString.match(/%\s*learn-qec-state:\s*(\{[^\r\n]*?\})(?:\r?\n|\\n|$)/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed.format === 'learn-qec' && Array.isArray(parsed.errors)) {
        return parsed as QecDiagramMetadata;
      }
    } catch {
      // Fallback
    }
  }
  return null;
}

/**
 * Sniffs and extracts metadata from any supported text representation (LaTeX, SVG, JSON).
 */
export function extractMetadataFromText(text: string): QecDiagramMetadata | null {
  const trimmed = text.trim();

  // Try direct JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.format === 'learn-qec' && Array.isArray(parsed.errors)) {
        return parsed as QecDiagramMetadata;
      }
    } catch {
      // Not raw JSON
    }
  }

  // Try LaTeX comment
  const latexMeta = extractMetadataFromLatex(trimmed);
  if (latexMeta) return latexMeta;

  // Try SVG
  const svgMeta = extractMetadataFromSvg(trimmed);
  if (svgMeta) return svgMeta;

  return null;
}

/**
 * Universal file importer: accepts any File (.png, .svg, .tex, .json)
 * and extracts the embedded QecDiagramMetadata.
 */
export async function importDiagramFromFile(file: File): Promise<QecDiagramMetadata> {
  const fileName = file.name.toLowerCase();

  // PNG file
  if (fileName.endsWith('.png') || file.type === 'image/png') {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const meta = extractMetadataFromPng(bytes);
    if (!meta) {
      throw new Error(
        'No learn-qec metadata found in this PNG file. PNGs must be exported directly from learn-qec to contain embedded state.',
      );
    }
    return meta;
  }

  // PDF file
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    const text = await file.text();
    const meta = extractMetadataFromLatex(text);
    if (meta) return meta;
    throw new Error(
      'No learn-qec metadata found in this PDF file. PDFs must be exported directly from learn-qec to contain embedded state.',
    );
  }

  // Text-based files (SVG, TeX, JSON)
  const text = await file.text();
  const meta = extractMetadataFromText(text);
  if (!meta) {
    throw new Error(
      `Could not find valid learn-qec metadata in "${file.name}". Please ensure the file was exported from learn-qec.`,
    );
  }

  return meta;
}
