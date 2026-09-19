import React, { useState, useCallback, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  X,
  FileImage,
  FileCode,
  FileText,
  Binary,
  Layers,
  Info,
} from 'lucide-react';
import {
  exportSvg,
  exportPng,
  downloadBlob,
  renderSvgToCanvas,
} from '../export/exportImage';
import { exportPdf } from '../export/exportPdf';
import { generateShorTikz } from '../export/shorTikz';
import {
  createDiagramMetadata,
  QecDiagramMetadata,
  embedMetadataInPng,
} from '../export/metadata';

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'latex' | 'json';
export type ExportBackground = 'dark' | 'light' | 'transparent';
export type LatexMode = 'figure' | 'standalone' | 'snippet';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  errors: Uint8Array | number[];
  syndromes: Uint8Array | number[];
  activeCorrection?: { qubit: number; pauli: number } | null;
  codeName?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  svgRef,
  errors,
  syndromes,
  activeCorrection = null,
  codeName = 'shor-code-lattice',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [background, setBackground] = useState<ExportBackground>('dark');
  const [pngScale, setPngScale] = useState<number>(3); // 3 = ~300 DPI
  const [latexMode, setLatexMode] = useState<LatexMode>('figure');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customFilename, setCustomFilename] = useState<string>(codeName || 'shor-code-lattice');

  useEffect(() => {
    if (isOpen) {
      setCustomFilename(codeName || 'shor-code-lattice');
    }
  }, [isOpen, codeName]);

  const getFileExtension = (format: ExportFormat): string => {
    switch (format) {
      case 'png':
        return 'png';
      case 'svg':
        return 'svg';
      case 'pdf':
        return 'pdf';
      case 'latex':
        return 'tex';
      case 'json':
        return 'qec.json';
    }
  };

  const getCleanFilename = (format: ExportFormat): string => {
    let name = customFilename.trim();
    const ext = getFileExtension(format);
    if (format === 'json') {
      if (name.toLowerCase().endsWith('.qec.json')) {
        name = name.slice(0, -9);
      } else if (name.toLowerCase().endsWith('.json')) {
        name = name.slice(0, -5);
      }
    } else {
      if (name.toLowerCase().endsWith(`.${ext}`)) {
        name = name.slice(0, -(ext.length + 1));
      }
    }
    return name.trim() || codeName || 'shor-code-lattice';
  };

  const getMetadata = useCallback((): QecDiagramMetadata => {
    return createDiagramMetadata('shor', errors, syndromes);
  }, [errors, syndromes]);

  const getLatexCode = useCallback(() => {
    return generateShorTikz(errors, syndromes, {
      standalone: latexMode === 'standalone',
      asFigure: latexMode === 'figure',
      paperMode: background === 'light',
      activeCorrection,
    });
  }, [errors, syndromes, latexMode, background, activeCorrection]);

  const handleDownload = useCallback(async () => {
    if (!svgRef.current) return;
    setIsProcessing(true);

    try {
      const meta = getMetadata();
      const baseFilename = getCleanFilename(selectedFormat);

      switch (selectedFormat) {
        case 'png':
          await exportPng(svgRef.current, {
            filename: baseFilename,
            scale: pngScale,
            background,
            metadata: meta,
          });
          break;

        case 'svg':
          exportSvg(svgRef.current, {
            filename: baseFilename,
            background,
            metadata: meta,
          });
          break;

        case 'pdf':
          await exportPdf(svgRef.current, {
            filename: baseFilename,
            scale: 3,
            background: background === 'transparent' ? 'light' : (background as 'dark' | 'light'),
            metadata: meta,
          });
          break;

        case 'latex': {
          const texCode = getLatexCode();
          const blob = new Blob([texCode], { type: 'text/x-tex;charset=utf-8' });
          downloadBlob(blob, `${baseFilename}.tex`);
          break;
        }

        case 'json': {
          const jsonStr = JSON.stringify(meta, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
          downloadBlob(blob, `${baseFilename}.qec.json`);
          break;
        }
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [svgRef, selectedFormat, customFilename, codeName, pngScale, background, getMetadata, getLatexCode]);

  const handleCopy = useCallback(async () => {
    if (!svgRef.current) return;
    setIsProcessing(true);

    try {
      switch (selectedFormat) {
        case 'png': {
          const canvas = document.createElement('canvas');
          await renderSvgToCanvas(svgRef.current, canvas, { scale: 2, background });
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/png'),
          );
          if (blob && navigator.clipboard && (window as any).ClipboardItem) {
            let finalBlob = blob;
            try {
              const meta = getMetadata();
              const buffer = await blob.arrayBuffer();
              const taggedBytes = embedMetadataInPng(new Uint8Array(buffer), meta);
              finalBlob = new Blob([taggedBytes.buffer as ArrayBuffer], { type: 'image/png' });
            } catch (err) {
              console.warn('Failed to embed learn-qec metadata in clipboard PNG:', err);
            }

            await navigator.clipboard.write([
              new (window as any).ClipboardItem({ 'image/png': finalBlob }),
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } else {
            throw new Error('Clipboard image writing is not supported in this browser.');
          }
          break;
        }

        case 'svg': {
          const serializer = new XMLSerializer();
          const sanitized = svgRef.current.cloneNode(true) as SVGSVGElement;
          sanitized.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          const xml = serializer.serializeToString(sanitized);
          await navigator.clipboard.writeText(xml);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          break;
        }

        case 'latex': {
          const texCode = getLatexCode();
          await navigator.clipboard.writeText(texCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          break;
        }

        case 'json': {
          const meta = getMetadata();
          await navigator.clipboard.writeText(JSON.stringify(meta, null, 2));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          break;
        }

        case 'pdf':
          // Copying raw PDF binary to clipboard is disallowed by browser security policies
          break;
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [svgRef, selectedFormat, background, getLatexCode, getMetadata]);

  if (!isOpen) return null;

  const isCopyDisabled = selectedFormat === 'pdf' || isProcessing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-200 relative flex flex-col space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Export Diagram</h3>
              <p className="text-xs text-slate-400">
                Choose format, styling, and copy to clipboard or download
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selection Cards */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-400 block mb-2">
            Select Format:
          </label>
          <div className="grid grid-cols-5 gap-2 text-xs">
            {[
              { id: 'png', label: 'PNG', icon: FileImage, desc: '300 DPI Image' },
              { id: 'svg', label: 'SVG', icon: Layers, desc: 'Vector Graphic' },
              { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Vector Print' },
              { id: 'latex', label: 'LaTeX', icon: FileCode, desc: 'TikZ Code' },
              { id: 'json', label: 'JSON', icon: Binary, desc: 'State Data' },
            ].map((fmt) => {
              const Icon = fmt.icon;
              const isSelected = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id as ExportFormat)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/10'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className="font-bold font-mono text-xs">{fmt.label}</span>
                  <span className="text-[10px] text-slate-500 leading-tight mt-0.5">{fmt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Format Specific Options */}
        <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 space-y-4 text-xs font-mono">
          {/* Background selector */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Background Theme:</span>
            <div className="flex space-x-1.5">
              {(['dark', 'light', 'transparent'] as const).map((bg) => {
                const isSelected = background === bg;
                return (
                  <button
                    key={bg}
                    onClick={() => setBackground(bg)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] transition capitalize ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {bg === 'light' ? 'Paper (White)' : bg}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PNG specific: Scale / Resolution */}
          {selectedFormat === 'png' && (
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <span className="text-slate-400 font-medium">Resolution:</span>
              <div className="flex space-x-1.5">
                {[
                  { scale: 1, label: '1x (Web)' },
                  { scale: 2, label: '2x (Retina)' },
                  { scale: 3, label: '3x (300 DPI Print)' },
                ].map((opt) => (
                  <button
                    key={opt.scale}
                    onClick={() => setPngScale(opt.scale)}
                    className={`px-2 py-1 rounded-lg border text-[11px] transition ${
                      pngScale === opt.scale
                        ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LaTeX specific: Mode */}
          {selectedFormat === 'latex' && (
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <span className="text-slate-400 font-medium">Environment:</span>
              <div className="flex space-x-1.5">
                {[
                  { id: 'figure', label: '\\begin{figure}' },
                  { id: 'snippet', label: 'TikZ Only' },
                  { id: 'standalone', label: 'Standalone File' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setLatexMode(mode.id as LatexMode)}
                    className={`px-2 py-1 rounded-lg border text-[11px] transition ${
                      latexMode === mode.id
                        ? 'bg-amber-600 border-amber-500 text-white font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PDF notice regarding clipboard copying */}
          {selectedFormat === 'pdf' && (
            <div className="flex items-start space-x-2 text-slate-400 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>
                PDF documents are vector-scaled and print-ready. Web browsers restrict the system clipboard to images and text, so use <strong>Download PDF</strong>.
              </span>
            </div>
          )}

          {/* Metadata badge reminder */}
          <div className="text-[10px] text-slate-500 flex items-center space-x-1.5 border-t border-slate-800/60 pt-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
            <span>
              Lossless learn-qec state metadata is embedded for 1-click re-importing.
            </span>
          </div>
        </div>

        {/* Filename Input */}
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-400">
            File Name:
          </label>
          <div className="flex items-center rounded-xl bg-slate-950/60 border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 px-3 py-2 transition">
            <input
              type="text"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDownload();
                }
              }}
              placeholder={codeName || 'shor-code-lattice'}
              className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full font-mono"
            />
            <span className="text-xs font-mono font-medium text-indigo-400 bg-indigo-950/50 border border-indigo-800/60 rounded px-1.5 py-0.5 select-none ml-2 whitespace-nowrap">
              .{getFileExtension(selectedFormat)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2.5">
            {/* Copy to Clipboard Button */}
            <button
              onClick={handleCopy}
              disabled={isCopyDisabled}
              title={
                selectedFormat === 'pdf'
                  ? 'Clipboard copy is unavailable for PDF files (browsers only permit image and text formats).'
                  : 'Copy to clipboard'
              }
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition flex items-center space-x-2 shadow-sm ${
                selectedFormat === 'pdf'
                  ? 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                  : copied
                  ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700/80 cursor-pointer'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-75 duration-150" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {selectedFormat === 'png' ? 'Copy Image' : 'Copy Code'}
                  </span>
                </>
              )}
            </button>

            {/* Download File Button */}
            <button
              onClick={handleDownload}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-2 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                Download .{getFileExtension(selectedFormat)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
