import {
  BarChart3,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import BrandLogo from "./BrandLogo.jsx";
import DateRangeControl from "./DateRangeControl.jsx";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calls", label: "Call database", icon: ClipboardList },
  { to: "/employees", label: "Employees", icon: UsersRound },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/sync", label: "Sync status", icon: RefreshCw },
];

function NavigationLinks({ onNavigate }) {
  return (
    <nav className="primary-nav" aria-label="Main navigation">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          to={to}
          key={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `nav-link${isActive ? " is-active" : ""}`
          }
        >
          <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pageLabel =
    navItems.find((item) => item.to === location.pathname)?.label ||
    (location.pathname === "/"
      ? "Dashboard"
      : location.pathname === "/security"
        ? "Account security"
      : location.pathname.startsWith("/employees/")
        ? "Employees"
        : "Workspace");
  const initials = user?.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="sidebar-brand" to="/dashboard" aria-label="CPM Management home">
          <BrandLogo />
          <span className="sidebar-brand-copy">
            <strong>CPM</strong>
            <span>Management</span>
          </span>
        </NavLink>
        <div className="sidebar-section-label">WORKSPACE</div>
        <NavigationLinks />
        <div className="sidebar-footer">
          <div className="sidebar-footer-mark">CPM</div>
          <span>One team. Every move.</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="topbar-title">
            <span className="topbar-eyebrow">CPM MANAGEMENT</span>
            <span className="topbar-page-title">{pageLabel}</span>
          </div>
          <div className="topbar-actions">
            <DateRangeControl />
            <div className="user-menu">
              <div className="user-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="user-details">
                <strong>{user?.name}</strong>
                <span>{user?.role}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => navigate("/security")}
                aria-label="Change password"
                title="Change password"
              >
                <KeyRound size={18} />
              </button>
              <button
                className="icon-button logout-button"
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {menuOpen && (
          <div className="mobile-nav-panel">
            <NavigationLinks onNavigate={() => setMenuOpen(false)} />
            <button className="mobile-logout" type="button" onClick={handleLogout}>
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        )}

        <main className="main-content">
          <Outlet />
        </main>

        <nav className="bottom-nav" aria-label="Mobile navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              to={to}
              key={to}
              aria-label={label}
              className={({ isActive }) =>
                `bottom-nav-link${isActive ? " is-active" : ""}`
              }
            >
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              <span>{label === "Call database" ? "Calls" : label === "Sync status" ? "Sync" : label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
