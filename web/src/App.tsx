import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import init, { ShorCodeCircuit, init_panic_hook } from 'qec_engine';
import {
  ShorLattice,
  ExportModal,
  ImportModal,
  PlaybackBar,
  useStepPlayer,
  recordAnimationGif,
  recordAnimationVideo,
  renderSvgToCanvas,
  QecDiagramMetadata,
  importDiagramFromFile,
} from '@learn-qec/visualizers';
import { RefreshCw, Play, ShieldAlert, Cpu, Sparkles, CheckCircle2, Upload, Download } from 'lucide-react';

function composePauli(p1: number, p2: number): number {
  if (p1 === 0) return p2;
  if (p2 === 0) return p1;
  if (p1 === p2) return 0;
  if ((p1 === 1 && p2 === 3) || (p1 === 3 && p2 === 1)) return 2; // X*Z = Y
  if ((p1 === 2 && p2 === 3) || (p1 === 3 && p2 === 2)) return 1; // Y*Z = X
  if ((p1 === 2 && p2 === 1) || (p1 === 1 && p2 === 2)) return 3; // Y*X = Z
  return 0;
}

export default function App() {
  const [wasmReady, setWasmReady] = useState(false);
  const [circuit, setCircuit] = useState<ShorCodeCircuit | null>(null);
  const [errors, setErrors] = useState<Uint8Array>(new Uint8Array(9));
  const [syndromes, setSyndromes] = useState<Uint8Array>(new Uint8Array(8));
  const [highlightedCheck, setHighlightedCheck] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [recordingState, setRecordingState] = useState({
    isRecording: false,
    progress: 0,
    text: '',
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsExportModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsImportModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const player = useStepPlayer({
    totalSteps: 5,
    baseIntervalMs: 1300,
  });

  // Initialize Wasm module
  useEffect(() => {
    async function loadWasm() {
      try {
        await init();
        init_panic_hook();
        const sc = new ShorCodeCircuit();
        setCircuit(sc);
        setErrors(sc.get_errors());
        setSyndromes(sc.measure_syndromes());
        setWasmReady(true);
      } catch (err) {
        console.error('Failed to initialize Wasm engine:', err);
      }
    }
    loadWasm();
  }, []);

  // Update React state from Rust circuit
  const syncState = useCallback((c: ShorCodeCircuit) => {
    setErrors(new Uint8Array(c.get_errors()));
    setSyndromes(new Uint8Array(c.measure_syndromes()));
  }, []);

  // Cycle qubit error: 0 (I) -> 1 (X) -> 2 (Y) -> 3 (Z) -> 0 (I)
  const handleQubitClick = useCallback(
    (qIdx: number) => {
      if (!circuit) return;
      setIsPlaybackMode(false);
      player.pause();
      player.goToStep(0);
      const current = circuit.get_error(qIdx);
      const next = (current + 1) % 4;
      circuit.inject_error(qIdx, next);
      syncState(circuit);
    },
    [circuit, syncState, player],
  );

  const handleClear = useCallback(() => {
    if (!circuit) return;
    setIsPlaybackMode(false);
    player.pause();
    player.goToStep(0);
    circuit.clear_errors();
    syncState(circuit);
  }, [circuit, syncState, player]);

  const handleInject = useCallback(
    (qIdx: number, pauli: number) => {
      if (!circuit) return;
      setIsPlaybackMode(false);
      player.pause();
      player.goToStep(0);
      circuit.inject_error(qIdx, pauli);
      syncState(circuit);
    },
    [circuit, syncState, player],
  );

  const handleApplyCorrection = useCallback(() => {
    if (!circuit) return;
    setIsPlaybackMode(false);
    player.pause();
    player.goToStep(0);
    circuit.apply_correction();
    syncState(circuit);
  }, [circuit, syncState, player]);

  const handleImportState = useCallback(
    (metadata: QecDiagramMetadata) => {
      if (!circuit) return;

      setIsPlaybackMode(false);
      player.pause();
      player.goToStep(0);

      // Clear existing state
      circuit.clear_errors();

      // Inject Pauli errors from imported metadata
      if (Array.isArray(metadata.errors)) {
        metadata.errors.forEach((pauli, qIdx) => {
          if (pauli > 0 && qIdx < 9) {
            circuit.inject_error(qIdx, pauli);
          }
        });
      }

      syncState(circuit);
    },
    [circuit, syncState, player],
  );

  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleCardDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  }, []);

  const handleCardDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  const handleCardDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      try {
        const meta = await importDiagramFromFile(files[0]);
        handleImportState(meta);
      } catch (err: any) {
        alert(err.message || 'Failed to import diagram');
      }
    },
    [handleImportState],
  );

  // Decode suggestion from Wasm
  const correction = useMemo(() => {
    if (!circuit || !wasmReady) return null;
    const corr = circuit.suggest_correction();
    if (!corr) return null;
    return {
      qubit: corr.qubit,
      pauli: corr.pauli,
      explanation: corr.explanation,
    };
  }, [circuit, wasmReady, errors, syndromes]);

  const activeErrorCount = useMemo(() => {
    return errors.reduce((acc, p) => acc + (p !== 0 ? 1 : 0), 0);
  }, [errors]);

  const activeDefectCount = useMemo(() => {
    return syndromes.reduce((acc, s) => acc + (s !== 0 ? 1 : 0), 0);
  }, [syndromes]);

  // Derive displayed states according to step player
  const { displayErrors, displaySyndromes, displayCorrection } = useMemo(() => {
    if (!isPlaybackMode) {
      return {
        displayErrors: errors,
        displaySyndromes: syndromes,
        displayCorrection: correction,
      };
    }

    // Precompute post-correction errors
    const postCorrectionErrors = new Uint8Array(errors);
    if (correction) {
      const cur = postCorrectionErrors[correction.qubit];
      postCorrectionErrors[correction.qubit] = composePauli(cur, correction.pauli);
    }

    switch (player.currentStep) {
      case 0: // Error Injected (Syndromes not yet evaluated)
        return {
          displayErrors: errors,
          displaySyndromes: new Uint8Array(8),
          displayCorrection: null,
        };
      case 1: // Syndrome Extraction (Defects light up)
        return {
          displayErrors: errors,
          displaySyndromes: syndromes,
          displayCorrection: null,
        };
      case 2: // Decoder Target (Yellow halo on correction qubit)
        return {
          displayErrors: errors,
          displaySyndromes: syndromes,
          displayCorrection: correction,
        };
      case 3: // Recovery Gate applied
        return {
          displayErrors: postCorrectionErrors,
          displaySyndromes: syndromes,
          displayCorrection: null,
        };
      case 4: // Verification / Clean
        return {
          displayErrors: postCorrectionErrors,
          displaySyndromes: new Uint8Array(8),
          displayCorrection: null,
        };
      default:
        return {
          displayErrors: errors,
          displaySyndromes: syndromes,
          displayCorrection: correction,
        };
    }
  }, [isPlaybackMode, player.currentStep, errors, syndromes, correction]);

  const handleTogglePlay = useCallback(() => {
    if (!isPlaybackMode) {
      setIsPlaybackMode(true);
      if (activeErrorCount === 0) {
        handleInject(1, 1);
      }
    }
    player.togglePlay();
  }, [isPlaybackMode, activeErrorCount, handleInject, player]);

  const handleStepForward = useCallback(() => {
    if (!isPlaybackMode) {
      setIsPlaybackMode(true);
      if (activeErrorCount === 0) {
        handleInject(1, 1);
      }
    }
    player.stepForward();
  }, [isPlaybackMode, activeErrorCount, handleInject, player]);

  const handleStepBackward = useCallback(() => {
    if (!isPlaybackMode) {
      setIsPlaybackMode(true);
    }
    player.stepBackward();
  }, [isPlaybackMode, player]);

  const handleGoToStep = useCallback(
    (s: number) => {
      if (!isPlaybackMode) {
        setIsPlaybackMode(true);
      }
      player.goToStep(s);
    },
    [isPlaybackMode, player],
  );

  const handleResetPlayback = useCallback(() => {
    player.reset();
  }, [player]);

  const handleRecordGif = useCallback(async () => {
    if (!svgRef.current) return;
    if (activeErrorCount === 0) {
      handleInject(1, 1);
    }
    setIsPlaybackMode(true);
    player.pause();
    setRecordingState({ isRecording: true, progress: 0, text: 'Initializing GIF encoder...' });

    try {
      const framesPerStep = 10;
      const totalFrames = 5 * framesPerStep;
      let lastRenderedStep = -1;

      await recordAnimationGif(
        async (frameIndex, _progress, canvas) => {
          const step = Math.min(Math.floor(frameIndex / framesPerStep), 4);
          if (step !== lastRenderedStep) {
            lastRenderedStep = step;
            player.goToStep(step);
            await new Promise((r) => setTimeout(r, 40));
            if (svgRef.current) {
              await renderSvgToCanvas(svgRef.current, canvas, { width: 880, height: 520, background: 'dark' });
            }
          }
        },
        totalFrames,
        {
          filename: 'shor-code-correction',
          fps: 15,
          width: 880,
          height: 520,
          onProgress: (p, t) => setRecordingState({ isRecording: true, progress: p, text: t }),
        },
      );
    } catch (err) {
      console.error('Failed to record GIF:', err);
    } finally {
      setRecordingState({ isRecording: false, progress: 0, text: '' });
    }
  }, [activeErrorCount, handleInject, player]);

  const handleRecordVideo = useCallback(async () => {
    if (!svgRef.current) return;
    if (activeErrorCount === 0) {
      handleInject(1, 1);
    }
    setIsPlaybackMode(true);
    player.pause();
    setRecordingState({ isRecording: true, progress: 0, text: 'Initializing video stream...' });

    try {
      const framesPerStep = 20;
      const totalFrames = 5 * framesPerStep;
      let lastRenderedStep = -1;

      await recordAnimationVideo(
        async (frameIndex, _progress, canvas) => {
          const step = Math.min(Math.floor(frameIndex / framesPerStep), 4);
          if (step !== lastRenderedStep) {
            lastRenderedStep = step;
            player.goToStep(step);
            await new Promise((r) => setTimeout(r, 40));
            if (svgRef.current) {
              await renderSvgToCanvas(svgRef.current, canvas, { width: 880, height: 520, background: 'dark' });
            }
          }
        },
        totalFrames,
        {
          filename: 'shor-code-correction',
          fps: 30,
          width: 880,
          height: 520,
          onProgress: (p, t) => setRecordingState({ isRecording: true, progress: p, text: t }),
        },
      );
    } catch (err) {
      console.error('Failed to record video:', err);
    } finally {
      setRecordingState({ isRecording: false, progress: 0, text: '' });
    }
  }, [activeErrorCount, handleInject, player]);

  if (!wasmReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex items-center space-x-3 text-lg font-mono">
          <RefreshCw className="animate-spin h-6 w-6 text-indigo-400" />
          <span>Initializing Rust Wasm Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-600/30">
            Ψ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              learn-qec
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              High-Speed Rust/Wasm Stabilizer Simulation & Video Pipeline
            </p>
          </div>
        </div>

        {/* Screen Chooser (Roadmap Milestones + Crumble) */}
        <div className="hidden xl:flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 space-x-1 font-mono text-xs">
          {[
            { id: 'shor', label: 'Shor [[9,1,3]]', active: true, desc: 'Milestone 1 — Shor [[9,1,3]] Code Pipeline (Active)' },
            { id: 'css', label: 'CSS Codes', badge: 'M2', active: false, desc: 'Milestone 2 — Steane [[7,1,3]] & Binary Symplectic Tableau (Coming Soon)' },
            { id: 'surface', label: '2D Surface Code', badge: 'M3', active: false, desc: 'Milestone 3 — Rotated Surface Code & Union-Find Decoding (Coming Soon)' },
            { id: 'qldpc', label: 'qLDPC Codes', badge: 'M4', active: false, desc: 'Milestone 4 — Tanner Graph & Belief Propagation (Coming Soon)' },
            { id: 'crumble', label: 'Crumble View', badge: 'Soon', active: false, desc: 'Crumble Clifford Circuit Visualizer & Stabilizer Tracking (Coming Soon)' },
          ].map((s) => (
            <button
              key={s.id}
              disabled={!s.active}
              title={s.desc}
              className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all text-xs ${
                s.active
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 cursor-default'
                  : 'text-slate-500 cursor-not-allowed hover:text-slate-500 opacity-60'
              }`}
            >
              <span>{s.label}</span>
              {s.badge && (
                <span className="px-1.5 py-0.2 text-[9px] rounded font-semibold bg-slate-800/90 text-slate-400 border border-slate-700/60 uppercase tracking-tight">
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile / Tablet Screen Chooser Dropdown */}
        <div className="xl:hidden flex items-center">
          <select
            defaultValue="shor"
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 font-mono outline-none cursor-pointer"
            onChange={(e) => {
              if (e.target.value !== 'shor') e.target.value = 'shor';
            }}
          >
            <option value="shor">Shor [[9,1,3]] (M1 Active)</option>
            <option value="css" disabled>CSS Codes (M2 Soon)</option>
            <option value="surface" disabled>2D Surface Code (M3 Soon)</option>
            <option value="qldpc" disabled>qLDPC Codes (M4 Soon)</option>
            <option value="crumble" disabled>Crumble View (Soon)</option>
          </select>
        </div>

        {/* Status, Global File Actions & GitHub */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          {/* Unified Global File I/O Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              title="Import diagram or quantum state from PNG, SVG, TeX, JSON, or Clipboard (Ctrl+O)"
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center space-x-1.5 shadow-sm text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Import</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              title="Export diagram as PNG, SVG, PDF, LaTeX TikZ, or JSON (Ctrl+E)"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Export</span>
            </button>
          </div>

          <a
            href="https://github.com/alban/learn-qec"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 font-sans font-medium text-xs ml-2 underline underline-offset-2"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Visualizer Canvas */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          <div
            onDragOver={handleCardDragOver}
            onDragLeave={handleCardDragLeave}
            onDrop={handleCardDrop}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl relative backdrop-blur flex-1 flex flex-col justify-between"
          >
            {/* Drag & Drop Overlay */}
            {isDraggingFile && (
              <div className="absolute inset-0 z-40 bg-indigo-950/85 backdrop-blur-sm border-2 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
                <Upload className="w-10 h-10 text-indigo-300 animate-bounce mb-2" />
                <span className="font-bold text-sm text-white">Drop to import diagram state</span>
                <span className="text-xs text-indigo-200">Supports .png, .svg, .pdf, .tex, or .json</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div>
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold font-mono tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full mb-1">
                  Milestone 1 — Shor [[9, 1, 3]] Code
                </span>
                <h2 className="text-lg font-bold text-white">Interactive 2D Stabilizer Patch</h2>
                <p className="text-xs text-slate-400">
                  Click any data qubit to inject Pauli errors (<kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">I</kbd> → <kbd className="px-1 py-0.5 bg-red-950 text-red-300 rounded">X</kbd> → <kbd className="px-1 py-0.5 bg-emerald-950 text-emerald-300 rounded">Y</kbd> → <kbd className="px-1 py-0.5 bg-blue-950 text-blue-300 rounded">Z</kbd>).
                </p>
              </div>

              {/* Crumble Standard RGB = XYZ Color Legend & Reset Button */}
              <div className="flex items-center space-x-2.5 self-start sm:self-auto">
                <div className="hidden sm:flex items-center space-x-2.5 text-[11px] font-mono bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-xl shadow-inner">
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
                    <span className="text-slate-300">X</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                    <span className="text-slate-300">Y</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
                    <span className="text-slate-300">Z</span>
                  </span>
                </div>

                <button
                  onClick={handleClear}
                  title="Reset all errors to pristine ground state"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Visualizer SVG */}
            <div className="w-full my-auto py-3 flex items-center justify-center">
              <ShorLattice
                ref={svgRef}
                errors={displayErrors}
                syndromes={displaySyndromes}
                onQubitClick={handleQubitClick}
                activeCorrection={displayCorrection}
                highlightedCheck={highlightedCheck}
              />
            </div>

            {/* Quick Test Presets */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-400 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Presets:</span>
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <button
                  onClick={() => handleInject(1, 1)}
                  className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 transition"
                >
                  Inject X on Q₁ (S₁+S₂)
                </button>
                <button
                  onClick={() => handleInject(4, 3)}
                  className="px-2.5 py-1 rounded bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 transition"
                >
                  Inject Z on Q₄ (S₇+S₈)
                </button>
                <button
                  onClick={() => handleInject(7, 2)}
                  className="px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 transition"
                >
                  Inject Y on Q₇ (S₅+S₆+S₈)
                </button>
              </div>
            </div>

            {/* Step-by-Step Playback and In-Browser Recording Bar */}
            <div className="mt-3 pt-3 border-t border-slate-800/80">
              <PlaybackBar
                currentStep={player.currentStep}
                totalSteps={player.totalSteps}
                isPlaying={player.isPlaying}
                speed={player.speed}
                onTogglePlay={handleTogglePlay}
                onStepForward={handleStepForward}
                onStepBackward={handleStepBackward}
                onGoToStep={handleGoToStep}
                onReset={handleResetPlayback}
                onSpeedChange={player.setSpeed}
                onRecordVideo={handleRecordVideo}
                onRecordGif={handleRecordGif}
                recordingState={recordingState}
              />
            </div>
          </div>
        </section>

        {/* Right Column: Syndrome Diagnostics & Decoder Recommendations */}
        <section className="lg:col-span-4 flex flex-col space-y-4">
          {/* Decoder Suggestion Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-200">
                  Syndrome Decoder
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                {activeErrorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {activeErrorCount} Error{activeErrorCount > 1 ? 's' : ''}
                  </span>
                )}
                {activeDefectCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                    <ShieldAlert className="w-3 h-3" />
                    <span>{activeDefectCount} Defect{activeDefectCount > 1 ? 's' : ''}</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Code Space Clean</span>
                  </span>
                )}
              </div>
            </div>

            {correction ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
                  <div className="font-semibold text-indigo-200 mb-1 flex items-center space-x-1.5">
                    <span>Diagnosis:</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    {correction.explanation}
                  </p>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-indigo-500/20 font-mono">
                    <span className="text-slate-400">Target: Qubit {correction.qubit}</span>
                    <span className="font-bold text-amber-300">
                      Apply Pauli{' '}
                      {correction.pauli === 1 ? 'X' : correction.pauli === 2 ? 'Y' : 'Z'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleApplyCorrection}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Correction Gate</span>
                </button>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 font-mono">
                No active defects detected. The code state is in the +1 stabilizer eigenspace.
              </div>
            )}
          </div>

          {/* Stabilizer Generator Parity Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur flex-1">
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-200 mb-3 flex items-center justify-between">
              <span>Stabilizers (8 Checks)</span>
              <span className="text-[10px] text-slate-500 font-normal">Eigenvalue (-1)ᵐ</span>
            </h3>

            <div className="space-y-2 text-xs font-mono">
              {[
                { id: 0, name: 'S₁', type: 'Z', desc: 'Z₀ Z₁', q: '0 ↔ 1' },
                { id: 1, name: 'S₂', type: 'Z', desc: 'Z₁ Z₂', q: '1 ↔ 2' },
                { id: 2, name: 'S₃', type: 'Z', desc: 'Z₃ Z₄', q: '3 ↔ 4' },
                { id: 3, name: 'S₄', type: 'Z', desc: 'Z₄ Z₅', q: '4 ↔ 5' },
                { id: 4, name: 'S₅', type: 'Z', desc: 'Z₆ Z₇', q: '6 ↔ 7' },
                { id: 5, name: 'S₆', type: 'Z', desc: 'Z₇ Z₈', q: '7 ↔ 8' },
                { id: 6, name: 'S₇', type: 'X', desc: 'X₀X₁X₂ X₃X₄X₅', q: 'Block 0 ↔ 1' },
                { id: 7, name: 'S₈', type: 'X', desc: 'X₃X₄X₅ X₆X₇X₈', q: 'Block 1 ↔ 2' },
              ].map((s) => {
                const isDefect = (syndromes[s.id] || 0) === 1;
                return (
                  <div
                    key={`syn-row-${s.id}`}
                    onMouseEnter={() => setHighlightedCheck(s.id)}
                    onMouseLeave={() => setHighlightedCheck(null)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition ${
                      isDefect
                        ? s.type === 'X'
                          ? 'bg-red-950/30 border-red-700/60 text-red-200'
                          : 'bg-blue-950/30 border-blue-700/60 text-blue-200'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          s.type === 'X' ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                      ></span>
                      <span className="font-bold">{s.name}</span>
                      <span className="text-[11px] text-slate-500">({s.desc})</span>
                    </div>
                    <div className="flex items-center space-x-2 font-mono">
                      <span className="text-[10px] text-slate-500">{s.q}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isDefect
                            ? s.type === 'X'
                              ? 'bg-red-600 text-white'
                              : 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isDefect ? '-1' : '+1'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Global Export & Import Modals */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        svgRef={svgRef}
        errors={displayErrors}
        syndromes={displaySyndromes}
        activeCorrection={displayCorrection}
        codeName="shor-code-lattice"
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportState}
      />
    </div>
  );
}
