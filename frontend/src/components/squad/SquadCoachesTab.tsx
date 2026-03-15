// components/squad/SquadCoachesTab.tsx
import { usePermissions } from '@/hooks/usePermissions';
import { ManageCoaches } from '@/components/squad/ManageCoaches';

interface SquadCoachesTabProps {
  squadId: string;
}

export function SquadCoachesTab({ squadId }: SquadCoachesTabProps) {
  const { loading, hasPermission } = usePermissions(squadId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const canManageCoaches = hasPermission('can_manage_squad_settings');

  return (
    <div className="space-y-6">
      <ManageCoaches squadId={squadId} canManage={canManageCoaches} />
    </div>
  );
}
