export type RangeKey =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "all_time"
  | "custom";

export default function DateRangePicker({
  rangeKey,
  onQuick,
  onApplyCustom,
  from,
  to,
  setFrom,
  setTo,
}: {
  rangeKey: RangeKey;
  onQuick: (k: RangeKey) => void;
  onApplyCustom: () => void;
  from?: string;
  to?: string;
  setFrom: (v: string | undefined) => void;
  setTo: (v: string | undefined) => void;
}) {
  return (
    <section className="range-toolbar">
      <div className="quick-row">
        <button
          className={`quick ${rangeKey === "this_week" ? "active" : ""}`}
          onClick={() => onQuick("this_week")}
        >
          This Week
        </button>
        <button
          className={`quick ${rangeKey === "last_week" ? "active" : ""}`}
          onClick={() => onQuick("last_week")}
        >
          Last Week
        </button>
        <button
          className={`quick ${rangeKey === "this_month" ? "active" : ""}`}
          onClick={() => onQuick("this_month")}
        >
          This Month
        </button>
        <button
          className={`quick ${rangeKey === "last_month" ? "active" : ""}`}
          onClick={() => onQuick("last_month")}
        >
          Last Month
        </button>
        <button
          className={`quick ${rangeKey === "all_time" ? "active" : ""}`}
          onClick={() => onQuick("all_time")}
        >
          All Time
        </button>
      </div>

      <div className="custom-row">
        <label htmlFor="from-date">From</label>
        <input
          id="from-date"
          type="date"
          className="date-input"
          value={from ? from.slice(0, 10) : ""}
          onChange={(e) =>
            setFrom(
              e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined
            )
          }
        />
        <label htmlFor="to-date">To</label>
        <input
          id="to-date"
          type="date"
          className="date-input"
          value={to ? to.slice(0, 10) : ""}
          onChange={(e) =>
            setTo(
              e.target.value
                ? new Date(e.target.value + "T23:59:59").toISOString()
                : undefined
            )
          }
        />
        <button className="btn btn-primary small" onClick={onApplyCustom}>
          Apply
        </button>
      </div>
    </section>
  );
}
