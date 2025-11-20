import { supabase } from '@/lib/supabase';
import { API_BASE_URL } from '@/lib/api';

export interface SwimRankingsSearchResult {
  athlete_id: string;
  name: string;
  birth_year?: string;
  gender?: string;
  nation?: string;
  club?: string;
  last_result?: string;
  url: string;
}

export interface SwimmerExternalLink {
  id: string;
  swimmer_id: string;
  platform: string;
  external_id: string;
  external_url?: string;
  external_name?: string;
  birth_year?: number;
  nation_code?: string;
  club_name?: string;
  gender?: string;
  verified: boolean;
  auto_import_enabled: boolean;
  last_sync_at?: string;
  last_result_date?: string;
  created_at: string;
  updated_at: string;
}

export interface LinkSwimmerRequest {
  swimmer_id: string;
  swimrankings_athlete_id: string;
  swimrankings_name: string;
  birth_year?: number;
  nation_code?: string;
  club_name?: string;
  gender?: string;
  verified?: boolean;
}

export interface LinkSwimmerResponse {
  success: boolean;
  message: string;
  link?: SwimmerExternalLink;
}

export interface ImportResultsRequest {
  swimmer_id: string;
  season?: number;
  include_splits?: boolean;
}

export interface ImportedResult {
  distance: number;
  stroke: string;
  time_seconds: number;
  course: string;
  meet_name: string;
  meet_date: string;
  meet_city?: string;
  meet_nation?: string;
  points?: number;
  splits_count: number;
}

export interface ImportResultsResponse {
  success: boolean;
  message: string;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  results: ImportedResult[];
}

export interface ImportEventAttemptsRequest {
  swimmer_id: string;
  event_name: string;
  limit?: number;
  skip_no_splits?: boolean;
}

export interface EventAttempt {
  time: string;
  points: number;
  date: string;
  location: string;
  meet_name: string;
  course: string;
  result_id: string;
  meet_link: string;
}

export interface RaceSplit {
  split_distance: number;
  split_time: number;
  cumulative_time: number;
  split_order: number;
}

export interface EventResult {
  attempt: EventAttempt;
  reaction_time?: number;
  splits: RaceSplit[];
}

export interface ImportEventAttemptsResponse {
  success: boolean;
  message: string;
  event_name: string;
  style_id: string;
  total_results: number;
  results: EventResult[];
}

export interface ExternalSwimmerBestTime {
  distance: number;
  stroke: string;
  time: string;
  time_formatted: string;
  time_seconds: number;
  course: string;
  date: string;
  city: string;
  meet_name: string;
  swimrankings_points?: string;
  fina_points: number;
}

export interface ExternalSwimmerFinaPoints {
  athlete_id: string;
  gender: string;
  course: string;
  by_stroke: Record<string, ExternalSwimmerBestTime[]>;
  all_results: ExternalSwimmerBestTime[];
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export async function searchSwimRankings(
  firstname: string,
  lastname: string
): Promise<SwimRankingsSearchResult[]> {
  const token = await getAuthToken();
  
  const params = new URLSearchParams({
    firstname,
    lastname,
  });

  const response = await fetch(
    `${API_BASE_URL}/swimrankings/search?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to search swimmers');
  }

  return response.json();
}

export async function linkSwimmer(
  request: LinkSwimmerRequest
): Promise<LinkSwimmerResponse> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/swimrankings/link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to link swimmer');
  }

  return response.json();
}

export async function getSwimmerLinks(
  swimmerId: string
): Promise<SwimmerExternalLink[]> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_BASE_URL}/swimrankings/swimmer/${swimmerId}/links`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get swimmer links');
  }

  return response.json();
}

export async function deleteLink(linkId: string): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/swimrankings/link/${linkId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete link');
  }
}

export async function importResults(
  request: ImportResultsRequest
): Promise<ImportResultsResponse> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}/swimrankings/import-results`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to import results');
  }

  return response.json();
}

export async function importEventAttempts(
  request: ImportEventAttemptsRequest
): Promise<ImportEventAttemptsResponse> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}/swimrankings/fetch-event-attempts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to import event attempts');
  }

  return response.json();
}

export async function getExternalSwimmerFinaPoints(
  athleteId: string,
  gender: string,
  course: string = 'LCM'
): Promise<ExternalSwimmerFinaPoints> {
  // No auth required - this is public SwimRankings data
  const params = new URLSearchParams({
    gender,
    course,
  });

  const response = await fetch(
    `${API_BASE_URL}/swimrankings/athlete/${athleteId}/fina-points?${params}`
  );

  if (!response.ok) {
    throw new Error('Failed to get external swimmer FINA points');
  }

  return response.json();
}
