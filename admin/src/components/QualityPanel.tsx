import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './Button';

/**
 * **Чанарын самбар** — хариулах боломжгүй / эргэлзээтэй дасгалуудыг нэрлэж,
 * засах мөр рүү нь шууд хүргэнэ.
 *
 * Яагаад хэрэгтэй вэ: AI-гаар үүсгэсэн дасгал англи хэлний хувьд төгс харагдаж
 * байгаад логикийн хувьд эвдэрсэн байдаг. Бодит жишээ — сонсох яриагүй байж
 * «Сара хэдэд босдог вэ?» гэж асуух, эсвэл `swimming` ба `to swim` хоёуланг
 * сонголт болгож өгөх (хоёул зөв мөртлөө нэг нь л тэнцдэг).
 *
 * Шалгуурыг **сервер** (`backend/src/quizzes/quality.ts`) гүйцэтгэнэ — энэ
 * компонент зөвхөн үр дүнг харуулна.
 */
export interface QualityIssue {
  severity: 'block' | 'warn';
  questionNo: number | null;
  message: string;
}

export interface QualityRow {
  id: string;
  title: string;
  /** `true` = хариулах боломжгүй тул апп дээр огт харагдахгүй. */
  blocked: boolean;
  issues: QualityIssue[];
}

interface Props<T extends { id: string; title: string }> {
  /** Аппаас нуугдсан мөрүүд. */
  broken: T[];
  /** Аппад харагдсаар байгаа ч шалгах шаардлагатай мөрүүд. */
  suspect: T[];
  quality: Map<string, QualityRow>;
  onEdit: (row: T) => void;
  /** Ганцаарчилсан нэр — ж: "дасгал" · "сорил". */
  noun?: string;
}

export function QualityPanel<T extends { id: string; title: string }>({
  broken,
  suspect,
  quality,
  onEdit,
  noun = 'дасгал',
}: Props<T>) {
  // Анхдагчаар нээлттэй: эвдэрсэн зүйл байгаа бол админ түүнийг ХАРАХ ёстой,
  // хаалттай самбар бол байхгүйтэй адил.
  const [open, setOpen] = useState(true);

  const rows = [...broken, ...suspect];
  if (rows.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-amber-900"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          {broken.length > 0 && (
            <b>
              {broken.length} {noun} хариулах боломжгүй байна
            </b>
          )}
          {broken.length > 0 && suspect.length > 0 && ' · '}
          {suspect.length > 0 && <>{suspect.length} шалгах шаардлагатай</>}
          {broken.length > 0 && (
            <> — эдгээрийг апп дээр <b>харуулахгүй байна</b>.</>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <ul className="space-y-2 border-t border-amber-200 px-4 py-3">
          {rows.map((row) => {
            const q = quality.get(row.id);
            if (!q) return null;
            return (
              <li key={row.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    q.blocked
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {q.blocked ? 'Хаагдсан' : 'Шалгах'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800">{row.title}</p>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                    {q.issues.map((issue, i) => (
                      <li key={i}>
                        {issue.questionNo ? `${issue.questionNo}-р асуулт: ` : ''}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onEdit(row)}>
                  Засах
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
