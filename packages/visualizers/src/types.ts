export type PauliType = 0 | 1 | 2 | 3; // 0: I, 1: X, 2: Y, 3: Z

export interface QubitState {
  index: number;
  pauli: PauliType;
  block: number;
}

export interface ShorLatticeProps {
  errors: Uint8Array | number[];
  syndromes: Uint8Array | number[];
  onQubitClick?: (qubitIndex: number) => void;
  interactive?: boolean;
  activeCorrection?: { qubit: number; pauli: number } | null;
  highlightedCheck?: number | null; // 0..7
  className?: string;
  width?: number | string;
  height?: number | string;
}
