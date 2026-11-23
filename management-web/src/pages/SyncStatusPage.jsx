import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getSyncStatus, requestDeviceSync } from "../services/api.js";

export default function SyncStatusPage() {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestingDeviceId, setRequestingDeviceId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      setDevices(await getSyncStatus());
    } catch (loadError) {
      setError(loadError.message || "Unable to load device sync status.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  async function startSync(device) {
    setRequestingDeviceId(device.deviceId);
    setError("");
    setNotice("");
    try {
      await requestDeviceSync(device.deviceId);
      setNotice(`Sync started for ${device.employeeName}.`);
      await loadStatus(true);
    } catch (requestError) {
      setError(requestError.message || "Could not start device sync.");
    } finally {
      setRequestingDeviceId("");
    }
  }

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <section className="page-section data-page">
      <div className="data-page-heading">
        <div>
          <span className="eyebrow">DEVICE CONNECTIVITY</span>
          <h1>Sync status</h1>
          <p>Start and monitor call-log syncs from management.</p>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => loadStatus(true)}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw size={16} className={isRefreshing ? "is-spinning" : ""} />
          Refresh
        </button>
      </div>

      {notice && <div className="page-state" role="status">{notice}</div>}
      {isLoading ? (
        <div className="page-state" role="status">Loading sync status…</div>
      ) : error ? (
        <div className="page-state page-state-error" role="alert">
          <strong>Couldn’t load sync status</strong>
          <span>{error}</span>
          <button
            type="button"
            className="secondary-action"
            onClick={() => loadStatus()}
          >
            Try again
          </button>
        </div>
      ) : devices.length === 0 ? (
        <div className="page-state">
          <strong>No employee devices found</strong>
          <span>Device entries appear after an employee signs in and syncs calls.</span>
        </div>
      ) : (
        <section className="records-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Device ID</th>
                  <th>Last successful sync</th>
                  <th>Pending</th>
                  <th>Failed</th>
                  <th>Management sync</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={`${device.employeeId}-${device.deviceId || "unregistered"}`}>
                    <td>
                      <strong>{device.employeeName}</strong>
                      <span className="table-secondary">{device.employeeId}</span>
                    </td>
                    <td>{device.deviceId || "Not registered"}</td>
                    <td>{device.lastSync}</td>
                    <td>{device.pendingRecords || 0}</td>
                    <td>{device.failedRecords || 0}</td>
                    <td>
                      {device.pushRegistered ? (
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={() => startSync(device)}
                          disabled={
                            requestingDeviceId === device.deviceId ||
                            device.syncRequestStatus === "pending"
                          }
                        >
                          {requestingDeviceId === device.deviceId
                            ? "Starting…"
                            : device.syncRequestStatus === "pending"
                              ? "Syncing…"
                              : "Start sync"}
                        </button>
                      ) : (
                        <span className="table-secondary">App not registered</span>
                      )}
                      {device.syncRequestMessage && (
                        <span className="table-secondary">
                          {device.syncRequestMessage}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${device.status}`}>
                        {device.status.replaceAll("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
