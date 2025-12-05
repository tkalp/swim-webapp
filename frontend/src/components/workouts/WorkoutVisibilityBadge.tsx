import { Lock, Users, Globe } from 'lucide-react';
import type { WorkoutVisibility } from '@/services/workoutSharingService';

interface WorkoutVisibilityBadgeProps {
  visibility: WorkoutVisibility;
  size?: 'sm' | 'md';
}

export default function WorkoutVisibilityBadge({ visibility, size = 'sm' }: WorkoutVisibilityBadgeProps) {
  const icons = {
    private: Lock,
    network: Users,
    public: Globe,
  };

  const labels = {
    private: 'Private',
    network: 'Network',
    public: 'Public',
  };

  const colors = {
    private: 'bg-slate-700 text-slate-300',
    network: 'bg-purple-900/50 text-purple-300',
    public: 'bg-green-900/50 text-green-300',
  };

  const Icon = icons[visibility];
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${colors[visibility]} ${textSize}`}>
      <Icon className={iconSize} />
      {labels[visibility]}
    </span>
  );
}
