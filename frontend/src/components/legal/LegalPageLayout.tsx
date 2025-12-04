import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { ReactNode } from 'react';

interface LegalPageLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalPageLayout({ title, subtitle, lastUpdated, children }: LegalPageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white py-12 px-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-8 left-8 z-50 flex items-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-xl hover:bg-slate-700/80 hover:border-cyan-500/50 transition-all shadow-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-medium">Back to Home</span>
      </button>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12 pb-8 border-b border-slate-700/50">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-xl text-slate-300 mb-6">{subtitle}</p>
          <div className="inline-block px-6 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full">
            <span className="text-cyan-400 font-semibold">Last updated: {lastUpdated}</span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 md:p-12 shadow-2xl">
          <div className="prose prose-invert prose-slate max-w-none">
            {children}
          </div>
        </div>

        {/* Contact section */}
        <div className="mt-12 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 text-center shadow-lg">
          <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Questions?
          </h3>
          <p className="text-slate-300 mb-6">
            We're here to help. Contact us for any questions or concerns.
          </p>
          <a
            href="mailto:cj.baker@lablytics.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-semibold transition-all shadow-lg shadow-cyan-500/20"
          >
            <Mail className="w-5 h-5" />
            cj.baker@lablytics.com
          </a>
        </div>
      </div>
    </div>
  );
}
