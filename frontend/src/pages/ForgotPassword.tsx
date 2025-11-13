// pages/ForgotPassword.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.png";

export default function ForgotPassword() {
  const { sendPasswordResetEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await sendPasswordResetEmail(email);

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

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
            Reset Password
          </h1>
          <p className="text-text-secondary text-base">
            {success
              ? "Check your email for reset instructions"
              : "Enter your email address and we'll send you a link to reset your password"}
          </p>
        </div>

        {!success ? (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
                <AlertCircle size={20} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-primary" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  id="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-background-secondary border-2 border-border rounded-xl text-text-primary placeholder:text-text-muted transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  type="email"
                  placeholder="coach@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-linear-to-r from-primary-dark via-primary to-accent rounded-xl text-white font-semibold shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <Mail size={20} />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>

            <Link 
              to="/login" 
              className="flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200 pt-2"
            >
              <ArrowLeft size={18} />
              <span>Back to Login</span>
            </Link>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center">
                <CheckCircle size={40} className="text-success" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <p className="text-text-primary font-medium">
                We've sent a password reset link to <strong className="text-primary">{email}</strong>
              </p>
              <p className="text-sm text-text-muted">
                Please check your inbox and follow the instructions to reset your password.
              </p>
            </div>
            <Link 
              to="/login"
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-background-secondary border border-border rounded-xl text-text-primary font-semibold transition-all duration-200 hover:bg-background-tertiary hover:border-border-light hover:scale-[1.02]"
            >
              <ArrowLeft size={18} />
              <span>Back to Login</span>
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-text-muted">
            Didn't receive the email? Check your spam folder
          </p>
        </div>
      </div>
    </main>
  );
}
