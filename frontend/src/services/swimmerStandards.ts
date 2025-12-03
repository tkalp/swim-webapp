import { supabase } from '@/lib/supabase';
import { TimeStandard } from '@/types/standards';

/**
 * Calculate swimmer's current age from date of birth
 */
export function calculateSwimmerAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Convert time result string to seconds
 */
export function timeStringToSeconds(timeString: string): number {
  const parts = timeString.split(':');
  let totalSeconds = 0;
  
  if (parts.length === 3) {
    // HH:MM:SS.ms format
    totalSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS.ms format
    totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else if (parts.length === 1) {
    // SS.ms format
    totalSeconds = parseFloat(parts[0]);
  }
  
  return totalSeconds;
}

/**
 * Fetch standards that match the event and swimmer criteria
 */
export async function getStandardsForEvent(
  standardsSetId: string,
  distance: number,
  stroke: string,
  age: number,
  gender: 'M' | 'F' | 'X',
  poolType: 'SCM' | 'LCM'
): Promise<TimeStandard[]> {
  const { data, error } = await supabase
    .from('time_standards')
    .select('*')
    .eq('set_id', standardsSetId)
    .eq('distance', distance)
    .eq('stroke', stroke.toLowerCase())
    .eq('gender', gender)
    .lte('age_group_min', age)
    .gte('age_group_max', age)
    .order('standard_level', { ascending: true });

  if (error) {
    console.error('Error fetching standards:', error);
    return [];
  }

  return data || [];
}

/**
 * Calculate achievement level and gap for a swimmer's time
 */
export interface StandardComparison {
  achievedLevel?: string;
  nextLevel?: string;
  nextLevelTime?: string;
  nextLevelSeconds?: number;
  gapSeconds?: number;
  gapPercentage?: number;
  allLevels: Array<{
    level: string;
    time: string;
    timeSeconds: number;
    achieved: boolean;
    gapSeconds: number;
    gapPercentage: number;
  }>;
}

export function calculateStandardComparison(
  swimmerTimeSeconds: number,
  standards: TimeStandard[],
  poolType: 'SCM' | 'LCM'
): StandardComparison {
  const result: StandardComparison = {
    allLevels: []
  };

  // Get the appropriate time field based on pool type
  const timeField = poolType === 'SCM' ? 'scm_time' : 'lcm_time';

  // Process each standard level
  for (const standard of standards) {
    const standardTimeString = standard[timeField];
    if (!standardTimeString) continue;

    const standardSeconds = timeStringToSeconds(standardTimeString);
    const achieved = swimmerTimeSeconds <= standardSeconds;
    const gapSeconds = swimmerTimeSeconds - standardSeconds;
    const gapPercentage = (gapSeconds / standardSeconds) * 100;

    result.allLevels.push({
      level: standard.standard_level,
      time: standardTimeString,
      timeSeconds: standardSeconds,
      achieved,
      gapSeconds,
      gapPercentage
    });

    // Track achieved and next levels
    if (achieved && !result.achievedLevel) {
      result.achievedLevel = standard.standard_level;
    }
    
    if (!achieved && !result.nextLevel) {
      result.nextLevel = standard.standard_level;
      result.nextLevelTime = standardTimeString;
      result.nextLevelSeconds = standardSeconds;
      result.gapSeconds = gapSeconds;
      result.gapPercentage = gapPercentage;
    }
  }

  return result;
}

/**
 * Format time delta as a readable string
 */
export function formatTimeDelta(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const sign = seconds > 0 ? '+' : '-';
  
  if (absSeconds < 60) {
    return `${sign}${absSeconds.toFixed(2)}s`;
  } else {
    const minutes = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${sign}${minutes}:${secs.toFixed(2)}`;
  }
}

/**
 * Format percentage delta
 */
export function formatPercentageDelta(percentage: number): string {
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}

/**
 * Map gender from swimmer format to standards format
 */
export function mapGenderToStandards(sex?: string | null): 'M' | 'F' | 'X' {
  if (!sex) return 'X';
  
  const normalized = sex.toLowerCase();
  if (normalized === 'male' || normalized === 'm') return 'M';
  if (normalized === 'female' || normalized === 'f') return 'F';
  return 'X';
}

/**
 * Convert pool type from result units format
 */
export function normalizePoolType(resultUnits: string): 'SCM' | 'LCM' {
  const normalized = resultUnits.toUpperCase();
  if (normalized === 'SCM' || normalized === 'LCM') {
    return normalized as 'SCM' | 'LCM';
  }
  // Default to SCM if unknown
  return 'SCM';
}

/**
 * Get the standard time for a specific event (useful for qualifiers)
 * Returns the first/fastest standard time for the event, or null if none exists
 */
export async function getStandardTime(
  standardsSetId: string,
  distance: number,
  stroke: string,
  poolType: 'SCM' | 'LCM' | 'SCY',
  age: number,
  sex?: string
): Promise<number | null> {
  if (!sex) return null;
  
  const gender = mapGenderToStandards(sex);
  if (gender === 'X') return null;
  
  // SCY not commonly supported in standards, default to SCM
  const actualPoolType = poolType === 'SCY' ? 'SCM' : poolType;
  
  const standards = await getStandardsForEvent(
    standardsSetId,
    distance,
    stroke,
    age,
    gender,
    actualPoolType
  );
  
  if (standards.length === 0) return null;
  
  // Get the first standard (usually the fastest/highest level)
  const timeField = actualPoolType === 'SCM' ? 'scm_time' : 'lcm_time';
  const timeString = standards[0][timeField];
  
  if (!timeString) return null;
  
  return timeStringToSeconds(timeString);
}
