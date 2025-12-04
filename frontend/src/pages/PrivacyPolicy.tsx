import { useEffect } from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { Shield, Lock, Eye, Database, UserCheck, FileText } from 'lucide-react';

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="Your privacy and data security are our top priorities"
      lastUpdated="December 4, 2025"
    >
      {/* Access Section */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Access</h2>
        </div>
        <div className="bg-slate-900/50 border-l-4 border-cyan-500 rounded-lg p-6">
          <p className="text-slate-300 m-0">
            <strong className="text-white">Restricted Access:</strong> This application is designed exclusively for authorized users. 
            Unauthorized access is strictly prohibited and monitored for security purposes.
          </p>
        </div>
      </section>

      {/* Data Collection Section */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Data Collection and Storage</h2>
        </div>
        <p className="text-slate-300 mb-6">
          We collect and store the following information to provide you with the best possible experience:
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6 hover:border-cyan-500/50 transition-colors">
            <h3 className="text-lg font-semibold text-cyan-400 mb-2">Account Information</h3>
            <p className="text-slate-300 text-sm m-0">
              Email address, name, team information, and profile data for authentication and personalization
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6 hover:border-cyan-500/50 transition-colors">
            <h3 className="text-lg font-semibold text-cyan-400 mb-2">Swimmer Data</h3>
            <p className="text-slate-300 text-sm m-0">
              Performance metrics, times, training data, and analytics to provide coaching insights
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6 hover:border-cyan-500/50 transition-colors">
            <h3 className="text-lg font-semibold text-cyan-400 mb-2">Usage Data</h3>
            <p className="text-slate-300 text-sm m-0">
              App usage statistics and performance metrics to improve functionality and user experience
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6 hover:border-cyan-500/50 transition-colors">
            <h3 className="text-lg font-semibold text-cyan-400 mb-2">Device Information</h3>
            <p className="text-slate-300 text-sm m-0">
              Device type, browser information, and operating system for compatibility and optimization
            </p>
          </div>
        </div>
      </section>

      {/* How We Use Data */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">How We Use Your Data</h2>
        </div>
        <p className="text-slate-300 mb-4">Your data enables us to deliver exceptional service through:</p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Core Functionality:</strong> Providing essential app features including workout management, athlete tracking, and performance analytics</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">AI-Powered Features:</strong> Training our machine learning models to provide intelligent workout recommendations and predictive analytics</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Performance Enhancement:</strong> Improving app performance, fixing bugs, and optimizing user experience</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Security Assurance:</strong> Ensuring secure access, preventing fraud, and protecting your account</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Communication:</strong> Sending important updates, feature announcements, and responding to support requests</span>
          </li>
        </ul>
      </section>

      {/* Data Security */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Data Security</h2>
        </div>
        <div className="bg-slate-900/50 border-l-4 border-cyan-500 rounded-lg p-6 mb-4">
          <p className="text-slate-300 m-0">
            We implement enterprise-grade security measures to protect your data:
          </p>
        </div>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Encryption:</strong> All data transmitted between your device and our servers is encrypted using industry-standard TLS/SSL protocols</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Secure Infrastructure:</strong> Data is stored on Supabase's secure cloud infrastructure with encryption at rest</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Access Controls:</strong> Strict role-based access controls ensure only authorized users can access specific data</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Regular Audits:</strong> We conduct regular security audits and vulnerability assessments</span>
          </li>
        </ul>
      </section>

      {/* Third-Party Services */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Third-Party Services</h2>
        </div>
        <p className="text-slate-300 mb-4">We use the following trusted third-party services:</p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Supabase:</strong> Database and authentication services (data stored securely with encryption)</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Mixpanel:</strong> Analytics to understand user behavior and improve our product</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">OpenAI:</strong> AI-powered features including workout generation and analysis</span>
          </li>
        </ul>
        <p className="text-slate-300 mt-4">
          These services are bound by their own privacy policies and we ensure they meet our security standards.
        </p>
      </section>

      {/* Data Sharing */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Data Sharing</h2>
        </div>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Your Privacy is Paramount:</strong> We do not sell, trade, or share your personal data with third parties for marketing purposes. Limited sharing may occur only when:
        </p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>Necessary to provide core app services (e.g., database hosting, authentication)</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>Required by applicable laws, legal processes, or government requests</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>Essential for security, fraud prevention, and protecting our rights</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>With your explicit consent for specific purposes</span>
          </li>
        </ul>
      </section>

      {/* Data Retention */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
        <p className="text-slate-300">
          We retain your data only as long as necessary for the purposes outlined in this policy, to provide ongoing services, 
          or as required by applicable laws and regulations. When you delete your account, we will remove your personal data 
          within 30 days, except where retention is required by law or for legitimate business purposes (e.g., dispute resolution, 
          security investigations).
        </p>
      </section>

      {/* Your Rights */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Your Rights</h2>
        <p className="text-slate-300 mb-4">You maintain full control over your personal data. You may request:</p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Access:</strong> View what personal data we have about you</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Correction:</strong> Update or correct your personal information</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Deletion:</strong> Remove your personal data from our systems</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Portability:</strong> Export your data in a standard format</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Objection:</strong> Object to certain processing of your data</span>
          </li>
        </ul>
        <p className="text-slate-300 mt-4">
          To exercise these rights, please contact us at <a href="mailto:cj.baker@lablytics.com" className="text-cyan-400 hover:text-cyan-300">cj.baker@lablytics.com</a>
        </p>
      </section>

      {/* Cookies */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Cookies and Tracking</h2>
        <p className="text-slate-300">
          We use cookies and similar tracking technologies to maintain your session, remember your preferences, and analyze usage patterns. 
          You can control cookie settings through your browser preferences. Note that disabling cookies may affect app functionality.
        </p>
      </section>

      {/* Children's Privacy */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Children's Privacy</h2>
        <p className="text-slate-300">
          Our service is designed for coaches and administrators (ages 18+). While we may store performance data about athletes of all ages, 
          we do not knowingly collect personal information directly from children under 13 without parental consent. If you believe we have 
          collected such information, please contact us immediately.
        </p>
      </section>

      {/* Changes to Policy */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Changes to This Policy</h2>
        <p className="text-slate-300">
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page 
          and updating the "Last Updated" date. We encourage you to review this policy periodically.
        </p>
      </section>

      {/* GDPR/CCPA */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4">International Users & Compliance</h2>
        <p className="text-slate-300 mb-4">
          We comply with applicable data protection regulations including GDPR (Europe) and CCPA (California). If you are located in the EU or California, 
          you have additional rights under these regulations:
        </p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">GDPR:</strong> Right to data portability, right to be forgotten, right to restrict processing</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">CCPA:</strong> Right to know what personal information is collected, right to opt-out of sale (we don't sell data)</span>
          </li>
        </ul>
      </section>
    </LegalPageLayout>
  );
}
