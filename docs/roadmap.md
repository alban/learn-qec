# Roadmap & Milestones

This roadmap outlines the phased development of `learn-qec`.

---

## Milestone 1: Shor $[[9, 1, 3]]$ Code Pipeline
- **Goal:** Build the complete end-to-end Rust Wasm $\to$ React $\to$ Remotion loop using the Shor 9-qubit code.
- **Scope:**
  - `crates/qec_engine`: `ShorCodeCircuit` representing 9 data qubits, 6 bit-flip ($Z$) checks, 2 phase-flip ($X$) checks, and syndrome extraction.
  - `web/`: 2D SVG/Canvas interactive lattice with clickable error cycling (None $\to$ $X$ $\to$ $Y$ $\to$ $Z$).
  - `video/`: Remotion 15-second 1080p explainer demonstrating error injection, syndrome detection, and recovery.

---

## Milestone 2: CSS Codes & Binary Symplectic Tableau
- **Goal:** Generalize stabilizer code representation with generator matrices.
- **Scope:**
  - Steane $[[7, 1, 3]]$ code and classical Fano plane check mapping.
  - Live $(X \mid Z)$ binary symplectic check matrix heatmap powered by `binar::BitMatrix`.
  - Transversal Clifford gates and error propagation.

---

## Milestone 3: 2D Surface Code & Union-Find Decoding
- **Goal:** Planar rotated surface code visualizer and step-by-step heuristic decoder.
- **Scope:**
  - Rotated surface code patches for distances $d=3, 5$.
  - Rust-native Union-Find decoder with an introspective step-by-step iterator (cluster growth, merging, boundary anchoring, peeling).
  - Space-time syndrome prism (2.5D/3D layer extrusion).

---

## Milestone 4: qLDPC & Belief Propagation
- **Goal:** Quantum Low-Density Parity-Check (qLDPC) codes and Tanner graph decoding.
- **Scope:**
  - Bipartite Tanner graph visualization showing real-time log-likelihood ratio (LLR) flow.
  - Belief Propagation (BP) message passing and Ordered Statistics Decoding (OSD) post-processing.
