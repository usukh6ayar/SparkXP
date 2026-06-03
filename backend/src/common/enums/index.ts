/**
 * Shared enums used across entities.
 * Keeping them in one place avoids circular imports between entity files.
 */

/** A single User table holds every role; access is gated by this field. */
export enum UserRole {
  STUDENT = "student",
  TEACHER = "teacher",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

/**
 * Common organization-type values, kept as plain string constants (NOT an enum
 * column). The set is open-ended — admins can introduce new org types from the
 * DB/admin panel without a code change or migration. These are just convenient
 * defaults/suggestions for seeding and the UI dropdown.
 */
export const ORG_TYPE_SUGGESTIONS = ["school", "company", "law_firm"] as const;

/** Lesson category — drives which learning UI the mobile app renders. */
export enum LessonType {
  VOCABULARY = "vocabulary",
  GRAMMAR = "grammar",
  LISTENING = "listening",
}

/** CEFR-style difficulty, reused by Lesson and Word. */
export enum ContentLevel {
  A1 = "a1",
  A2 = "a2",
  B1 = "b1",
  B2 = "b2",
  C1 = "c1",
  C2 = "c2",
}

/** What a teacher can assign to a class. */
export enum AssignmentType {
  LESSON = "lesson",
  QUIZ = "quiz",
}

/** Where an XP award came from — used for analytics and anti-abuse audits. */
export enum XpSource {
  WORD_REVIEW = "word_review",
  QUIZ = "quiz",
  LESSON = "lesson",
  ASSIGNMENT = "assignment",
  STREAK = "streak",
  AI_BUDDY = "ai_buddy",
}

/** Which AI capability consumed budget — the AI Gateway logs this per call. */
export enum AiUsageType {
  TEXT_CHAT = "text_chat",
  TRANSLATION = "translation",
  STT = "stt",
  TTS = "tts",
}

/** Author of a chat message in an AI buddy conversation. */
export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
}

/** Lifecycle of a payment record. */
export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}
