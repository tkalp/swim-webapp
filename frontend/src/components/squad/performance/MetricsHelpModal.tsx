import React from 'react';
import { TrendingDown, Trophy, Target, Activity, Zap } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface MetricsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MetricsHelpModal: React.FC<MetricsHelpModalProps> = ({ isOpen, onClose }) => {
  const metrics = [
    {
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      name: "Events",
      description: "Total number of unique events the swimmer has competed in during the selected period."
    },
    {
      icon: <Trophy className="w-5 h-5 text-yellow-400" />,
      name: "PRs",
      description: "Personal Records - The total number of times the swimmer achieved their best time in any event."
    },
    {
      icon: <TrendingDown className="w-5 h-5 text-emerald-400" />,
      name: "Avg Improvement",
      description: "Average improvement percentage across all events. Negative values indicate improvement (faster times)."
    },
    {
      icon: <Target className="w-5 h-5 text-cyan-400" />,
      name: "Best Improvement",
      description: "The single best improvement percentage achieved across any event. Shows the swimmer's peak performance gain."
    },
    {
      icon: <Activity className="w-5 h-5 text-purple-400" />,
      name: "Consistency",
      description: "Measures how evenly the swimmer improves across all events. Higher scores (closer to 100) indicate more consistent progress across all events."
    },
    {
      icon: <Zap className="w-5 h-5 text-orange-400" />,
      name: "Weighted Improvement",
      description: "A weighted average improvement that emphasizes recent performance using quadratic weighting. More recent swims have greater impact on this metric."
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Performance Metrics Guide"
      size="2xl"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {metrics.map((metric, index) => (
          <div 
            key={index}
            className="flex gap-4 p-4 bg-slate-900/40 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors"
          >
            <div className="shrink-0 mt-0.5">
              {metric.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-100 mb-1">
                {metric.name}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {metric.description}
              </p>
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            Click on any column header to sort by that metric
          </p>
        </div>
      </div>
    </Modal>
  );
};
