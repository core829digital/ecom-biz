/** Time-zone helpers for <input type="datetime-local"> values interpreted in the store's zone. */

function zoneParts(d: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return parts as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

/** Offset of `timeZone` from UTC at instant `d`, in ms. */
function offsetMs(d: Date, timeZone: string): number {
  const p = zoneParts(d, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Date → "YYYY-MM-DDTHH:mm" as seen in `timeZone`. */
export function toZonedInput(d: Date | null | undefined, timeZone: string): string {
  if (!d) return "";
  const p = zoneParts(d, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone` → Date. Returns null if malformed. */
export function fromZonedInput(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let result = guess - offsetMs(new Date(guess), timeZone);
  // Re-check once: the offset can differ on the other side of a DST change.
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}
