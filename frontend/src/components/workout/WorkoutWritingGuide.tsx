// components/workout/WorkoutWritingGuide.tsx
import { useState } from 'react';
import { BookOpen, X, ChevronRight, Copy, Check, Zap, Ruler, Activity, Target, Wrench, Brain, Calendar, TrendingUp } from 'lucide-react';

type Section = 'overview' | 'basic' | 'equipment' | 'intensity' | 'drills' | 'advanced' | 'examples';

interface Example {
  title: string;
  description: string;
  code: string;
  features: string[];
}

export function WorkoutWritingGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [copiedExample, setCopiedExample] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedExample(id);
    setTimeout(() => setCopiedExample(null), 2000);
  };

  const sections = [
    { id: 'overview' as Section, label: 'Overview', icon: BookOpen },
    { id: 'basic' as Section, label: 'Basic Format', icon: Ruler },
    { id: 'equipment' as Section, label: 'Equipment', icon: Wrench },
    { id: 'intensity' as Section, label: 'Intensity & Pace', icon: Zap },
    { id: 'drills' as Section, label: 'Drills', icon: Brain },
    { id: 'advanced' as Section, label: 'Advanced', icon: TrendingUp },
    { id: 'examples' as Section, label: 'Examples', icon: Target },
  ];

  const examples: Example[] = [
    {
      title: 'Complete Workout',
      description: 'A full workout demonstrating all features',
      code: `WARM-UP
400 Easy
4 x 100 @ 1:30
  Odds: Catch Up
  Evens: Single Arm

MAIN SET
8 x 200 FINS @ 3:00
  100 Kick - 100 Swim Build

6 x 100 @ 1:30 / 1:25 / 1:20
  2 Free PB Strong
  2 Back Paddles
  2 Breast Easy

4 x 50 @ :50
  Fast

COOL-DOWN
200 Easy`,
      features: ['Equipment (FINS, PB, Paddles)', 'Drills (Catch Up, Single Arm)', 'Intensity (Build, Strong, Easy, Fast)', 'Distance sub-components', 'Progressive intervals', 'Breakdown notation']
    },
    {
      title: 'Sprint Workout',
      description: 'High-intensity sprint focus with equipment',
      code: `WARM-UP
300 Easy
4 x 50 @ 1:00 Build

PRE-SET
8 x 25 FINS @ :45
  Odds: Fast
  Evens: Easy

MAIN SET
5 x 100 @ 2:00
  50 PB+5 - 50 Max

8 x 50 Paddles @ 1:15
  Strong

COOL-DOWN
200 Easy`,
      features: ['Pace targets (PB+5)', 'Equipment changes', 'Max effort', 'Odds/Evens breakdown']
    },
    {
      title: 'Technique Workout',
      description: 'Drill-focused technique development',
      code: `WARM-UP
400 Easy

DRILL SET
8 x 100 @ 1:45
  25 Catch Up - 25 Swim - 25 Single Arm - 25 Swim

6 x 50 @ 1:00
  SL Kick

MAIN SET
4 x 200 @ 3:00
  100 Fur Trader - 100 Swim Easy

200 Vertical Kick

COOL-DOWN
200 Easy`,
      features: ['Multiple drills', 'Distance breakdowns', 'Technique focus', 'Vertical kick']
    }
  ];

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 transition-all duration-200 hover:border-cyan-500/50 group"
      >
        <BookOpen size={18} className="group-hover:scale-110 transition-transform" />
        <span className="font-medium">Workout Writing Guide</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-500/30">
              <BookOpen size={24} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Workout Writing Guide</h2>
              <p className="text-sm text-slate-400">Write workouts that maximize analysis quality</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-56 border-r border-slate-700/60 p-4 overflow-y-auto">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    type="button"
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium text-sm">{section.label}</span>
                    {isActive && <ChevronRight size={16} className="ml-auto" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'basic' && <BasicFormatSection />}
            {activeSection === 'equipment' && <EquipmentSection />}
            {activeSection === 'intensity' && <IntensitySection />}
            {activeSection === 'drills' && <DrillsSection />}
            {activeSection === 'advanced' && <AdvancedSection />}
            {activeSection === 'examples' && (
              <ExamplesSection 
                examples={examples} 
                copiedExample={copiedExample}
                onCopy={copyToClipboard}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Section Components
function OverviewSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-100 mb-3">How the Analyzer Works</h3>
        <p className="text-slate-300 leading-relaxed">
          Our advanced workout analyzer automatically extracts detailed information from your workout text, 
          including distances, strokes, activities, equipment, drills, intensity markers, and more. The better 
          you format your workouts, the more accurate and comprehensive the analysis becomes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeatureCard
          icon={Ruler}
          title="Automatic Parsing"
          description="Recognizes standard swim notation like '4 x 100' or '200m'"
          color="cyan"
        />
        <FeatureCard
          icon={Wrench}
          title="Equipment Detection"
          description="Identifies FINS, Paddles, Pull Buoy, Snorkel, and more"
          color="blue"
        />
        <FeatureCard
          icon={Zap}
          title="Intensity Tracking"
          description="Captures Build, Descend, Fast, Easy, and pace targets"
          color="purple"
        />
        <FeatureCard
          icon={Brain}
          title="Drill Recognition"
          description="Detects 13+ drill patterns for technique analysis"
          color="green"
        />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
        <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Activity size={18} className="text-cyan-400" />
          What Gets Analyzed
        </h4>
        <ul className="grid grid-cols-2 gap-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Total distance & duration
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Stroke breakdown
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Activity types (swim/kick/pull/drill)
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Energy zones
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Equipment usage
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Intensity distribution
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Drill breakdown
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            Interval times
          </li>
        </ul>
      </div>
    </div>
  );
}

function BasicFormatSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-100 mb-3">Basic Set Formats</h3>
        <p className="text-slate-300 mb-4">
          The analyzer recognizes several standard swimming workout formats:
        </p>
      </div>

      <div className="space-y-4">
        <FormatExample
          title="Repetition Sets"
          pattern="N x Distance"
          examples={['4 x 100', '8 x 50 Free', '6 x 200 @ 3:00']}
          description="Standard format for sets with multiple repetitions"
        />

        <FormatExample
          title="Standalone Distances"
          pattern="Distance Stroke"
          examples={['400 Easy', '200m Free', '300 Choice']}
          description="Single swim with optional stroke specification"
        />

        <FormatExample
          title="Interval Times"
          pattern="@ Time or on Time"
          examples={['@ 1:30', 'on 2:00', '@ :45']}
          description="Specify rest/interval time after distance"
        />

        <FormatExample
          title="Stroke Specification"
          pattern="Free, Back, Breast, Fly, IM, Choice"
          examples={['100 Free', '50 Fly', '200 IM', '100 Choice']}
          description="Add stroke type to any set"
        />

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <h4 className="font-semibold text-amber-300 mb-2 flex items-center gap-2">
            <Zap size={18} />
            Pro Tip
          </h4>
          <p className="text-slate-300 text-sm">
            Use clear sections (WARM-UP, MAIN SET, COOL-DOWN) to organize your workout. 
            The analyzer treats these as headers and won't try to parse them as sets.
          </p>
        </div>
      </div>
    </div>
  );
}

