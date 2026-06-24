import { X } from 'lucide-react';

/** Modal width presets. Default `md` keeps the old size for existing modals. */
const SIZES = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-5xl',
} as const;

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Modal width. Defaults to `md` (max-w-lg). */
  size?: keyof typeof SIZES;
}

export function Modal({ title, onClose, children, size = 'md' }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {/* flex-col + max-h so a tall form scrolls inside while the header stays put */}
      <div
        className={`flex max-h-[90vh] w-full ${SIZES[size]} flex-col rounded-xl bg-white shadow-xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
