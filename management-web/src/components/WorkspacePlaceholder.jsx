import { ArrowUpRight, BarChart3, ClipboardList, RefreshCw, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

const shortcuts = [
  { to: "/calls", label: "Call database", description: "Browse synced call activity", icon: ClipboardList },
  { to: "/employees", label: "Employees", description: "View your sales team", icon: UsersRound },
  { to: "/reports", label: "Reports", description: "Review team performance", icon: BarChart3 },
  { to: "/sync", label: "Sync status", description: "Check employee device sync", icon: RefreshCw },
];

export default function WorkspacePlaceholder({
  title,
  description,
  showLinks = false,
}) {
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR OPERATIONS, AT A GLANCE</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      {showLinks ? (
        <div className="welcome-panel">
          <div className="welcome-panel-copy">
            <span className="welcome-kicker">WELCOME TO CPM MANAGEMENT</span>
            <h2>Make every move count.</h2>
            <p>
              Your team&apos;s call activity and performance tools live in one
              clear workspace.
            </p>
          </div>
          <div className="welcome-panel-decoration" aria-hidden="true">
            <div className="welcome-orbit welcome-orbit-one" />
            <div className="welcome-orbit welcome-orbit-two" />
            <span>CPM</span>
          </div>
        </div>
      ) : (
        <div className="section-empty-card">
          <div className="section-empty-icon">
            <ArrowUpRight size={22} />
          </div>
          <h2>This section is ready for its next step</h2>
          <p>
            The shared workspace is in place. This page will be built in a
            focused follow-up.
          </p>
        </div>
      )}

      {showLinks && (
        <div className="shortcut-grid">
          {shortcuts.map(({ to, label, description: detail, icon: Icon }) => (
            <Link className="shortcut-card" to={to} key={to}>
              <span className="shortcut-icon">
                <Icon size={20} />
              </span>
              <span className="shortcut-copy">
                <strong>{label}</strong>
                <span>{detail}</span>
              </span>
              <ArrowUpRight className="shortcut-arrow" size={17} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
