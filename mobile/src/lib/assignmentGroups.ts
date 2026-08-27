import type { Assignment } from '../api/assignments';

/**
 * **Нэг даалгавар = олон багц.**
 *
 * Багш «Даалгавар оноох» дээр 5 сэдвээс асуулт сонгоод нэг удаа илгээхэд
 * сервер сэдэв бүрд **тусдаа `assignments` мөр** үүсгэдэг (`targets.map`).
 * Тэр нь дотоод бүтэц болохоос сурагчийн харах ёстой зүйл биш: сурагч дээр
 * **ганц даалгавар** гарч, дотроо 5 багц болж салах ёстой — эс бөгөөс нэг
 * өгсөн даалгавар 5 карт болж, «3 хоног үлдлээ» 5 удаа давтагдана.
 *
 * ⚠️ **Бүлэглэх түлхүүр нь `createdAt`.** Нэг `POST /assignments` нь бүх
 * мөрөө нэг гүйлгээнд хадгалдаг ба Postgres-ийн `now()` нь гүйлгээний
 * эхлэлээр тогтдог тул тэдгээрийн `created_at` **яг ижил** (миллисекунд
 * хүртэл) ирдэг — локал сервер дээр шалгаж баталсан. Класс · төрөл · багш ·
 * хугацааг мөн түлхүүрт оруулснаар өөр өөр илгээлт санамсаргүй нийлэхээс
 * хамгаална.
 *
 * ⚠️ Энэ бол **түр шийдэл**. Зөв нь серверт `assignments.batch_id` багана
 * нэмэх — тэр гармагц доорх `keyOf`-ийг `a.batchId ?? <одоогийн түлхүүр>`
 * болгож нэг мөрөөр солино, бусад код хөндөгдөхгүй.
 */

/** Хийгдсэн үү — `assigned` бол цорын ганц хүлээгдэж буй төлөв. */
export function isAssignmentDone(a: Assignment): boolean {
  return (a.status ?? 'assigned') !== 'assigned';
}

function keyOf(a: Assignment): string {
  return [a.classId, a.type, a.assignedById ?? '', a.createdAt, a.dueAt ?? ''].join('|');
}

export interface AssignmentGroup {
  key: string;
  /** Багцууд. Урт нь 1 бол ердийн ганц даалгавар (хуучин зан төлөв). */
  parts: Assignment[];
  /** Төлөөлөх мөр — төрөл · хугацаа · тэмдэглэл · ирсэн огноо бүгд нийтлэг. */
  head: Assignment;
  /** Бүх багцын асуултын нийлбэр. Хичээлд `null` (асуулт гэж байхгүй). */
  questionCount: number | null;
  /** Сурагчийн тал: хийж дуусгасан багцын тоо. */
  doneParts: number;
  /** Бүх багц хийгдсэн эсэх — жагсаалтын «Хийсэн» шүүлт үүгээр ажиллана. */
  done: boolean;
}

/** Мөрүүдийг илгээлт тус бүрээр нь бүлэглэнэ (ирсэн дараалал хадгалагдана). */
export function groupAssignments(rows: Assignment[]): AssignmentGroup[] {
  const buckets = new Map<string, Assignment[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }

  return [...buckets].map(([key, parts]) => {
    const doneParts = parts.filter(isAssignmentDone).length;
    // Нийлбэрийг зөвхөн бодит тоо байвал гаргана: бүх багц `null` (хичээл)
    // бол «0 асуулт» гэж худал бичихийн оронд юу ч харуулахгүй.
    const counted = parts.filter((p) => p.questionCount != null);
    return {
      key,
      parts,
      head: parts[0],
      questionCount: counted.length
        ? counted.reduce((sum, p) => sum + (p.questionCount ?? 0), 0)
        : null,
      doneParts,
      done: doneParts === parts.length,
    };
  });
}

/**
 * Бүлгийн гарчиг. Багцууд өөр өөр сэдэвтэй байж болох тул сэдвүүдийг нь
 * нэрлэнэ — «5 багц даалгавар» гэсэн ерөнхий гарчиг юу хийхийг нь хэлэхгүй.
 * Хоёроос олон бол сүүлийнхийг «+N» болгож богиносгоно (мөр нь нэг л мөр).
 */
export function groupTitle(group: AssignmentGroup): string {
  const names = [
    ...new Set(
      group.parts.map((p) => p.targetTopic || p.targetTitle || '').filter(Boolean),
    ),
  ];
  if (names.length === 0) return '—';
  if (names.length <= 2) return names.join(' · ');
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
}
