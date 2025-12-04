import { useEffect } from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { FileText, AlertCircle, DollarSign, Shield, Scale, Users } from 'lucide-react';

export default function TermsOfService() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="Please read these terms carefully before using Aquilus"
      lastUpdated="December 4, 2025"
    >
      {/* Acceptance */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Acceptance of Terms</h2>
        </div>
        <p className="text-slate-300 mb-4">
          By accessing or using Aquilus ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
          If you do not agree to these Terms, please do not use the Service.
        </p>
        <div className="bg-slate-900/50 border-l-4 border-cyan-500 rounded-lg p-6">
          <p className="text-slate-300 m-0">
            <strong className="text-white">Important:</strong> These Terms constitute a legally binding agreement between you and Lablytics. 
            Please read them carefully.
          </p>
        </div>
      </section>

      {/* Beta Program */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Beta Program Conditions</h2>
        </div>
        <p className="text-slate-300 mb-4">
          Aquilus is currently in beta testing. By participating in our beta program, you acknowledge and agree that:
        </p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Service Availability:</strong> The Service may be unavailable, unstable, or subject to frequent changes</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Features May Change:</strong> Features, functionality, and pricing may change without notice during the beta period</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">No Warranties:</strong> The Service is provided "as is" without warranties of any kind</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Data Backup:</strong> While we implement security measures, you should maintain backups of critical data</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Feedback:</strong> We may request feedback, which you grant us the right to use for product improvement</span>
          </li>
        </ul>
      </section>

      {/* User Accounts */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">User Accounts & Responsibilities</h2>
        </div>
        <p className="text-slate-300 mb-4">When creating an account, you agree to:</p>
        <ul className="space-y-3 text-slate-300 mb-4">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Accurate Information:</strong> Provide accurate, current, and complete information</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Account Security:</strong> Maintain the security of your password and account credentials</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Authorized Use:</strong> Ensure you have proper authorization to use the Service for your organization</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Account Responsibility:</strong> You are responsible for all activities under your account</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Notify Us:</strong> Immediately notify us of any unauthorized account access</span>
          </li>
        </ul>
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
          <p className="text-slate-300 m-0">
            <strong className="text-white">Age Requirement:</strong> You must be at least 18 years old to create an account and use the Service.
          </p>
        </div>
      </section>

      {/* Acceptable Use */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Acceptable Use Policy</h2>
        <p className="text-slate-300 mb-4">You agree NOT to use the Service to:</p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✗</span>
            <span>Violate any applicable laws, regulations, or third-party rights</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✗</span>
            <span>Upload or transmit viruses, malware, or other malicious code</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✗</span>
            <span>Attempt to gain unauthorized access to our systems or other users' accounts</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✗</span>
            <span>Interfere with or disrupt the Service or servers</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✗</span>
            <span>Scrape, data mine, or use automated tools to access the Service without permission</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✗</span>
            <span>Impersonate any person or entity, or misrepresent your affiliation</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✗</span>
            <span>Use the Service for any illegal, harmful, or abusive purpose</span>
          </li>
        </ul>
      </section>

      {/* Intellectual Property */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Intellectual Property Rights</h2>
        </div>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Our Property:</strong> The Service, including all content, features, functionality, software, 
          and design, is owned by Lablytics and protected by copyright, trademark, and other intellectual property laws.
        </p>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Your Content:</strong> You retain ownership of the data you upload to the Service (swimmer data, 
          workout plans, etc.). By using the Service, you grant us a license to use this data solely to provide and improve the Service.
        </p>
        <p className="text-slate-300">
          <strong className="text-white">License Grant:</strong> We grant you a limited, non-exclusive, non-transferable license to access 
          and use the Service for your internal business purposes, subject to these Terms.
        </p>
      </section>

      {/* Subscription & Billing */}
      <section className="mb-12">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Subscription & Billing</h2>
        </div>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Beta Access:</strong> During the beta period, access may be provided free of charge or at discounted rates. 
          Pricing is subject to change upon launch of the commercial version.
        </p>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Future Paid Plans:</strong> When we launch paid subscription plans, the following will apply:
        </p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Billing:</strong> Subscriptions are billed in advance on a monthly or annual basis</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Auto-Renewal:</strong> Subscriptions automatically renew unless canceled before the renewal date</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Cancellation:</strong> You may cancel your subscription at any time; no refunds for partial periods</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Price Changes:</strong> We will provide 30 days' notice of any price changes</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span><strong className="text-white">Payment Methods:</strong> Valid payment method required for paid plans</span>
          </li>
        </ul>
      </section>

      {/* Limitation of Liability */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white m-0">Limitation of Liability</h2>
        </div>
        <div className="bg-slate-900/50 border-l-4 border-yellow-500 rounded-lg p-6 mb-4">
          <p className="text-slate-300 m-0">
            <strong className="text-white">Important Legal Notice:</strong> Please read this section carefully as it limits our liability.
          </p>
        </div>
        <p className="text-slate-300 mb-4">
          To the maximum extent permitted by law:
        </p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>We do not warrant that the Service will be uninterrupted, secure, or error-free</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>We are not liable for any indirect, incidental, special, consequential, or punitive damages</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>We are not responsible for third-party services, content, or actions</span>
          </li>
        </ul>
      </section>

      {/* Indemnification */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Indemnification</h2>
        <p className="text-slate-300">
          You agree to indemnify, defend, and hold harmless Lablytics, its affiliates, officers, directors, employees, and agents 
          from any claims, liabilities, damages, losses, or expenses (including legal fees) arising from: (a) your use of the Service, 
          (b) your violation of these Terms, (c) your violation of any rights of another party, or (d) your content or data.
        </p>
      </section>

      {/* Termination */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Termination</h2>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Your Rights:</strong> You may terminate your account at any time by contacting us or using 
          the account deletion feature in the app.
        </p>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Our Rights:</strong> We reserve the right to suspend or terminate your access to the Service 
          at any time, with or without cause, with or without notice, particularly if you violate these Terms.
        </p>
        <p className="text-slate-300">
          <strong className="text-white">Effect of Termination:</strong> Upon termination, your right to use the Service will immediately 
          cease. We may delete your data after a reasonable period, as outlined in our Privacy Policy.
        </p>
      </section>

      {/* Data Ownership */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Data Ownership & Portability</h2>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Your Data:</strong> You own all the data you input into the Service, including swimmer profiles, 
          performance metrics, and workout plans.
        </p>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Data Export:</strong> You may export your data at any time in standard formats.
        </p>
        <p className="text-slate-300">
          <strong className="text-white">Data Use:</strong> We may use aggregated, anonymized data for analytics, research, and product 
          improvement, but we will not share your identifiable data without your consent (except as described in our Privacy Policy).
        </p>
      </section>

      {/* AI Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">AI-Generated Content</h2>
        <p className="text-slate-300 mb-4">
          Our Service uses artificial intelligence to generate workout recommendations and analyze performance data. 
          You acknowledge and agree that:
        </p>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>AI-generated content is provided as suggestions and should be reviewed by qualified coaches</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>You are responsible for evaluating the appropriateness of AI recommendations for your athletes</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>AI outputs may contain errors or may not be suitable for all situations</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>We are not liable for decisions made based on AI-generated recommendations</span>
          </li>
        </ul>
      </section>

      {/* Dispute Resolution */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Dispute Resolution</h2>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Informal Resolution:</strong> If you have a dispute with us, please contact us first at 
          <a href="mailto:cj.baker@lablytics.com" className="text-cyan-400 hover:text-cyan-300"> cj.baker@lablytics.com</a> to 
          attempt to resolve the issue informally.
        </p>
        <p className="text-slate-300 mb-4">
          <strong className="text-white">Governing Law:</strong> These Terms shall be governed by and construed in accordance with the 
          laws of the United States, without regard to conflict of law principles.
        </p>
        <p className="text-slate-300">
          <strong className="text-white">Jurisdiction:</strong> You agree to submit to the exclusive jurisdiction of the courts located 
          within the United States for resolution of any disputes.
        </p>
      </section>

      {/* Changes to Terms */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Changes to These Terms</h2>
        <p className="text-slate-300 mb-4">
          We reserve the right to modify these Terms at any time. We will notify you of material changes by:
        </p>
        <ul className="space-y-3 text-slate-300 mb-4">
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>Posting the updated Terms on this page with a new "Last Updated" date</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>Sending an email notification to your registered email address</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-1">•</span>
            <span>Displaying an in-app notification</span>
          </li>
        </ul>
        <p className="text-slate-300">
          Your continued use of the Service after changes take effect constitutes acceptance of the modified Terms.
        </p>
      </section>

      {/* Entire Agreement */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Entire Agreement</h2>
        <p className="text-slate-300">
          These Terms, together with our Privacy Policy, constitute the entire agreement between you and Lablytics regarding the Service 
          and supersede all prior agreements and understandings.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
        <p className="text-slate-300 mb-2">
          For questions about these Terms, please contact us:
        </p>
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
          <p className="text-slate-300 mb-2">
            <strong className="text-white">Email:</strong> <a href="mailto:cj.baker@lablytics.com" className="text-cyan-400 hover:text-cyan-300">cj.baker@lablytics.com</a>
          </p>
          <p className="text-slate-300 m-0">
            <strong className="text-white">Company:</strong> Lablytics
          </p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
