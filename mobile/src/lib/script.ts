/**
 * Split a listening script into the sentences that are spoken one at a time.
 *
 * Shared by the exercise runner and the IELTS exam player: both read the same
 * admin-authored script aloud, and a script that splits differently in the two
 * places would highlight the wrong line in one of them.
 */
export function splitScript(script: string): string[] {
  return script
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
