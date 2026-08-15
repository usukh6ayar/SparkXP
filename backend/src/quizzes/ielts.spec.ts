import {
  ieltsBand,
  IELTS_CATEGORIES,
  paperPlan,
  paperQuestionCount,
} from './ielts';

const listening = IELTS_CATEGORIES.listening;
const reading = IELTS_CATEGORIES.reading;

/**
 * Band нь албан ёсны түүхий оноо → band хүснэгтээр гарах ёстой (40 асуулт).
 * Урьд нь хувь хэмжээний ойролцоолол байсан тул жинхэнэ шалгалтын оноотой
 * таарахгүй байв.
 */
/**
 * ⚓️ **Албан ёсны цэгүүд** — ielts.org «IELTS scoring in detail» (2026-08-15).
 * IELTS зөвхөн эдгээр 4 цэгийг нийтэлдэг; хүснэгтийг засах бүрд эдгээр нь
 * хөдлөхгүй байх ёстой.
 */
describe('ieltsBand — ielts.org-ийн албан ёсны цэгүүд', () => {
  it.each([
    [
      'Listening',
      listening,
      [
        [16, 5],
        [23, 6],
        [30, 7],
        [35, 8],
      ],
    ],
    [
      'Academic Reading',
      reading,
      [
        [15, 5],
        [23, 6],
        [30, 7],
        [35, 8],
      ],
    ],
  ] as const)('%s', (_name, category, rows) => {
    for (const [raw, band] of rows) {
      expect(ieltsBand(raw, 40, category)).toBe(band);
    }
  });
});

describe('ieltsBand — бүтэн 40 асуулттай шалгалт', () => {
  it('Listening: албан ёсны хүснэгтийн зангилаанууд', () => {
    expect(ieltsBand(40, 40, listening)).toBe(9.0);
    expect(ieltsBand(39, 40, listening)).toBe(9.0);
    expect(ieltsBand(38, 40, listening)).toBe(8.5);
    expect(ieltsBand(35, 40, listening)).toBe(8.0);
    expect(ieltsBand(30, 40, listening)).toBe(7.0);
    expect(ieltsBand(23, 40, listening)).toBe(6.0);
    expect(ieltsBand(16, 40, listening)).toBe(5.0);
  });

  it('Reading нь Listening-ээс ХАТУУ (ижил оноо, бага band)', () => {
    // 19 зөв: Listening 5.5, Reading бас 5.5 — харин 15 дээр ялгарна.
    expect(ieltsBand(15, 40, listening)).toBe(4.5);
    expect(ieltsBand(15, 40, reading)).toBe(5.0);
    // 33 зөв: Reading 7.5 харин Listening 7.5 — 32 дээр ялгарна.
    expect(ieltsBand(32, 40, listening)).toBe(7.5);
    expect(ieltsBand(32, 40, reading)).toBe(7.0);
  });

  it('хоосон / буруу оролт', () => {
    expect(ieltsBand(0, 40, listening)).toBe(0);
    expect(ieltsBand(5, 0, listening)).toBe(0);
  });
});

describe('ieltsBand — богино дасгалыг 40-д шилжүүлнэ', () => {
  it('20 асуултын 15 нь 40-ийн 30-тай тэнцэнэ → 7.0', () => {
    expect(ieltsBand(15, 20, listening)).toBe(ieltsBand(30, 40, listening));
    expect(ieltsBand(15, 20, listening)).toBe(7.0);
  });

  it('10 асуултын 10 нь бүтэн оноо → 9.0', () => {
    expect(ieltsBand(10, 10, listening)).toBe(9.0);
  });

  it('12 асуултын 6 нь = 50% → 40-ийн 20', () => {
    // 20/40 нь Listening дээр 5.5 (18-аас дээш), Reading дээр 5.5 (19-өөс дээш).
    expect(ieltsBand(6, 12, listening)).toBe(5.5);
    expect(ieltsBand(6, 12, reading)).toBe(5.5);
  });

  it('ангилал өгөөгүй бол Listening хүснэгтээр (аюулгүй анхдагч)', () => {
    expect(ieltsBand(30, 40)).toBe(ieltsBand(30, 40, listening));
  });
});

describe('paperPlan — ielts.org-ийн бүтэц', () => {
  it('Listening = 4 Section × 10 = 40', () => {
    const plan = paperPlan('listening');
    expect(plan).toHaveLength(4);
    expect(paperQuestionCount('listening')).toBe(40);
  });

  it('Academic Reading = 3 Passage, нийт 40', () => {
    const plan = paperPlan('reading');
    expect(plan).toHaveLength(3);
    expect(paperQuestionCount('reading')).toBe(40);
  });

  it('Writing = 2 Task, Speaking = 3 Part (задгай хариулт)', () => {
    expect(paperPlan('writing')).toHaveLength(2);
    expect(paperPlan('speaking')).toHaveLength(3);
    expect(paperPlan('writing').every((p) => p.openResponse)).toBe(true);
    expect(paperPlan('speaking').every((p) => p.openResponse)).toBe(true);
  });
});
