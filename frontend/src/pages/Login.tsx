// pages/Login.tsx
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import "../styles/Login.css";
import logo from "../assets/logo.png";

export default function Login() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      setErr(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="main-login">
      <div className="login-container">
        {/* Logo Section */}
        <div className="login-header">
          <div className="logo-wrapper">
            <img src={logo} className="logo" alt="Aquilus Logo" />
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to manage your swim squads</p>
        </div>

        {/* Login Form */}
        <form className="login-form" onSubmit={onLogin}>
          {/* Error Alert */}
          {err && (
            <div className="error-alert">
              <AlertCircle size={20} />
              <span>{err}</span>
            </div>
          )}

          {/* Email Input */}
          <div className="input-block">
            <label className="login-label" htmlFor="email">
              Email Address
            </label>
            <div className="input-wrapper">
              <Mail size={20} className="input-icon" />
              <input
                id="email"
                className="login-input"
                type="email"
                placeholder="coach@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="input-block">
            <label className="login-label" htmlFor="password">
              Password
            </label>
            <div className="input-wrapper">
              <Lock size={20} className="input-icon" />
              <input
                id="password"
                className="login-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn size={20} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="footer-text">
            Need help? Contact your administrator
          </p>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="background-decoration">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>
    </main>
  );
}