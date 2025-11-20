// pages/CoachNetwork.tsx
import { CoachConnections } from '@/components/squad/CoachConnections';

export default function CoachNetworkPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Coach Network</h1>
          <p className="text-text-muted">
            Connect with other coaches, build your professional network, and collaborate across squads.
          </p>
        </div>

        <CoachConnections />
      </div>
    </div>
  );
}
