// components/EditMetricModal.tsx
import { useState, useEffect } from "react";
import Modal from '@/components/ui/Modal';

type MetricType = 'distance' | 'duration' | 'calories';

type EditMetricModalProps = {
  isOpen: boolean;
  metricType: MetricType | null;
  initialValue: number;
  onSave: (value: number) => void;
  onClose: () => void;
};

export function EditMetricModal({ 
  isOpen, 
  metricType, 
  initialValue, 
  onSave, 
  onClose 
}: EditMetricModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSave = () => {
    onSave(value);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const getTitle = () => {
    if (!metricType) return '';
    return `Edit ${metricType.charAt(0).toUpperCase()}${metricType.slice(1)}`;
  };

  const getLabel = () => {
    switch (metricType) {
      case 'distance': return 'Distance (meters)';
      case 'duration': return 'Duration (minutes)';
      case 'calories': return 'Calories (kcal)';
      default: return '';
    }
  };

  const getHelpText = () => {
    switch (metricType) {
      case 'distance': return 'Override the auto-calculated distance';
      case 'duration': return 'Override the auto-calculated duration';
      case 'calories': return 'Override the auto-calculated calories';
      default: return '';
    }
  };

  const getStep = () => {
    return metricType === 'distance' ? 50 : 1;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="metric-value" className="block text-sm font-medium text-text-primary mb-2">
            {getLabel()}
          </label>
          <input
            id="metric-value"
            type="number"
            className="w-full px-4 py-2.5 bg-background-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            value={value}
            onChange={(e) => setValue(parseInt(e.target.value) || 0)}
            onKeyDown={handleKeyDown}
            min="0"
            step={getStep()}
            autoFocus
          />
          <p className="text-xs text-text-secondary mt-2">
            {getHelpText()}
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-background-tertiary hover:bg-background-secondary text-text-primary rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
