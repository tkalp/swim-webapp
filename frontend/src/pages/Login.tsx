// pages/Login.tsx
import { useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { Link, Navigate } from "react-router-dom";
import { LogIn, AlertCircle } from "lucide-react";
import { Input, Button, Copyright } from '@/components/ui';
import logo from '@/assets/logo.png';

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
    <main className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decoration - Animated Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-linear-to-r from-cyan-500/10 to-blue-500/10 blur-[120px] -top-48 -right-48 animate-pulse" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-linear-to-r from-purple-500/10 to-pink-500/10 blur-[120px] -bottom-32 -left-32 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-linear-to-r from-blue-500/5 to-cyan-500/5 blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Gradient Border Wrapper */}
        <div className="relative">
          <div className="absolute -inset-px bg-linear-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-sm" />
          
          <div className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-10 shadow-2xl">
            {/* Logo Section */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className="relative group">
                  <div className="absolute -inset-2 bg-linear-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <img 
                    src={logo} 
                    className="relative h-28 w-auto drop-shadow-[0_4px_20px_rgba(34,211,238,0.3)] transition-transform group-hover:scale-105 duration-300" 
                    alt="Aquilus Logo" 
                  />
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-2 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Welcome Back
              </h1>
              <p className="text-slate-400 text-base">
                Sign in to manage your swim squads
              </p>
            </div>

            {/* Login Form */}
            <form className="space-y-5" onSubmit={onLogin}>
              {/* Error Alert */}
              {err && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-slate-300">{err}</span>
                </div>
              )}

              {/* Email Input */}
              <Input
                label="Email Address"
                type="email"
                icon="mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@example.com"
                required
                disabled={loading}
              />

              {/* Password Input */}
              <Input
                label="Password"
                type="password"
                icon="lock"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <Link 
                  to="/forgot-password"
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors duration-200 font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                variant="primary"
                size="lg"
                icon={<LogIn size={20} strokeWidth={2.5} />}
                loading={loading}
                loadingText="Signing In..."
                fullWidth
              >
                Sign In
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500">
                Need help? Contact your administrator
              </p>
            </div>

            {/* Copyright */}
            <Copyright />
          </div>
        </div>
      </div>
    </main>
  );
}