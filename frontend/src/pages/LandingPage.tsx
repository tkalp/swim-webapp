import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Sparkles, 
  Calendar, 
  ClipboardCheck, 
  TrendingUp, 
  BookOpen, 
  Award, 
  Network,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { analytics } from '@/lib/mixpanel';
import MiniAnalyticsChart from '../components/landing/MiniAnalyticsChart';
import MiniAthleteProfile from '../components/landing/MiniAthleteProfile';
import MiniWorkoutLibrary from '../components/landing/MiniWorkoutLibrary';
import MiniAICoach from '../components/landing/MiniAICoach';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrollDepth, setScrollDepth] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const [betaCount, setBetaCount] = useState(12);

  useEffect(() => {
    // Track page view
    analytics.track('Landing Page Viewed', {
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    });

    // Track scroll depth
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      const scrolled = window.scrollY;
      const depth = Math.round((scrolled / documentHeight) * 100);
      
      // Track milestones
      if (depth >= 25 && scrollDepth < 25) {
        analytics.track('Landing Scroll Depth', { depth: 25 });
        setScrollDepth(25);
      } else if (depth >= 50 && scrollDepth < 50) {
        analytics.track('Landing Scroll Depth', { depth: 50 });
        setScrollDepth(50);
      } else if (depth >= 75 && scrollDepth < 75) {
        analytics.track('Landing Scroll Depth', { depth: 75 });
        setScrollDepth(75);
      } else if (depth >= 100 && scrollDepth < 100) {
        analytics.track('Landing Scroll Depth', { depth: 100 });
        setScrollDepth(100);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollDepth]);

  useEffect(() => {
    // Set up intersection observers for feature sections
    const observerOptions = {
      threshold: 0.3,
      rootMargin: '0px'
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const featureName = entry.target.getAttribute('data-feature');
          if (featureName) {
            analytics.track('Feature Section Viewed', { 
              feature: featureName,
              timestamp: new Date().toISOString()
            });
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const featureElements = document.querySelectorAll('[data-feature]');
    featureElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const handleCTAClick = (location: string) => {
    analytics.track('Hero CTA Clicked', { 
      button_location: location,
      timestamp: new Date().toISOString()
    });
    navigate('/beta-access');
  };

  const handleNavClick = (section: string) => {
    analytics.track('Nav Link Clicked', { section });
  };

  const features = [
    {
      icon: Users,
      title: 'Intelligent Athlete Profiles',
      description: 'Centralized performance data with automated tracking, trend analysis, and predictive insights for every swimmer.',
      benefits: [
        'Complete performance history with trend visualization',
        'Automated data aggregation from training sessions',
        'Predictive analytics for goal achievement'
      ],
      screenshot: 'squad-dashboard.png'
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Workout Intelligence',
      description: 'Machine learning algorithms analyze swimmer data to generate scientifically-optimized training plans tailored to individual performance profiles.',
      benefits: [
        'Data-driven workout recommendations based on historical performance',
        'Adaptive training loads using fatigue and recovery metrics',
        'Automated periodization aligned with competition schedules'
      ],
      screenshot: 'ai-coach.png'
    },
    {
      icon: TrendingUp,
      title: 'Advanced Performance Analytics',
      description: 'Real-time data processing with FINA points, velocity curves, improvement rates, and statistical modeling to identify performance patterns.',
      benefits: [
        'Multi-dimensional performance metrics and benchmarking',
        'Predictive modeling for race times and progression',
        'Statistical analysis of training effectiveness'
      ],
      screenshot: 'analytics-fina.png'
    },
    {
      icon: BookOpen,
      title: 'Smart Workout Database',
      description: 'Machine-learning powered workout repository that tracks effectiveness metrics and recommends proven training sets.',
      benefits: [
        'Performance outcome tracking for each workout',
        'AI-recommended workouts based on success patterns',
        'Data-driven workout optimization and iteration'
      ],
      screenshot: 'workout-library.png'
    }
  ];

  const pricingTiers = [
    {
      name: 'Free',
      tagline: 'Perfect for getting started',
      features: [
        { name: '1 Squad', included: true },
        { name: 'Up to 10 Swimmers', included: true },
        { name: 'Basic Workout Tracking', included: true },
        { name: 'Attendance Tracking', included: true },
        { name: 'Performance Analytics', included: false },
        { name: 'AI Workout Generation', included: false },
        { name: 'Time Standards', included: false },
        { name: 'Workout Library', included: false }
      ]
    },
    {
      name: 'Pro',
      tagline: 'For serious coaches',
      popular: true,
      features: [
        { name: 'Unlimited Squads', included: true },
        { name: 'Unlimited Swimmers', included: true },
        { name: 'Advanced Workout Tracking', included: true },
        { name: 'Attendance Tracking', included: true },
        { name: 'Performance Analytics', included: true },
        { name: 'AI Workout Generation', included: true },
        { name: 'Time Standards', included: true },
        { name: 'Workout Library', included: true }
      ]
    },
    {
      name: 'Team',
      tagline: 'For organizations',
      features: [
        { name: 'Everything in Pro', included: true },
        { name: 'Multi-Coach Access', included: true },
        { name: 'Advanced Permissions', included: true },
        { name: 'Priority Support', included: true },
        { name: 'Custom Integrations', included: true },
        { name: 'Dedicated Account Manager', included: true },
        { name: 'Training & Onboarding', included: true },
        { name: 'API Access', included: true }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                aquilus
              </span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => {
                  handleNavClick('features');
                  featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-slate-300 hover:text-cyan-400 transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => {
                  handleNavClick('pricing');
                  pricingRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-slate-300 hover:text-cyan-400 transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => navigate('/login')}
                className="text-slate-300 hover:text-cyan-400 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => handleCTAClick('nav')}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-medium transition-all shadow-lg shadow-cyan-500/20"
              >
                Request Beta Access
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Beta Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-full mb-8">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-slate-300">
                Limited Beta - {50 - betaCount} Spots Remaining
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Data-Driven Swim Coaching
              </span>
              <br />
              <span className="text-slate-100">Powered by AI & Analytics</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-400 mb-12 leading-relaxed">
              Make smarter coaching decisions with AI-powered insights, real-time performance analytics, 
              and data-driven training tools that transform how you develop swimmers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => handleCTAClick('hero-primary')}
                className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-xl font-semibold text-lg transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
              >
                <span className="flex items-center gap-2">
                  Request Beta Access
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={() => {
                  analytics.track('Hero CTA Clicked', { button_location: 'hero-secondary' });
                  featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl font-semibold text-lg transition-all"
              >
                See Features
              </button>
            </div>

            {/* Social Proof */}
            <div className="mt-16 pt-8 border-t border-slate-800/60">
              <p className="text-slate-500 text-sm mb-4">Trusted by coaches from</p>
              <div className="flex flex-wrap justify-center gap-8 text-slate-600 text-sm">
                <span>High School Teams</span>
                <span>•</span>
                <span>Club Swimming</span>
                <span>•</span>
                <span>Masters Programs</span>
                <span>•</span>
                <span>Private Coaching</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Your Complete Performance Intelligence Platform
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Advanced analytics, AI-powered insights, and data visualization tools that turn 
              raw swim data into actionable coaching strategies.
            </p>
          </div>

          <div className="space-y-20">
            {features.map((feature, index) => {
              const isInteractive = ['squad-dashboard.png', 'workout-library.png', 'analytics-fina.png', 'ai-coach.png'].includes(feature.screenshot);
              const isReversed = index % 2 === 1;
              
              return (
                <div
                  key={index}
                  data-feature={feature.title}
                  className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 lg:gap-12 items-center`}
                >
                  {/* Interactive Demo / Screenshot */}
                  <div className="flex-1 w-full">
                    {feature.screenshot === 'squad-dashboard.png' ? (
                      <MiniAthleteProfile />
                    ) : feature.screenshot === 'workout-library.png' ? (
                      <MiniWorkoutLibrary />
                    ) : feature.screenshot === 'analytics-fina.png' ? (
                      <MiniAnalyticsChart />
                    ) : feature.screenshot === 'ai-coach.png' ? (
                      <MiniAICoach />
                    ) : (
                      <div className="relative group">
                        <div className="aspect-video bg-slate-950/80 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl hover:shadow-cyan-500/20 transition-all duration-500">
                          <img 
                            src={`/screenshots/${feature.screenshot}`}
                            alt={`${feature.title} screenshot`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            style={{ imageRendering: 'crisp-edges' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                          {/* Fallback placeholder */}
                          <div className="w-full h-full hidden items-center justify-center bg-slate-900/50">
                            <div className="text-center">
                              <div className="w-16 h-16 mx-auto mb-3 rounded-lg bg-slate-700/50 flex items-center justify-center">
                                <feature.icon className="w-8 h-8 text-slate-500" />
                              </div>
                              <p className="text-slate-500 text-sm">{feature.screenshot}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 w-full">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-14 h-14 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                        <feature.icon className="w-7 h-7 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold text-white mb-2">{feature.title}</h3>
                        {isInteractive && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-xs font-medium text-cyan-300">
                            <Sparkles className="w-3 h-3" />
                            Interactive Demo
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-lg text-slate-300 mb-6 leading-relaxed">{feature.description}</p>
                    <ul className="space-y-3">
                      {feature.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="text-slate-300">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingRef} className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-6">
              Choose the plan that fits your needs. All plans include core features with room to grow.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-full">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-slate-300">
                Beta Pricing Available - Join Waitlist to Learn More
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <div
                key={index}
                className={`relative bg-slate-900/90 backdrop-blur-xl border rounded-2xl p-8 ${
                  tier.popular 
                    ? 'border-cyan-500/50 shadow-2xl shadow-cyan-500/20' 
                    : 'border-slate-800/60'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-linear-to-r from-cyan-500 to-blue-500 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-100 mb-2">{tier.name}</h3>
                  <p className="text-slate-400 text-sm">{tier.tagline}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-700 shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? 'text-slate-300' : 'text-slate-500'}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCTAClick(`pricing-${tier.name.toLowerCase()}`)}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    tier.popular
                      ? 'bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  Join Waitlist
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-12 shadow-2xl shadow-cyan-500/10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Coach with Data?
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            Join the limited beta and be among the first 50 coaches to experience AI-powered performance analytics 
            that turn data into faster swimmers.
          </p>
          <button
            onClick={() => handleCTAClick('footer-cta')}
            className="group px-8 py-4 bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-xl font-semibold text-lg transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
          >
            <span className="flex items-center gap-2">
              Request Beta Access Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="font-bold text-lg bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  aquilus
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                AI-powered performance analytics platform transforming swim coaching with data-driven insights.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}>Features</button></li>
                <li><button onClick={() => pricingRef.current?.scrollIntoView({ behavior: 'smooth' })}>Pricing</button></li>
                <li><button onClick={() => handleCTAClick('footer-link')}>Beta Access</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => navigate('/privacy')} className="hover:text-cyan-400 transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => navigate('/terms')} className="hover:text-cyan-400 transition-colors">Terms of Service</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <p className="text-slate-400 text-sm">
                Questions about the beta? Reach out and we'll get back to you within 24 hours.
              </p>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-800/60 text-center text-slate-500 text-sm">
            © {new Date().getFullYear()} Lablytics. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
