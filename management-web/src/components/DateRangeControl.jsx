import { CalendarDays } from "lucide-react";
import { useDateRange } from "../contexts/DateRangeContext.jsx";

const presets = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["thisWeek", "This week"],
  ["last7Days", "Last 7 days"],
  ["thisMonth", "This month"],
  ["custom", "Custom range"],
];

export default function DateRangeControl() {
  const { preset, range, setPreset, setCustomRange } = useDateRange();

  return (
    <div className={`date-range-control${preset === "custom" ? " is-custom" : ""}`}>
      <CalendarDays size={16} aria-hidden="true" />
      <label className="visually-hidden" htmlFor="global-date-range">
        Global date range
      </label>
      <select
        id="global-date-range"
        value={preset}
        onChange={(event) => setPreset(event.target.value)}
      >
        {presets.map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
      {preset === "custom" && (
        <div className="date-range-custom-fields">
          <label>
            <span className="visually-hidden">From date and time</span>
            <input
              type="datetime-local"
              value={range.from}
              onChange={(event) => setCustomRange({ from: event.target.value })}
            />
          </label>
          <span className="date-range-separator">to</span>
          <label>
            <span className="visually-hidden">To date and time</span>
            <input
              type="datetime-local"
              value={range.to}
              onChange={(event) => setCustomRange({ to: event.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
