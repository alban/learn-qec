import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Video,
  Film,
  Loader2,
} from 'lucide-react';
import { QEC_STEP_METAS } from '../playback/useStepPlayer';

export interface PlaybackBarProps {
  currentStep: number;
  totalSteps?: number;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onGoToStep: (step: number) => void;
  onReset: () => void;
  onSpeedChange: (speed: 0.5 | 1 | 2) => void;
  onRecordVideo?: () => Promise<void>;
  onRecordGif?: () => Promise<void>;
  recordingState?: {
    isRecording: boolean;
    progress: number;
    text: string;
  };
  className?: string;
}

export const PlaybackBar: React.FC<PlaybackBarProps> = ({
  currentStep,
  totalSteps = 5,
  isPlaying,
  speed,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  onGoToStep,
  onReset,
  onSpeedChange,
  onRecordVideo,
  onRecordGif,
  recordingState = { isRecording: false, progress: 0, text: '' },
  className = '',
}) => {
  const currentMeta = QEC_STEP_METAS[currentStep] || QEC_STEP_METAS[0];

  return (
    <div
      className={`w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur flex flex-col space-y-3.5 select-none ${className}`}
    >
      {/* Top Bar: Step Progress Indicator & Scrubbable Dots */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {currentMeta.badge}
            </span>
            <h4 className="text-xs font-bold text-white font-mono">
              {currentMeta.title}
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{currentMeta.desc}</p>
        </div>

        {/* 5-Step Scrubbable Progress Pills */}
        <div className="flex items-center space-x-1.5 self-start sm:self-center">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const isCurrent = currentStep === idx;
            const isPast = currentStep > idx;
            return (
              <button
                key={`step-dot-${idx}`}
                onClick={() => !recordingState.isRecording && onGoToStep(idx)}
                disabled={recordingState.isRecording}
                title={`Jump to step ${idx + 1}: ${QEC_STEP_METAS[idx]?.title}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? 'w-7 bg-indigo-500 shadow-md shadow-indigo-500/50'
                    : isPast
                    ? 'w-3 bg-indigo-700/60 hover:bg-indigo-600'
                    : 'w-3 bg-slate-800 hover:bg-slate-700'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Recording Status Bar (if active) */}
      {recordingState.isRecording && (
        <div className="py-2 px-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 flex flex-col space-y-1 text-xs font-mono">
          <div className="flex items-center justify-between text-indigo-200">
            <span className="flex items-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>{recordingState.text}</span>
            </span>
            <span className="font-bold">{recordingState.progress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-150"
              style={{ width: `${recordingState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Controls Bar: Playback Controls & Recording Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
        {/* Left: Player Buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onReset}
            disabled={recordingState.isRecording}
            title="Reset playback to Step 1"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onStepBackward}
            disabled={recordingState.isRecording || currentStep === 0}
            title="Previous Step"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition disabled:opacity-30"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onTogglePlay}
            disabled={recordingState.isRecording}
            title={isPlaying ? 'Pause' : 'Play Sequence'}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/30 transition flex items-center space-x-1.5 disabled:opacity-40"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            onClick={onStepForward}
            disabled={recordingState.isRecording || currentStep === totalSteps - 1}
            title="Next Step"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition disabled:opacity-30"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Speed Toggle */}
          <div className="ml-2 flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 text-[10px] font-mono font-semibold">
            {([0.5, 1, 2] as const).map((s) => (
              <button
                key={`speed-${s}`}
                onClick={() => onSpeedChange(s)}
                disabled={recordingState.isRecording}
                className={`px-1.5 py-0.5 rounded transition ${
                  speed === s
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Export Video & Export GIF Buttons */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          {onRecordVideo && (
            <button
              onClick={onRecordVideo}
              disabled={recordingState.isRecording}
              title="Record and download animation as MP4/WebM video"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center space-x-1.5 shadow-sm disabled:opacity-40"
            >
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              <span>Record Video</span>
            </button>
          )}

          {onRecordGif && (
            <button
              onClick={onRecordGif}
              disabled={recordingState.isRecording}
              title="Record and download animation as an animated GIF"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center space-x-1.5 shadow-sm disabled:opacity-40"
            >
              <Film className="w-3.5 h-3.5 text-amber-400" />
              <span>Record GIF</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
