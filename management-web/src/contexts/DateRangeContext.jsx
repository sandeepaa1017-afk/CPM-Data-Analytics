import { createContext, useContext, useMemo, useState } from "react";

function toLocalDateTime(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 0, 0);
  return value;
}

function getPresetRange(preset) {
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: toLocalDateTime(yesterday), to: toLocalDateTime(endOfDay(yesterday)) };
    }
    case "thisWeek": {
      const monday = new Date(today);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      return { from: toLocalDateTime(monday), to: toLocalDateTime(now) };
    }
    case "last7Days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: toLocalDateTime(start), to: toLocalDateTime(now) };
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toLocalDateTime(start), to: toLocalDateTime(now) };
    }
    case "today":
    default:
      return { from: toLocalDateTime(today), to: toLocalDateTime(now) };
  }
}

const DateRangeContext = createContext(null);

export function DateRangeProvider({ children }) {
  const [preset, setPresetValue] = useState("last7Days");
  const [range, setRange] = useState(() => getPresetRange("last7Days"));

  function setPreset(nextPreset) {
    setPresetValue(nextPreset);
    if (nextPreset !== "custom") {
      setRange(getPresetRange(nextPreset));
    }
  }

  function setCustomRange(nextRange) {
    setPresetValue("custom");
    setRange((current) => ({ ...current, ...nextRange }));
  }

  const value = useMemo(
    () => ({ preset, range, setPreset, setCustomRange }),
    [preset, range],
  );
  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const value = useContext(DateRangeContext);
  if (!value) {
    throw new Error("useDateRange must be used within DateRangeProvider.");
  }
  return value;
}
