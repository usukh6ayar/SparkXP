import { useRef, useState } from 'react';
import { X, Image, Film, Music2 } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  accept: 'image' | 'video' | 'audio';
  value: string;                       // current URL
  onChange: (url: string) => void;
  label?: string;
}

export function FileUpload({ accept, value, onChange, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const acceptAttr =
    accept === 'image' ? '.jpg,.jpeg,.png,.gif,.webp'
    : accept === 'audio' ? '.mp3,.m4a,.wav,.ogg,.aac'
    : '.mp4,.mov,.webm,.m4v';

  async function handleFile(file: File) {
    setUploading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.upload<{ url: string }>('/upload', formData);
      onChange(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload алдаа');
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const Icon = accept === 'image' ? Image : accept === 'audio' ? Music2 : Film;

  return (
    <div>
      {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 p-2">
          {accept === 'image' ? (
            <img src={value} alt="preview" className="w-full max-h-40 object-cover" />
          ) : accept === 'audio' ? (
            <audio src={value} controls className="w-full" />
          ) : (
            <video src={value} controls className="w-full max-h-40" />
          )}
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
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Байршуулж байна...
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-gray-200 p-2">
                <Icon className="h-5 w-5 text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-primary">Файл сонгох</span> эсвэл чирж оруулна уу
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {accept === 'image' ? 'JPG, PNG, GIF, WEBP · Max 10 MB'
                    : accept === 'audio' ? 'MP3, M4A, WAV, OGG'
                    : 'MP4, MOV, WEBM · Max 200 MB'}
                </p>
              </div>
            </>
          )}
          <input ref={inputRef} type="file" accept={acceptAttr} className="hidden" onChange={onInputChange} />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
