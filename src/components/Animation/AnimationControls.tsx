import { useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Zap } from 'lucide-react';
import type { AnimationState } from '../../lib/animation-engine';

interface AnimationControlsProps {
  animations: AnimationState[];
  onPlay: (id: string) => void;
  onPause: (id: string) => void;
  onStop: (id: string) => void;
  onReset: (id: string) => void;
  onSpeedChange: (id: string, speed: number) => void;
  onPlayAll: () => void;
  onPauseAll: () => void;
  onStopAll: () => void;
}

export function AnimationControls({
  animations,
  onPlay,
  onPause,
  onStop,
  onReset,
  onSpeedChange,
  onPlayAll,
  onPauseAll,
  onStopAll,
}: AnimationControlsProps) {
  const anyPlaying = animations.some(a => a.playing);

  if (animations.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 max-w-[220px]">
      {/* Global controls */}
      <div className="flex items-center gap-1 bg-surface/90 backdrop-blur-sm border border-border rounded-lg px-2 py-1.5 shadow-lg">
        <Zap size={12} className="text-accent mr-1" />
        <span className="text-[10px] text-muted font-medium uppercase tracking-wide mr-auto">Animations</span>
        <button
          onClick={anyPlaying ? onPauseAll : onPlayAll}
          className="w-6 h-6 flex items-center justify-center rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors cursor-pointer active:scale-90"
          aria-label={anyPlaying ? 'Pause all' : 'Play all'}
          title={anyPlaying ? 'Pause all' : 'Play all'}
        >
          {anyPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          onClick={onStopAll}
          className="w-6 h-6 flex items-center justify-center rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer active:scale-90"
          aria-label="Stop all"
          title="Stop all"
        >
          <Square size={10} />
        </button>
      </div>

      {/* Per-animation controls */}
      {animations.map((anim) => (
        <AnimationItem
          key={anim.config.id}
          animation={anim}
          onPlay={onPlay}
          onPause={onPause}
          onStop={onStop}
          onReset={onReset}
          onSpeedChange={onSpeedChange}
        />
      ))}
    </div>
  );
}

interface AnimationItemProps {
  animation: AnimationState;
  onPlay: (id: string) => void;
  onPause: (id: string) => void;
  onStop: (id: string) => void;
  onReset: (id: string) => void;
  onSpeedChange: (id: string, speed: number) => void;
}

function AnimationItem({ animation, onPlay, onPause, onStop, onReset, onSpeedChange }: AnimationItemProps) {
  const { config, playing, time } = animation;

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSpeedChange(config.id, parseFloat(e.target.value));
  }, [config.id, onSpeedChange]);

  return (
    <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-2 shadow-lg">
      {/* Label + status */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.color, boxShadow: playing ? `0 0 6px ${config.color}` : 'none' }}
        />
        <span className="text-xs font-medium text-foreground truncate flex-1">{config.label}</span>
        <span className="text-[10px] font-mono text-muted">{time.toFixed(1)}s</span>
      </div>

      {/* Playback buttons */}
      <div className="flex items-center gap-1 mb-1.5">
        <button
          onClick={() => playing ? onPause(config.id) : onPlay(config.id)}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer active:scale-90 ${
            playing ? 'bg-accent/20 text-accent' : 'bg-surface-elevated text-foreground hover:bg-accent/15 hover:text-accent'
          }`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={11} /> : <Play size={11} />}
        </button>
        <button
          onClick={() => onStop(config.id)}
          className="w-6 h-6 flex items-center justify-center rounded bg-surface-elevated text-muted hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer active:scale-90"
          aria-label="Stop"
        >
          <Square size={9} />
        </button>
        <button
          onClick={() => onReset(config.id)}
          className="w-6 h-6 flex items-center justify-center rounded bg-surface-elevated text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer active:scale-90"
          aria-label="Reset"
        >
          <RotateCcw size={11} />
        </button>

        {/* Speed display */}
        <span className="text-[10px] text-muted ml-auto font-mono">{config.speed.toFixed(1)}×</span>
      </div>

      {/* Speed slider */}
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        value={config.speed}
        onChange={handleSpeedChange}
        className="w-full h-1 rounded-full appearance-none bg-border cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer"
        aria-label="Animation speed"
      />
    </div>
  );
}
