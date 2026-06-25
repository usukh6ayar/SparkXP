import { useState } from 'react';
import {
  BookOpen, Sparkles, ImageIcon, Volume2, Upload, CheckSquare,
  Filter, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';

interface Section {
  id: string;
  icon: typeof BookOpen;
  title: string;
  steps: React.ReactNode[];
  note?: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'add-one',
    icon: Sparkles,
    title: 'Нэг үг нэмэх (AI бөглөх)',
    steps: [
      <>Үгс хуудсан дээр баруун дээд талын <b>«Үг нэмэх»</b> товч дар.</>,
      <>Зөвхөн <b>Англи үгээ</b> бичээд <b>«AI бөглөх»</b> дар — AI нь монгол утга, тодорхойлолт,
        жишээ, түвшин, ижил/эсрэг утга зэрэг бүх талбарыг автоматаар бөглөнө.</>,
      <>Шалгаад, доор зураг/дуудлагыг <b>«AI-аар үүсгэх»</b> чеклээд <b>«Хадгалах»</b> дар.</>,
    ],
    note: <>Зураг save хийх үед <b>нэг л удаа</b> үүснэ — «AI бөглөх» дарах болгонд зураг үүсэхгүй (мөнгө хэмнэнэ).</>,
  },
  {
    id: 'import',
    icon: Upload,
    title: 'Олон үг нэг дор оруулах (Bulk import)',
    steps: [
      <>Баруун дээд талын <b>«Оруулах»</b> товч дар.</>,
      <><b>«Зөвхөн англи үгс — AI бусдыг бөглөнө»</b>-г чеклэвэл: мөр бүрт нэг англи үг
        (эсвэл CSV/JSON) файл оруул → AI бүх талбарыг бөглөнө.</>,
      <>Хүсвэл <b>«Зураг бас үүсгэх»</b> / <b>«Дуудлага бас үүсгэх»</b> чеклэнэ (удаан — background-д ажиллана).</>,
      <>Чеклэхгүй бол энгийн CSV (english, mongolian, …) загвараар бүрэн оруулж болно — «Загвар татах».</>,
    ],
    note: <>Медиатай үед нэг удаад <b>25 үг</b>, медиагүй бол <b>100 үг</b> хүртэл. Явцыг progress bar харуулна.</>,
  },
  {
    id: 'bulk-media',
    icon: ImageIcon,
    title: 'Олон үгэнд зураг/дуудлага нэг дор үүсгэх',
    steps: [
      <>Үгс хуудсан дээр шүүлтүүрээс <b><Filter className="inline h-3.5 w-3.5" /> «🖼 Зураггүй»</b>
        (эсвэл <b>«🔊 Аудиогүй»</b>)-г сонго — медиа дутуу үгс л харагдана.</>,
      <>Зүүн дээд талын <b><CheckSquare className="inline h-3.5 w-3.5" /> select-all</b> checkbox-оор бүгдийг сонго.</>,
      <><b>«Зураг үүсгэх»</b> эсвэл <b>«Дуудлага үүсгэх»</b> товч дар.</>,
      <>Background-д ажиллана — <b>admin дээр үргэлжлүүлэн ажиллаж болно</b>. Progress bar (%)
        явцыг харуулж, үгс бэлэн болохын хэрээр жагсаалт шинэчлэгдэнэ.</>,
    ],
    note: <>Зураг нь OpenAI-ийн лимитийн улмаас <b>5-аар багцлан</b> үүснэ. 200-аас олон бол: эхний
      багц дуусаад тэр үгс «Зураггүй»-ээс хасагдана → дахин select-all → үргэлжлүүл.</>,
  },
  {
    id: 'single-media',
    icon: Volume2,
    title: 'Нэг үгэнд зураг/дуудлага',
    steps: [
      <>Үгийн мөрийн баруун талын <b><Sparkles className="inline h-3.5 w-3.5 text-primary" /></b> (зураг)
        эсвэл <b><Volume2 className="inline h-3.5 w-3.5 text-primary" /></b> (дуудлага) товчийг дар.</>,
      <>Дуудлага байгаа бол <b>▶</b> товчоор admin дээрээс сонсож болно.</>,
      <>Зураг дээр дарвал томоор харагдана.</>,
    ],
  },
  {
    id: 'limits',
    icon: AlertTriangle,
    title: 'Анхаарах зүйлс (лимит / билл)',
    steps: [
      <><b>Зураг (OpenAI):</b> үүсэхийн тулд OpenAI billing идэвхтэй байх ёстой. Лимит ~5/мин.</>,
      <><b>Дуудлага (ElevenLabs):</b> сонгосон дуу хоолой paid plan шаардаж болзошгүй.
        Нэг удаа үүсгэсэн audio нь Cloudinary дээр <b>үүрд</b> хадгалагдана (дахин төлбөргүй).</>,
      <><b>AI текст (Gemini):</b> billing-тэй key шаардлагатай. Үг бөглөхөд маш бага зардалтай.</>,
    ],
  },
];

export default function GuidePage() {
  const [open, setOpen] = useState<string | null>(SECTIONS[0].id);

  return (
    <>
      <PageHeader
        title="Заавар"
        description="Admin панелийг хэрхэн ашиглах — алхам алхмаар"
      />

      <div className="space-y-3 max-w-3xl">
        {SECTIONS.map(({ id, icon: Icon, title, steps, note }) => {
          const isOpen = open === id;
          return (
            <div key={id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primarySoft text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1 font-semibold text-gray-800">{title}</span>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-4">
                  <ol className="space-y-2.5">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-700">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ol>
                  {note && (
                    <p className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                      💡 {note}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
