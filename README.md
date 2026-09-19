# learn-qec

An interactive, high-performance Quantum Error Correction (QEC) visualizer and programmatic video engine.

[![Deploy GitHub Pages](https://github.com/alban/learn-qec/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/alban/learn-qec/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

> [!NOTE]
> **Disclaimer:** I am a part-time student in quantum technologies and use this project as a hands-on learning playground. While I strive for mathematical and physical accuracy, there might be mistakes. Corrections, issues, and feedback are very welcome!

---

## Overview

**learn-qec** is an educational playground for exploring stabilizer codes, syndrome extraction, and decoding heuristics. It combines:

1. **Rust / WebAssembly Simulation Engine:** High-performance symplectic arithmetic and stabilizer state tracking using Microsoft's `qdk-ec` crates (`binar`, `paulimer`).
2. **Interactive Web Playground:** A modern React + TypeScript canvas providing real-time syndrome illumination, Pauli error injection, and interactive correction.
3. **Programmatic Video Pipeline:** Frame-accurate, 60 FPS educational animations generated deterministically with [Remotion](https://www.remotion.dev/).

---

## Visual Conventions

Following the standard Crumble and Stim conventions:
- **Red:** Pauli $X$ errors and $X$-type checks (bit-flip)
- **Green:** Pauli $Y$ errors and $Y$-type checks (bit + phase-flip)
- **Blue:** Pauli $Z$ errors and $Z$-type checks (phase-flip)

---

## Live Demo

The interactive playground is hosted on GitHub Pages:  
👉 **[https://alban.github.io/learn-qec/](https://alban.github.io/learn-qec/)**

---

## License

Distributed under the [MIT License](LICENSE).
