/**
 * Shared enums used across entities.
 * Keeping them in one place avoids circular imports between entity files.
 */

/** A single User table holds every role; access is gated by this field. */
export enum UserRole {
  STUDENT = "student",
  TEACHER = "teacher",
  /** Moderator = teacher-level + content management (create/edit lessons, words, quizzes). Set by super_admin only. */
  MODERATOR = "moderator",
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
  READING = "reading",
  WRITING = "writing",
  FILL = "fill", // нөхөх даалгавар (fill-in-the-blank)
}

/**
 * Lifecycle of a vocabulary word. The student app shows ONLY `published` words;
 * every other status is visible only in the admin panel. New bulk-imported words
 * land as `needs_review`; existing words default to `published` (see Word entity)
 * so the current content stays live.
 */
export enum WordStatus {
  DRAFT = "draft",
  NEEDS_REVIEW = "needs_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  PUBLISHED = "published",
}

/** Per-user recall state for a word, set from the swipe screen (forgot/know). */
export enum RecallStatus {
  FORGOT = "forgot",
  LEARNING = "learning",
  KNOW = "know",
}

/**
 * Open-ended vocabulary categories. Like ORG_TYPE_SUGGESTIONS these are plain
 * string suggestions (NOT a DB enum) — admins can add new categories from the
 * panel without a code change. `Word.category` is a free-text column.
 */
export const VOCAB_CATEGORY_SUGGESTIONS = [
  "Daily Life",
  "Business",
  "Law",
  "Medical",
  "Engineering",
  "Travel",
  "Academic",
] as const;

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
  IMAGE_GENERATION = "image_generation",
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

/**
 * Where a Sparks change came from. Positive amounts (earning) and negative
 * amounts (spending) both flow through SparksLog with one of these sources,
 * so we can audit anti-abuse just like XP.
 */
export enum SparksSource {
  // Earning
  QUIZ = "quiz",
  LESSON = "lesson",
  STREAK = "streak",
  ADMIN_GRANT = "admin_grant",
  PURCHASE = "purchase", // bought Sparks with real money (via a Payment)
  // Spending
  LESSON_UNLOCK = "lesson_unlock",
  STORE_PURCHASE = "store_purchase",
}

/** Time windows for leaderboards. Computed from XpLog.created_at (no reset of
 * actual XP — just a date filter over the ledger). */
export enum LeaderboardPeriod {
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  ALL_TIME = "all_time",
}

/** Geographic scope a leaderboard is ranked within. */
export enum LeaderboardScope {
  GLOBAL = "global",
  PROVINCE = "province",
  DISTRICT = "district",
  CLASS = "class",
  ORGANIZATION = "organization",
  /** Students across all classes owned by one teacher. */
  TEACHER = "teacher",
}

/**
 * Mongolia's 21 aimags + Ulaanbaatar (as a province-level entry). Kept as a
 * constant list so the registration dropdown and validation share one source.
 * Not a DB enum — locations are stored as plain strings on User/Organization.
 */
export const MN_PROVINCES = [
  "Улаанбаатар",
  "Архангай",
  "Баян-Өлгий",
  "Баянхонгор",
  "Булган",
  "Говь-Алтай",
  "Говьсүмбэр",
  "Дархан-Уул",
  "Дорноговь",
  "Дорнод",
  "Дундговь",
  "Завхан",
  "Орхон",
  "Өвөрхангай",
  "Өмнөговь",
  "Сүхбаатар",
  "Сэлэнгэ",
  "Төв",
  "Увс",
  "Ховд",
  "Хөвсгөл",
  "Хэнтий",
] as const;

/** Ulaanbaatar's 9 districts — used when province = "Улаанбаатар". */
export const UB_DISTRICTS = [
  "Багануур",
  "Багахангай",
  "Баянгол",
  "Баянзүрх",
  "Налайх",
  "Сонгинохайрхан",
  "Сүхбаатар",
  "Хан-Уул",
  "Чингэлтэй",
] as const;
