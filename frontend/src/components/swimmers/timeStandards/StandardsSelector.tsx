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

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[280px] m-2">
        <CustomSelect
          label="Compare to:"
          value={selectedSetId || ''}
          onChange={(value) => onSetChange(value || null)}
          options={options}
          placeholder="Select a time standard..."
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
