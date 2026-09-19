import { useState, useEffect, useRef, useCallback } from 'react';

export interface StepMeta {
  step: number;
  title: string;
  badge: string;
  desc: string;
}

export const QEC_STEP_METAS: StepMeta[] = [
  {
    step: 0,
    title: '1. Error Injected',
    badge: 'Perturbation',
    desc: 'Pauli error is active on the data qubit lattice.',
  },
  {
    step: 1,
    title: '2. Syndrome Extraction',
    badge: 'Syndrome Parity',
    desc: 'Stabilizer generators anti-commute with error, lighting up defect checks.',
  },
  {
    step: 2,
    title: '3. Decoder Diagnosis',
    badge: 'Decoder Target',
    desc: 'Minimum-weight decoder locates target qubit and Pauli recovery gate.',
  },
  {
    step: 3,
    title: '4. Recovery Gate Applied',
    badge: 'Correction',
    desc: 'Recovery Pauli operator is applied to cancel the defect.',
  },
  {
    step: 4,
    title: '5. Verification',
    badge: 'Code Space Clean',
    desc: 'Code state restored to the invariant +1 stabilizer eigenspace.',
  },
];

export interface UseStepPlayerOptions {
  totalSteps?: number;
  baseIntervalMs?: number; // Base delay per step at 1x speed (default: 1200ms)
  onStepChange?: (step: number) => void;
  onComplete?: () => void;
}

export function useStepPlayer(options: UseStepPlayerOptions = {}) {
  const {
    totalSteps = 5,
    baseIntervalMs = 1200,
    onStepChange,
    onComplete,
  } = options;

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.max(0, Math.min(step, totalSteps - 1));
      setCurrentStep(clamped);
      onStepChange?.(clamped);
    },
    [totalSteps, onStepChange],
  );

  const stepForward = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev < totalSteps - 1) {
        const next = prev + 1;
        onStepChange?.(next);
        return next;
      } else {
        setIsPlaying(false);
        onComplete?.();
        return prev;
      }
    });
  }, [totalSteps, onStepChange, onComplete]);

  const stepBackward = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(0, prev - 1);
      onStepChange?.(next);
      return next;
    });
  }, [onStepChange]);

  const play = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      goToStep(0);
    }
    setIsPlaying(true);
  }, [currentStep, totalSteps, goToStep]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    goToStep(0);
  }, [goToStep]);

  // Autoplay ticker
  useEffect(() => {
    if (isPlaying) {
      const interval = baseIntervalMs / speed;
      timerRef.current = setTimeout(() => {
        stepForward();
      }, interval);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentStep, speed, baseIntervalMs, stepForward]);

  return {
    currentStep,
    totalSteps,
    isPlaying,
    speed,
    currentMeta: QEC_STEP_METAS[currentStep] || QEC_STEP_METAS[0],
    setSpeed,
    play,
    pause,
    togglePlay,
    stepForward,
    stepBackward,
    goToStep,
    reset,
  };
}
