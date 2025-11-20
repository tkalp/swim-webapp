import { Calendar, Filter, Check } from 'lucide-react';
import DateInput from '@/components/ui/DateInput';
import type { RangeKey } from '@/types/stats';

type Props = {
  rangeKey: RangeKey;
  from?: string;
  to?: string;
  onQuick: (k: RangeKey) => void;
  onChangeFrom: (iso?: string) => void;
  onChangeTo: (iso?: string) => void;
  onApplyCustom: () => void;
};

const QUICK_RANGES: { key: RangeKey; label: string }[] = [
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all_time', label: 'All-Time' },
];

export default function RangeToolbar({
  rangeKey, from, to, onQuick, onChangeFrom, onChangeTo, onApplyCustom,
}: Props) {
  return (
    <section className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-lg space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary shadow-md">
          <Calendar size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Date Range</h3>
          <p className="text-xs text-text-secondary">Select a time period</p>
        </div>
      </div>

      {/* Quick Range Buttons */}
      <div className="flex flex-wrap gap-2">
        {QUICK_RANGES.map((range) => (
          <button
            key={range.key}
            className={`px-3 py-1.5 rounded-lg transition-all text-xs font-medium ${
              rangeKey === range.key
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30'
                : 'bg-background-tertiary/80 text-text-secondary hover:text-text-primary hover:bg-background-secondary border border-border/30'
            }`}
            onClick={() => onQuick(range.key)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Custom Range */}
      <div className="flex flex-wrap items-end gap-2 p-3 bg-background-tertiary/30 rounded-lg border border-border/30 relative">
        <div className="flex-1 min-w-[130px] relative z-[1001]">
          <DateInput
            label="From Date"
            value={from ? from.slice(0, 10) : ""}
            onChange={(value) => onChangeFrom(value ? new Date(value).toISOString() : undefined)}
            placeholder="Select start date"
          />
        </div>
        <div className="flex-1 min-w-[130px] relative z-[1001]">
          <DateInput
            label="To Date"
            value={to ? to.slice(0, 10) : ""}
            onChange={(value) => onChangeTo(value ? new Date(value + "T23:59:59").toISOString() : undefined)}
            placeholder="Select end date"
          />
        </div>
        <button
          className="px-4 py-2 text-xs bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-accent/25 transition-all flex items-center gap-1.5"
          onClick={onApplyCustom}
        >
          <Check className="w-3 h-3" />
          Apply
        </button>
      </div>
    </section>
  );
}
