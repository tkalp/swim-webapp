// services/aiCoachService.ts

import type { BestTimes, Conversation, Message } from '@/types/ai-coach/types';
import { authenticatedFetch } from '@/lib/apiClient';
import { API_BASE_URL } from '@/lib/api';

/**
 * Request type for generating a workout
 */
export interface GenerateWorkoutRequest {
  prompt: string;
  bestTimes?: BestTimes;
}

/**
 * Example workout from the vector database
 */
export interface ExampleWorkout {
  id: string;
  title: string;
  url: string;
  relevance: number;
}

/**
 * Response from AI workout generation
 */
export interface GenerateWorkoutResponse {
  workout: string;
  examples: ExampleWorkout[];
  athlete_paces?: string;
}

/**
 * Health check response for AI Coach
 */
export interface AICoachHealthResponse {
  status: string;
  chromadb?: string;
  message?: string;
}

/**
 * General API health response
 */
export interface APIHealthResponse {
  status: string;
  message: string;
}

/**
 * Generate a swimming workout using AI Coach (Anthropic Claude)
 * Uses ChromaDB for RAG to find similar workouts
 */
export async function generateWorkout(
  request: GenerateWorkoutRequest
): Promise<GenerateWorkoutResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/ai-coach/generate`, {
    method: "POST",
    body: JSON.stringify({
      prompt: request.prompt,
      bestTimes: request.bestTimes,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to generate workout",
    }));
    // FastAPI returns errors in 'detail' field
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check AI Coach health status
 * Verifies Claude API and ChromaDB connections
 */
export async function checkAICoachHealth(): Promise<AICoachHealthResponse> {
  const response = await fetch(`${API_BASE_URL}/ai-coach/health`);
  
  if (!response.ok) {
    throw new Error(`AI Coach health check failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Check general API health
 */
export async function checkAPIHealth(): Promise<APIHealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }
  
  return response.json();
}

// Conversation API functions

/**
 * List all conversations for the current user
 */
export async function listConversations(): Promise<Conversation[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/ai-coach/conversations`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to list conversations' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Create a new conversation, optionally with a title
 */
export async function createConversation(title?: string): Promise<Conversation> {
  const response = await authenticatedFetch(`${API_BASE_URL}/ai-coach/conversations`, {
    method: 'POST',
    body: JSON.stringify({ title: title || null }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create conversation' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch a single conversation and its message history
 */
export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/ai-coach/conversations/${id}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to load conversation' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Delete a conversation by ID (204 No Content on success)
 */
export async function deleteConversation(id: string): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE_URL}/ai-coach/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete conversation' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

/**
 * Send a message in a conversation; returns both the persisted coach message and the assistant reply
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  metadata?: object
): Promise<{ coach_message: Message; assistant_message: Message }> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/ai-coach/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, metadata }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Quick templates for common workout types
 * These provide users with starting points for AI generation
 */
export const WORKOUT_TEMPLATES = [
  {
    id: "sprint" as const,
    name: "Sprint Training",
    prompt:
      "Generate a 3000 yard sprint workout for advanced swimmers. Include short, fast intervals with adequate rest. Focus on explosive starts and maximum velocity.",
  },
  {
    id: "endurance" as const,
    name: "Endurance Base",
    prompt:
      "Create an endurance workout for building aerobic base. Include longer sets at moderate pace with emphasis on consistent tempo and breathing patterns. Total: 4000 yards.",
  },
  {
    id: "im" as const,
    name: "IM Practice",
    prompt:
      "Design an IM-focused workout with all four strokes. Include stroke-specific drills, IM combinations, and proper transitions. Total: 3500 yards.",
  },
  {
    id: "race" as const,
    name: "Race Prep",
    prompt:
      "Race simulation workout for 200 freestyle. Include pace work, broken swims at race pace, and mental preparation elements. Total: 3000 yards.",
  },
] as const;

export type TemplateId = (typeof WORKOUT_TEMPLATES)[number]["id"];

/**
 * Generate a 1-sentence description for a workout using AI
 */
export interface GenerateWorkoutDescriptionRequest {
  workout_name: string;
  raw_description: string;
  total_meters?: number;
  effort_level?: number;
}

export interface GenerateWorkoutDescriptionResponse {
  description: string;
  cached: boolean;
}

export interface GenerateWorkoutTitleRequest {
  raw_description: string;
  total_meters?: number;
  effort_level?: number;
  analysis?: any;  // Workout analysis data
}

export interface GenerateWorkoutTitleResponse {
  title: string;
  cached: boolean;
}

export async function generateWorkoutTitle(
  params: GenerateWorkoutTitleRequest
): Promise<GenerateWorkoutTitleResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/ai-coach/generate-title`, {
    method: 'POST',
    body: JSON.stringify({
      raw_description: params.raw_description,
      total_meters: params.total_meters,
      effort_level: params.effort_level,
      analysis: params.analysis,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      detail: 'Failed to generate title' 
    }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function generateWorkoutDescription(
  params: GenerateWorkoutDescriptionRequest
): Promise<GenerateWorkoutDescriptionResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/ai-coach/generate-description`, {
    method: 'POST',
    body: JSON.stringify({
      workout_name: params.workout_name,
      raw_description: params.raw_description,
      total_meters: params.total_meters,
      effort_level: params.effort_level,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      detail: 'Failed to generate description' 
    }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
