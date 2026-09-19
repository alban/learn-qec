import React, { useState, useEffect, useMemo } from 'react';
import { useCurrentFrame, interpolate, useVideoConfig, delayRender, continueRender } from 'remotion';
import { ShorLattice } from '@learn-qec/visualizers';
import init, { ShorCodeCircuit } from 'qec_engine';

export const ShorCodeExplainer: React.FC = () => {
  const [handle] = useState(() => delayRender('Initializing Wasm for Shor Explainer'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    init()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        console.error('Failed to load Wasm in Remotion:', err);
        continueRender(handle);
      });
  }, [handle]);

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Deterministic simulation state derived from frame counter
  const simState = useMemo(() => {
    if (!ready) return null;
    const circuit = new ShorCodeCircuit();

    if (frame < 90) {
      // Phase 1: Pristine code state
      return {
        errors: circuit.get_errors(),
        syndromes: circuit.measure_syndromes(),
        stage: 'PHASE 1: PRISTINE CODE STATE',
        caption: 'The Shor [[9, 1, 3]] code encodes 1 logical qubit into 9 physical data qubits across 3 blocks.',
        activeCorrection: null,
        highlightedCheck: null,
      };
    } else if (frame < 180) {
      // Phase 2: Pauli X Error on Q1
      circuit.inject_error(1, 1); // 1 = Pauli X
      return {
        errors: circuit.get_errors(),
        syndromes: circuit.measure_syndromes(),
        stage: 'PHASE 2: NOISE EVENT (PAULI X ON Q₁)',
        caption: 'A bit-flip error (X) occurs on Qubit 1. Z-stabilizers S₁ (Z₀Z₁) and S₂ (Z₁Z₂) anticommute and light up in blue (-1)!',
        activeCorrection: null,
        highlightedCheck: 0,
      };
    } else if (frame < 290) {
      // Phase 3: Syndrome Decoding Analysis
      circuit.inject_error(1, 1);
      const corr = circuit.suggest_correction();
      return {
        errors: circuit.get_errors(),
        syndromes: circuit.measure_syndromes(),
        stage: 'PHASE 3: SYNDROME EXTRACTION & DECODING',
        caption: corr
          ? `${corr.explanation} The overlapping defect syndrome isolates Qubit 1.`
          : 'Evaluating syndrome parity...',
        activeCorrection: corr ? { qubit: corr.qubit, pauli: corr.pauli } : null,
        highlightedCheck: 1,
      };
    } else if (frame < 380) {
      // Phase 4: Correction Applied
      circuit.inject_error(1, 1);
      circuit.apply_correction();
      return {
        errors: circuit.get_errors(),
        syndromes: circuit.measure_syndromes(),
        stage: 'PHASE 4: CORRECTION APPLIED (X₁)',
        caption: 'Pauli X is applied to Qubit 1. All 8 stabilizer eigenvalues return to +1. Logical state preserved!',
        activeCorrection: null,
        highlightedCheck: null,
      };
    } else {
      // Phase 5: Code Space Preserved
      return {
        errors: circuit.get_errors(),
        syndromes: circuit.measure_syndromes(),
        stage: 'PHASE 5: CODE SPACE RESTORED',
        caption: 'Shor [[9, 1, 3]] code successfully corrects arbitrary single-qubit errors without collapsing the logical state.',
        activeCorrection: null,
        highlightedCheck: null,
      };
    }
  }, [frame, ready]);

  if (!simState) {
    return null;
  }

  const { errors, syndromes, stage, caption, activeCorrection, highlightedCheck } = simState;

  // Smooth entrance animations
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#020617',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 64px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          opacity: titleOpacity,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              PROGRAMMATIC QEC EXPLAINER
            </span>
            <span
              style={{
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#94a3b8',
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}
            >
              FRAME {frame} / 450
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: '40px',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              background: 'linear-gradient(to right, #ffffff, #e2e8f0, #a5b4fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Shor [[9, 1, 3]] Quantum Error Correction
          </h1>
        </div>

        {/* RGB = XYZ Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            fontSize: '14px',
            fontFamily: 'monospace',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: '12px 24px',
            borderRadius: '16px',
            border: '1px solid #1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
            <span style={{ color: '#cbd5e1' }}>X (Bit-flip)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span style={{ color: '#cbd5e1' }}>Y (Bit+Phase)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
            <span style={{ color: '#cbd5e1' }}>Z (Phase-flip)</span>
          </div>
        </div>
      </div>

      {/* Center: Visualizer Lattice */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '20px 0',
        }}
      >
        <div
          style={{
            width: '1160px',
            height: '560px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(30, 41, 59, 0.8)',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShorLattice
            errors={errors}
            syndromes={syndromes}
            interactive={false}
            activeCorrection={activeCorrection}
            highlightedCheck={highlightedCheck}
            width={1000}
            height={500}
          />
        </div>
      </div>

      {/* Bottom Explainer Card */}
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '24px 32px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ maxWidth: '1100px' }}>
          <div
            style={{
              fontSize: '13px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              letterSpacing: '1.5px',
              color: '#818cf8',
              marginBottom: '6px',
            }}
          >
            {stage}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '20px',
              color: '#e2e8f0',
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {caption}
          </p>
        </div>

        {/* Stabilizer Vector Pill */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          <span
            style={{
              color: '#64748b',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Syndrome Vector (S₁..S₈)
          </span>
          <div
            style={{
              display: 'flex',
              gap: '6px',
              backgroundColor: '#020617',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #1e293b',
            }}
          >
            {Array.from(syndromes).map((s, idx) => (
              <span
                key={`syn-pill-${idx}`}
                style={{
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  backgroundColor: s === 1 ? (idx < 6 ? '#2563eb' : '#dc2626') : '#1e293b',
                  color: s === 1 ? '#ffffff' : '#64748b',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
