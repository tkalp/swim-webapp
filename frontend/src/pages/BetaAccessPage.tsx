import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { analytics } from '@/lib/mixpanel';

export default function BetaAccessPage() {
  const navigate = useNavigate();
  const [formStarted, setFormStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    teamSize: '',
    currentTools: '',
    painPoints: '',
    budgetRange: ''
  });

  const handleFieldChange = (field: string, value: string) => {
    if (!formStarted) {
      setFormStarted(true);
      analytics.track('Beta Form Started', {
        timestamp: new Date().toISOString()
      });
    }

    setFormData(prev => ({ ...prev, [field]: value }));
    
    analytics.track('Beta Form Field Changed', {
      field,
      timestamp: new Date().toISOString()
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Get current session to check auth state
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Current session:', sessionData.session ? 'AUTHENTICATED' : 'ANONYMOUS');
      
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Supabase ANON KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      console.log('Supabase ANON KEY prefix:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20));
      console.log('Supabase client initialized:', !!supabase);
      
      // If user is authenticated, sign them out for beta signup
      if (sessionData.session) {
        console.warn('User is authenticated - signing out for anonymous beta signup');
        await supabase.auth.signOut();
      }
      
      // Insert into Supabase beta_waitlist table
      const { error: submitError } = await supabase
        .from('beta_waitlist')
        .insert([
          {
            email: formData.email,
            name: formData.name,
            team_size: formData.teamSize,
            current_tools: formData.currentTools,
            pain_points: formData.painPoints,
            budget_range: formData.budgetRange,
            status: 'pending'
          }
        ]);

      console.log('Supabase response:', { error: submitError });

      if (submitError) {
        if (submitError.code === '23505') {
          // Duplicate email
          setError('This email has already been registered for beta access.');
        } else {
          console.error('Supabase error details:', submitError);
          throw submitError;
        }
        setLoading(false);
        return;
      }

      // Track successful submission
      analytics.track('Beta Form Submitted', {
        email: formData.email,
        team_size: formData.teamSize,
        budget_range: formData.budgetRange,
        has_current_tools: !!formData.currentTools,
        has_pain_points: !!formData.painPoints,
        timestamp: new Date().toISOString()
      });

      setSubmitted(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Error submitting beta form:', err);
      setError('Failed to submit. Please try again or contact support.');
      setLoading(false);
    }
  };

  const handleCalendlyClick = () => {
    analytics.track('Beta Calendly Clicked', {
      email: formData.email,
      timestamp: new Date().toISOString()
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-cyan-400" />
            </div>
            
            <h1 className="text-4xl font-bold mb-4 bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Thanks for Your Interest!
            </h1>
            
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              We've received your beta access request. Our team will review your application 
              and reach out within <span className="font-semibold text-cyan-400">48 hours</span>.
            </p>

            <button
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-cyan-400 transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-slate-300">Limited Beta Access</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Request Beta Access
            </h1>
            
            <p className="text-lg text-slate-400 leading-relaxed">
              We're looking for passionate swim coaches to help shape the future of Aquilus. 
              Tell us about your team and coaching needs.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                placeholder="coach@example.com"
              />
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-300 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                placeholder="John Doe"
              />
            </div>

            {/* Team Size */}
            <div>
              <label htmlFor="teamSize" className="block text-sm font-semibold text-slate-300 mb-2">
                Team Size
              </label>
              <select
                id="teamSize"
                value={formData.teamSize}
                onChange={(e) => handleFieldChange('teamSize', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              >
                <option value="">Select team size...</option>
                <option value="1-10">1-10 swimmers</option>
                <option value="11-25">11-25 swimmers</option>
                <option value="26-50">26-50 swimmers</option>
                <option value="51-100">51-100 swimmers</option>
                <option value="100+">100+ swimmers</option>
              </select>
            </div>

            {/* Current Tools */}
            <div>
              <label htmlFor="currentTools" className="block text-sm font-semibold text-slate-300 mb-2">
                What tools do you currently use?
              </label>
              <input
                type="text"
                id="currentTools"
                value={formData.currentTools}
                onChange={(e) => handleFieldChange('currentTools', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                placeholder="e.g., TeamUnify, Google Sheets, Excel..."
              />
            </div>

            {/* Pain Points */}
            <div>
              <label htmlFor="painPoints" className="block text-sm font-semibold text-slate-300 mb-2">
                What are your biggest coaching challenges?
              </label>
              <textarea
                id="painPoints"
                rows={4}
                value={formData.painPoints}
                onChange={(e) => handleFieldChange('painPoints', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                placeholder="Tell us about the problems you face managing your team..."
              />
            </div>

            {/* Budget Range */}
            <div>
              <label htmlFor="budgetRange" className="block text-sm font-semibold text-slate-300 mb-2">
                Monthly Budget Range
              </label>
              <select
                id="budgetRange"
                value={formData.budgetRange}
                onChange={(e) => handleFieldChange('budgetRange', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              >
                <option value="">Select budget range...</option>
                <option value="<$20">Less than $20/month</option>
                <option value="$20-50">$20-50/month</option>
                <option value="$50-100">$50-100/month</option>
                <option value=">$100">More than $100/month</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Request Beta Access
                </>
              )}
            </button>

            <p className="text-center text-sm text-slate-500">
              By submitting, you agree to our privacy policy and terms of service.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
