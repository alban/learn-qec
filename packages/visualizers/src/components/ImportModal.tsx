import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileUp,
  ClipboardPaste,
  FileCode,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  QecDiagramMetadata,
  importDiagramFromFile,
  extractMetadataFromText,
} from '../export/metadata';

export type ImportTab = 'file' | 'clipboard' | 'paste';

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (metadata: QecDiagramMetadata) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<QecDiagramMetadata | null>(null);
  const [clipboardSourceDesc, setClipboardSourceDesc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ImportTab>('file');
  const [pastedText, setPastedText] = useState('');
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setErrorMsg(null);
    setDetectedMeta(null);
    setClipboardSourceDesc(null);
    setPastedText('');
    setIsDragging(false);
    setIsReadingClipboard(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const processFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    setClipboardSourceDesc(null);
    try {
      const meta = await importDiagramFromFile(file);
      setDetectedMeta(meta);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse file');
      setDetectedMeta(null);
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile],
  );

  const handlePasteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPastedText(val);
    setErrorMsg(null);
    setClipboardSourceDesc(null);

    if (!val.trim()) {
      setDetectedMeta(null);
      return;
    }

    const meta = extractMetadataFromText(val);
    if (meta) {
      setDetectedMeta(meta);
      setErrorMsg(null);
    } else {
      setDetectedMeta(null);
      setErrorMsg(
        'Could not find valid learn-qec metadata in pasted content. Paste a LaTeX TikZ file with % learn-qec-state comment, an SVG, or JSON.',
      );
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    setErrorMsg(null);
    setIsReadingClipboard(true);

    try {
      // 1. Try reading clipboard items (can read image/png copied from Export modal!)
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes('image/png')) {
              const blob = await item.getType('image/png');
              const file = new File([blob], 'clipboard-image.png', { type: 'image/png' });
              const meta = await importDiagramFromFile(file);
              setDetectedMeta(meta);
              setClipboardSourceDesc('System clipboard (PNG image with embedded state metadata)');
              setActiveTab('clipboard');
              return;
            }

            if (item.types.includes('text/plain')) {
              const blob = await item.getType('text/plain');
              const text = await blob.text();
              if (text && text.trim()) {
                const meta = extractMetadataFromText(text);
                if (meta) {
                  setDetectedMeta(meta);
                  setPastedText(text);
                  setClipboardSourceDesc('System clipboard (LaTeX TikZ / SVG / JSON text)');
                  setActiveTab('clipboard');
                  return;
                }
              }
            }
          }
        } catch (itemErr: any) {
          console.warn('navigator.clipboard.read() warning, attempting readText():', itemErr);
        }
      }

      // 2. Fallback to readText()
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          throw new Error('Clipboard is empty. Copy a diagram image, LaTeX TikZ snippet, or JSON state first.');
        }

        const meta = extractMetadataFromText(text);
        if (meta) {
          setDetectedMeta(meta);
          setPastedText(text);
          setClipboardSourceDesc('System clipboard (text)');
          setActiveTab('clipboard');
          return;
        } else {
          throw new Error(
            'Could not find valid learn-qec metadata in clipboard content. Ensure it contains a % learn-qec-state comment, SVG, or JSON.',
          );
        }
      }

      throw new Error('Clipboard API is not supported in this browser.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to read from clipboard');
      setDetectedMeta(null);
    } finally {
      setIsReadingClipboard(false);
    }
  }, []);

  // Global paste handler when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && target.getAttribute('type') === 'text') {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      if (clipboardData.files && clipboardData.files.length > 0) {
        const file = clipboardData.files[0];
        e.preventDefault();
        processFile(file);
        return;
      }

      const text = clipboardData.getData('text');
      if (text && text.trim()) {
        const meta = extractMetadataFromText(text);
        if (meta) {
          e.preventDefault();
          setPastedText(text);
          setDetectedMeta(meta);
          setClipboardSourceDesc('Pasted from clipboard');
          setErrorMsg(null);
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [isOpen, processFile]);

  const handleApply = useCallback(() => {
    if (!detectedMeta) return;
    onImport(detectedMeta);
    handleClose();
  }, [detectedMeta, onImport, handleClose]);

  if (!isOpen) return null;

  // Format Pauli error breakdown for preview
  const pauliNames = ['I', 'X', 'Y', 'Z'];
  const errorSummaries: string[] = [];
  if (detectedMeta) {
    detectedMeta.errors.forEach((p, idx) => {
      if (p !== 0) {
        errorSummaries.push(`Q${idx}: ${pauliNames[p]}`);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-200 relative flex flex-col space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Import Diagram / State</h3>
              <p className="text-xs text-slate-400">
                Load state from an exported PNG, SVG, PDF, LaTeX (.tex), or JSON
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex space-x-2 border-b border-slate-800 pb-2 text-xs font-mono">
          <button
            onClick={() => {
              setActiveTab('file');
              setErrorMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'file'
                ? 'bg-indigo-600 text-white font-medium shadow-sm shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('clipboard');
              setErrorMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'clipboard'
                ? 'bg-indigo-600 text-white font-medium shadow-sm shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Import from Clipboard</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('paste');
              setErrorMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'paste'
                ? 'bg-indigo-600 text-white font-medium shadow-sm shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Paste Code</span>
          </button>
        </div>

        {/* Body content based on tab */}
        {activeTab === 'file' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.svg,.pdf,.tex,.latex,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/60'
              }`}
            >
              <div className="p-3 rounded-full bg-slate-800 text-slate-300 mb-3 shadow-inner">
                <FileUp className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-slate-200 mb-1">
                Drop your diagram file here, or{' '}
                <span className="text-indigo-400 underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-slate-500">
                Supports <span className="font-mono text-slate-400">.png</span>,{' '}
                <span className="font-mono text-slate-400">.svg</span>,{' '}
                <span className="font-mono text-slate-400">.pdf</span>,{' '}
                <span className="font-mono text-slate-400">.tex</span>, and{' '}
                <span className="font-mono text-slate-400">.json</span>
              </p>
            </div>

            <div className="flex items-center justify-center pt-1">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center space-x-1.5 underline underline-offset-4"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Or import directly from system clipboard</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'clipboard' && (
          <div className="flex flex-col items-center justify-center text-center p-6 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-inner">
              <ClipboardPaste className="w-7 h-7" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-sm font-bold text-white">Import from System Clipboard</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reads copied diagram images (PNG), LaTeX TikZ code, SVG XML, or JSON state data from your clipboard.
              </p>
            </div>

            <button
              onClick={handlePasteFromClipboard}
              disabled={isReadingClipboard}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {isReadingClipboard ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Reading Clipboard...</span>
                </>
              ) : (
                <>
                  <ClipboardPaste className="w-4 h-4 text-white" />
                  <span>Read from Clipboard</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500">
              Tip: You can also press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">Ctrl+V</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">Cmd+V</kbd> anywhere in this dialog.
            </p>
          </div>
        )}

        {activeTab === 'paste' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400 block">
                Paste LaTeX TikZ snippet, SVG XML, or JSON:
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 flex items-center space-x-1 transition"
              >
                <ClipboardPaste className="w-3 h-3 text-indigo-400" />
                <span>Paste Clipboard</span>
              </button>
            </div>
            <textarea
              rows={5}
              value={pastedText}
              onChange={handlePasteChange}
              placeholder="% Paste your LaTeX snippet with '% learn-qec-state: ...' comment or SVG code..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
            />
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start space-x-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Detected State Preview Card */}
        {detectedMeta && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Valid Diagram State Detected</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-900/60 font-mono text-[10px] uppercase border border-emerald-700/60">
                {detectedMeta.code.toUpperCase()} CODE
              </span>
            </div>

            <div className="text-xs text-slate-300 grid grid-cols-2 gap-2 pt-1 font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Active Errors:</span>
                <span className="font-semibold text-slate-200">
                  {errorSummaries.length > 0 ? errorSummaries.join(', ') : 'None (Ground State)'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Total Qubits:</span>
                <span className="font-semibold text-slate-200">
                  {detectedMeta.numQubits} Qubits
                </span>
              </div>
              {clipboardSourceDesc && (
                <div className="col-span-2 text-[10px] text-emerald-400/90 font-medium">
                  Source: {clipboardSourceDesc}
                </div>
              )}
              {detectedMeta.timestamp && (
                <div className="col-span-2 text-[10px] text-slate-500">
                  Exported at: {new Date(detectedMeta.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!detectedMeta}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition flex items-center space-x-1.5 shadow-md ${
              detectedMeta
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Apply to Visualizer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
