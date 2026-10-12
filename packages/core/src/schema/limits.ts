/** Request bounds shared by the client (to trim) and the server (to enforce). Zod-free on purpose. */
export const LIMITS = {
  questionChars: 2000,
  answerContextChars: 4000,
  historyTurns: 11,
  audioBytes: 25 * 1024 * 1024,
  audioSeconds: 60,
  speechChars: 1200,
  /** A share token (P6-17): a compressed answer and its signature. Long answers stay well under. */
  shareTokenChars: 24_000,
} as const;
