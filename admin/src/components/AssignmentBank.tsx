import { Input } from './Input';
import { Badge } from './Badge';

/**
 * **Даалгаврын сан** — багш л хардаг, сурагч зөвхөн даалгавар авсны дараа
 * нээгддэг контентын UI хэсгүүд.
 *
 * Нийтлэх төлөвийн `Publish.tsx`-тэй ижил зарчим: харагдацын логикийг хуудас
 * бүрд давтаж бичихгүй, эндээс ганц газраас өөрчилнө.
 */

/** Мөрийн шошго — жагсаалтад сангийн дасгалыг шууд ялгана. */
export function BankBadge({ assignOnly }: { assignOnly: boolean }) {
  if (!assignOnly) return null;
  return <Badge color="blue">Даалгаврын сан</Badge>;
}

/**
 * Формын сонголт. Тайлбар нь **үр дагаврыг** нь хэлнэ — «зөвхөн даалгавраар»
 * гэдэг нь өөрөө сурагч энэ дасгалыг Дасгал таб дээрээ ОГТ олохгүй гэдгийг
 * хэлж өгдөггүй.
 */
export function BankCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        <b className="text-gray-700">Зөвхөн даалгавраар (багшийн сан)</b>
        <span className="block text-xs text-gray-500">
          Сурагч энэ дасгалыг өөрөө хайж олохгүй — багш даалгавар болгож өгсний
          дараа л нээгдэнэ. Багш нэг тестээс хэдэн ч асуултыг сонгож өгч болно.
        </span>
      </span>
    </label>
  );
}

/**
 * Сэдвийн талбар — жагсаалтаас сонгох **эсвэл** өөрөө бичих.
 *
 * Яагаад жагсаалт биш вэ: даалгаврын сан нь дүрмийн сэдвүүдээр («Present
 * Simple», «Modal verbs») зохиогддог ба тэдгээрийг урьдчилан таамаглах
 * боломжгүй. Сэдэв нь аль хэдийн чөлөөт текст (`Quiz.topic` — хадгалсан утга
 * нь өөрөө шошго болдог), тиймээс энэ нь зөвхөн хатуу dropdown-ыг тайлж
 * байгаа хэрэг.
 *
 * ⚠️ Апп сэдвээр нь бүлэглэдэг тул **үсгийн алдаа = шинэ бүлэг**. Санал
 * болгож буй утгууд `datalist`-д хэвээр гарна — эхлээд тэднээс сонго.
 */
export function TopicField({
  label = 'Сэдэв',
  options,
  value,
  onChange,
  listId,
}: {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  /** Хуудсанд хоёр талбар зэрэг байвал datalist-ийн id давхцахгүй байх ёстой. */
  listId: string;
}) {
  return (
    <>
      <Input
        label={label}
        list={listId}
        value={value}
        placeholder="Сонгох эсвэл шинээр бичих"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options
          .filter((o) => o.value)
          .map((o) => (
            <option key={o.value} value={o.value} />
          ))}
      </datalist>
    </>
  );
}