function EquipmentSection() {
  const equipment = [
    { name: 'FINS', aliases: ['Fins', 'Flippers'], use: 'Resistance training, ankle flexibility' },
    { name: 'Paddles', aliases: ['Pads'], use: 'Strength building, stroke technique' },
    { name: 'PB', aliases: ['Pull Buoy', 'Buoy'], use: 'Upper body focus, body position' },
    { name: 'SNK', aliases: ['Snorkel'], use: 'Breathing technique, body position' },
    { name: 'Band', aliases: ['Ankle Band'], use: 'Upper body isolation' },
    { name: 'Board', aliases: ['Kickboard', 'KB'], use: 'Kick sets' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-100 mb-3">Equipment Recognition</h3>
        <p className="text-slate-300 mb-4">
          The analyzer automatically detects equipment in your workout descriptions. Just include 
          the equipment name anywhere in the line.
        </p>
      </div>

      <div className="space-y-3">
        {equipment.map((item) => (
          <div key={item.name} className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/40">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-cyan-300">{item.name}</h4>
                <p className="text-xs text-slate-400">
                  Also recognizes: {item.aliases.join(', ')}
                </p>
              </div>
              <Wrench size={18} className="text-slate-500" />
            </div>
            <p className="text-sm text-slate-300">{item.use}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
        <h4 className="font-semibold text-slate-200 mb-3">Usage Examples</h4>
        <div className="space-y-2 text-sm font-mono">
          <CodeLine>4 x 200 FINS @ 3:00</CodeLine>
          <CodeLine>8 x 50 Paddles Strong</CodeLine>
          <CodeLine>6 x 100 PB @ 1:30</CodeLine>
          <CodeLine>200 SNK Easy</CodeLine>
          <CodeLine>4 x 50 Band Fast</CodeLine>
        </div>
      </div>
    </div>
  );
}

function IntensitySection() {
  const intensities = [
    { name: 'Build', description: 'Gradually increase speed within each rep', color: 'blue' },
    { name: 'Descend', description: 'Get faster across multiple reps in the set', color: 'cyan' },
    { name: 'Fast / Hard / Strong', description: 'High intensity effort', color: 'red' },
    { name: 'Easy / Light / Recovery', description: 'Low intensity, recovery pace', color: 'green' },
    { name: 'Moderate / Mod', description: 'Medium intensity', color: 'yellow' },
    { name: 'Max / Maximum', description: 'All-out effort', color: 'purple' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-100 mb-3">Intensity & Pace Markers</h3>
        <p className="text-slate-300 mb-4">
          Help the analyzer understand the intensity of each set by including descriptive markers.
        </p>
      </div>

      <div className="space-y-3">
        {intensities.map((item) => (
          <div key={item.name} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full bg-${item.color}-400`} />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-200">{item.name}</h4>
                <p className="text-sm text-slate-400">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/30">
        <h4 className="font-semibold text-cyan-300 mb-3 flex items-center gap-2">
          <Target size={18} />
          Pace Targets
        </h4>
        <p className="text-slate-300 text-sm mb-3">
          Reference personal bests or race pace with optional modifiers:
        </p>
        <div className="space-y-2 text-sm font-mono">
          <CodeLine>4 x 50 PB (Personal Best pace)</CodeLine>
          <CodeLine>4 x 50 PB+5 (5 seconds slower than PB)</CodeLine>
          <CodeLine>4 x 50 PB-3 (3 seconds faster than PB)</CodeLine>
          <CodeLine>4 x 100 PR (Personal Record)</CodeLine>
          <CodeLine>4 x 100 Race Pace</CodeLine>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-slate-200">Examples</h4>
        <div className="space-y-2 text-sm font-mono">
          <CodeLine>8 x 100 @ 1:30 Build</CodeLine>
          <CodeLine>6 x 50 @ :50 Fast</CodeLine>
          <CodeLine>4 x 200 Easy</CodeLine>
          <CodeLine>3 x 100 Descend 1-3</CodeLine>
          <CodeLine>8 x 50 Strong PB+7</CodeLine>
        </div>
      </div>
    </div>
  );
}

function DrillsSection() {
  const drills = [
    'Catch Up', 'Single Arm', 'Fur Trader', 'SL Kick', 'SPIN IM',
    'Tarzan', 'Fist Drill', 'Fingertip Drag', '6 Kick', '3 Stroke',
    'Underwater', 'Vertical Kick', 'Sculling'
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-100 mb-3">Drill Recognition</h3>
        <p className="text-slate-300 mb-4">
          The analyzer recognizes 13 common swimming drills. Include the drill name in your set 
          description for automatic tracking.
        </p>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
        <h4 className="font-semibold text-slate-200 mb-3">Recognized Drills</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {drills.map((drill) => (
            <div key={drill} className="flex items-center gap-2 text-sm">
              <Brain size={14} className="text-cyan-400" />
              <span className="text-slate-300">{drill}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-slate-200">Usage Examples</h4>
        <div className="space-y-2 text-sm font-mono">
          <CodeLine>4 x 100 Catch Up</CodeLine>
          <CodeLine>8 x 50 Single Arm</CodeLine>
          <CodeLine>200 Fur Trader</CodeLine>
          <CodeLine>6 x 25 Fingertip Drag</CodeLine>
          <CodeLine>4 x 50 SL Kick</CodeLine>
        </div>
      </div>

      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
        <h4 className="font-semibold text-slate-200 mb-3">Combining with Distance Breakdowns</h4>
        <p className="text-slate-300 text-sm mb-3">
          Use indentation to specify different activities within a single distance:
        </p>
        <div className="space-y-2 text-sm font-mono">
          <CodeLine>4 x 100</CodeLine>
          <CodeLine indent>25 Catch Up - 25 Swim - 25 Single Arm - 25 Swim</CodeLine>
          <div className="h-2" />
          <CodeLine>200 Free</CodeLine>
          <CodeLine indent>100 Swim — 100 Fur Trader</CodeLine>
        </div>
      </div>
    </div>
  );
}

function AdvancedSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-100 mb-3">Advanced Features</h3>
        <p className="text-slate-300 mb-4">
          Take your workout descriptions to the next level with these advanced patterns.
        </p>
      </div>

      <div className="space-y-4">
        <AdvancedFeature
          title="Breakdown Notation"
          description="Specify different strokes or activities for specific reps"
          examples={[
            '8 x 100 @ 1:30',
            '  Odds: Free',
            '  Evens: Back',
            '',
            '4 x 50 @ :50',
            '  1-2: Kick',
            '  3-4: Swim'
          ]}
        />

        <AdvancedFeature
          title="Distance Sub-components"
          description="Break down a single rep into multiple activities"
          examples={[
            '4 x 100',
            '  30 Kick - 70 Swim',
            '',
            '3 x 200 FINS',
            '  100 Swim — 100 Fur Trader'
          ]}
        />

        <AdvancedFeature
          title="Progressive Intervals"
          description="Descending interval times across the set"
          examples={[
            '6 x 100 @ 1:30 / 1:25 / 1:20',
            '',
            '9 x 50 @ :55 / :50 / :45'
          ]}
        />

        <AdvancedFeature
          title="Cycle Notation"
          description="Specify drill cycles for IM drills"
          examples={[
            '8 x 25 SPIN IM by 8 cycles',
            '',
            '4 x 100 IM Drills by 4 cycles'
          ]}
        />

        <AdvancedFeature
          title="Superset Notation"
          description="Complex sets with multiple distances"
          examples={[
            '3 x [50 + 100] + 30 rest',
            '',
            '4 x [25 + 50 + 75] @ 2:00'
          ]}
        />
      </div>

      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
        <h4 className="font-semibold text-cyan-300 mb-2 flex items-center gap-2">
          <Calendar size={18} />
          Combining Multiple Features
        </h4>
        <p className="text-slate-300 text-sm mb-3">
          You can combine equipment, intensity, drills, and breakdowns in a single set:
        </p>
        <div className="space-y-1 text-sm font-mono bg-slate-900/50 rounded-lg p-3">
          <CodeLine>8 x 100 FINS @ 1:45</CodeLine>
          <CodeLine indent>Odds: 30 Kick - 70 Swim Strong</CodeLine>
          <CodeLine indent>Evens: Single Arm Easy</CodeLine>
        </div>
      </div>
    </div>
  );
}

function ExamplesSection({ examples, copiedExample, onCopy }: { 
  examples: Example[]; 
  copiedExample: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-100 mb-3">Complete Workout Examples</h3>
        <p className="text-slate-300 mb-4">
          Copy these examples and modify them for your own workouts. Each demonstrates multiple 
          analysis features working together.
        </p>
      </div>

      <div className="space-y-6">
        {examples.map((example, idx) => (
          <div key={idx} className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
            <div className="p-4 border-b border-slate-700/40">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-slate-100">{example.title}</h4>
                  <p className="text-sm text-slate-400">{example.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(example.code, `example-${idx}`)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 transition-all text-sm"
                >
                  {copiedExample === `example-${idx}` ? (
                    <>
                      <Check size={14} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {example.features.map((feature, fIdx) => (
                  <span key={fIdx} className="text-xs px-2 py-1 bg-slate-700/50 text-slate-300 rounded">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <pre className="p-4 bg-slate-900/50 text-slate-300 text-sm font-mono overflow-x-auto">
              {example.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper Components
function FeatureCard({ icon: Icon, title, description, color }: {
  icon: any;
  title: string;
  description: string;
  color: string;
}) {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} border rounded-xl p-4`}>
      <Icon size={24} className={`text-${color}-400 mb-2`} />
      <h4 className="font-semibold text-slate-100 mb-1">{title}</h4>
      <p className="text-sm text-slate-300">{description}</p>
    </div>
  );
}

function FormatExample({ title, pattern, examples, description }: {
  title: string;
  pattern: string;
  examples: string[];
  description: string;
}) {
  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
      <h4 className="font-semibold text-slate-200 mb-2">{title}</h4>
      <div className="mb-2 text-sm">
        <span className="text-slate-400">Pattern: </span>
        <code className="text-cyan-300 font-mono">{pattern}</code>
      </div>
      <p className="text-sm text-slate-400 mb-3">{description}</p>
      <div className="space-y-1">
        {examples.map((ex, idx) => (
          <div key={idx} className="text-sm font-mono bg-slate-900/50 px-3 py-1.5 rounded text-slate-300">
            {ex}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedFeature({ title, description, examples }: {
  title: string;
  description: string;
  examples: string[];
}) {
  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
      <div className="p-4 border-b border-slate-700/40">
        <h4 className="font-semibold text-slate-100 mb-1">{title}</h4>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <div className="p-4 bg-slate-900/50">
        <pre className="text-sm font-mono text-slate-300">
          {examples.join('\n')}
        </pre>
      </div>
    </div>
  );
}

function CodeLine({ children, indent = false }: { children: React.ReactNode; indent?: boolean }) {
  return (
    <div className={`bg-slate-900/50 px-3 py-1.5 rounded text-slate-300 ${indent ? 'ml-4' : ''}`}>
      {children}
    </div>
  );
}
