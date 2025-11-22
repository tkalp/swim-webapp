import { supabase } from '@/lib/supabase';
import { API_BASE_URL } from '@/lib/api';

export interface BulkSyncJob {
  id: string;
  status: string;
  total_swimmers: number;
  swimmers_processed: number;
  swimmers_succeeded: number;
  swimmers_failed: number;
  triggered_by: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface BulkSyncFailure {
  swimmer_name: string;
  error_message: string;
  failed_at: string;
}

export interface BulkSyncRequest {
  force_update: boolean;
}

export interface BulkSyncResponse {
  success: boolean;
  job_id?: string;
  total_swimmers?: number;
  message: string;
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export async function startBulkSync(
  forceUpdate: boolean = false
): Promise<BulkSyncResponse> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/admin/sync/bulk`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force_update: forceUpdate }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start bulk sync');
  }

  return response.json();
}

export async function getBulkSyncStatus(jobId: string): Promise<BulkSyncJob> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/admin/sync/bulk/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get job status');
  }

  return response.json();
}

export async function getBulkSyncFailures(
  jobId: string
): Promise<BulkSyncFailure[]> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_BASE_URL}/admin/sync/bulk/${jobId}/failures`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get failures');
  }

  return response.json();
}

export async function cancelBulkSync(jobId: string): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_BASE_URL}/admin/sync/bulk/${jobId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to cancel bulk sync');
  }
}

export async function getBulkSyncHistory(
  limit: number = 20
): Promise<BulkSyncJob[]> {
  const token = await getAuthToken();

  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/admin/sync/bulk/history?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get sync history');
  }

  return response.json();
}
