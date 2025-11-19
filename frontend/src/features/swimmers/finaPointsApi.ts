// features/swimmers/finaPointsApi.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface FinaPointsByStroke {
  best_fina_points: number;
  average_fina_points: number;
  total_results: number;
  best_by_distance: {
    [distance: string]: {
      id: string;
      distance: number;
      time_result: string;
      time_seconds: number;
      fina_points: number;
      performed_on: string;
    };
  };
}

export interface FinaPointsResult {
  id: string;
  distance: number;
  stroke: string;
  time_result: string;
  time_seconds: number;
  performed_on: string;
  fina_points: number;
  result_units: string;
}

export interface FinaPointsResponse {
  swimmer_id: string;
  gender: string;
  course: string;
  overall_best_fina_points: number;
  overall_best_result: {
    id: string;
    stroke: string;
    distance: number;
    time_result: string;
    time_seconds: number;
    fina_points: number;
    performed_on: string;
  };
  overall_average_fina_points: number;
  total_results: number;
  by_stroke: {
    [stroke: string]: FinaPointsByStroke;
  };
  results_with_points: FinaPointsResult[];
}

export async function getSwimmerFinaPoints(
  swimmerId: string,
  gender: string,
  course: "LCM" | "SCM" = "LCM",
  activity: string = "swim",
  equipment: string = "none"
): Promise<FinaPointsResponse> {
  const params = new URLSearchParams({
    gender,
    course,
    activity,
    equipment,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/swimmers/${swimmerId}/fina-points?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch FINA points: ${response.statusText}`);
  }

  return response.json();
}

export interface SupportedEvent {
  [stroke: string]: number[];
}

export interface SupportedEventsResponse {
  course: string;
  events: {
    male: SupportedEvent;
    female: SupportedEvent;
  };
}

export async function getSupportedFinaEvents(
  course: "LCM" | "SCM" = "LCM"
): Promise<SupportedEventsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/swimmers/fina/supported-events?course=${course}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch supported events: ${response.statusText}`);
  }

  return response.json();
}
