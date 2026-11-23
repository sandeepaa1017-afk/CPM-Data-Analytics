import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import WorkspacePlaceholder from "./components/WorkspacePlaceholder.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";

const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const CallDatabasePage = lazy(() => import("./pages/CallDatabasePage.jsx"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const SyncStatusPage = lazy(() => import("./pages/SyncStatusPage.jsx"));
const PasswordChangePage = lazy(() => import("./pages/PasswordChangePage.jsx"));

function PageLoading() {
  return <div className="dashboard-state" role="status">Loading page…</div>;
}

function ProtectedLayout() {
  const { user } = useAuth();
  return user ? <AppShell /> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<PageLoading />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route path="/calls" element={
          <Suspense fallback={<PageLoading />}><CallDatabasePage /></Suspense>
        } />
        <Route path="/employees" element={
          <Suspense fallback={<PageLoading />}><EmployeesPage /></Suspense>
        } />
        <Route path="/employees/:employeeId" element={
          <Suspense fallback={<PageLoading />}><EmployeesPage /></Suspense>
        } />
        <Route path="/reports" element={
          <Suspense fallback={<PageLoading />}><ReportsPage /></Suspense>
        } />
        <Route path="/sync" element={
          <Suspense fallback={<PageLoading />}><SyncStatusPage /></Suspense>
        } />
        <Route path="/security" element={
          <Suspense fallback={<PageLoading />}><PasswordChangePage /></Suspense>
        } />
        <Route
          path="*"
          element={
            <WorkspacePlaceholder
              title="Page not found"
              description="This page is not part of your workspace."
            />
          }
        />
      </Route>
    </Routes>
  );
}
