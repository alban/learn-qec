# Architecture Overview

`learn-qec` is organized as a high-performance monorepo designed to simulate, visualize, and programmatically animate Quantum Error Correction (QEC) circuits.

```text
+-----------------------------------------------------------+
|                      crates/qec_engine                    |
|             (Rust + wasm-bindgen + binar + paulimer)      |
+-----------------------------------------------------------+
                             |
                   wasm-pack build (--target web)
                             v
+-----------------------------------------------------------+
|                     packages/qec-wasm                     |
|           (Wasm binary + TypeScript typings)              |
+-----------------------------------------------------------+
                             |
        +--------------------+--------------------+
        |                                         |
        v                                         v
+-----------------------+               +-----------------------+
|  packages/visualizers |               |         web/          |
|  (Shared React/SVG    | ------------> | (Vite Playground SPA) |
|   Visualizers)        |               +-----------------------+
+-----------------------+
        |
        v
+-----------------------+
|        video/         |
|  (Remotion Pipeline)  |
+-----------------------+
```

---

## 1. Rust Engine (`crates/qec_engine`)
- **Stabilizer & Symplectic Simulation:** Uses Microsoft's `binar` (binary matrix operations) and `paulimer` (Pauli operators, Clifford conjugation).
- **State Encapsulation:** Circuit state and stabilizer tableaus live entirely in Rust heap memory.
- **Zero-Copy Memory Synchronization:** Exposes flat typed memory buffers (`Uint8Array`, `Float32Array`) directly to the Canvas/WebGL layer across the WebAssembly boundary, completely avoiding expensive JSON serialization on animation ticks.

---

## 2. Shared Visualizers (`packages/visualizers`)
- Components such as `ShorLattice.tsx` are written once in React and shared across:
  - The interactive single-page app (`web/`)
  - The Remotion deterministic video engine (`video/`)
- **RGB = XYZ Convention (Crumble / Stim Standard):**
  - **Red:** Pauli $X$ errors, $X$-type checks, $X$-boundaries.
  - **Green:** Pauli $Y$ errors, $Y$-type checks.
  - **Blue:** Pauli $Z$ errors, $Z$-type checks, $Z$-boundaries.

---

## 3. Interactive Web Playground (`web/`)
- Built with Vite, React, and TypeScript with `vite-plugin-wasm` and `vite-plugin-top-level-await`.
- Interactive qubit error cycling ($I \to X \to Y \to Z$), real-time syndrome defect illumination, and live diagnostic decoder feedback.
- Deep-linking parser (e.g. `#code=shor&error=X_1`) for direct state sharing from video timestamps.

---

## 4. Programmatic Video Pipeline (`video/`)
- **Remotion Framework:** Programmatic, deterministic 60 FPS 1080p/4K MP4 export via headless Chromium and FFmpeg.
- **Wasm Frame Synchronization:** Video time maps directly to discrete simulation steps (`frame -> layer_index -> wasm_state`).
- **Camera Flight Rules:**
  1. Start **orthographic (top-down 2D)** to introduce physical qubits and stabilizer generators.
  2. Tilt smoothly to **isometric 2.5D** when extruding repeated measurement rounds.
  3. Dolly and zoom directly onto localized defects (detector flips) while dimming the background lattice.
- **Timeline DSL (`.qec.yaml`):** High-level declarative script format driving state transitions (`init_code`, `inject_error`, `measure_syndrome`, `step_decoder`, `highlight_tableau`).

---

## 5. Next-Gen Upgrades Over Crumble
- **Rust/Wasm Clifford Tracking:** Replaces vanilla JavaScript Clifford tracking with high-speed SIMD-friendly binary arithmetic.
- **Automated Detector Derivation:** Computes null spaces over $\mathbb{F}_2$ via `binar::BitMatrix` to automatically discover deterministic measurement loops without manual tagging.
- **Parametric Code Generators:** Procedural generation of rotated surface codes, planar surface codes, and color codes for arbitrary distances $d$.
- **Web Worker Decoupling:** Runs heavy Clifford propagation and Monte Carlo noise sampling in background Web Workers to maintain 60 FPS UI responsiveness.
- **Hook-Error Linting:** Analyzes CNOT schedules to flag fault-intolerant error propagation that degrades effective distance from $d$ to $d-2$.
