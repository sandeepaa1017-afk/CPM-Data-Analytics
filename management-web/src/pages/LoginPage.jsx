import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await login({ username, password });
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-top">
          <BrandLogo className="login-brand-logo" />
          <div className="login-brand-wordmark">
            <strong>CPM</strong>
            <span>PACKERS &amp; MOVERS</span>
          </div>
        </div>
        <div className="login-brand-message">
          <span className="login-overline">CPM MANAGEMENT</span>
          <h1>Better visibility.<br />Better moves.</h1>
          <p>
            A clearer view of your team&apos;s activity, customer conversations,
            and day-to-day operations.
          </p>
        </div>
        <div className="login-brand-footer">
          <span className="login-brand-line" />
          <span>Operations, in sync.</span>
        </div>
        <div className="login-brand-shape login-brand-shape-one" aria-hidden="true" />
        <div className="login-brand-shape login-brand-shape-two" aria-hidden="true" />
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <BrandLogo />
            <span>CPM Management</span>
          </div>
          <div className="login-heading">
            <span className="eyebrow">YOUR TEAM&apos;S WORKSPACE</span>
            <h2>Welcome back</h2>
            <p>Sign in to continue to CPM Management.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="form-field" htmlFor="login-username">
              <span>Username</span>
              <input
                autoComplete="username"
                id="login-username"
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your account username"
                type="text"
                value={username}
              />
            </label>

            <label className="form-field" htmlFor="login-password">
              <span>Password</span>
              <span className="password-input-wrap">
                <input
                  autoComplete="current-password"
                  id="login-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-visibility"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="login-submit" type="submit" disabled={isSubmitting}>
              <span>
                {isSubmitting
                  ? "Signing in…"
                  : "Sign in"}
              </span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="login-security-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              Sign in with the username and password created by your CPM administrator.
            </span>
          </div>
          <div className="login-legal">© CPM Packers &amp; Movers</div>
        </div>
      </section>
    </main>
  );
}
