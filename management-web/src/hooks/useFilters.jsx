import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDateRange } from "../contexts/DateRangeContext.jsx";

const FiltersContext = createContext(null);

const DEFAULT_FILTERS = {
  employeeId: "",
  callType: "",
  status: "",
  from: "",
  to: "",
  minDuration: "",
  maxDuration: "",
  phone: "",
  q: "",
  page: 1,
  pageSize: 25,
};

export function FiltersProvider({ children }) {
  const { range } = useDateRange();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    from: range.from,
    to: range.to,
  }));

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      from: range.from,
      to: range.to,
      page: 1,
    }));
  }, [range.from, range.to]);

  const value = useMemo(
    () => ({
      filters,
      setFilter(name, nextValue) {
        setFilters((current) => ({
          ...current,
          [name]: nextValue,
          ...(name === "page" ? {} : { page: 1 }),
        }));
      },
      setFilters,
      clearFilters() {
        setFilters((current) => ({
          ...DEFAULT_FILTERS,
          from: current.from,
          to: current.to,
        }));
      },
    }),
    [filters],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const value = useContext(FiltersContext);
  if (!value) {
    throw new Error("useFilters must be used within FiltersProvider.");
  }
  return value;
}
