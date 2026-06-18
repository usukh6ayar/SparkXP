import { useRef, useState, useCallback } from 'react';
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Image, Crop as CropIcon } from 'lucide-react';
import { getToken } from '../api/client';
import { Modal } from './Modal';
import { Button } from './Button';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

function centerAspectCrop(w: number, h: number, aspect: number): Crop {
  return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, w, h), w, h);
}

async function cropToBlob(img: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    img,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas хоосон байна'))),
      'image/jpeg',
      0.92,
    );
  });
}

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  /** Crop aspect ratio — default 16/9 for lesson thumbnails. */
  aspect?: number;
}

export function ImageCropUpload({ value, onChange, label, aspect = 16 / 9 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [srcImage, setSrcImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function openPicker() {
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.click();
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => setSrcImage(reader.result as string));
    reader.readAsDataURL(file);
  }

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
      setCrop(centerAspectCrop(w, h, aspect));
    },
    [aspect],
  );

  function closeModal() {
    setSrcImage(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleSave() {
    if (!imgRef.current || !completedCrop) return;
    setUploading(true);
    setError('');
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop);
      const formData = new FormData();
      formData.append('file', blob, 'thumbnail.jpg');
      const res = await fetch(`${BASE}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Upload алдаа ${res.status}`);
      }
      const data = await res.json();
      onChange(data.url);
      setSrcImage(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload алдаа');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <img src={value} alt="preview" className="w-full max-h-40 object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={openPicker}
              className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
              title="Зураг солих / дахин тайрах"
            >
              <CropIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
              title="Зураг устгах"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={openPicker}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <div className="rounded-lg bg-gray-200 p-2">
            <Image className="h-5 w-5 text-gray-500" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-primary">Зураг сонгох</span> — crop хийх боломжтой
            </p>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP · Max 10 MB · 16:9 харьцаа</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={onFileSelect}
      />

      {error && !srcImage && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* Crop modal */}
      {srcImage && (
        <Modal title="Зураг тайрах (16:9)" onClose={closeModal}>
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Шар хүрэн хүрээг чирж хичээлийн thumbnail-г тохируулна уу.
            </p>
            <div className="flex justify-center bg-gray-900 rounded-lg p-2 overflow-auto max-h-[55vh]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
                minWidth={80}
              >
                <img
                  ref={imgRef}
                  src={srcImage}
                  alt="Crop"
                  style={{ maxHeight: '50vh', maxWidth: '100%', display: 'block' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeModal}>
                Болих
              </Button>
              <Button onClick={handleSave} disabled={uploading || !completedCrop}>
                {uploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Байршуулж байна...
                  </>
                ) : (
                  'Хадгалах'
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
