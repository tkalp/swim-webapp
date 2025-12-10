import { useEffect, useState } from 'react';
import { fetchStandardsSets } from '@/services/timeStandards';
import { TimeStandardsSet } from '@/types/standards';
import CustomSelect, { Option } from '@/components/ui/CustomSelect';

interface StandardsSelectorProps {
  onSetChange: (setId: string | null) => void;
  selectedSetId: string | null;
}

export function StandardsSelector({ onSetChange, selectedSetId }: StandardsSelectorProps) {
  const [standardsSets, setStandardsSets] = useState<TimeStandardsSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStandardsSets();
  }, []);

  const loadStandardsSets = async () => {
    try {
      setIsLoading(true);
      const sets = await fetchStandardsSets();
      // Only show active sets
      const activeSets = sets.filter((set: TimeStandardsSet) => set.active);
      setStandardsSets(activeSets);
    } catch (error) {
      console.error('Failed to load standards sets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const options: Option[] = [
    { value: '', label: 'None' },
    ...standardsSets.map((set) => ({
      value: set.id,
      label: `${set.name}${set.year ? ` (${set.year})` : ''}`
    }))
  ];

  const selectedSet = standardsSets.find(s => s.id === selectedSetId);
  const displayLabel = selectedSet 
    ? `${selectedSet.name}${selectedSet.year ? ` (${selectedSet.year})` : ''}`
    : 'Compare Standards';

  return (
    <div className="standards-selector-button">
      <CustomSelect
        value={selectedSetId || ''}
        onChange={(value) => onSetChange(value || null)}
        options={options}
        placeholder={displayLabel}
        disabled={isLoading}
        className="button-style"
      />
    </div>
  );
}
