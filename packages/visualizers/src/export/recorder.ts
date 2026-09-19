/**
 * In-browser client-side video and GIF recorder.
 * High-performance, zero-backend frame capture for quantum error correction animations.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { downloadBlob } from './exportImage';

export interface RecorderOptions {
  filename?: string;
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (percent: number, statusText: string) => void;
}

/**
 * Encodes an animation sequence into an animated GIF client-side.
 * Runs deterministically frame-by-frame.
 */
export async function recordAnimationGif(
  renderFrame: (frameIndex: number, progress: number, canvas: HTMLCanvasElement) => Promise<void>,
  totalFrames: number,
  options: RecorderOptions = {},
): Promise<void> {
  const {
    filename = 'shor-code-correction',
    fps = 15,
    width = 880,
    height = 520,
    onProgress,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot acquire 2D canvas context');

  const gif = GIFEncoder();
  const frameDelay = Math.round(1000 / fps);

  for (let i = 0; i < totalFrames; i++) {
    const progress = totalFrames > 1 ? i / (totalFrames - 1) : 1;
    onProgress?.(
      Math.round((i / totalFrames) * 100),
      `Rendering GIF frame ${i + 1}/${totalFrames}...`,
    );

    // Render state to canvas
    await renderFrame(i, progress, canvas);

    // Dynamically sample the full canvas dimensions in case renderFrame sized the canvas
    const actualW = canvas.width;
    const actualH = canvas.height;

    // Extract RGBA buffer and quantize
    const { data } = ctx.getImageData(0, 0, actualW, actualH);
    const palette = quantize(data, 256);
    const indexedPixels = applyPalette(data, palette);

    gif.writeFrame(indexedPixels, actualW, actualH, {
      palette,
      delay: frameDelay,
    });

    // Yield to main thread briefly so UI updates
    await new Promise((r) => setTimeout(r, 0));
  }

  onProgress?.(98, 'Finalizing GIF binary...');
  gif.finish();

  const blob = new Blob([gif.bytes() as any], { type: 'image/gif' });
  downloadBlob(blob, `${filename}.gif`);
  onProgress?.(100, 'GIF downloaded!');
}

/**
 * Encodes an animation sequence into a WebM or MP4 video client-side using MediaRecorder.
 */
export async function recordAnimationVideo(
  renderFrame: (frameIndex: number, progress: number, canvas: HTMLCanvasElement) => Promise<void>,
  totalFrames: number,
  options: RecorderOptions = {},
): Promise<void> {
  const {
    filename = 'shor-code-correction',
    fps = 30,
    width = 880,
    height = 520,
    onProgress,
  } = options;

  // 1. Primary stream canvas (connected to MediaRecorder via captureStream)
  const streamCanvas = document.createElement('canvas');
  streamCanvas.width = width;
  streamCanvas.height = height;
  const streamCtx = streamCanvas.getContext('2d');
  if (!streamCtx) throw new Error('Cannot acquire 2D canvas context for video stream');

  // Immediately paint opaque dark background so video stream is never transparent black
  streamCtx.fillStyle = '#0F172A';
  streamCtx.fillRect(0, 0, width, height);

  if (typeof streamCanvas.captureStream !== 'function') {
    throw new Error('Canvas.captureStream() is not supported in this browser.');
  }

  // 2. Offscreen staging canvas for rendering frames (completely decoupled from stream)
  const stagingCanvas = document.createElement('canvas');
  stagingCanvas.width = width;
  stagingCanvas.height = height;
  const stagingCtx = stagingCanvas.getContext('2d');
  if (stagingCtx) {
    stagingCtx.fillStyle = '#0F172A';
    stagingCtx.fillRect(0, 0, width, height);
  }

  // Detect preferred supported container and codec
  const preferredTypes = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  let selectedMime = 'video/webm';
  for (const t of preferredTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      selectedMime = t;
      break;
    }
  }

  const isMp4 = selectedMime.includes('mp4');
  const ext = isMp4 ? 'mp4' : 'webm';

  // 3. Pre-render initial frame onto staging canvas and blit to streamCanvas BEFORE starting recorder
  await renderFrame(0, 0, stagingCanvas);
  streamCtx.drawImage(stagingCanvas, 0, 0);

  const stream = streamCanvas.captureStream(fps);
  const track = stream.getVideoTracks()[0] as any;
  if (track && typeof track.requestFrame === 'function') {
    track.requestFrame();
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 4_000_000,
  });

  const recordedChunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => {
      try {
        const blob = new Blob(recordedChunks, { type: selectedMime });
        downloadBlob(blob, `${filename}.${ext}`);
        onProgress?.(100, `Video (${ext.toUpperCase()}) downloaded!`);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  const frameIntervalMs = 1000 / fps;

  for (let i = 0; i < totalFrames; i++) {
    const progress = totalFrames > 1 ? i / (totalFrames - 1) : 1;
    onProgress?.(
      Math.round((i / totalFrames) * 100),
      `Recording frame ${i + 1}/${totalFrames}...`,
    );

    await renderFrame(i, progress, stagingCanvas);

    // Atomically blit fully-rendered staging canvas onto the stream canvas
    streamCtx.drawImage(stagingCanvas, 0, 0);

    if (track && typeof track.requestFrame === 'function') {
      track.requestFrame();
    }

    await new Promise((r) => setTimeout(r, frameIntervalMs));
  }

  // Hold final frame for 400ms so viewer sees clean/verified state
  await new Promise((r) => setTimeout(r, 400));

  onProgress?.(95, 'Finalizing video stream...');
  recorder.stop();
  await recordingPromise;
}
