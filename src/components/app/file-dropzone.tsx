"use client";

// Drag-and-drop file picker. Layout adapted from Origin UI's file-upload
// patterns (originui.com, MIT) - rewritten without their hook so it stays a
// thin controlled wrapper around a native <input type="file">.
import { useId, useRef, useState } from "react";
import { FileTextIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDropzone({
  files,
  onFilesChange,
  accept,
  multiple = false,
  title = "Dosyayı buraya sürükle",
  hint,
  icon: Icon = UploadCloudIcon,
  className,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accepts(file: File) {
    if (!accept) return true;
    return accept.split(",").some((rule) => {
      const r = rule.trim();
      if (r.startsWith(".")) return file.name.toLowerCase().endsWith(r.toLowerCase());
      if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
      return file.type === r;
    });
  }

  function take(list: FileList | null) {
    const picked = list ? Array.from(list).filter(accepts) : [];
    if (!picked.length) return;
    onFilesChange(multiple ? picked : picked.slice(0, 1));
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-input bg-background/60 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/30",
          dragging && "border-primary bg-accent/60",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-background ring-1 ring-border transition-transform group-hover:-translate-y-0.5">
          <Icon className="size-5 text-primary" />
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">
          ya da <span className="font-medium text-primary underline-offset-2 group-hover:underline">göz at</span>
          {hint ? <> · {hint}</> : null}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, i) => (
            <li
              key={file.name + i}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm text-card-foreground"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileTextIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{file.name}</span>
                <span className="block text-xs text-muted-foreground">{formatBytes(file.size)}</span>
              </span>
              <button
                type="button"
                aria-label={`${file.name} dosyasını kaldır`}
                onClick={() => onFilesChange(files.filter((_, j) => j !== i))}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
