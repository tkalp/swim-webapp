import { useAuth } from '../contexts/AuthContext';

/**
 * Simple feature flag hook that checks user email for feature access.
 * Currently used to gate time standards and qualifiers features to specific users.
 */
export function useFeatureFlags() {
  const { user } = useAuth();

  const hasTimeStandards = user?.email === 'teddy.kalp@lablytics.com';
  const hasQualifiers = user?.email === 'teddy.kalp@lablytics.com';

  return {
    hasTimeStandards,
    hasQualifiers,
  };
}
