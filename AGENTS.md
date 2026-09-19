# Instructions for AI Agents (LLMs)

You are an automated coding agent working on the `learn-qec` repository. Follow these strict rules and operational invariants at all times.

---

## 1. Safety & Git Invariants
- **NEVER PUSH TO GIT:** Never execute `git push` autonomously. This repository has a public remote. Always ask for explicit user permission before any push.
- **NO DESTRUCTIVE GIT OPS:** Do not run `git reset --hard` or `git clean -f` without explicit user instruction.
- **LOCAL OVERRIDES:** If `AGENTS.local.md` exists, consult and follow its instructions (it is gitignored and contains private/local guidelines).

---

## 2. Core Architectural Invariants
- **STATE BOUNDARY:**
  - Never implement Clifford conjugation, stabilizer matrix multiplication, or Pauli tracking in TypeScript.
  - All quantum computations belong strictly in Rust (`crates/qec_engine`) using Microsoft's `binar` and `paulimer` crates.
  - TypeScript and React act exclusively as a view layer.
- **ZERO-COPY STATE SYNCHRONIZATION:**
  - Never serialize circuit state or syndrome vectors to JSON on animation loops or render ticks.
  - Expose flat typed buffers (`Uint8Array`, `Float32Array`) directly across the Wasm boundary to Canvas/SVG/WebGL.
- **RGB = XYZ COLOR STANDARD:**
  - Follow the Crumble and Stim standard across all UI components, SVGs, and 3D meshes:
    - **Red:** Pauli $X$ errors, $X$-type checks, $X$-boundaries.
    - **Green:** Pauli $Y$ errors, $Y$-type checks.
    - **Blue:** Pauli $Z$ errors, $Z$-type checks, $Z$-boundaries.

---

## 3. Operational Commands
- **Compile Wasm:**
  ```bash
  wasm-pack build crates/qec_engine --target web --out-dir ../../packages/qec-wasm
  ```
- **Run Tests:**
  ```bash
  cargo test -p qec_engine
  ```
- **Web App:**
  ```bash
  npm run dev --workspace=web
  npm run build --workspace=web
  ```
- **Remotion Video:**
  ```bash
  npm run preview --workspace=video
  npm run render --workspace=video
  ```
