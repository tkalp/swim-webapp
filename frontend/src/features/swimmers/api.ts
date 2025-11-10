import { supabase } from "../../lib/supabase";

export async function getSwimmerBasicInfo(swimmerId: string) {
  const { data, error } = await supabase
    .from('swimmers')
    .select('id, first_name, last_name, date_of_birth, sex')
    .eq('id', swimmerId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAttendanceStats(
  swimmerId: string,
  range?: { from?: string; to?: string }
) {
  let q = supabase
    .from('training_attendance')
    .select('status, created_at')
    .eq('swimmer_id', swimmerId);

  if (range?.from) q = q.gte('created_at', range.from);
  if (range?.to)   q = q.lte('created_at', range.to);

  const { data, error } = await q;
  if (error) throw error;

  const counts = { present: 0, late: 0, absent: 0 };
  data?.forEach(a => {
    const key = String(a.status ?? '').toLowerCase();
    if (key === 'present') counts.present++;
    else if (key === 'late') counts.late++;
    else counts.absent++;
  });
  return counts;
}

export async function getSessionsPerWeek(
  swimmerId: string,
  range?: { from?: string; to?: string }
): Promise<{ week: string; sessions: number; start: string; end: string }[]> {
  let q = supabase
    .from('training_attendance')
    .select('training_session_id, created_at, status')
    .eq('swimmer_id', swimmerId);

  if (range?.from) q = q.gte('created_at', range.from);
  if (range?.to)   q = q.lte('created_at', range.to);

  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) return [];

  const byWeek = new Map<string, number>();
  data.forEach(row => {
    if (!row.status || row.status.toLowerCase() === 'absent') return;
    const d = new Date(row.created_at);
    const key = getWeekKey(d); // e.g. 2025-W02
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  });

  // stable sort by ISO week key, then format to readable labels
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, sessions]) => {
      const { start, end, label } = parseWeekKey(weekKey);
      return { week: label, sessions, start: start.toISOString(), end: end.toISOString() };
    });
}

/** Returns ISO week key like "2025-W02" */
function getWeekKey(d: Date) {
  const w = getWeekNumber(d);
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
}

function getWeekNumber(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const dayMs = 86400000;
  return Math.ceil((((d.getTime() - onejan.getTime()) / dayMs) + onejan.getDay() + 1) / 7);
}

/** Converts "YYYY-Wxx" → { start: Date (Mon), end: Date (Sun), label: "Jan 6–12, 2025" } */
function parseWeekKey(key: string) {
  const [yearStr, weekStr] = key.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // approximate start, then shift to Monday
  const approx = new Date(year, 0, 1 + (week - 1) * 7);
  const day = approx.getDay(); // 0=Sun..6=Sat
  const start = new Date(approx);
  start.setDate(approx.getDate() - ((day + 6) % 7)); // back to Monday
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const label = formatRange(start, end);
  return { start, end, label };
}

function formatRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth();
  const monthShort = (d: Date) => d.toLocaleString('en-US', { month: 'short' });

  if (sameMonth) {
    // "Jan 6–12, 2025"
    return `${monthShort(start)} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  // "Jan 30 – Feb 5, 2025"
  return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`;
}
