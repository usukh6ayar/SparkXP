# AI Buddy — дуут API-ийн лимит ба зардал (Essential)

Эх сурвалж: `SparkXP_AI_Buddy_Voice_API_Costs.docx` (2026-09-26, 1 USD = 3,595.56₮).

| Хэсэг | Лимит / сар | USD / хэрэглэгч | MNT / хэрэглэгч |
| --- | --- | --- | --- |
| STT — Gemini 3.5 Transcribe Live | 100 мин хэрэглэгчийн яриа | ~$0.90 ($0.009/мин) | ~3,236₮ |
| TTS — Azure Speech | 35 мин Spark-ийн яриа (≈30,000 тэмдэгт) | ~$0.45 ($15 / 1M тэмдэгт) | ~1,618₮ |
| Viseme / lip-sync | TTS-тэй хамт | +$0 | +0₮ |
| **Нийт** | | **~$1.35** | **~4,854₮** |

## Кодод хаана байна

- **Лимит нь өгөгдөл, код биш.** `plans.stt_minutes_limit` (100) ба
  `plans.voice_minutes_limit` (35) — админ багцын мөрөөс тохируулна, апп
  шинэчлэхгүй. Шалгалт: `ai-gateway/buddy-usage.service.ts` (`checkStt`,
  `checkVoice`), сарын `ai_usage.voice_seconds`-ийн нийлбэрээр.
- **Тэмдэгтийн тоо (2026-09-28-аас).** Azure TTS-ийг тэмдэгтээр тооцдог тул
  TTS мөр бүр `ai_usage.metadata.characters`-тай. Сарын дүн:

```sql
SELECT user_id,
       SUM(voice_seconds) / 60.0                        AS tts_minutes,
       SUM((metadata->>'characters')::int)              AS tts_characters
  FROM ai_usage
 WHERE type = 'tts' AND created_at >= date_trunc('month', now())
 GROUP BY user_id ORDER BY tts_characters DESC NULLS LAST;
```

⚠️ `buddy.service.ts`-ийн `costMicroUsd` нь TTS-ийг **$50 / 1M тэмдэгт** гэж
тооцдог (HD voice-ийн таамаг) — brief-ийн $15 (Standard Neural)-аас өндөр.
Production voice-ийн яг SKU-г Azure дээр шалгаад тааруулна; тэр болтол
`costMicroUsd` нь дээд хязгаарын тооцоо.
