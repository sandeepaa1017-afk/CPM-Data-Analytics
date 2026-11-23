const buildEnv = import.meta.env || {};
const configuredApiUrl = buildEnv.VITE_API_BASE_URL;

export function normalizeApiBaseUrl(apiUrl, isProduction = false) {
  if (isProduction && (!apiUrl || !/^https:\/\//i.test(apiUrl))) {
    throw new Error("Set VITE_API_BASE_URL to the HTTPS production API URL.");
  }
  const normalizedUrl = (apiUrl || "http://localhost:8000").replace(/\/+$/, "");
  return normalizedUrl.endsWith("/api")
    ? normalizedUrl
    : `${normalizedUrl}/api`;
}

export const BASE_URL = normalizeApiBaseUrl(
  configuredApiUrl,
  Boolean(buildEnv.PROD),
);

const TOKEN_KEY = "cpm-management.access-token.v1";
const LEGACY_MOCK_EMPLOYEES_KEY = "cpm-management.mock-employees.v1";

if (typeof window !== "undefined") {
  window.localStorage.removeItem(LEGACY_MOCK_EMPLOYEES_KEY);
}

export function setAccessToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function getAccessToken() {
  return typeof window === "undefined"
    ? null
    : window.localStorage.getItem(TOKEN_KEY);
}

function toQueryString(values) {
  const query = new URLSearchParams();
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== "" && value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

async function request(path, queryValues, options = {}) {
  const query = toQueryString(queryValues);
  const headers = {
    Accept: "application/json",
    ...options.headers,
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(
    `${BASE_URL}${path}${query ? `?${query}` : ""}`,
    {
      ...options,
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    },
  );
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed (${response.status}): ${path}`,
    );
  }
  return payload;
}

export async function authenticate({ username, password }) {
  return request("/auth/login", undefined, {
    method: "POST",
    body: { username, password },
  });
}

export async function changePassword({ currentPassword, newPassword }) {
  return request("/auth/change-password", undefined, {
    method: "POST",
    body: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  });
}

export async function getEmployees() {
  return request("/employees");
}

export async function saveEmployee(employee) {
  if (employee.id) {
    return request(`/employees/${encodeURIComponent(employee.id)}`, undefined, {
      method: "PUT",
      body: employee,
    });
  }
  return request("/employees", undefined, { method: "POST", body: employee });
}

export async function setEmployeeActive(employeeId, active) {
  if (!active) {
    return request(
      `/employees/${encodeURIComponent(employeeId)}/deactivate`,
      undefined,
      { method: "PATCH" },
    );
  }
  return request(`/employees/${encodeURIComponent(employeeId)}`, undefined, {
    method: "PUT",
    body: { active: true },
  });
}

export async function getCalls(filters = {}) {
  return request("/calls", filters);
}

export async function getCustomers(filters = {}) {
  return request("/customers", filters);
}

export async function getCallStats(filters = {}) {
  return request("/calls/stats", filters);
}

export async function exportCalls(filters = {}) {
  const query = toQueryString(filters);
  const token = getAccessToken();
  const response = await fetch(
    `${BASE_URL}/calls/export${query ? `?${query}` : ""}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(
      typeof payload.detail === "string"
        ? payload.detail
        : `Call export failed (${response.status}).`,
    );
  }
  return response.blob();
}

export async function getReport({
  from,
  to,
  groupBy = "day",
  employeeId,
  callType,
  status,
  minDuration,
  minDurationExclusive,
  maxDuration,
} = {}) {
  const params = {
    from,
    to,
    groupBy,
    employeeId,
    callType,
    status,
    minDuration,
    minDurationExclusive,
    maxDuration,
  };
  return request("/reports", params);
}

export async function getSyncStatus() {
  return request("/sync/status");
}

export async function requestDeviceSync(deviceId) {
  return request(
    `/sync/devices/${encodeURIComponent(deviceId)}/request`,
    undefined,
    { method: "POST" },
  );
}
