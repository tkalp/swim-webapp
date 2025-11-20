import { useEffect, useMemo, useState } from 'react';
import { getAttendanceStats, getSessionsPerWeek, getSwimmerBasicInfo } from '../services/swimmerService';
import type { Att, WeekRow } from '../types/stats';
import { getWeekKey } from '../utils/dateRanges';

export function useSwimmerStats(
  swimmerId: string | undefined,
  range: { from?: string; to?: string }
) {
  const { from, to } = range;

  const [swimmer, setSwimmer] = useState<any>(null);
  const [attendance, setAttendance] = useState<Att | null>(null);
  const [sessions, setSessions] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!swimmerId) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const [att, sess, swimmer] = await Promise.all([
          getAttendanceStats(swimmerId, { from, to }),
          getSessionsPerWeek(swimmerId, { from, to }),
          getSwimmerBasicInfo(swimmerId),
        ]);
        if (!mounted) return;
        setAttendance(att);
        setSessions(sess);
        setSwimmer(swimmer);
        setErr('');
      } catch (e: any) {
        setErr(e.message ?? 'Failed to load swimmer stats');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [swimmerId, from, to]);


  const totalAttendance = useMemo(() => {
    if (!attendance) return 0;
    return attendance.present + attendance.late + attendance.absent;
  }, [attendance]);

  const presentPct = useMemo(() => {
    if (!attendance || totalAttendance === 0) return 0;
    return Math.round((attendance.present / totalAttendance) * 100);
  }, [attendance, totalAttendance]);

  const attendanceData = useMemo(() => {
    if (!attendance) return [];
    return [
      { label: 'Present', value: attendance.present, color: '#10B981' },
      { label: 'Late',    value: attendance.late,    color: '#F59E0B' },
      { label: 'Absent',  value: attendance.absent,  color: '#EF4444' },
    ];
  }, [attendance]);

  const avgPerWeek = useMemo(() => {
    if (!sessions.length) return 0;
    const total = sessions.reduce((sum, r) => sum + r.sessions, 0);
    return +(total / sessions.length).toFixed(1);
  }, [sessions]);

  const bestWeek = useMemo(() => {
    if (!sessions.length) return null;
    return sessions.reduce((max, r) => (r.sessions > (max?.sessions ?? 0) ? r : max), sessions[0]);
  }, [sessions]);

  const currentWeekKey = useMemo(() => getWeekKey(new Date()), []);
  const thisWeekSessions = useMemo(() => {
    const row = sessions.find(r => r.week === currentWeekKey);
    return row?.sessions ?? 0;
  }, [sessions, currentWeekKey]);

  return {
    loading,
    err,
    attendance,
    sessions,
    totalAttendance,
    presentPct,
    attendanceData,
    avgPerWeek,
    bestWeek,
    thisWeekSessions,
    swimmer,
  };
}
