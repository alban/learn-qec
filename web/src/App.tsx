import { useState, useEffect, useCallback, useMemo } from 'react';
import init, { ShorCodeCircuit, init_panic_hook } from 'qec_engine';
import { ShorLattice } from '@learn-qec/visualizers';
import { RefreshCw, Play, ShieldAlert, Cpu, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [wasmReady, setWasmReady] = useState(false);
  const [circuit, setCircuit] = useState<ShorCodeCircuit | null>(null);
  const [errors, setErrors] = useState<Uint8Array>(new Uint8Array(9));
  const [syndromes, setSyndromes] = useState<Uint8Array>(new Uint8Array(8));
  const [highlightedCheck, setHighlightedCheck] = useState<number | null>(null);

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
      const current = circuit.get_error(qIdx);
      const next = (current + 1) % 4;
      circuit.inject_error(qIdx, next);
      syncState(circuit);
    },
    [circuit, syncState],
  );

  const handleClear = useCallback(() => {
    if (!circuit) return;
    circuit.clear_errors();
    syncState(circuit);
  }, [circuit, syncState]);

  const handleInject = useCallback(
    (qIdx: number, pauli: number) => {
      if (!circuit) return;
      circuit.inject_error(qIdx, pauli);
      syncState(circuit);
    },
    [circuit, syncState],
  );

  const handleApplyCorrection = useCallback(() => {
    if (!circuit) return;
    circuit.apply_correction();
    syncState(circuit);
  }, [circuit, syncState]);

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

        {/* RGB = XYZ Color Legend (Crumble Convention) */}
        <div className="flex items-center space-x-6 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
            <span className="text-slate-300">X (Bit-flip)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
            <span className="text-slate-300">Y (Bit+Phase)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
            <span className="text-slate-300">Z (Phase-flip)</span>
          </div>
          <a
            href="https://github.com/alban/learn-qec"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 font-sans font-medium text-xs ml-4 underline underline-offset-2"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Visualizer Canvas */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl relative backdrop-blur flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold font-mono tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full mb-1">
                  Milestone 1 — Shor [[9, 1, 3]] Code
                </span>
                <h2 className="text-lg font-bold text-white">Interactive 2D Stabilizer Patch</h2>
                <p className="text-xs text-slate-400">
                  Click any data qubit to inject Pauli errors (<kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">I</kbd> → <kbd className="px-1 py-0.5 bg-red-950 text-red-300 rounded">X</kbd> → <kbd className="px-1 py-0.5 bg-emerald-950 text-emerald-300 rounded">Y</kbd> → <kbd className="px-1 py-0.5 bg-blue-950 text-blue-300 rounded">Z</kbd>).
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset State</span>
                </button>
              </div>
            </div>

            {/* Visualizer SVG */}
            <div className="w-full my-auto py-4 flex items-center justify-center">
              <ShorLattice
                errors={errors}
                syndromes={syndromes}
                onQubitClick={handleQubitClick}
                activeCorrection={correction}
                highlightedCheck={highlightedCheck}
              />
            </div>

            {/* Quick Test Presets */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
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
    </div>
  );
}
