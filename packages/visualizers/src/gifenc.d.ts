declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      options?: { palette: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { auto?: boolean }): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors?: number,
    options?: { format?: string; oneBitAlpha?: boolean },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}
