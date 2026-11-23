import { KeyRound } from "lucide-react";
import { useState } from "react";
import { changePassword } from "../services/api.js";

export default function PasswordChangePage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("New password must not exceed 72 UTF-8 bytes.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password changed successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to change password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-section">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ACCOUNT</span>
          <h1>Change password</h1>
          <p>Verify your current password before choosing a new one.</p>
        </div>
      </header>

      <div className="security-card">
        <div className="security-card-heading">
          <span className="security-icon"><KeyRound size={20} /></span>
          <div>
            <h2>Account security</h2>
            <p>Use at least 8 characters. Your password is stored securely as a hash.</p>
          </div>
        </div>

        <form className="security-form" onSubmit={handleSubmit} noValidate>
          <label className="form-field" htmlFor="current-password">
            <span>Current password</span>
            <input
              autoComplete="current-password"
              id="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </label>
          <label className="form-field" htmlFor="new-password">
            <span>New password</span>
            <input
              autoComplete="new-password"
              id="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <label className="form-field" htmlFor="confirm-password">
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              id="confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          {success && <p className="security-success" role="status">{success}</p>}
          <button className="primary-action security-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </section>
  );
}
