import type { RangeKey } from '@/types/stats';


export function startOfWeek(d = new Date()) {
  const n = new Date(d);
  const day = n.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  n.setHours(0, 0, 0, 0);
  // Adjust to Monday: if Sunday (0), go back 6 days; otherwise go back (day - 1) days
  const offset = day === 0 ? 6 : day - 1;
  n.setDate(n.getDate() - offset);
  return n;
}
export function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
export function shiftMonth(d = new Date(), delta = 0) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
}

export function presetRange(key: RangeKey): {
  from?: string;
  to?: string;
  label: string;
} {
  const now = new Date();
  if (key === "this_week") {
    const f = startOfWeek(now),
      t = endOfWeek(now);
    return { from: f.toISOString(), to: t.toISOString(), label: "This Week" };
  }
  if (key === "last_week") {
    const f = startOfWeek(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    );
    const t = endOfWeek(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    );
    return { from: f.toISOString(), to: t.toISOString(), label: "Last Week" };
  }
  if (key === "this_month") {
    const f = startOfMonth(now),
      t = endOfMonth(now);
    return { from: f.toISOString(), to: t.toISOString(), label: "This Month" };
  }
  if (key === "last_month") {
    const base = shiftMonth(now, -1);
    const f = startOfMonth(base),
      t = endOfMonth(base);
    return { from: f.toISOString(), to: t.toISOString(), label: "Last Month" };
  }
  if (key === "all_time") {
    return { from: undefined, to: undefined, label: "All-Time" };
  }
  // custom handled by UI
  return { label: "Custom" };
}

/* Week keys */
export function getWeekKey(d: Date) {
  return `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, "0")}`;
}
export function getWeekNumber(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const msDay = 86400000;
  return Math.ceil(
    ((d.getTime() - onejan.getTime()) / msDay + onejan.getDay() + 1) / 7
  );
}

/* Pretty subtitle for range */
export function formatRangeSubtitle(from?: string, to?: string) {
  if (!from && !to) return "All-time";
  const f = from ? new Date(from) : undefined;
  const t = to ? new Date(to) : undefined;
  const fmt = (d: Date) =>
    d.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  if (f && t) return `${fmt(f)} – ${fmt(t)}`;
  if (f) return `Since ${fmt(f)}`;
  if (t) return `Until ${fmt(t)}`;
  return "";
}
