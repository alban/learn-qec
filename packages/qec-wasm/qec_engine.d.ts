/* tslint:disable */
/* eslint-disable */

/**
 * Suggested correction for detected syndrome
 */
export class Correction {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly explanation: string;
    pauli: number;
    qubit: number;
}

/**
 * Shor [[9, 1, 3]] quantum error-correcting code engine.
 *
 * 9 data qubits partitioned into three blocks of 3:
 * - Block 0: qubits 0, 1, 2
 * - Block 1: qubits 3, 4, 5
 * - Block 2: qubits 6, 7, 8
 *
 * 8 Stabilizer Generators:
 * - Bit-flip (Z) checks (6):
 *     S1 = Z0 Z1
 *     S2 = Z1 Z2
 *     S3 = Z3 Z4
 *     S4 = Z4 Z5
 *     S5 = Z6 Z7
 *     S6 = Z7 Z8
 * - Phase-flip (X) checks (2):
 *     S7 = X0 X1 X2 X3 X4 X5
 *     S8 = X3 X4 X5 X6 X7 X8
 */
export class ShorCodeCircuit {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Applies the suggested correction directly to remove errors.
     */
    apply_correction(): boolean;
    /**
     * Reset all injected errors to Identity.
     */
    clear_errors(): void;
    /**
     * Returns the current error on a qubit (0=I, 1=X, 2=Y, 3=Z).
     */
    get_error(qubit: number): number;
    /**
     * Zero-copy view / flat array of all 9 qubit errors.
     */
    get_errors(): Uint8Array;
    /**
     * Returns current syndrome vector without recomputing.
     */
    get_syndromes(): Uint8Array;
    /**
     * Inject a Pauli error (1=X, 2=Y, 3=Z, 0=I) on target qubit (0..8).
     */
    inject_error(qubit: number, pauli: number): void;
    /**
     * Evaluates parity against the 8 generators and returns an 8-bit syndrome vector.
     * Defect = 1 (anticommutes with generator), Neutral = 0 (commutes).
     */
    measure_syndromes(): Uint8Array;
    constructor();
    /**
     * Suggests single-qubit correction based on the current syndrome vector.
     */
    suggest_correction(): Correction | undefined;
}

export function init_panic_hook(): void;

export function ping(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_correction_free: (a: number, b: number) => void;
    readonly __wbg_get_correction_pauli: (a: number) => number;
    readonly __wbg_get_correction_qubit: (a: number) => number;
    readonly __wbg_set_correction_pauli: (a: number, b: number) => void;
    readonly __wbg_set_correction_qubit: (a: number, b: number) => void;
    readonly __wbg_shorcodecircuit_free: (a: number, b: number) => void;
    readonly correction_explanation: (a: number) => [number, number];
    readonly init_panic_hook: () => void;
    readonly ping: () => [number, number];
    readonly shorcodecircuit_apply_correction: (a: number) => number;
    readonly shorcodecircuit_clear_errors: (a: number) => void;
    readonly shorcodecircuit_get_error: (a: number, b: number) => number;
    readonly shorcodecircuit_get_errors: (a: number) => [number, number];
    readonly shorcodecircuit_get_syndromes: (a: number) => [number, number];
    readonly shorcodecircuit_inject_error: (a: number, b: number, c: number) => void;
    readonly shorcodecircuit_measure_syndromes: (a: number) => [number, number];
    readonly shorcodecircuit_new: () => number;
    readonly shorcodecircuit_suggest_correction: (a: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
