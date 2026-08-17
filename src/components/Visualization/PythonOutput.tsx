interface PythonOutputProps {
  image?: string;
  output: string;
  onClose?: () => void;
}

export function PythonOutput({ image, output, onClose }: PythonOutputProps) {
  return (
    <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">🐍 Python Output</span>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs rounded bg-surface-elevated text-muted hover:text-foreground border border-border cursor-pointer"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-4">
        {image && (
          <img
            src={`data:image/png;base64,${image}`}
            alt="Python plot output"
            className="max-w-full max-h-[80%] rounded-lg border border-border shadow-lg"
          />
        )}
        {output && !image && (
          <pre className="text-sm font-mono text-foreground bg-surface p-4 rounded-lg border border-border max-w-full overflow-auto">
            {output}
          </pre>
        )}
        {!image && !output && (
          <p className="text-muted text-sm">No output generated.</p>
        )}
      </div>
    </div>
  );
}
