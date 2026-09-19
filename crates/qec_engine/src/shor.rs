use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Pauli error types matching standard Crumble/Stim convention:
/// 0 = Identity (I)
/// 1 = Pauli X (Bit-flip, Red)
/// 2 = Pauli Y (Bit & Phase-flip, Green)
/// 3 = Pauli Z (Phase-flip, Blue)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum Pauli {
    I = 0,
    X = 1,
    Y = 2,
    Z = 3,
}

impl From<u8> for Pauli {
    fn from(val: u8) -> Self {
        match val {
            1 => Pauli::X,
            2 => Pauli::Y,
            3 => Pauli::Z,
            _ => Pauli::I,
        }
    }
}

/// Returns true if two single-qubit Pauli operators anticommute:
/// {X, Z} = 0, {X, Y} = 0, {Y, Z} = 0; same Paulis or I commute.
#[inline]
pub fn anticommutes(p1: Pauli, p2: Pauli) -> bool {
    match (p1, p2) {
        (Pauli::I, _) | (_, Pauli::I) => false,
        (Pauli::X, Pauli::X) | (Pauli::Y, Pauli::Y) | (Pauli::Z, Pauli::Z) => false,
        _ => true,
    }
}

/// Suggested correction for detected syndrome
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Correction {
    pub qubit: usize,
    pub pauli: u8,
    #[wasm_bindgen(skip)]
    pub explanation: String,
}

#[wasm_bindgen]
impl Correction {
    #[wasm_bindgen(getter)]
    pub fn explanation(&self) -> String {
        self.explanation.clone()
    }
}

/// Shor [[9, 1, 3]] quantum error-correcting code engine.
///
/// 9 data qubits partitioned into three blocks of 3:
/// - Block 0: qubits 0, 1, 2
/// - Block 1: qubits 3, 4, 5
/// - Block 2: qubits 6, 7, 8
///
/// 8 Stabilizer Generators:
/// - Bit-flip (Z) checks (6):
///     S1 = Z0 Z1
///     S2 = Z1 Z2
///     S3 = Z3 Z4
///     S4 = Z4 Z5
///     S5 = Z6 Z7
///     S6 = Z7 Z8
/// - Phase-flip (X) checks (2):
///     S7 = X0 X1 X2 X3 X4 X5
///     S8 = X3 X4 X5 X6 X7 X8
#[wasm_bindgen]
pub struct ShorCodeCircuit {
    errors: [Pauli; 9],
    syndromes: [u8; 8],
}

