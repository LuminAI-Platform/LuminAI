import React from "react";

interface StepDropzoneProps {
  dragActive: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const StepDropzone: React.FC<StepDropzoneProps> = ({
  dragActive,
  fileInputRef,
  onDrag,
  onDrop,
  onChange,
}) => {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <form
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        className={`w-full max-w-2xl border-2 border-dashed rounded-lg p-12 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
          dragActive
            ? "border-blue-500 bg-blue-500/5"
            : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/45 hover:bg-zinc-950/60"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={onChange}
        />
        <div className="w-16 h-16 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors mb-6 shadow-inner">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m9 15 3-3 3 3" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-zinc-100 tracking-tight">
          Drag and drop file
        </h3>
        <p className="text-sm text-zinc-400 mt-2 max-w-md">
          Ingest structured records instantly. Supported formats are{" "}
          <strong className="text-zinc-300">CSV</strong> or{" "}
          <strong className="text-zinc-300">JSON</strong> (up to 500 MB).
        </p>
        <button
          type="button"
          className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/10 transition-colors cursor-pointer"
        >
          Select File
        </button>
      </form>
    </div>
  );
};
