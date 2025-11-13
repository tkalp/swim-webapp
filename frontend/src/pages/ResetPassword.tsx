// pages/ResetPassword.tsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.png";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Check if we have the required token
  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const type = searchParams.get("type");
    
    if (!accessToken || type !== "recovery") {
      setError("Invalid or expired reset link. Please request a new password reset.");
    }
  }, [searchParams]);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setValidationError("");

    // Validate password
    const pwdError = validatePassword(password);
    if (pwdError) {
      setValidationError(pwdError);
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { error: updateError } = await updatePassword(password);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-linear-to-br from-background-primary via-background-primary to-background-secondary/30 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[500px] h-[500px] rounded-full bg-linear-to-r from-accent/20 to-primary/20 blur-[100px] -top-48 -right-48 animate-pulse" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-linear-to-r from-accent-purple/20 to-accent/20 blur-[100px] -bottom-32 -left-32 animate-pulse delay-1000" />
          <div className="absolute w-[300px] h-[300px] rounded-full bg-linear-to-r from-primary/10 to-accent/10 blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse delay-500" />
        </div>

        <div className="relative z-10 w-full max-w-md bg-background-elevated/95 backdrop-blur-xl border border-border rounded-3xl p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img 
                src={logo} 
                className="h-28 w-auto drop-shadow-[0_4px_12px_rgba(49,151,167,0.3)] transition-transform hover:scale-105" 
                alt="Aquilus Logo" 
              />
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-linear-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
              Password Reset Successful
            </h1>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center">
                <CheckCircle size={40} className="text-success" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <p className="text-text-primary font-medium">
                Your password has been successfully reset
              </p>
              <p className="text-sm text-text-muted">
                You will be redirected to the login page in a few seconds...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-background-primary via-background-primary to-background-secondary/30 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-linear-to-r from-accent/20 to-primary/20 blur-[100px] -top-48 -right-48 animate-pulse" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-linear-to-r from-accent-purple/20 to-accent/20 blur-[100px] -bottom-32 -left-32 animate-pulse delay-1000" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-linear-to-r from-primary/10 to-accent/10 blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse delay-500" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-background-elevated/95 backdrop-blur-xl border border-border rounded-3xl p-10 shadow-2xl">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src={logo} 
              className="h-28 w-auto drop-shadow-[0_4px_12px_rgba(49,151,167,0.3)] transition-transform hover:scale-105" 
              alt="Aquilus Logo" 
            />
          </div>
          <h1 className="text-3xl font-bold mb-2 bg-linear-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
            Set New Password
          </h1>
          <p className="text-text-secondary text-base">
            Please enter your new password below
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {validationError && (
            <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* New Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-text-primary" htmlFor="password">
              New Password
            </label>
            <div className="relative">
              <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                id="password"
                className="w-full pl-12 pr-12 py-3.5 bg-background-secondary border-2 border-border rounded-xl text-text-primary placeholder:text-text-muted transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || !!error}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading || !!error}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-text-primary" htmlFor="confirmPassword">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                id="confirmPassword"
                className="w-full pl-12 pr-12 py-3.5 bg-background-secondary border-2 border-border rounded-xl text-text-primary placeholder:text-text-muted transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading || !!error}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading || !!error}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-linear-to-r from-primary-dark via-primary to-accent rounded-xl text-white font-semibold shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            disabled={loading || !!error}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Resetting Password...</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                <span>Reset Password</span>
              </>
            )}
          </button>

          {error && (
            <Link 
              to="/forgot-password"
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-background-secondary border border-border rounded-xl text-text-primary font-semibold transition-all duration-200 hover:bg-background-tertiary hover:border-border-light hover:scale-[1.02]"
            >
              Request New Reset Link
            </Link>
          )}
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-text-muted">
            <Link to="/login" className="text-primary hover:text-accent transition-colors">Back to Login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