#[wasm_bindgen]
impl ShorCodeCircuit {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut circuit = Self {
            errors: [Pauli::I; 9],
            syndromes: [0; 8],
        };
        circuit.update_syndromes();
        circuit
    }

    /// Reset all injected errors to Identity.
    pub fn clear_errors(&mut self) {
        self.errors = [Pauli::I; 9];
        self.update_syndromes();
    }

    /// Inject a Pauli error (1=X, 2=Y, 3=Z, 0=I) on target qubit (0..8).
    pub fn inject_error(&mut self, qubit: usize, pauli: u8) {
        if qubit < 9 {
            self.errors[qubit] = Pauli::from(pauli);
            self.update_syndromes();
        }
    }

    /// Returns the current error on a qubit (0=I, 1=X, 2=Y, 3=Z).
    pub fn get_error(&self, qubit: usize) -> u8 {
        if qubit < 9 {
            self.errors[qubit] as u8
        } else {
            0
        }
    }

    /// Zero-copy view / flat array of all 9 qubit errors.
    pub fn get_errors(&self) -> Vec<u8> {
        self.errors.iter().map(|&p| p as u8).collect()
    }

    /// Evaluates parity against the 8 generators and returns an 8-bit syndrome vector.
    /// Defect = 1 (anticommutes with generator), Neutral = 0 (commutes).
    pub fn measure_syndromes(&mut self) -> Vec<u8> {
        self.update_syndromes();
        self.syndromes.to_vec()
    }

    /// Returns current syndrome vector without recomputing.
    pub fn get_syndromes(&self) -> Vec<u8> {
        self.syndromes.to_vec()
    }

    /// Suggests single-qubit correction based on the current syndrome vector.
    pub fn suggest_correction(&self) -> Option<Correction> {
        self.decode_syndrome(&self.syndromes)
    }

    /// Applies the suggested correction directly to remove errors.
    pub fn apply_correction(&mut self) -> bool {
        if let Some(corr) = self.suggest_correction() {
            // Invert or compose the correction Pauli onto the target qubit
            let cur = self.errors[corr.qubit];
            let corr_p = Pauli::from(corr.pauli);
            self.errors[corr.qubit] = match (cur, corr_p) {
                (Pauli::I, p) => p,
                (p1, p2) if p1 == p2 => Pauli::I,
                (Pauli::X, Pauli::Z) | (Pauli::Z, Pauli::X) => Pauli::Y,
                (Pauli::Y, Pauli::Z) | (Pauli::Z, Pauli::Y) => Pauli::X,
                (Pauli::Y, Pauli::X) | (Pauli::X, Pauli::Y) => Pauli::Z,
                _ => Pauli::I,
            };
            self.update_syndromes();
            true
        } else {
            false
        }
    }

    /// Internal syndrome evaluation: counts anticommutations modulo 2.
    fn update_syndromes(&mut self) {
        // Bit-flip checks (Z-checks):
        // S1 = Z0 Z1
        self.syndromes[0] = (anticommutes(self.errors[0], Pauli::Z)
            ^ anticommutes(self.errors[1], Pauli::Z)) as u8;

        // S2 = Z1 Z2
        self.syndromes[1] = (anticommutes(self.errors[1], Pauli::Z)
            ^ anticommutes(self.errors[2], Pauli::Z)) as u8;

        // S3 = Z3 Z4
        self.syndromes[2] = (anticommutes(self.errors[3], Pauli::Z)
            ^ anticommutes(self.errors[4], Pauli::Z)) as u8;

        // S4 = Z4 Z5
        self.syndromes[3] = (anticommutes(self.errors[4], Pauli::Z)
            ^ anticommutes(self.errors[5], Pauli::Z)) as u8;

        // S5 = Z6 Z7
        self.syndromes[4] = (anticommutes(self.errors[6], Pauli::Z)
            ^ anticommutes(self.errors[7], Pauli::Z)) as u8;

        // S6 = Z7 Z8
        self.syndromes[5] = (anticommutes(self.errors[7], Pauli::Z)
            ^ anticommutes(self.errors[8], Pauli::Z)) as u8;

        // Phase-flip checks (X-checks):
        // S7 = X0 X1 X2 X3 X4 X5
        let mut s7_anticommutes = false;
        for q in 0..6 {
            s7_anticommutes ^= anticommutes(self.errors[q], Pauli::X);
        }
        self.syndromes[6] = s7_anticommutes as u8;

        // S8 = X3 X4 X5 X6 X7 X8
        let mut s8_anticommutes = false;
        for q in 3..9 {
            s8_anticommutes ^= anticommutes(self.errors[q], Pauli::X);
        }
        self.syndromes[7] = s8_anticommutes as u8;
    }

    /// Decode syndrome into a suggested correction:
    /// - Bit-flip detection in Block 0 (S1, S2):
    ///     (1, 0) -> qubit 0 bit-flip (X)
    ///     (1, 1) -> qubit 1 bit-flip (X)
    ///     (0, 1) -> qubit 2 bit-flip (X)
    /// - Bit-flip detection in Block 1 (S3, S4):
    ///     (1, 0) -> qubit 3 bit-flip (X)
    ///     (1, 1) -> qubit 4 bit-flip (X)
    ///     (0, 1) -> qubit 5 bit-flip (X)
    /// - Bit-flip detection in Block 2 (S5, S6):
    ///     (1, 0) -> qubit 6 bit-flip (X)
    ///     (1, 1) -> qubit 7 bit-flip (X)
    ///     (0, 1) -> qubit 8 bit-flip (X)
    /// - Phase-flip detection across Blocks (S7, S8):
    ///     (1, 0) -> phase-flip in Block 0 (apply Z to qubit in Block 0)
    ///     (1, 1) -> phase-flip in Block 1 (apply Z to qubit in Block 1)
    ///     (0, 1) -> phase-flip in Block 2 (apply Z to qubit in Block 2)
    fn decode_syndrome(&self, syn: &[u8; 8]) -> Option<Correction> {
        let (s1, s2, s3, s4, s5, s6, s7, s8) =
            (syn[0], syn[1], syn[2], syn[3], syn[4], syn[5], syn[6], syn[7]);

        let has_bit_flip = s1 | s2 | s3 | s4 | s5 | s6 != 0;
        let has_phase_flip = s7 | s8 != 0;

        if !has_bit_flip && !has_phase_flip {
            return None;
        }

        // Identify bit-flip location
        let bit_flip_qubit = match (s1, s2, s3, s4, s5, s6) {
            (1, 0, 0, 0, 0, 0) => Some(0),
            (1, 1, 0, 0, 0, 0) => Some(1),
            (0, 1, 0, 0, 0, 0) => Some(2),
            (0, 0, 1, 0, 0, 0) => Some(3),
            (0, 0, 1, 1, 0, 0) => Some(4),
            (0, 0, 0, 1, 0, 0) => Some(5),
            (0, 0, 0, 0, 1, 0) => Some(6),
            (0, 0, 0, 0, 1, 1) => Some(7),
            (0, 0, 0, 0, 0, 1) => Some(8),
            _ => None,
        };

        // Identify phase-flip block
        let phase_flip_block = match (s7, s8) {
            (1, 0) => Some(0), // Block 0
            (1, 1) => Some(1), // Block 1
            (0, 1) => Some(2), // Block 2
            _ => None,
        };

        match (bit_flip_qubit, phase_flip_block) {
            // Both bit-flip and phase-flip on the same block/qubit -> Y error
            (Some(q), Some(b)) if q / 3 == b => Some(Correction {
                qubit: q,
                pauli: Pauli::Y as u8,
                explanation: format!(
                    "Syndrome detects combined bit and phase flip on Qubit {}. Apply Pauli Y to correct.",
                    q
                ),
            }),
            // Pure bit flip -> X error
            (Some(q), None) => Some(Correction {
                qubit: q,
                pauli: Pauli::X as u8,
                explanation: format!(
                    "Bit-flip detected by Z-stabilizers on Qubit {}. Apply Pauli X to correct.",
                    q
                ),
            }),
            // Pure phase flip -> Z error on any qubit of the identified block
            (None, Some(b)) => {
                let target_qubit = b * 3;
                Some(Correction {
                    qubit: target_qubit,
                    pauli: Pauli::Z as u8,
                    explanation: format!(
                        "Phase-flip detected by X-stabilizers in Block {} (Qubits {}-{}). Apply Pauli Z to Qubit {} to correct.",
                        b,
                        b * 3,
                        b * 3 + 2,
                        target_qubit
                    ),
                })
            }
            // If bit flip and phase flip are on different blocks (multi-qubit error)
            (Some(q), Some(_)) => Some(Correction {
                qubit: q,
                pauli: Pauli::X as u8,
                explanation: format!(
                    "Multi-qubit error detected. Correcting primary bit-flip on Qubit {}.",
                    q
                ),
            }),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pristine_circuit() {
        let circuit = ShorCodeCircuit::new();
        assert_eq!(circuit.get_syndromes(), vec![0; 8]);
        assert!(circuit.suggest_correction().is_none());
    }

    #[test]
    fn test_single_qubit_x_errors() {
        // Test bit-flip on qubit 1 (frame 90-150 in chat2.log)
        let mut circuit = ShorCodeCircuit::new();
        circuit.inject_error(1, Pauli::X as u8);
        assert_eq!(circuit.get_syndromes(), vec![1, 1, 0, 0, 0, 0, 0, 0]);

        let corr = circuit.suggest_correction().expect("should suggest correction");
        assert_eq!(corr.qubit, 1);
        assert_eq!(corr.pauli, Pauli::X as u8);

        // Apply correction and verify return to neutral
        assert!(circuit.apply_correction());
        assert_eq!(circuit.get_syndromes(), vec![0; 8]);
    }

    #[test]
    fn test_single_qubit_z_errors() {
        let mut circuit = ShorCodeCircuit::new();
        // Z on qubit 0 (Block 0)
        circuit.inject_error(0, Pauli::Z as u8);
        assert_eq!(circuit.get_syndromes(), vec![0, 0, 0, 0, 0, 0, 1, 0]);
        let corr = circuit.suggest_correction().unwrap();
        assert_eq!(corr.qubit / 3, 0); // Corrects block 0
        assert_eq!(corr.pauli, Pauli::Z as u8);

        // Z on qubit 4 (Block 1)
        circuit.clear_errors();
        circuit.inject_error(4, Pauli::Z as u8);
        assert_eq!(circuit.get_syndromes(), vec![0, 0, 0, 0, 0, 0, 1, 1]);
        let corr = circuit.suggest_correction().unwrap();
        assert_eq!(corr.qubit / 3, 1); // Corrects block 1
        assert_eq!(corr.pauli, Pauli::Z as u8);

        // Z on qubit 7 (Block 2)
        circuit.clear_errors();
        circuit.inject_error(7, Pauli::Z as u8);
        assert_eq!(circuit.get_syndromes(), vec![0, 0, 0, 0, 0, 0, 0, 1]);
        let corr = circuit.suggest_correction().unwrap();
        assert_eq!(corr.qubit / 3, 2); // Corrects block 2
        assert_eq!(corr.pauli, Pauli::Z as u8);
    }

    #[test]
    fn test_single_qubit_y_errors() {
        let mut circuit = ShorCodeCircuit::new();
        circuit.inject_error(1, Pauli::Y as u8);
        // S1=1, S2=1, S7=1, S8=0
        assert_eq!(circuit.get_syndromes(), vec![1, 1, 0, 0, 0, 0, 1, 0]);
        let corr = circuit.suggest_correction().unwrap();
        assert_eq!(corr.qubit, 1);
        assert_eq!(corr.pauli, Pauli::Y as u8);

        assert!(circuit.apply_correction());
        assert_eq!(circuit.get_syndromes(), vec![0; 8]);
    }
}
