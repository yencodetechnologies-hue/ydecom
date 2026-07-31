import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Upload, X } from 'lucide-react';

export default function CategoryImageUploader({
  previewUrl,
  fileName,
  onSelect,
  onClear,
  label = 'Category image',
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    onSelect(file);
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-ink/80">{label}</span>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition ${
          dragging
            ? 'border-rose bg-rose-soft/40'
            : 'border-blush-line bg-gradient-to-br from-blush/80 to-white hover:border-rose/50'
        }`}
      >
        {previewUrl ? (
          <div className="relative aspect-[16/9] w-full">
            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-wine/55 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-white/95">
                {fileName || 'Current image'}
              </p>
              <button
                type="button"
                className="rounded-full bg-white/95 p-1.5 text-wine shadow-sm transition hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-blush-line">
              <ImagePlus className="h-5 w-5 text-rose-deep" />
            </span>
            <p className="text-sm font-semibold text-wine">Add a category image</p>
            <p className="max-w-[220px] text-xs text-mauve">
              Drag & drop or click to upload. JPG, PNG, or WebP up to 5MB.
            </p>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-plum px-3 py-1.5 text-[12px] font-semibold text-white">
              <Upload className="h-3.5 w-3.5" /> Choose file
            </span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
