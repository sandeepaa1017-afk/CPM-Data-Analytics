import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getCalls,
  getEmployees,
  saveEmployee,
  setEmployeeActive,
} from "../services/api.js";
import { useFilters } from "../hooks/useFilters.jsx";

const numberFormat = new Intl.NumberFormat("en-IN");

function formatDuration(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function EmployeeForm({ employee, onClose, onSave }) {
  const [values, setValues] = useState({
    name: employee?.name || "",
    role: employee?.role || "Sales Executive",
    branch: employee?.branch || "",
    phone: employee?.phone || "",
    email: employee?.email || "",
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (Object.values(values).some((value) => !value.trim())) {
      setError("Complete all fields before saving.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError("Enter a valid work email address.");
      return;
    }
    if ((!username && password) || (username && !password)) {
      setError("Provide both a username and password to create an employee login.");
      return;
    }
    if (password && password.length < 8) {
      setError("Employee passwords must be at least 8 characters.");
      return;
    }
    try {
      await onSave({
        ...employee,
        ...values,
        name: values.name.trim(),
        email: values.email.trim(),
        ...(username ? { username: username.trim(), password } : {}),
      });
    } catch (saveError) {
      setError(saveError.message || "Unable to save this employee.");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="employee-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-form-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{employee ? "TEAM DIRECTORY" : "NEW TEAM MEMBER"}</span>
            <h2 id="employee-form-title">{employee ? "Edit employee" : "Add employee"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <form className="employee-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input name="name" value={values.name} onChange={updateField} autoFocus />
          </label>
          <label>
            Role
            <select name="role" value={values.role} onChange={updateField}>
              <option>Sales Executive</option>
              <option>Sales Manager</option>
              <option>Branch Manager</option>
              <option>Operations Executive</option>
            </select>
          </label>
          <label>
            Branch
            <input name="branch" value={values.branch} onChange={updateField} />
          </label>
          <label>
            Phone number
            <input name="phone" type="tel" value={values.phone} onChange={updateField} />
          </label>
          <label className="employee-form-wide">
            Work email
            <input name="email" type="email" value={values.email} onChange={updateField} />
          </label>
          {!employee && (
            <>
              <label>
                Login username (optional)
                <input
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label>
                Temporary password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions employee-form-wide">
            <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-action">
              {employee ? "Save changes" : "Add employee"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EmployeeDetail({ employee, calls, onEdit, onToggleActive, canManage }) {
  const answered = calls.filter((call) => call.status === "answered");
  const talkTime = answered.reduce((sum, call) => sum + call.durationSec, 0);
  const answerRate = calls.length ? Math.round((answered.length / calls.length) * 100) : 0;
  const averageDuration = answered.length ? Math.round(talkTime / answered.length) : 0;

  return (
    <div className="employee-detail">
      <Link className="back-link" to="/employees"><ArrowLeft size={16} /> All employees</Link>
      <div className="employee-profile-card">
        <div className="employee-profile-main">
          <div className="employee-avatar employee-avatar-large">{initials(employee.name)}</div>
          <div className="employee-profile-copy">
            <span className="eyebrow">EMPLOYEE PROFILE · {employee.id}</span>
            <h2>{employee.name}</h2>
            <p>{employee.role} <span>·</span> {employee.branch}</p>
            <div className="employee-contact-line">
              <span>{employee.email}</span>
              <span>{employee.phone}</span>
            </div>
          </div>
        </div>
        <div className="employee-profile-actions">
          <span className={`employee-status ${employee.active ? "is-active" : "is-inactive"}`}>
            {employee.active ? "Active" : "Inactive"}
          </span>
          {canManage && (
            <>
              <button type="button" className="secondary-action" onClick={onEdit}>
                <Edit3 size={15} /> Edit
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => onToggleActive(employee)}
              >
                {employee.active ? "Deactivate" : "Activate"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="employee-stat-grid">
        <article className="employee-stat-card"><span>Total calls</span><strong>{numberFormat.format(calls.length)}</strong></article>
        <article className="employee-stat-card"><span>Answered</span><strong>{answerRate}%</strong></article>
        <article className="employee-stat-card"><span>Average duration</span><strong>{formatDuration(averageDuration)}</strong></article>
        <article className="employee-stat-card"><span>Talk time</span><strong>{formatDuration(talkTime)}</strong></article>
      </div>

      <section className="records-card employee-call-history">
        <div className="employee-history-heading">
          <div>
            <h2>Call history</h2>
            <p>Records in the selected global date range</p>
          </div>
          <span className="history-count">{numberFormat.format(calls.length)} calls</span>
        </div>
        {calls.length === 0 ? (
          <div className="page-state compact-state">No call records found in this date range.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Phone number</th><th>Call type</th><th>Status</th><th>Duration</th><th>Date &amp; time</th></tr>
              </thead>
              <tbody>
                {calls.slice(0, 12).map((call) => (
                  <tr key={call.id}>
                    <td>{call.phone}</td>
                    <td><span className={`call-type-badge type-${call.callType}`}>{call.callType}</span></td>
                    <td><span className={`status-badge status-${call.status}`}>{call.status}</span></td>
                    <td>{formatDuration(call.durationSec)}</td>
                    <td>{new Date(call.dateTime).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function EmployeesPage() {
  const { employeeId } = useParams();
  const { filters } = useFilters();
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const [employees, setEmployees] = useState([]);
  const [calls, setCalls] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalEmployee, setModalEmployee] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionError, setActionError] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [employeeList, callPage] = await Promise.all([
        getEmployees(),
        getCalls({
          from: filters.from,
          to: filters.to,
          employeeId,
          page: 1,
          pageSize: 5000,
        }),
      ]);
      setEmployees(employeeList);
      setCalls(callPage.items);
    } catch (loadError) {
      setError(loadError.message || "Unable to load employees.");
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, filters.from, filters.to, reloadKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesQuery =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.id.toLowerCase().includes(query) ||
        (employee.branch || "").toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? employee.active : !employee.active);
      return matchesQuery && matchesStatus;
    });
  }, [employees, search, statusFilter]);

  const selectedEmployee = employeeId
    ? employees.find((employee) => employee.id === employeeId)
    : null;
  const selectedCalls = employeeId
    ? calls.filter((call) => call.employeeId === employeeId)
    : [];

  async function toggleActive(employee) {
    setActionError("");
    try {
      await setEmployeeActive(employee.id, !employee.active);
      setReloadKey((key) => key + 1);
    } catch (actionFailure) {
      setActionError(actionFailure.message || "Unable to update employee status.");
    }
  }

  async function handleSave(values) {
    await saveEmployee(values);
    setModalEmployee(null);
    setIsAdding(false);
    setReloadKey((key) => key + 1);
  }

  if (isLoading) {
    return <section className="page-section"><div className="page-state" role="status">Loading employees…</div></section>;
  }

  if (error) {
    return (
      <section className="page-section">
        <div className="page-state page-state-error" role="alert">
          <strong>Couldn’t load employees</strong>
          <span>{error}</span>
          <button type="button" className="secondary-action" onClick={loadData}>Try again</button>
        </div>
      </section>
    );
  }

  if (employeeId && !selectedEmployee) {
    return (
      <section className="page-section">
        <div className="page-state">
          <strong>Employee not found</strong>
          <Link className="back-link" to="/employees">Return to employees</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section data-page">
      {actionError && (
        <div className="page-state page-state-error" role="alert">
          {actionError}
        </div>
      )}
      {employeeId ? (
        <EmployeeDetail
          employee={selectedEmployee}
          calls={selectedCalls}
          canManage={canManage}
          onEdit={() => setModalEmployee(selectedEmployee)}
          onToggleActive={toggleActive}
        />
      ) : (
        <>
          <div className="data-page-heading">
            <div>
              <span className="eyebrow">TEAM DIRECTORY</span>
              <h1>Employees</h1>
              <p>Manage your team and review call activity in the selected date range.</p>
            </div>
            {canManage && (
              <button type="button" className="primary-action" onClick={() => setIsAdding(true)}>
                <Plus size={16} /> Add employee
              </button>
            )}
          </div>

          <section className="filter-panel employee-filter-panel">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search name, employee ID, or branch"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="employee-status-tabs" role="group" aria-label="Filter employees by status">
              {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={statusFilter === value ? "is-selected" : ""}
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="filter-result-count">{filteredEmployees.length} employees</span>
          </section>

          {filteredEmployees.length === 0 ? (
            <div className="page-state">
              <strong>No employees match your search</strong>
              <span>Try a different name, employee ID, or branch.</span>
            </div>
          ) : (
            <section className="records-card">
              <div className="table-scroll">
                <table className="data-table employee-table">
                  <thead>
                    <tr>
                      <th>Employee</th><th>Branch</th><th>Call activity</th>
                      <th>Device sync</th><th>Status</th><th><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => {
                      const employeeCalls = calls.filter((call) => call.employeeId === employee.id);
                      return (
                        <tr key={employee.id}>
                          <td>
                            <Link className="employee-cell" to={`/employees/${encodeURIComponent(employee.id)}`}>
                              <span className="employee-avatar">{initials(employee.name)}</span>
                              <span className="employee-cell-copy">
                                <strong>{employee.name}</strong>
                                <span>{employee.id} · {employee.role}</span>
                              </span>
                            </Link>
                          </td>
                          <td>{employee.branch}</td>
                          <td><strong className="table-number">{numberFormat.format(employeeCalls.length)}</strong><span className="table-secondary">calls</span></td>
                          <td>
                            <span className="sync-time">{employee.lastSync}</span>
                            {employee.pendingRecords > 0 && <span className="table-secondary">{employee.pendingRecords} pending</span>}
                            {employee.failedRecords > 0 && <span className="employee-sync-warning">{employee.failedRecords} failed</span>}
                          </td>
                          <td><span className={`employee-status ${employee.active ? "is-active" : "is-inactive"}`}>{employee.active ? "Active" : "Inactive"}</span></td>
                          <td>
                            <div className="employee-actions">
                              <Link
                                className="row-action"
                                to={`/employees/${encodeURIComponent(employee.id)}`}
                                aria-label={`View ${employee.name}`}
                                title="View details"
                              >
                                <ChevronRight size={17} />
                              </Link>
                              {canManage && (
                                <>
                                  <button
                                    className="row-action"
                                    type="button"
                                    aria-label={`Edit ${employee.name}`}
                                    title="Edit employee"
                                    onClick={() => setModalEmployee(employee)}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    className="row-text-action"
                                    type="button"
                                    onClick={() => toggleActive(employee)}
                                  >
                                    {employee.active ? "Deactivate" : "Activate"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      {(modalEmployee || isAdding) && (
        <EmployeeForm
          employee={modalEmployee}
          onClose={() => {
            setModalEmployee(null);
            setIsAdding(false);
          }}
          onSave={handleSave}
        />
      )}
    </section>
  );
}
