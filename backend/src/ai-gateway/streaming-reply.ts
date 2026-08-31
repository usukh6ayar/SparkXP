/**
 * Buddy-гийн JSON гэрээг **бүрэн ирэхээс өмнө** ярьж эхлэхэд хэрэгтэй хоёр
 * цэвэр функц.
 *
 * Яагаад хэрэгтэй вэ: buddy-гийн хариу нь баталгаажсан JSON объект тул
 * "token ирэнгүүт ярь" гэдэг нь шууд боломжгүй — эхлээд ярих ёстой мөрөө
 * дундаас нь салгаж авах хэрэгтэй. Хэмжилтээр `reply_text` нь бүтэн JSON-оос
 * **~1.3 секундын өмнө** бүрддэг (объектын үлдсэн хэсэг нь засвар, монгол
 * тайлбар, санах ой, аюулгүй байдал) — тэр зөрүү нь энэ файлын оршин байх
 * шалтгаан.
 */

/**
 * Хэсэгчилсэн JSON-оос нэг мөрөн талбарын **одоог хүртэл ирсэн** утгыг гаргана.
 *
 * Урсгал дундуур дуудагддаг тул хаагдаагүй мөрийг ч зохицуулна: `complete`
 * нь хаах хашилт ирсэн эсэхийг хэлнэ. JSON-ы escape дарааллыг (`\"`, `\n`,
 * `\uXXXX`) тайлна; хагас ирсэн escape-ийг бүрдтэл хүлээнэ — эс бөгөөс
 * `О`-ийн хагасыг үсэг гэж уншиж хог гаргана.
 *
 * @returns `null` — талбар хараахан эхлээгүй.
 */
export function readJsonStringField(
  buffer: string,
  field: string,
): { value: string; complete: boolean } | null {
  const opener = new RegExp(`"${field}"\\s*:\\s*"`).exec(buffer);
  if (!opener) return null;

  let out = '';
  let i = opener.index + opener[0].length;
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '"') return { value: out, complete: true };
    if (ch === '\\') {
      const esc = buffer[i + 1];
      if (esc === undefined) break; // escape дуусаагүй — дараагийн хэсгийг хүлээнэ
      if (esc === 'u') {
        const hex = buffer.slice(i + 2, i + 6);
        if (hex.length < 4) break; // \uXXXX бүрэн ирээгүй
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
      out += ESCAPES[esc] ?? esc;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return { value: out, complete: false };
}

const ESCAPES: Record<string, string> = {
  n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/',
};

/** Ярих боломжтой хэсгийн урт (тэмдэгт). Төлөвлөгөө §2: 50–160. */
const MIN_CHUNK_CHARS = 50;

/**
 * Ярих боломжтой дараагийн хэсгүүдийг тасалж авна.
 *
 * Дүрэм (төлөвлөгөө §2):
 *  - `.`/`?`/`!`/`…` дээр таслана;
 *  - өгүүлбэр хэт урт болвол таслал/цэгтэй таслал дээр таслана;
 *  - **хэт богино хэсгийг тусад нь явуулахгүй** — TTS хүсэлт тус бүр нэмэлт
 *    зардал, робот шиг завсарлага үүсгэдэг тул дараагийн хэсэгтэй нийлүүлнэ;
 *  - `final` үед үлдсэнийг богино ч бай гаргана.
 *
 * @param text     одоог хүртэл цугларсан бүтэн мөр
 * @param consumed өмнө нь аль хэдийн ярьсан тэмдэгтийн тоо
 * @returns шинэ хэсгүүд + `consumed`-ийн шинэ утга. Хоёуланг нь буцаах ёстой:
 *   хэсгүүд нь `trim` хийгддэг тул уртынх нь нийлбэр эхийн байрлалыг илэрхийлэхгүй,
 *   ялгааг нь дуудагч тооцвол зай алдагдаж, ярианы хэсэг давхардана.
 */
export function takeSpeakableChunks(
  text: string,
  consumed: number,
  final: boolean,
): { chunks: string[]; consumed: number } {
  const chunks: string[] = [];
  let rest = text.slice(consumed);
  let offset = consumed;

  for (;;) {
    const cut = findCut(rest, final);
    if (cut === null) break;
    const piece = rest.slice(0, cut).trim();
    rest = rest.slice(cut);
    offset += cut;
    if (piece) chunks.push(piece);
  }

  if (final) {
    const tail = rest.trim();
    if (tail) {
      // Сүүлийн үлдэгдэл хэт богино бол өмнөх хэсэгтээ наана — "Yes." гэсэн
      // ганц клип нь дуудлагын зардлаа ч нөхөхгүй, дуудлага нь тасалдана.
      if (tail.length < MIN_CHUNK_CHARS && chunks.length) {
        chunks[chunks.length - 1] += ` ${tail}`;
      } else {
        chunks.push(tail);
      }
    }
    offset = text.length;
  }
  return { chunks, consumed: offset };
}

/**
 * Тасрах цэгийн индекс (тухайн тэмдэгтийг оруулаад), эсвэл `null`.
 *
 * Эрэмбэ нь чухал: өгүүлбэрийн төгсгөл нь **боломжийн зайд** байвал түүнийг
 * сонгоно, харин өгүүлбэр хэт урт бол өмнөх заалтын завсар дээр таслана.
 * Эсрэгээр нь хийвэл (эхлээд аль ч цэгийг хайх) хол байгаа цэг нь ойрын
 * таслалыг далдалж, "урт өгүүлбэрийг заалтаар тасал" гэсэн дүрэм хэзээ ч
 * ажиллахгүй.
 */
function findCut(text: string, final: boolean): number | null {
  const sentenceCut = firstBreak(text, /[.!?…]/g, MIN_CHUNK_CHARS, final);
  if (sentenceCut !== null && sentenceCut <= MAX_CLAUSE_CHARS) return sentenceCut;

  const clauseCut = firstBreak(text, /[,;:]/g, MIN_CHUNK_CHARS, final);
  if (clauseCut !== null && (sentenceCut === null || clauseCut < sentenceCut)) {
    return clauseCut;
  }
  // Таслалгүй урт өгүүлбэр — цэг дээр таслахаас өөр аргагүй.
  return sentenceCut;
}

/** Хамгийн эхний тохирох таслах цэг, `minChars`-аас хойш. */
function firstBreak(
  text: string,
  pattern: RegExp,
  minChars: number,
  final: boolean,
): number | null {
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const end = m.index + 1;
    // Урсгалын яг төгсгөл дээрх тэмдэг нь бүрэн эсэх нь тодорхойгүй
    // ("Mr" гэх мэт биш эсэхийг хэлэх юм алга) — дараагийн тэмдэгтийг хүлээнэ.
    if (end >= text.length && !final) return null;
    if (end >= minChars) return end;
  }
  return null;
}

/** Үүнээс урт болсон үед таслал дээр ч таслахыг зөвшөөрнө. */
const MAX_CLAUSE_CHARS = 160;
