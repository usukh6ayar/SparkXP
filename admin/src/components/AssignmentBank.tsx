import { Input } from './Input';

/**
 * **Даалгаврын сан** (`Quiz.assignOnly`) — багш л хардаг контентын UI хэсэг.
 *
 * Сан нь одоо Дасгал хуудсан дээр **өөрийн табтай** (`BANK_CAT`) тул «энэ мөр
 * сангийнх үү» гэдгийг мөр бүр дээр хэлэх хэрэг байхаа больсон: тэр шошго ба
 * формын checkbox хоёр хоёулаа хасагдсан. Үлдсэн нь сэдвийн талбар — сан нь
 * сэдвээр (Present Simple, Modal verbs…) зохион байгуулагддаг.
 */

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
