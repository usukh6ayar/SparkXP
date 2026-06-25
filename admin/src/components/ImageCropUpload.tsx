import { useCallback, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { X, Image as ImageIcon, Crop } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  /** Crop aspect ratio (width/height). Default 2 = 2:1 thumbnail banner. */
  aspect?: number;
  /** Max output width in px (downscaled + compressed). Default 1200. */
  maxWidth?: number;
}

/**
 * Pick an image → crop it to a fixed aspect (2:1 by default) → compress →
 * upload to /upload → return the URL.
 */
export function ImageCropUpload({ value, onChange, label, aspect = 2, maxWidth = 1200 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const onCropComplete = useCallback((_a: Area, pixels: Area) => setAreaPixels(pixels), []);

  async function confirmCrop() {
    if (!src || !areaPixels) return;
    setBusy(true);
    setError('');
    try {
      const blob = await cropToBlob(src, areaPixels, maxWidth, aspect);
      const form = new FormData();
      form.append('file', new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }));
      const data = await api.upload<{ url: string }>('/upload', form);
      onChange(data.url);
      setSrc(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload алдаа');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <img src={value} alt="thumbnail" className="w-full object-cover" style={{ aspectRatio: String(aspect) }} />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <div className="rounded-lg bg-gray-200 p-2">
            <ImageIcon className="h-5 w-5 text-gray-500" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-primary">Зураг сонгох</span> — сонгоод тайрна
            </p>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP · {aspect}:1 болгож тайрна</p>
          </div>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={onPick} />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* Crop overlay */}
      {src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Crop className="h-4 w-4 text-primary" />
              <p className="font-medium text-gray-800">Зургийг тайрах ({aspect}:1)</p>
            </div>

            <div className="relative h-72 w-full rounded-lg overflow-hidden bg-gray-900">
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-gray-500">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSrc(null)}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={confirmCrop}
                disabled={busy}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Байршуулж байна...' : 'Тайрч хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Crop the source image to `area` (source px), downscale to maxWidth, JPEG-compress. */
function cropToBlob(src: string, area: Area, maxWidth: number, aspect: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const outW = Math.min(area.width, maxWidth);
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas дэмжигдэхгүй'));
      ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Зураг боловсруулж чадсангүй'))),
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => reject(new Error('Зураг ачаалж чадсангүй'));
    img.src = src;
  });
}
