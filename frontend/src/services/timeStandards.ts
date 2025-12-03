import { supabase } from '@/lib/supabase';
import { TimeStandardsSet, TimeStandard, TimeStandardInput } from '@/types/standards';

/**
 * Fetch all time standards sets for the authenticated coach
 */
export async function fetchStandardsSets(): Promise<TimeStandardsSet[]> {
  const { data, error } = await supabase
    .from('time_standards_sets')
    .select(`
      *,
      standards_count:time_standards(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching standards sets:', error);
    throw error;
  }

  // Transform the count from the aggregation
  return (data || []).map(set => ({
    ...set,
    standards_count: set.standards_count?.[0]?.count || 0
  }));
}

/**
 * Create a new time standards set
 */
export async function createStandardsSet(
  input: Omit<TimeStandardsSet, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'standards_count'>
): Promise<TimeStandardsSet> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('time_standards_sets')
    .insert([{
      ...input,
      created_by: user.id
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating standards set:', error);
    throw error;
  }

  return {
    ...data,
    standards_count: 0
  };
}

/**
 * Update an existing time standards set
 */
export async function updateStandardsSet(
  id: string,
  updates: Partial<Omit<TimeStandardsSet, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'standards_count'>>
): Promise<TimeStandardsSet> {
  const { data, error } = await supabase
    .from('time_standards_sets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating standards set:', error);
    throw error;
  }

  // Fetch the count separately
  const { count } = await supabase
    .from('time_standards')
    .select('*', { count: 'exact', head: true })
    .eq('set_id', id);

  return {
    ...data,
    standards_count: count || 0
  };
}

/**
 * Delete a time standards set and all its standards
 */
export async function deleteStandardsSet(id: string): Promise<void> {
  const { error } = await supabase
    .from('time_standards_sets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting standards set:', error);
    throw error;
  }
}

/**
 * Fetch all standards for a specific set
 */
export async function fetchStandards(setId: string): Promise<TimeStandard[]> {
  const { data, error } = await supabase
    .from('time_standards')
    .select('*')
    .eq('set_id', setId)
    .order('distance', { ascending: true })
    .order('stroke', { ascending: true });

  if (error) {
    console.error('Error fetching standards:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a single time standard
 */
export async function createStandard(
  setId: string,
  input: TimeStandardInput
): Promise<TimeStandard> {
  const { data, error } = await supabase
    .from('time_standards')
    .insert([{
      set_id: setId,
      ...input
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating standard:', error);
    throw error;
  }

  return data;
}

/**
 * Update an existing time standard
 */
export async function updateStandard(
  id: string,
  updates: Partial<TimeStandardInput>
): Promise<TimeStandard> {
  const { data, error } = await supabase
    .from('time_standards')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating standard:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a time standard
 */
export async function deleteStandard(id: string): Promise<void> {
  const { error } = await supabase
    .from('time_standards')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting standard:', error);
    throw error;
  }
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

  // Insert in batches of 100 to avoid request size limits
  const batchSize = 100;
  for (let i = 0; i < standards.length; i += batchSize) {
    const batch = standards.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('time_standards')
      .insert(
        batch.map(standard => ({
          set_id: setId,
          ...standard
        }))
      )
      .select();

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      failedCount += batch.length;
    } else {
      successCount += data?.length || 0;
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    errors
  };
}

/**
 * Parse CSV content to time standard inputs
 */
export function parseCSV(csvContent: string): TimeStandardInput[] {
  const lines = csvContent.trim().split('\n');
  const standards: TimeStandardInput[] = [];

  // Helper to normalize time format
  const normalizeTime = (time: string): string | undefined => {
    if (!time || time.trim() === '') return undefined;
    
    time = time.trim();
    
    // If already in full format HH:MM:SS.ms, just ensure 2 decimal places
    if (time.match(/^\d{2}:\d{2}:\d{2}\.\d+$/)) {
      const [hms, ms] = time.split('.');
      return `${hms}.${ms.padEnd(2, '0').substring(0, 2)}`;
    }
    
    // If format is MM:SS.ms or SS.ms, convert to HH:MM:SS.ms
    const parts = time.split(':');
    let hours = '00', minutes = '00', seconds = '00.00';
    
    if (parts.length === 1) {
      // Just seconds: 28.5 or 28.50
      const [sec, ms] = parts[0].split('.');
      seconds = `${sec.padStart(2, '0')}.${(ms || '0').padEnd(2, '0').substring(0, 2)}`;
    } else if (parts.length === 2) {
      // Minutes:Seconds: 00:28.5
      minutes = parts[0].padStart(2, '0');
      const [sec, ms] = parts[1].split('.');
      seconds = `${sec.padStart(2, '0')}.${(ms || '0').padEnd(2, '0').substring(0, 2)}`;
    } else if (parts.length === 3) {
      // Hours:Minutes:Seconds: 00:01:28.5
      hours = parts[0].padStart(2, '0');
      minutes = parts[1].padStart(2, '0');
      const [sec, ms] = parts[2].split('.');
      seconds = `${sec.padStart(2, '0')}.${(ms || '0').padEnd(2, '0').substring(0, 2)}`;
    }
    
    return `${hours}:${minutes}:${seconds}`;
  };

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',').map(col => col.trim());
    
    if (columns.length < 8) {
      console.warn(`Skipping invalid row ${i + 1}: insufficient columns`);
      continue;
    }

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
      standard_level: level
    });
  }

  return standards;
}
