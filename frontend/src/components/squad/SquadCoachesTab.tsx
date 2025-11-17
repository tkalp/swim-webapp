// components/squad/SquadCoachesTab.tsx
import { useSquadPermissions } from '../../hooks/useSquadPermissions';
import { ManageCoaches } from './ManageCoaches';

interface SquadCoachesTabProps {
  squadId: string;
}

export function SquadCoachesTab({ squadId }: SquadCoachesTabProps) {
  const { loading, hasPermission } = useSquadPermissions(squadId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const canManageCoaches = hasPermission('can_manage_coaches');

  return (
    <div className="space-y-6">
      <ManageCoaches squadId={squadId} canManage={canManageCoaches} />
    </div>
  );
}
