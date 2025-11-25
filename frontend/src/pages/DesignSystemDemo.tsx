// pages/DesignSystemDemo.tsx
import { useState } from 'react';
import { Button, Input, Textarea, Select } from '@/components/ui';
import { Plus, Save, Trash2, X } from 'lucide-react';

/**
 * Design System Demo Page
 * 
 * This page showcases all the unified components from the new design system.
 * Use this as a reference when building new features.
 */
export default function DesignSystemDemo() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [description, setDescription] = useState('');
  const [squad, setSquad] = useState('');

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const validateEmail = (value: string) => {
    if (!value.includes('@')) {
      setEmailError('Invalid email format');
    } else {
      setEmailError('');
    }
  };

  return (
    <div className="min-h-screen bg-background-primary p-8">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Design System Demo
          </h1>
          <p className="text-slate-400">
            Reference guide for unified components. See <code className="px-2 py-1 bg-slate-800 rounded text-cyan-400">DESIGN_SYSTEM.md</code> for full documentation.
          </p>
        </div>

        {/* Buttons Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-200">Buttons</h2>
          
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 space-y-6">
            {/* Primary Buttons */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Primary (CTAs only)</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4" /> Small
                </Button>
                <Button variant="primary" size="md">
                  <Save className="w-4 h-4" /> Medium (Default)
                </Button>
                <Button variant="primary" size="lg">
                  <Save className="w-5 h-5" /> Large
                </Button>
                <Button variant="primary" size="md" loading={loading} onClick={handleSubmit}>
                  {loading ? 'Saving...' : 'With Loading State'}
                </Button>
                <Button variant="primary" size="md" disabled>
                  Disabled
                </Button>
              </div>
            </div>

            {/* Secondary Buttons */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Secondary (Most actions)</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="sm">Cancel</Button>
                <Button variant="secondary" size="md">Edit Profile</Button>
                <Button variant="secondary" size="lg">View Details</Button>
              </div>
            </div>

            {/* Ghost Buttons */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Ghost (Tertiary actions)</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="ghost" size="sm">
                  <X className="w-4 h-4" /> Close
                </Button>
                <Button variant="ghost" size="md">Skip</Button>
                <Button variant="ghost" size="lg">Learn More</Button>
              </div>
            </div>

            {/* Danger Buttons */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Danger (Destructive actions)</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="danger" size="sm">
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
                <Button variant="danger" size="md">Remove Squad</Button>
                <Button variant="danger" size="lg">Permanently Delete</Button>
              </div>
            </div>

            {/* Success Buttons */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Success (Positive actions)</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="success" size="sm">Approve</Button>
                <Button variant="success" size="md">Confirm</Button>
                <Button variant="success" size="lg">Accept Invitation</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Form Inputs Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-200">Form Inputs</h2>
          
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 space-y-6">
            {/* Text Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="First Name"
                placeholder="Enter first name"
                required
              />
              
              <Input
                label="Last Name"
                placeholder="Enter last name"
                hint="As it appears on official documents"
              />
            </div>

            {/* Input with Error */}
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                validateEmail(e.target.value);
              }}
              placeholder="you@example.com"
              error={emailError}
              required
            />

            {/* Textarea */}
            <Textarea
              label="Description"
              placeholder="Enter a detailed description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              hint="Maximum 500 characters"
              rows={4}
            />

            {/* Select */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                label="Squad"
                value={squad}
                onChange={(e) => setSquad(e.target.value)}
                options={[
                  { value: '', label: 'Select a squad...' },
                  { value: '1', label: 'Junior Sharks' },
                  { value: '2', label: 'Senior Team' },
                  { value: '3', label: 'Elite Squad' },
                ]}
                required
              />

              <Select
                label="Event Type"
                options={[
                  { value: '', label: 'Select event...' },
                  { value: 'freestyle', label: 'Freestyle' },
                  { value: 'backstroke', label: 'Backstroke' },
                  { value: 'breaststroke', label: 'Breaststroke' },
                  { value: 'butterfly', label: 'Butterfly' },
                ]}
              />
            </div>

            {/* Disabled States */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Disabled Input"
                placeholder="Cannot edit"
                disabled
              />
              
              <Select
                label="Disabled Select"
                options={[
                  { value: '1', label: 'Option 1' },
                  { value: '2', label: 'Option 2' },
                ]}
                disabled
              />
            </div>
          </div>
        </section>

        {/* Color Palette Reference */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-200">Color Palette</h2>
          
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Primary */}
              <div>
                <div className="h-20 rounded-lg bg-primary mb-2"></div>
                <p className="text-xs font-mono text-slate-400">primary</p>
                <p className="text-xs font-mono text-slate-500">#3197a7</p>
              </div>
              
              {/* Accent */}
              <div>
                <div className="h-20 rounded-lg bg-accent mb-2"></div>
                <p className="text-xs font-mono text-slate-400">accent</p>
                <p className="text-xs font-mono text-slate-500">#22d3ee</p>
              </div>
              
              {/* Success */}
              <div>
                <div className="h-20 rounded-lg bg-success mb-2"></div>
                <p className="text-xs font-mono text-slate-400">success</p>
                <p className="text-xs font-mono text-slate-500">#10b981</p>
              </div>
              
              {/* Danger */}
              <div>
                <div className="h-20 rounded-lg bg-danger mb-2"></div>
                <p className="text-xs font-mono text-slate-400">danger</p>
                <p className="text-xs font-mono text-slate-500">#ef4444</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-800 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Gradient (Primary CTAs only)</h3>
              <div className="h-16 rounded-lg bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500"></div>
              <p className="text-xs font-mono text-slate-500 mt-2">
                bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500
              </p>
            </div>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-200">Usage Guidelines</h2>
          
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
              <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                <span className="text-xl">✓</span> DO
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                <li>Use <code className="px-1 py-0.5 bg-slate-800 rounded text-cyan-400">variant="primary"</code> for ONE main CTA per page</li>
                <li>Use <code className="px-1 py-0.5 bg-slate-800 rounded text-cyan-400">variant="secondary"</code> for most actions</li>
                <li>Add labels to all form inputs</li>
                <li>Show loading states on async buttons</li>
                <li>Use hint text for additional context</li>
              </ul>
            </div>

            <div className="p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
              <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                <span className="text-xl">✗</span> DON'T
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                <li>Use gradients on secondary buttons</li>
                <li>Have multiple primary buttons competing for attention</li>
                <li>Create inputs without labels</li>
                <li>Mix old CSS var patterns with new Tailwind classes</li>
                <li>Use touch targets smaller than 44px on mobile</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 pb-12">
          <p>For complete documentation, see <code className="px-2 py-1 bg-slate-800 rounded text-cyan-400">DESIGN_SYSTEM.md</code></p>
        </div>
      </div>
    </div>
  );
}
