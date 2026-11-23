import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getCallStats,
  getReport,
} from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useFilters } from "../hooks/useFilters.jsx";

const PIE_COLORS = ["#1e2470", "#02a8f2", "#a9d8f2", "#c5cad7"];
const numberFormat = new Intl.NumberFormat("en-IN");

function formatTalkTime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function formatDay(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function MetricCard({ label, value, note, icon: Icon, tone }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-card-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
        </span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`chart-card ${className}`.trim()}>
      <div className="chart-card-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ChartLoading() {
  return (
    <div className="dashboard-state" role="status">
      <span className="dashboard-spinner" />
      <span>Loading call activity…</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { filters } = useFilters();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const reportFilters = { from: filters.from, to: filters.to };
      const [stats, report] = await Promise.all([
        getCallStats(reportFilters),
        getReport({ ...reportFilters, groupBy: "day" }),
      ]);
      setDashboard({ stats, report });
    } catch (loadError) {
      setError(loadError.message || "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [filters.from, filters.to]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const callTypeData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.stats.callTypeBreakdown
      .map((item) => ({
        name: item.callType[0].toUpperCase() + item.callType.slice(1),
        value: item.totalCalls,
      }))
      .filter((item) => item.value > 0);
  }, [dashboard]);

  const employeeData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.stats.topEmployees.map((employee) => ({
      name: employee.employeeName.split(" ")[0],
      calls: employee.calls,
    }));
  }, [dashboard]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, []);

  if (isLoading) {
    return (
      <section className="page-section dashboard-page">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">EMPLOYEE CALL ACTIVITY</span>
            <h1>{greeting}, {user?.name?.split(" ")[0] || "there"}</h1>
          </div>
        </div>
        <ChartLoading />
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-section dashboard-page">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">EMPLOYEE CALL ACTIVITY</span>
            <h1>{greeting}, {user?.name?.split(" ")[0] || "there"}</h1>
          </div>
        </div>
        <div className="dashboard-message dashboard-error" role="alert">
          <h2>We couldn’t load the dashboard</h2>
          <p>{error}</p>
          <button type="button" className="retry-button" onClick={loadDashboard}>
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!dashboard || dashboard.stats.totalCalls === 0) {
    return (
      <section className="page-section dashboard-page">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">EMPLOYEE CALL ACTIVITY</span>
            <h1>{greeting}, {user?.name?.split(" ")[0] || "there"}</h1>
            <p>Here’s the latest activity across your team.</p>
          </div>
        </div>
        <div className="dashboard-message">
          <div className="empty-chart-icon"><Phone size={20} /></div>
          <h2>No calls in this date range</h2>
          <p>Choose another date range to see synced employee call activity.</p>
        </div>
      </section>
    );
  }

  const { stats, report } = dashboard;
  const chartSeries = report.series.map((point) => ({
    ...point,
    label: formatDay(point.label),
  }));

  return (
    <section className="page-section dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">EMPLOYEE CALL ACTIVITY</span>
          <h1>{greeting}, {user?.name?.split(" ")[0] || "there"}</h1>
          <p>Here’s the latest activity across your team.</p>
        </div>
        <div className="dashboard-live-status">
          <span className="status-dot" />
          Live API
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Total calls"
          value={numberFormat.format(stats.totalCalls)}
          note="In the selected period"
          icon={Phone}
          tone="navy"
        />
        <MetricCard
          label="Incoming"
          value={numberFormat.format(stats.incomingCalls)}
          note="Calls received"
          icon={ArrowDownLeft}
          tone="cyan"
        />
        <MetricCard
          label="Outgoing"
          value={numberFormat.format(stats.outgoingCalls)}
          note="Calls placed"
          icon={ArrowUpRight}
          tone="blue"
        />
        <MetricCard
          label="Missed"
          value={numberFormat.format(stats.missedCalls)}
          note="Needs follow-up"
          icon={Phone}
          tone="amber"
        />
        <MetricCard
          label="Talk time"
          value={formatTalkTime(stats.talkTimeSec)}
          note="Answered calls"
          icon={Clock3}
          tone="slate"
        />
      </div>

      <div className="dashboard-chart-grid">
        <ChartCard
          title="Call activity"
          subtitle="Calls by day in the selected date range"
          className="trend-chart-card"
        >
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="callTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#02a8f2" stopOpacity={0.2} />
                    <stop offset="92%" stopColor="#02a8f2" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0f5" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#858da0", fontSize: 10 }}
                  dy={8}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#858da0", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e6eaf1",
                    borderRadius: 9,
                    boxShadow: "0 8px 24px rgb(22 37 74 / 10%)",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalCalls"
                  name="Calls"
                  stroke="#02a8f2"
                  strokeWidth={2.5}
                  fill="url(#callTrendFill)"
                  activeDot={{ r: 4, fill: "#1e2470", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Call types"
          subtitle="Distribution of call activity"
          className="type-chart-card"
        >
          <div className="chart-area pie-chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={callTypeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {callTypeData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e6eaf1",
                    borderRadius: 9,
                    fontSize: 11,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-total">
              <strong>{numberFormat.format(stats.totalCalls)}</strong>
              <span>calls</span>
            </div>
          </div>
          <div className="chart-legend">
            {callTypeData.map((item, index) => (
              <span className="chart-legend-item" key={item.name}>
                <i style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                {item.name}
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Top employees"
          subtitle="Call volume by employee"
          className="employee-chart-card"
        >
          {employeeData.length ? (
            <div className="chart-area employee-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={employeeData}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="#edf0f5" strokeDasharray="3 5" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#858da0", fontSize: 10 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={58}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#626a80", fontSize: 10 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f4f7fb" }}
                    contentStyle={{
                      border: "1px solid #e6eaf1",
                      borderRadius: 9,
                      fontSize: 11,
                    }}
                  />
                  <Bar
                    dataKey="calls"
                    name="Calls"
                    fill="#1e2470"
                    radius={[0, 5, 5, 0]}
                    barSize={15}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-no-data">
              <BarChart3 size={20} />
              <span>No employee activity in this range</span>
            </div>
          )}
        </ChartCard>
      </div>
      <div className="dashboard-footnote">
        <span className="status-dot" />
        Displaying call data from the CPM backend
      </div>
    </section>
  );
}
