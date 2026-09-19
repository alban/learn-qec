# Shor [[9, 1, 3]] Code

The Shor code is the first known quantum error-correcting code, introduced by Peter Shor in 1995. It encodes 1 logical qubit into 9 physical qubits ($k=1, n=9$) and has code distance $d=3$, protecting against any arbitrary single-qubit quantum error.

---

## 1. Logical State Encoding
Arranged into 3 blocks of 3 qubits each:
- **Block 0:** Qubits 0, 1, 2
- **Block 1:** Qubits 3, 4, 5
- **Block 2:** Qubits 6, 7, 8

The logical basis states concatenate a 3-qubit phase-flip repetition code with a 3-qubit bit-flip repetition code:

$$|0_L\rangle = \frac{1}{2\sqrt{2}} (|000\rangle + |111\rangle)(|000\rangle + |111\rangle)(|000\rangle + |111\rangle)$$

$$|1_L\rangle = \frac{1}{2\sqrt{2}} (|000\rangle - |111\rangle)(|000\rangle - |111\rangle)(|000\rangle - |111\rangle)$$

---

## 2. Stabilizer Generators (8 Checks)

### Bit-Flip Checks (6 $Z$-Stabilizers)
Detects $X$ errors within each 3-qubit block by checking adjacent parity:
- $S_1 = Z_0 Z_1$ (Block 0)
- $S_2 = Z_1 Z_2$ (Block 0)
- $S_3 = Z_3 Z_4$ (Block 1)
- $S_4 = Z_4 Z_5$ (Block 1)
- $S_5 = Z_6 Z_7$ (Block 2)
- $S_6 = Z_7 Z_8$ (Block 2)

### Phase-Flip Checks (2 $X$-Stabilizers)
Detects $Z$ errors across blocks by checking relative phase between triplets:
- $S_7 = X_0 X_1 X_2 X_3 X_4 X_5$ (Block 0 $\leftrightarrow$ Block 1)
- $S_8 = X_3 X_4 X_5 X_6 X_7 X_8$ (Block 1 $\leftrightarrow$ Block 2)

---

## 3. Syndrome Decoding Logic
- **Bit-flip ($X$) isolation:**
  - $S_1=1, S_2=0 \implies X$ error on Qubit 0
  - $S_1=1, S_2=1 \implies X$ error on Qubit 1
  - $S_1=0, S_2=1 \implies X$ error on Qubit 2
  - (Analogous for Block 1 with $S_3, S_4$ and Block 2 with $S_5, S_6$)
- **Phase-flip ($Z$) isolation:**
  - $S_7=1, S_8=0 \implies Z$ error in Block 0 (correct via $Z$ on Qubit 0)
  - $S_7=1, S_8=1 \implies Z$ error in Block 1 (correct via $Z$ on Qubit 3)
  - $S_7=0, S_8=1 \implies Z$ error in Block 2 (correct via $Z$ on Qubit 6)
- **$Y$ errors:**
  - Simultaneously trigger both the bit-flip pair syndrome and the phase-flip block syndrome.
