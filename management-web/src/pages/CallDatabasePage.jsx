import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  exportCalls,
  getCalls,
  getEmployees,
} from "../services/api.js";
import { useDateRange } from "../contexts/DateRangeContext.jsx";
import { useFilters } from "../hooks/useFilters.jsx";

const callTypes = ["incoming", "outgoing", "missed", "rejected"];
const statuses = ["answered", "missed"];
const numberFormat = new Intl.NumberFormat("en-IN");

const columns = [
  ["employeeName", "Employee"],
  ["phone", "Phone number"],
  ["callType", "Call type"],
  ["status", "Status"],
  ["durationSec", "Duration"],
  ["dateTime", "Date & time"],
];

function formatCallType(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SortButton({ label, column, sortBy, sortDirection, onSort }) {
  const active = sortBy === column;
  const SortIcon = active
    ? sortDirection === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;
  return (
    <button
      className="table-sort-button"
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}${active ? ` ${sortDirection}ending` : ""}`}
    >
      {label}
      <SortIcon size={13} aria-hidden="true" />
    </button>
  );
}

export default function CallDatabasePage() {
  const { filters, setFilter, clearFilters } = useFilters();
  const { preset, setPreset } = useDateRange();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("dateTime");
  const [sortDirection, setSortDirection] = useState("desc");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const query = {
        ...filters,
        page: filters.page,
        pageSize: filters.pageSize,
        sortBy,
        order: sortDirection,
      };
      const [calls, employeeList] = await Promise.all([
        getCalls(query),
        getEmployees(),
      ]);
      setRecords(calls.items);
      setTotal(calls.total);
      setEmployees(employeeList);
    } catch (loadError) {
      setError(loadError.message || "Unable to load call records.");
    } finally {
      setIsLoading(false);
    }
  }, [
    filters.employeeId,
    filters.callType,
    filters.status,
    filters.from,
    filters.to,
    filters.minDuration,
    filters.maxDuration,
    filters.phone,
    filters.q,
    filters.page,
    filters.pageSize,
    sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pageSize = Number(filters.pageSize) || 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Number(filters.page) || 1, pageCount);
  const visibleRecords = records;

  function sortRecords(column) {
    setFilter("page", 1);
    if (sortBy === column) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection(column === "dateTime" ? "desc" : "asc");
    }
  }

  async function exportFilteredCalls() {
    try {
      const blob = await exportCalls({
        ...filters,
        sortBy,
        order: sortDirection,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cpm-call-records.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message || "Unable to export call records.");
    }
  }

  function clearAll() {
    clearFilters();
    if (preset === "custom") setPreset("last7Days");
  }

  const activeChips = [
    filters.q && {
      label: `Search: ${filters.q}`,
      clear: () => setFilter("q", ""),
    },
    filters.employeeId && {
      label: `Employee: ${employees.find((employee) => employee.id === filters.employeeId)?.name || filters.employeeId}`,
      clear: () => setFilter("employeeId", ""),
    },
    filters.callType && {
      label: `Type: ${formatCallType(filters.callType)}`,
      clear: () => setFilter("callType", ""),
    },
    filters.status && {
      label: `Status: ${formatCallType(filters.status)}`,
      clear: () => setFilter("status", ""),
    },
    filters.phone && {
      label: `Phone: ${filters.phone}`,
      clear: () => setFilter("phone", ""),
    },
    (filters.minDuration !== "" || filters.maxDuration !== "") && {
      label: `Duration: ${filters.minDuration || "0"}–${filters.maxDuration || "∞"} sec`,
      clear: () => {
        setFilter("minDuration", "");
        setFilter("maxDuration", "");
      },
    },
    preset === "custom" && {
      label: "Custom date range",
      clear: () => setPreset("last7Days"),
    },
  ].filter(Boolean);

  return (
    <section className="page-section data-page">
      <div className="data-page-heading">
        <div>
          <span className="eyebrow">EMPLOYEE CALL ACTIVITY</span>
          <h1>Call database</h1>
          <p>Search, filter, and export synced call records.</p>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={exportFilteredCalls}
          disabled={isLoading || records.length === 0}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <section className="filter-panel" aria-label="Call filters">
        <div className="filter-panel-heading">
          <div className="filter-panel-title">
            <SlidersHorizontal size={16} />
            <strong>Filters</strong>
          </div>
          <span className="filter-period-note">Date range is shared with the header</span>
        </div>
        <div className="call-filter-grid">
          <label className="search-field">
            <span className="visually-hidden">Search calls by employee or phone</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search employee or phone"
              value={filters.q}
              onChange={(event) => setFilter("q", event.target.value)}
            />
          </label>
          <label className="filter-control">
            <span className="visually-hidden">Employee</span>
            <select
              value={filters.employeeId}
              onChange={(event) => setFilter("employeeId", event.target.value)}
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span className="visually-hidden">Call type</span>
            <select
              value={filters.callType}
              onChange={(event) => setFilter("callType", event.target.value)}
            >
              <option value="">All call types</option>
              {callTypes.map((type) => (
                <option key={type} value={type}>{formatCallType(type)}</option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span className="visually-hidden">Call status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{formatCallType(status)}</option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span className="visually-hidden">Filter by phone number</span>
            <input
              type="search"
              placeholder="Phone number"
              value={filters.phone}
              onChange={(event) => setFilter("phone", event.target.value)}
            />
          </label>
          <label className="filter-control duration-control">
            <span className="visually-hidden">Minimum duration in seconds</span>
            <input
              type="number"
              min="0"
              placeholder="Min sec"
              value={filters.minDuration}
              onChange={(event) => setFilter("minDuration", event.target.value)}
            />
          </label>
          <label className="filter-control duration-control">
            <span className="visually-hidden">Maximum duration in seconds</span>
            <input
              type="number"
              min="0"
              placeholder="Max sec"
              value={filters.maxDuration}
              onChange={(event) => setFilter("maxDuration", event.target.value)}
            />
          </label>
        </div>

        {(activeChips.length > 0 || total > 0) && (
          <div className="active-filter-row">
            <div className="active-filter-chips">
              {activeChips.map((chip) => (
                <button
                  type="button"
                  className="filter-chip"
                  key={chip.label}
                  onClick={chip.clear}
                >
                  {chip.label}
                  <X size={12} />
                </button>
              ))}
            </div>
            <button type="button" className="clear-filters-button" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="page-state" role="status">Loading call records…</div>
      ) : error ? (
        <div className="page-state page-state-error" role="alert">
          <strong>Couldn’t load call records</strong>
          <span>{error}</span>
          <button type="button" className="secondary-action" onClick={loadData}>
            Try again
          </button>
        </div>
      ) : total === 0 ? (
        <div className="page-state">
          <strong>No calls match these filters</strong>
          <span>Try changing a filter or clearing the search.</span>
        </div>
      ) : (
        <section className="records-card" aria-label="Synced call records">
          <div className="records-toolbar">
            <span><strong>{numberFormat.format(total)}</strong> records found</span>
            <label className="page-size-control">
              Rows
              <select
                value={pageSize}
                onChange={(event) => setFilter("pageSize", Number(event.target.value))}
              >
                {[10, 25, 50].map((size) => (
                  <option value={size} key={size}>{size}</option>
                ))}
              </select>
              per page
            </label>
          </div>
          <div className="table-scroll">
            <table className="data-table call-table">
              <thead>
                <tr>
                  {columns.map(([key, label]) => (
                    <th key={key} aria-sort={
                      sortBy === key
                        ? sortDirection === "asc" ? "ascending" : "descending"
                        : "none"
                    }>
                      <SortButton
                        label={label}
                        column={key}
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={sortRecords}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((call) => (
                  <tr key={call.id}>
                    <td>
                      <span className="table-primary">{call.employeeName}</span>
                      <span className="table-secondary">{call.employeeId}</span>
                    </td>
                    <td>{call.phone}</td>
                    <td><span className={`call-type-badge type-${call.callType}`}>{formatCallType(call.callType)}</span></td>
                    <td><span className={`status-badge status-${call.status}`}>{formatCallType(call.status)}</span></td>
                    <td>{formatDuration(call.durationSec)}</td>
                    <td>{formatDateTime(call.dateTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-row">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, total)}–
              {Math.min(currentPage * pageSize, total)} of {numberFormat.format(total)}
            </span>
            <div className="pagination-controls">
              <button
                className="pagination-button"
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setFilter("page", currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>Page {currentPage} of {pageCount}</span>
              <button
                className="pagination-button"
                type="button"
                aria-label="Next page"
                disabled={currentPage >= pageCount}
                onClick={() => setFilter("page", currentPage + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
