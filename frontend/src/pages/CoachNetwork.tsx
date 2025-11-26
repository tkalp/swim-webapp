// pages/CoachNetwork.tsx
import { CoachConnections } from '@/components/squad/CoachConnections';

export default function CoachNetworkPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Coach Network</h1>
          <p className="text-slate-500">
            Connect with other coaches, build your professional network, and collaborate across squads.
          </p>
        </div>

        <CoachConnections />
      </div>
    </div>
  );
}
