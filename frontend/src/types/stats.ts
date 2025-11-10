export type TabKey = 'overview' | 'bestTimes';

export type Att = { present: number; late: number; absent: number };
export type WeekRow = { week: string; sessions: number };

export type RangeKey =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'all_time'
  | 'custom';