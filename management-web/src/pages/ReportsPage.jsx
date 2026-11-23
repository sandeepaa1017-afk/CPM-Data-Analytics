import { BarChart3, Download, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDateRange } from "../contexts/DateRangeContext.jsx";
import { useFilters } from "../hooks/useFilters.jsx";
import { getCustomers, getReport } from "../services/api.js";
import { downloadCsv } from "../utils/export.js";

const groupOptions = [
  ["day", "By day"],
  ["week", "By week"],
  ["employee", "By employee"],
];
const emptyAnalysisDraft = {
  callType: "",
  status: "",
  minDurationExclusive: "",
  maxDuration: "",
};
const numberFormat = new Intl.NumberFormat("en-IN");

function formatDuration(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatTalkTime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function formatLabel(label, groupBy) {
  if (groupBy === "employee") return label;
  const date = new Date(`${label}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? label
    : date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatCallDateTime(value) {
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SummaryCard({ label, value, note, tone }) {
  return (
    <article className={`report-summary-card ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export default function ReportsPage() {
  const { filters } = useFilters();
  const { preset } = useDateRange();
  const [groupBy, setGroupBy] = useState("day");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [report, setReport] = useState(null);
  const [analysisDraft, setAnalysisDraft] = useState(emptyAnalysisDraft);
  const [analysisFilters, setAnalysisFilters] = useState({});
  const [employeeAnalysis, setEmployeeAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisFilterError, setAnalysisFilterError] = useState("");
  const [analysisRetry, setAnalysisRetry] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await getReport({
        from: filters.from,
        to: filters.to,
        groupBy,
      });
      setReport(result);
    } catch (loadError) {
      setError(loadError.message || "Unable to load report data.");
    } finally {
      setIsLoading(false);
    }
  }, [filters.from, filters.to, groupBy]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const chartData = useMemo(
    () =>
      (report?.series || []).map((point) => ({
        ...point,
        chartLabel: formatLabel(point.label, groupBy),
        talkTimeMinutes: Math.round(point.talkTimeSec / 60),
      })),
    [report, groupBy],
  );
  const selectedEmployee =
    report?.employees.find((employee) => employee.employeeId === selectedEmployeeId) ||
    report?.employees.find((employee) => employee.totalCalls > 0) ||
    report?.employees[0];
  const analysisEmployeeId = selectedEmployee?.employeeId;

  useEffect(() => {
    if (!analysisEmployeeId) {
      setEmployeeAnalysis(null);
      return undefined;
    }

    let isCurrent = true;
    setAnalysisLoading(true);
    setAnalysisError("");
    const sharedFilters = {
      from: filters.from,
      to: filters.to,
      groupBy: "day",
      ...analysisFilters,
    };

    Promise.all([
      getReport({ ...sharedFilters, employeeId: analysisEmployeeId }),
      getReport(sharedFilters),
      getCustomers({ ...sharedFilters, employeeId: analysisEmployeeId }),
    ])
      .then(([employeeResult, teamResult, customers]) => {
        if (!isCurrent) return;
        const employee = employeeResult.employees.find(
          (item) => item.employeeId === analysisEmployeeId,
        );
        setEmployeeAnalysis({
          employee: employee ? { ...employee, customers } : null,
          teamSummary: teamResult.summary,
        });
      })
      .catch((loadError) => {
        if (isCurrent) {
          setAnalysisError(loadError.message || "Unable to load employee analysis.");
        }
      })
      .finally(() => {
        if (isCurrent) setAnalysisLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    analysisEmployeeId,
    analysisFilters,
    analysisRetry,
    filters.from,
    filters.to,
  ]);

  const employeeChartData = useMemo(
    () =>
      (employeeAnalysis?.employee?.dailySeries || []).map((point) => ({
        ...point,
        chartLabel: formatLabel(point.label, "day"),
        talkTimeMinutes: Math.round(point.talkTimeSec / 60),
      })),
    [employeeAnalysis],
  );
  const analysisEmployee = employeeAnalysis?.employee;
  const activeAnalysisFilters = [
    analysisFilters.callType && `Type: ${analysisFilters.callType}`,
    analysisFilters.status && `Status: ${analysisFilters.status}`,
    analysisFilters.minDurationExclusive !== undefined &&
      `Duration > ${analysisFilters.minDurationExclusive}s`,
    analysisFilters.maxDuration !== undefined &&
      `Duration ≤ ${analysisFilters.maxDuration}s`,
  ].filter(Boolean);

  const dateRangeLabel =
    preset === "custom" ? "Custom date and time range" : ({
      today: "Today",
      yesterday: "Yesterday",
      thisWeek: "This week",
      last7Days: "Last 7 days",
      thisMonth: "This month",
    }[preset] || "Selected date range");

  function exportReport() {
    if (!report) return;
    const columns = [
      ["employeeName", "Employee"],
      ["employeeId", "Employee ID"],
      ["totalCalls", "Total calls"],
      ["answeredCalls", "Answered calls"],
      ["unansweredCalls", "Unanswered calls"],
      ["uniqueCustomerCount", "Unique customers (phone numbers)"],
      ["dateRange", "Date range"],
    ];
    const rows = report.employees.map((employee) => ({
      ...employee,
      unansweredCalls: employee.totalCalls - employee.answeredCalls,
      dateRange: dateRangeLabel,
    }));
    downloadCsv("cpm-call-customer-summary.csv", columns, rows);
  }

  function exportEmployeeReport() {
    if (!analysisEmployee || analysisEmployee.totalCalls === 0) return;
    downloadCsv(
      `${analysisEmployee.employeeId}-custom-analysis.csv`,
      [
        ["employeeName", "Employee"],
        ["employeeId", "Employee ID"],
        ["branch", "Branch"],
        ["dateRange", "Date range"],
        ["totalCalls", "Total calls"],
        ["answeredCalls", "Answered calls"],
        ["unansweredCalls", "Unanswered calls"],
        ["answeredPercent", "Answered %"],
        ["missedCalls", "Missed calls"],
        ["rejectedCalls", "Rejected calls"],
        ["uniqueCustomerCount", "Unique customers"],
        ["repeatInteractions", "Repeat interactions"],
        ["averageInteractions", "Average interactions per customer"],
        ["averageDuration", "Average duration"],
        ["talkTime", "Talk time"],
        ["callTypeFilter", "Call type filter"],
        ["statusFilter", "Status filter"],
        ["durationLongerThanSec", "Duration longer than (sec)"],
        ["durationUpToSec", "Duration up to (sec)"],
      ],
      [{
        ...analysisEmployee,
        dateRange: dateRangeLabel,
        unansweredCalls: analysisEmployee.totalCalls - analysisEmployee.answeredCalls,
        repeatInteractions:
          analysisEmployee.totalCalls - analysisEmployee.uniqueCustomerCount,
        averageInteractions:
          analysisEmployee.uniqueCustomerCount
            ? (analysisEmployee.totalCalls / analysisEmployee.uniqueCustomerCount).toFixed(1)
            : "0.0",
        averageDuration: formatDuration(analysisEmployee.averageDurationSec),
        talkTime: formatTalkTime(analysisEmployee.talkTimeSec),
        callTypeFilter: analysisFilters.callType || "All",
        statusFilter: analysisFilters.status || "All",
        durationLongerThanSec: analysisFilters.minDurationExclusive ?? "No minimum",
        durationUpToSec: analysisFilters.maxDuration ?? "No maximum",
      }],
    );
  }

  function applyAnalysisFilters(event) {
    event.preventDefault();
    const minText = analysisDraft.minDurationExclusive.trim();
    const maxText = analysisDraft.maxDuration.trim();
    const minDurationExclusive = minText === "" ? undefined : Number(minText);
    const maxDuration = maxText === "" ? undefined : Number(maxText);
    const validDuration = (value) =>
      value === undefined || (Number.isInteger(value) && value >= 0);

    if (!validDuration(minDurationExclusive) || !validDuration(maxDuration)) {
      setAnalysisFilterError("Enter whole duration values of 0 seconds or more.");
      return;
    }
    if (
      minDurationExclusive !== undefined &&
      maxDuration !== undefined &&
      maxDuration <= minDurationExclusive
    ) {
      setAnalysisFilterError("The maximum duration must be greater than the minimum.");
      return;
    }

    setAnalysisFilterError("");
    setAnalysisFilters({
      callType: analysisDraft.callType,
      status: analysisDraft.status,
      minDurationExclusive,
      maxDuration,
    });
  }

  function resetAnalysisFilters() {
    setAnalysisDraft(emptyAnalysisDraft);
    setAnalysisFilters({});
    setAnalysisFilterError("");
  }

  if (isLoading) {
    return <section className="page-section"><div className="page-state" role="status">Loading report…</div></section>;
  }

  if (error) {
    return (
      <section className="page-section">
        <div className="page-state page-state-error" role="alert">
          <strong>Couldn’t load the report</strong>
          <span>{error}</span>
          <button type="button" className="secondary-action" onClick={loadReport}>Try again</button>
        </div>
      </section>
    );
  }

  if (!report || report.summary.totalCalls === 0) {
    return (
      <section className="page-section data-page">
        <div className="data-page-heading">
          <div>
            <span className="eyebrow">TEAM PERFORMANCE</span>
            <h1>Reports</h1>
            <p>{dateRangeLabel} · Date range is shared with the header picker.</p>
          </div>
        </div>
        <div className="page-state">
          <strong>No calls in this date range</strong>
          <span>Choose another range using the date picker in the header.</span>
        </div>
      </section>
    );
  }

  const stats = report.summary;

  return (
    <section className="page-section data-page reports-page">
      <div className="data-page-heading">
        <div>
          <span className="eyebrow">TEAM PERFORMANCE</span>
          <h1>Reports</h1>
          <p>{dateRangeLabel} · Date range is shared with the header picker.</p>
        </div>
        <div className="report-actions no-print">
          <button type="button" className="secondary-action" onClick={() => window.print()}>
            <FileText size={15} /> Download PDF
          </button>
          <button type="button" className="primary-action" onClick={exportReport}>
            <Download size={15} /> Employee call summary CSV
          </button>
        </div>
      </div>

      <div className="report-summary-grid">
        <SummaryCard label="Total calls" value={numberFormat.format(stats.totalCalls)} note="Calls in selected range" />
        <SummaryCard label="Answered" value={`${stats.answeredPercent}%`} note={`${numberFormat.format(stats.answeredCalls)} answered calls`} tone="summary-cyan" />
        <SummaryCard label="Average duration" value={formatDuration(stats.averageDurationSec)} note="Per answered call" tone="summary-blue" />
        <SummaryCard label="Talk time" value={formatTalkTime(stats.talkTimeSec)} note="Across all employees" tone="summary-slate" />
      </div>

      <section className="report-chart-panel">
        <div className="report-chart-toolbar">
          <div>
            <h2>Call performance</h2>
            <p>Group activity by day, week, or employee.</p>
          </div>
          <label className="report-group-control no-print">
            <span>Group by</span>
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              {groupOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-charts-grid">
          <section className="report-chart-card">
            <h3>Total calls</h3>
            <div className="report-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid stroke="#edf0f5" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="chartLabel" axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                  <Tooltip contentStyle={{ border: "1px solid #e6eaf1", borderRadius: 9, fontSize: 11 }} />
                  <Bar dataKey="totalCalls" name="Calls" fill="#1e2470" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="report-chart-card">
            <h3>Talk time</h3>
            <div className="report-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid stroke="#edf0f5" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="chartLabel" axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                  <Tooltip contentStyle={{ border: "1px solid #e6eaf1", borderRadius: 9, fontSize: 11 }} />
                  <Area type="monotone" dataKey="talkTimeMinutes" name="Minutes" stroke="#02a8f2" strokeWidth={2.5} fill="#eaf7fe" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </section>

      <section className="report-chart-panel employee-analysis-panel">
        <div className="report-chart-toolbar employee-analysis-toolbar">
          <div>
            <span className="eyebrow">INDIVIDUAL ANALYSIS</span>
            <h2>{selectedEmployee?.employeeName || "Employee report"}</h2>
            <p>
              {selectedEmployee
                ? `${selectedEmployee.role} · ${selectedEmployee.branch} · ${dateRangeLabel}`
                : "Choose an employee to view their performance."}
            </p>
          </div>
          <div className="employee-analysis-controls no-print">
            <label className="report-group-control">
              <span>Employee</span>
              <select
                aria-label="Employee analysis"
                value={selectedEmployee?.employeeId || ""}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
              >
                {report.employees.map((employee) => (
                  <option key={employee.employeeId} value={employee.employeeId}>
                    {employee.employeeName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary-action"
              onClick={exportEmployeeReport}
              disabled={!analysisEmployee || analysisEmployee.totalCalls === 0 || analysisLoading}
            >
              <Download size={14} /> Custom analysis CSV
            </button>
          </div>
        </div>

        <form className="employee-analysis-filters no-print" onSubmit={applyAnalysisFilters}>
          <div className="analysis-filter-grid">
            <label>
              <span>Call type</span>
              <select
                value={analysisDraft.callType}
                onChange={(event) =>
                  setAnalysisDraft({ ...analysisDraft, callType: event.target.value })
                }
              >
                <option value="">All call types</option>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
                <option value="missed">Missed</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label>
              <span>Call status</span>
              <select
                value={analysisDraft.status}
                onChange={(event) =>
                  setAnalysisDraft({ ...analysisDraft, status: event.target.value })
                }
              >
                <option value="">All statuses</option>
                <option value="answered">Answered</option>
                <option value="missed">Missed / rejected</option>
              </select>
            </label>
            <label>
              <span>Duration longer than (sec)</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 60"
                value={analysisDraft.minDurationExclusive}
                onChange={(event) =>
                  setAnalysisDraft({
                    ...analysisDraft,
                    minDurationExclusive: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Duration up to (sec)</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="No maximum"
                value={analysisDraft.maxDuration}
                onChange={(event) =>
                  setAnalysisDraft({
                    ...analysisDraft,
                    maxDuration: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <div className="analysis-filter-footer">
            <span>Both sections use these filters; customer totals group matching calls by phone number.</span>
            <div>
              <button type="button" className="secondary-action" onClick={resetAnalysisFilters}>
                Reset
              </button>
              <button type="submit" className="primary-action">Apply analysis</button>
            </div>
          </div>
          {analysisFilterError && (
            <p className="analysis-filter-error" role="alert">{analysisFilterError}</p>
          )}
          {activeAnalysisFilters.length > 0 && (
            <div className="analysis-filter-chips" aria-label="Applied analysis filters">
              {activeAnalysisFilters.map((filter) => (
                <span key={filter}>{filter}</span>
              ))}
            </div>
          )}
        </form>

        {analysisLoading ? (
          <div className="page-state" role="status">Applying filters to employee calls…</div>
        ) : analysisError ? (
          <div className="page-state page-state-error" role="alert">
            <strong>Couldn’t load employee analysis</strong>
            <span>{analysisError}</span>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setAnalysisRetry((retry) => retry + 1)}
            >
              Try again
            </button>
          </div>
        ) : !analysisEmployee || analysisEmployee.totalCalls === 0 ? (
          <div className="page-state employee-analysis-empty">
            <strong>No calls match these analysis settings</strong>
            <span>Adjust the filters or choose another employee or date range.</span>
          </div>
        ) : (
          <>
            <section className="employee-analysis-block">
              <div className="analysis-section-heading">
                <h3>Call analysis</h3>
                <span>Each call that matches the selected criteria is counted individually.</span>
              </div>
            <div className="report-summary-grid employee-analysis-summary">
              <SummaryCard
                label="Total calls"
                value={numberFormat.format(analysisEmployee.totalCalls)}
                note="Calls matching these filters"
              />
              <SummaryCard
                label="Answered"
                value={`${analysisEmployee.answeredPercent}%`}
                note={`${analysisEmployee.answeredCalls} answered calls`}
                tone="summary-cyan"
              />
              <SummaryCard
                label="Missed / rejected"
                value={numberFormat.format(analysisEmployee.missedCalls + analysisEmployee.rejectedCalls)}
                note={`${analysisEmployee.missedCalls} missed · ${analysisEmployee.rejectedCalls} rejected`}
              />
              <SummaryCard
                label="Average duration"
                value={formatDuration(analysisEmployee.averageDurationSec)}
                note="Per answered call"
                tone="summary-blue"
              />
              <SummaryCard
                label="Talk time"
                value={formatTalkTime(analysisEmployee.talkTimeSec)}
                note="Answered calls"
                tone="summary-slate"
              />
            </div>

            <div className="report-charts-grid employee-analysis-charts">
              <section className="report-chart-card">
                <h3>Daily call activity</h3>
                <div className="report-chart-area">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={employeeChartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                      <CartesianGrid stroke="#edf0f5" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="chartLabel" axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                      <Tooltip contentStyle={{ border: "1px solid #e6eaf1", borderRadius: 9, fontSize: 11 }} />
                      <Bar dataKey="totalCalls" name="Calls" fill="#1e2470" radius={[4, 4, 0, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="report-chart-card">
                <h3>Calls by type</h3>
                <div className="report-chart-area">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysisEmployee.callTypeBreakdown} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke="#edf0f5" strokeDasharray="3 5" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" width={58} axisLine={false} tickLine={false} tick={{ fill: "#858da0", fontSize: 10 }} />
                      <Tooltip contentStyle={{ border: "1px solid #e6eaf1", borderRadius: 9, fontSize: 11 }} />
                      <Bar dataKey="totalCalls" name="Calls" fill="#02a8f2" radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <div className="employee-analysis-insights">
              <article>
                <span>Answer rate vs. team</span>
                <strong>
                  {analysisEmployee.answeredPercent === employeeAnalysis.teamSummary.answeredPercent
                    ? "Matches team average"
                    : `${Math.abs(analysisEmployee.answeredPercent - employeeAnalysis.teamSummary.answeredPercent)} pts ${
                        analysisEmployee.answeredPercent > employeeAnalysis.teamSummary.answeredPercent ? "above" : "below"
                      } team average`}
                </strong>
              </article>
              <article>
                <span>Busiest day</span>
                <strong>
                  {employeeChartData.reduce(
                    (busiest, day) => (day.totalCalls > (busiest?.totalCalls || 0) ? day : busiest),
                    null,
                  )?.chartLabel || "No activity"}
                </strong>
              </article>
              <article>
                <span>Most common call type</span>
                <strong>
                  {[...analysisEmployee.callTypeBreakdown]
                    .filter((callType) => callType.totalCalls > 0)
                    .sort((a, b) => b.totalCalls - a.totalCalls)[0]?.label || "No calls"}
                </strong>
              </article>
            </div>
            </section>

            <section className="employee-customer-analysis">
              <div className="analysis-section-heading">
                <div>
                  <h3>Customer analysis</h3>
                  <p>
                    Each unique phone number represents one customer, regardless of repeat calls.
                  </p>
                </div>
              </div>
              <div className="report-summary-grid employee-customer-summary">
                <SummaryCard
                  label="Unique customers"
                  value={numberFormat.format(analysisEmployee.uniqueCustomerCount)}
                  note="Distinct phone numbers"
                  tone="summary-cyan"
                />
                <SummaryCard
                  label="Avg. interactions per customer"
                  value={(analysisEmployee.totalCalls / analysisEmployee.uniqueCustomerCount).toFixed(1)}
                  note="Matching calls ÷ unique customers"
                />
                <SummaryCard
                  label="Repeat interactions"
                  value={numberFormat.format(analysisEmployee.totalCalls - analysisEmployee.uniqueCustomerCount)}
                  note="Calls after the first per number"
                />
              </div>
              <section className="records-card report-performance-card customer-analysis-card">
                <div className="employee-history-heading">
                  <div>
                    <h2>Customer details</h2>
                    <p>
                      {numberFormat.format(analysisEmployee.uniqueCustomerCount)} customer records · phone number is the primary key
                    </p>
                  </div>
                </div>
                  <div className="table-scroll">
                    <table className="data-table report-table customer-analysis-table">
                      <thead>
                        <tr>
                          <th>Customer ID</th>
                          <th>Phone number (primary)</th>
                          <th>Call interactions</th>
                          <th>Answered</th>
                          <th>Missed / rejected</th>
                          <th>Talk time</th>
                          <th>Last contacted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisEmployee.customers.map((customer) => (
                          <tr key={customer.phone.replace(/\D/g, "")}>
                            <td>{customer.customerId}</td>
                            <td>{customer.phone}</td>
                            <td>{numberFormat.format(customer.interactionCount)}</td>
                            <td>{numberFormat.format(customer.answeredCalls)}</td>
                            <td>{numberFormat.format(customer.missedCalls + customer.rejectedCalls)}</td>
                            <td>{formatTalkTime(customer.talkTimeSec)}</td>
                            <td>{formatCallDateTime(customer.lastCallAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="customer-data-note">
                    One row represents one phone number. Repeated calls stay in call analysis but are combined here as customer interactions.
                  </p>
              </section>
            </section>
          </>
        )}
      </section>

      <section className="records-card report-performance-card">
        <div className="employee-history-heading">
          <div>
            <h2>Call summary by employee</h2>
            <p>One row per employee · customers are counted by unique phone number</p>
          </div>
          <BarChart3 size={18} className="report-table-icon" />
        </div>
        <div className="table-scroll">
          <table className="data-table report-table employee-call-summary-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Total calls</th>
                <th>Answered calls</th>
                <th>Unanswered calls</th>
                <th>Unique customers</th>
                <th>Answered rate</th>
                <th>Avg. duration</th>
                <th>Talk time</th>
              </tr>
            </thead>
            <tbody>
              {report.employees.map((employee) => (
                <tr key={employee.employeeId}>
                  <td>
                    <span className="table-primary">{employee.employeeName}</span>
                    <span className="table-secondary">{employee.employeeId}</span>
                  </td>
                  <td>{numberFormat.format(employee.totalCalls)}</td>
                  <td>{numberFormat.format(employee.answeredCalls)}</td>
                  <td>{numberFormat.format(employee.totalCalls - employee.answeredCalls)}</td>
                  <td>{numberFormat.format(employee.uniqueCustomerCount)}</td>
                  <td>
                    <span className="answer-rate-cell">{employee.answeredPercent}%</span>
                    <span className="answer-rate-track"><i style={{ width: `${employee.answeredPercent}%` }} /></span>
                  </td>
                  <td>{formatDuration(employee.averageDurationSec)}</td>
                  <td>{formatTalkTime(employee.talkTimeSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="dashboard-footnote">
        <span className="status-dot" />
        Report data is read from the CPM backend
      </div>
    </section>
  );
}
