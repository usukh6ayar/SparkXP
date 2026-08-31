-- AI Buddy latency report (латенсийн төлөвлөгөө §6 — acceptance matrix).
--
-- Эх сурвалж нь assistant мессежийн `metadata.latency` — turn бүр өөрийнхөө
-- задаргааг авч явдаг тул тусдаа хүснэгт, тусдаа хэмжүүрийн сан хэрэггүй.
--
-- Ажиллуулах:  psql -d sparkxp -f scripts/buddy-latency.sql
--
-- `t0_to_audible_ms` нь ЗӨВХӨН клиент тайлагнасан turn-д байна (аппын шинэ
-- хувилбар). Байхгүй бол `t0_to_response_ms`-ийг хар — тэр нь аудио татаж
-- декодлох хугацааг агуулаагүй тул бодит хүлээлтээс бага байна.
WITH t AS (
  SELECT
    (metadata -> 'latency' ->> 'upload_ms')::numeric          AS upload_ms,
    (metadata -> 'latency' ->> 'stt_ms')::numeric             AS stt_ms,
    (metadata -> 'latency' ->> 'context_ms')::numeric         AS context_ms,
    (metadata -> 'latency' ->> 'llm_ms')::numeric             AS llm_ms,
    (metadata -> 'latency' ->> 'llm_bookkeeping_ms')::numeric AS bookkeeping_ms,
    (metadata -> 'latency' ->> 'tts_first_audio_ms')::numeric AS tts_first_audio_ms,
    (metadata -> 'latency' ->> 'tts_ms')::numeric             AS tts_ms,
    (metadata -> 'latency' ->> 'audio_upload_ms')::numeric    AS r2_upload_ms,
    (metadata -> 'latency' ->> 'persist_ms')::numeric         AS persist_ms,
    (metadata -> 'latency' ->> 't0_to_response_ms')::numeric  AS t0_to_response_ms,
    (metadata -> 'latency' ->> 't0_to_audible_ms')::numeric   AS t0_to_audible_ms,
    (metadata -> 'latency' ->> 'playback_overhead_ms')::numeric AS playback_overhead_ms
  FROM messages
  WHERE role = 'assistant'
    AND metadata -> 'latency' ->> 'turn_id' IS NOT NULL
    AND created_at > now() - interval '7 days'
)
SELECT
  metric,
  count(*)                                                   AS n,
  round(percentile_cont(0.50) WITHIN GROUP (ORDER BY v))     AS p50,
  round(percentile_cont(0.90) WITHIN GROUP (ORDER BY v))     AS p90,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY v))     AS p95,
  round(max(v))                                              AS max
FROM (
  SELECT 'stt'               AS metric, stt_ms             AS v FROM t
  UNION ALL SELECT 'context',           context_ms         FROM t
  UNION ALL SELECT 'llm',               llm_ms             FROM t
  UNION ALL SELECT 'llm_bookkeeping',   bookkeeping_ms     FROM t
  UNION ALL SELECT 'tts_first_audio',   tts_first_audio_ms FROM t
  UNION ALL SELECT 'tts_full',          tts_ms             FROM t
  UNION ALL SELECT 'r2_upload',         r2_upload_ms       FROM t
  UNION ALL SELECT 'persist',           persist_ms         FROM t
  UNION ALL SELECT 'E2E t0→response',   t0_to_response_ms  FROM t
  UNION ALL SELECT 'E2E t0→audible',    t0_to_audible_ms   FROM t
  UNION ALL SELECT 'playback_overhead', playback_overhead_ms FROM t
) s
WHERE v IS NOT NULL
GROUP BY metric
ORDER BY p50 DESC NULLS LAST;
