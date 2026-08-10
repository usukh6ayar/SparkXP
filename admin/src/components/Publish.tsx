import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';

/**
 * Нийтлэх төлөвийн дундын хэсгүүд.
 *
 * **"Ноорог" гэсэн ойлголт админаас хасагдсан (2026-08-10).** "Хадгалах" дарсан
 * контент шууд нийтлэгдэнэ — өмнө нь ноорог-анхдагч формууд "оруулсан контент
 * апп дээр гарахгүй" гэсэн гомдлын байнгын эх үүсвэр байсан.
 *
 * Үлдсэн цорын ганц төлөв нь **нуух** — аль хэдийн нийтлэгдсэн контентыг
 * аппаас түр авах (устгахгүйгээр). Хуучин ноорог мөрүүд DB-д хэвээр байгаа тул
 * `UnpublishedBanner` тэднийг ил гаргаж, нэг товчоор нийтлүүлнэ.
 */

/** Нуугдсан мөрийг жагсаалтад ялгаж харуулах шошго (нийтэлсэн бол юу ч биш). */
export function HiddenBadge({ published }: { published: boolean }) {
  if (published) return null;
  return <Badge color="yellow">Нуугдсан</Badge>;
}

/** Нэг мөрийн харагдах эсэхийг сэлгэх нүдний товч. */
export function VisibilityButton({ published, onToggle }: { published: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      title={published ? 'Аппад харагдаж байна — дарж нуух' : 'Нуугдсан — дарж нийтлэх'}
    >
      {published
        ? <Eye className="h-4 w-4 text-green-600" />
        : <EyeOff className="h-4 w-4 text-amber-500" />}
    </Button>
  );
}

/**
 * Нуугдмал (хуучин ноорог) мөр үлдсэн бол дээр нь анхааруулаад нэг товчоор
 * бүгдийг нь нийтлүүлнэ. Тоо 0 бол огт харагдахгүй.
 */
export function UnpublishedBanner({
  count, onPublishAll, busy, noun = 'контент', paged,
}: {
  count: number;
  onPublishAll: () => void;
  busy?: boolean;
  noun?: string;
  /** Жагсаалт сервер талаас хуудаслагддаг бол — тоо нь зөвхөн энэ хуудсынх. */
  paged?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        <strong>{count}</strong> {noun} нуугдмал байна{paged && ' (энэ хуудсанд)'} — апп дээр харагдахгүй.
      </span>
      <Button size="sm" onClick={onPublishAll} disabled={busy}>
        {busy ? 'Нийтэлж байна…' : 'Бүгдийг нийтлэх'}
      </Button>
    </div>
  );
}
