import { getApiUrl } from '../../lib/api';

export interface SwimmerAttendance {
  swimmer_id: string;
  swimmer_name: string;
  total_sessions: number;
  present: number;
  late: number;
  absent: number;
  present_percentage: number;
  late_percentage: number;
  absent_percentage: number;
}

export interface AttendanceStats {
  total_sessions: number;
  avg_present_percentage: number;
  avg_late_percentage: number;
  avg_absent_percentage: number;
  total_swimmers: number;
}

export interface SquadAttendanceData {
  squad: {
    id: string;
    name: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  swimmers: SwimmerAttendance[];
  stats: AttendanceStats;
}

export async function getSquadAttendanceRankings(
  squadId: string,
  startDate?: string,
  endDate?: string
): Promise<SquadAttendanceData> {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const url = getApiUrl(`squads/${squadId}/attendance?${params.toString()}`);
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch squad attendance: ${response.statusText}`);
  }

  return response.json();
}
