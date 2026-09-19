import React from 'react';
import { ShorLatticeProps } from './types';

export const ShorLattice = React.forwardRef<SVGSVGElement, ShorLatticeProps>(({
  errors,
  syndromes,
  onQubitClick,
  interactive = true,
  activeCorrection = null,
  highlightedCheck = null,
  className = '',
  width = '100%',
  height = 'auto',
}, ref) => {
  // Qubit coordinates: 3 blocks spaced across 880px width
  const qubitPositions: { [key: number]: { x: number; y: number; block: number } } = {
    // Block 0 (cx = 170)
    0: { x: 170, y: 175, block: 0 },
    1: { x: 170, y: 285, block: 0 },
    2: { x: 170, y: 395, block: 0 },
    // Block 1 (cx = 440)
    3: { x: 440, y: 175, block: 1 },
    4: { x: 440, y: 285, block: 1 },
    5: { x: 440, y: 395, block: 1 },
    // Block 2 (cx = 710)
    6: { x: 710, y: 175, block: 2 },
    7: { x: 710, y: 285, block: 2 },
    8: { x: 710, y: 395, block: 2 },
  };

  // 6 Z-stabilizers (Blue bit-flip checks)
  const zChecks = [
    { id: 0, label: 'S₁', qA: 0, qB: 1, x: 170, y: 230 },
    { id: 1, label: 'S₂', qA: 1, qB: 2, x: 170, y: 340 },
    { id: 2, label: 'S₃', qA: 3, qB: 4, x: 440, y: 230 },
    { id: 3, label: 'S₄', qA: 4, qB: 5, x: 440, y: 340 },
    { id: 4, label: 'S₅', qA: 6, qB: 7, x: 710, y: 230 },
    { id: 5, label: 'S₆', qA: 7, qB: 8, x: 710, y: 340 },
  ];

  // 2 X-stabilizers (Red phase-flip checks)
  // Brackets attach cleanly to the outer card boundary (y=90 at top, y=435 at bottom)
  const xChecks = [
    {
      id: 6,
      name: 'S₇',
      sublabel: 'Phase (Block 0 ↔ 1)',
      xStart: 170,
      xEnd: 440,
      yBracket: 42,
      yAttach: 90, // Attaches directly to card top edge; NO text in y=42..90
      textX: 305,
      textY: 42,
    },
    {
      id: 7,
      name: 'S₈',
      sublabel: 'Phase (Block 1 ↔ 2)',
      xStart: 440,
      xEnd: 710,
      yBracket: 485,
      yAttach: 435, // Attaches directly to card bottom edge; NO text in y=435..485
      textX: 575,
      textY: 485,
    },
  ];

  // Helper colors conforming to Crumble RGB = XYZ standard
  const getPauliColor = (p: number) => {
    switch (p) {
      case 1:
        return { fill: '#DC2626', stroke: '#EF4444', text: '#FFFFFF', label: 'X' }; // Red
      case 2:
        return { fill: '#059669', stroke: '#10B981', text: '#FFFFFF', label: 'Y' }; // Green
      case 3:
        return { fill: '#2563EB', stroke: '#3B82F6', text: '#FFFFFF', label: 'Z' }; // Blue
      default:
        return { fill: '#1E293B', stroke: '#475569', text: '#E2E8F0', label: 'I' }; // Neutral Dark
    }
  };

  return (
    <div
      className={`w-full max-w-3xl aspect-[880/520] relative select-none flex items-center justify-center mx-auto ${className}`}
      style={{ width, height: height === 'auto' ? undefined : height }}
    >
      <svg
        ref={ref}
        viewBox="0 0 880 520"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="blockBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* 3 Block Cards: Boundaries strictly in Y = 90..435. */}
        {[
          { idx: 0, x: 95, cx: 170, title: 'BLOCK 0' },
          { idx: 1, x: 365, cx: 440, title: 'BLOCK 1' },
          { idx: 2, x: 635, cx: 710, title: 'BLOCK 2' },
        ].map((b) => (
          <g key={`block-${b.idx}`}>
            {/* Card boundary */}
            <rect
              x={b.x}
              y={90}
              width={150}
              height={345}
              rx={18}
              fill="url(#blockBg)"
              stroke="#334155"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {/* Block Header INSIDE the card at Y = 120, completely clear of bracket lines */}
            <text
              x={b.cx}
              y={120}
              textAnchor="middle"
              fill="#94A3B8"
              fontFamily="ui-monospace, monospace"
              fontSize="13px"
              fontWeight="900"
              letterSpacing="0.1em"
              className="font-mono"
            >
              {b.title}
            </text>
          </g>
        ))}

        {/* Connecting check lines between vertically adjacent qubits in each block */}
        {zChecks.map((zc) => {
          const isDefect = (syndromes[zc.id] || 0) === 1;
          return (
            <line
              key={`z-line-${zc.id}`}
              x1={zc.x}
              y1={qubitPositions[zc.qA].y}
              x2={zc.x}
              y2={qubitPositions[zc.qB].y}
              stroke={isDefect ? '#3B82F6' : '#334155'}
              strokeWidth={isDefect ? 4 : 2.5}
              strokeDasharray={isDefect ? undefined : '3 3'}
              className="transition-colors duration-200"
            />
          );
        })}

        {/* X-Checks (S7 & S8): Brackets attach to outer top/bottom borders. Zero text collision! */}
        {xChecks.map((xc) => {
          const isDefect = (syndromes[xc.id] || 0) === 1;
          const isHighlighted = highlightedCheck === xc.id;
          return (
            <g key={`x-check-${xc.id}`} className="transition-all duration-300">
              {/* Bracket line attaches cleanly to top/bottom card borders at yAttach */}
              <path
                d={
                  xc.id === 6
                    ? `M ${xc.xStart} ${xc.yAttach} L ${xc.xStart} ${xc.yBracket} L ${xc.xEnd} ${xc.yBracket} L ${xc.xEnd} ${xc.yAttach}`
                    : `M ${xc.xStart} ${xc.yAttach} L ${xc.xStart} ${xc.yBracket} L ${xc.xEnd} ${xc.yBracket} L ${xc.xEnd} ${xc.yAttach}`
                }
                fill="none"
                stroke={isDefect ? '#EF4444' : isHighlighted ? '#F87171' : '#475569'}
                strokeWidth={isDefect ? 4 : 2.5}
                filter={isDefect ? 'url(#glow-red)' : undefined}
              />

              {/* Connector dots where bracket meets block border */}
              <circle
                cx={xc.xStart}
                cy={xc.yAttach}
                r={3.5}
                fill={isDefect ? '#EF4444' : isHighlighted ? '#F87171' : '#475569'}
              />
              <circle
                cx={xc.xEnd}
                cy={xc.yAttach}
                r={3.5}
                fill={isDefect ? '#EF4444' : isHighlighted ? '#F87171' : '#475569'}
              />

              {/* Badge for X-check */}
              <rect
                x={xc.textX - 102}
                y={xc.textY - 14}
                width={204}
                height={28}
                rx={8}
                fill={isDefect ? '#EF4444' : '#1E293B'}
                stroke={isDefect ? '#F87171' : '#475569'}
                strokeWidth={1.5}
                filter={isDefect ? 'url(#glow-red)' : undefined}
              />
              <text
                x={xc.textX}
                y={xc.textY + 4.5}
                textAnchor="middle"
                fill={isDefect ? '#FFFFFF' : '#E2E8F0'}
                fontFamily="ui-monospace, monospace"
                fontSize="12px"
                fontWeight="bold"
                className={`font-mono ${isDefect ? 'fill-white' : 'fill-slate-200'}`}
              >
                {isDefect ? `DEFECT: ${xc.name} (Phase)` : `${xc.name}: ${xc.sublabel}`}
              </text>
            </g>
          );
        })}

        {/* Z-Check Nodes (S1..S6 - Bit-flip pair checks) */}
        {zChecks.map((zc) => {
          const isDefect = (syndromes[zc.id] || 0) === 1;
          const isHighlighted = highlightedCheck === zc.id;
          return (
            <g key={`z-node-${zc.id}`} className="transition-all duration-200">
              <circle
                cx={zc.x}
                cy={zc.y}
                r={isDefect ? 17 : 14}
                fill={isDefect ? '#2563EB' : isHighlighted ? '#1E3A8A' : '#0F172A'}
                stroke={isDefect ? '#60A5FA' : isHighlighted ? '#3B82F6' : '#475569'}
                strokeWidth={isDefect ? 3 : 2}
                filter={isDefect ? 'url(#glow-blue)' : undefined}
              />
              <text
                x={zc.x}
                y={zc.y + 4.5}
                textAnchor="middle"
                fill={isDefect ? '#FFFFFF' : '#CBD5E1'}
                fontFamily="ui-monospace, monospace"
                fontSize="11px"
                fontWeight="bold"
                className={`font-mono ${isDefect ? 'fill-white' : 'fill-slate-300'}`}
              >
                {zc.label}
              </text>
            </g>
          );
        })}

        {/* 9 Data Qubits */}
        {Object.entries(qubitPositions).map(([idxStr, pos]) => {
          const qIdx = parseInt(idxStr, 10);
          const pauli = errors[qIdx] || 0;
          const styling = getPauliColor(pauli);
          const isTargetedForCorrection = activeCorrection?.qubit === qIdx;

          return (
            <g
              key={`qubit-${qIdx}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => interactive && onQubitClick?.(qIdx)}
              className={interactive ? 'cursor-pointer group' : ''}
            >
              {/* Highlight halo when correction is suggested */}
              {isTargetedForCorrection && (
                <circle
                  cx={0}
                  cy={0}
                  r={36}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  strokeDasharray="5 3"
                  className="animate-spin"
                />
              )}

              {/* Qubit Body */}
              <circle
                cx={0}
                cy={0}
                r={28}
                fill={styling.fill}
                stroke={styling.stroke}
                strokeWidth={pauli !== 0 ? 3.5 : 2.5}
                className="transition-all duration-200 group-hover:stroke-indigo-400 group-hover:scale-105"
              />

              {/* Active Pauli Symbol or Qubit Index */}
              {pauli !== 0 ? (
                <text
                  x={0}
                  y={7}
                  textAnchor="middle"
                  fill={styling.text}
                  fontFamily="ui-monospace, monospace"
                  fontSize="19px"
                  fontWeight="900"
                  className="font-mono select-none pointer-events-none"
                >
                  {styling.label}
                </text>
              ) : (
                <text
                  x={0}
                  y={5}
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontFamily="ui-monospace, monospace"
                  fontSize="14px"
                  fontWeight="bold"
                  className="font-mono select-none pointer-events-none group-hover:fill-white"
                >
                  Q{qIdx}
                </text>
              )}

              {/* Small Qubit Subscript when error is active */}
              {pauli !== 0 && (
                <text
                  x={17}
                  y={20}
                  textAnchor="start"
                  fill="#CBD5E1"
                  fontFamily="ui-monospace, monospace"
                  fontSize="11px"
                  fontWeight="bold"
                  className="font-mono select-none pointer-events-none"
                >
                  Q{qIdx}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
});

ShorLattice.displayName = 'ShorLattice';
