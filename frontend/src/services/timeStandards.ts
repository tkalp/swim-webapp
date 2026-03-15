import { apiClient } from '@/lib/apiClient';
import { TimeStandardsSet, TimeStandard, TimeStandardInput } from '@/types/standards';

/**
 * Fetch all time standards sets for the authenticated coach
 */
export async function fetchStandardsSets(): Promise<TimeStandardsSet[]> {
  return apiClient.get<TimeStandardsSet[]>('/time-standards/sets');
}

/**
 * Create a new time standards set
 */
export async function createStandardsSet(
  input: Omit<TimeStandardsSet, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'standards_count'>
): Promise<TimeStandardsSet> {
  return apiClient.post<TimeStandardsSet>('/time-standards/sets', input);
}

/**
 * Update an existing time standards set
 */
export async function updateStandardsSet(
  id: string,
  updates: Partial<Omit<TimeStandardsSet, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'standards_count'>>
): Promise<TimeStandardsSet> {
  return apiClient.put<TimeStandardsSet>(`/time-standards/sets/${id}`, updates);
}

/**
 * Delete a time standards set and all its standards
 */
export async function deleteStandardsSet(id: string): Promise<void> {
  await apiClient.delete(`/time-standards/sets/${id}`);
}

/**
 * Fetch all standards for a specific set
 */
export async function fetchStandards(setId: string): Promise<TimeStandard[]> {
  return apiClient.get<TimeStandard[]>(`/time-standards/sets/${setId}/standards`);
}

/**
 * Create a single time standard
 */
export async function createStandard(
  setId: string,
  input: TimeStandardInput
): Promise<TimeStandard> {
  return apiClient.post<TimeStandard>('/time-standards/standards', {
    set_id: setId,
    ...input,
  });
}

/**
 * Update an existing time standard
 */
export async function updateStandard(
  id: string,
  updates: Partial<TimeStandardInput>
): Promise<TimeStandard> {
  return apiClient.put<TimeStandard>(`/time-standards/standards/${id}`, updates);
}

/**
 * Delete a time standard
 */
export async function deleteStandard(id: string): Promise<void> {
  await apiClient.delete(`/time-standards/standards/${id}`);
}

/**
 * Bulk import time standards from CSV data
 */
export async function importStandards(
  setId: string,
  standards: TimeStandardInput[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  let failedCount = 0;

  const batchSize = 100;
  for (let i = 0; i < standards.length; i += batchSize) {
    const batch = standards.slice(i, i + batchSize);

    try {
      const result = await apiClient.post<{ created: number }>(
        '/time-standards/standards/bulk',
        {
          set_id: setId,
          standards: batch.map(s => ({ set_id: setId, ...s })),
        }
      );
      successCount += result.created;
    } catch (e: any) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${e.message}`);
      failedCount += batch.length;
    }
  }

  return { success: successCount, failed: failedCount, errors };
}

/**
 * Parse CSV content to time standard inputs
 */
export function parseCSV(csvContent: string): TimeStandardInput[] {
  const lines = csvContent.trim().split('\n');
  const standards: TimeStandardInput[] = [];

  const normalizeTime = (time: string): string | undefined => {
    if (!time || time.trim() === '') return undefined;

    time = time.trim();

    if (time.match(/^\d{2}:\d{2}:\d{2}\.\d+$/)) {
      const [hms, ms] = time.split('.');
      return `${hms}.${ms.padEnd(2, '0').substring(0, 2)}`;
    }

    const parts = time.split(':');
    let hours = '00', minutes = '00', seconds = '00.00';

    if (parts.length === 1) {
      const [sec, ms] = parts[0].split('.');
      seconds = `${sec.padStart(2, '0')}.${(ms || '0').padEnd(2, '0').substring(0, 2)}`;
    } else if (parts.length === 2) {
      minutes = parts[0].padStart(2, '0');
      const [sec, ms] = parts[1].split('.');
      seconds = `${sec.padStart(2, '0')}.${(ms || '0').padEnd(2, '0').substring(0, 2)}`;
    } else if (parts.length === 3) {
      hours = parts[0].padStart(2, '0');
      minutes = parts[1].padStart(2, '0');
      const [sec, ms] = parts[2].split('.');
      seconds = `${sec.padStart(2, '0')}.${(ms || '0').padEnd(2, '0').substring(0, 2)}`;
    }

    return `${hours}:${minutes}:${seconds}`;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',').map(col => col.trim());
    if (columns.length < 8) continue;

    const [distance, stroke, ageGroupMin, ageGroupMax, gender, scmTime, lcmTime, level] = columns;

    standards.push({
      distance: parseInt(distance),
      stroke: stroke.toLowerCase(),
      activity: 'swim',
      equipment: 'none',
      age_group_min: parseInt(ageGroupMin),
      age_group_max: parseInt(ageGroupMax),
      gender: gender.toUpperCase() as 'M' | 'F' | 'X',
      scm_time: normalizeTime(scmTime),
      lcm_time: normalizeTime(lcmTime),
      standard_level: level,
    });
  }

  return standards;
}
