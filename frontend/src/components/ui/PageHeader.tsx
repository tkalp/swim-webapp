// components/ui/PageHeader.tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Waves } from 'lucide-react';

type Tab = {
  key: string;
  label: string;
};

type PageHeaderProps = {
  title: string;
  backLabel?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  className?: string;
};

export default function PageHeader({
  title,
  backLabel = 'Back',
  tabs = [],
  activeTab,
  onTabChange,
  className = '',
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={`sticky top-0 z-[100] bg-[var(--color-background-elevated)]/95 border-b border-[var(--color-border)] px-4 sm:px-8 py-4 sm:py-5 backdrop-blur-xl shadow-lg before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-gradient-to-r before:from-[var(--color-primary-dark)] before:via-[var(--color-primary)] before:to-[var(--color-accent)] ${className}`.trim()}>
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 sm:gap-8 flex-wrap">
        {/* Logo and Breadcrumbs */}
        <div className="flex items-center gap-3 sm:gap-5 text-base w-full sm:w-auto">
          {/* Logo */}
          <button
            className="flex items-center gap-2 cursor-pointer transition-all hover:scale-105 bg-transparent border-none p-0"
            onClick={() => navigate('/')}
            title="Home"
          >
            <Waves size={24} className="text-[var(--color-primary)]" />
            <span className="hidden sm:inline text-lg font-bold bg-gradient-to-r from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">
              aquilus
            </span>
          </button>

          <span className="text-[var(--color-border)] text-xl">/</span>
          
          <button
            className="flex items-center gap-2 text-[var(--color-text-secondary)] bg-none border-none font-semibold cursor-pointer transition-all px-3 py-2 rounded-lg hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 hover:scale-105"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} />
            <span>{backLabel}</span>
          </button>
          
          <span className="text-[var(--color-border)] text-xl">/</span>
          
          <span className="text-[var(--color-text-primary)] font-bold text-lg">
            {title}
          </span>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex gap-2 bg-[var(--color-background-tertiary)]/50 p-1.5 rounded-xl border border-[var(--color-border)]/50 shadow-inner w-full sm:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`px-4 sm:px-6 py-2.5 rounded-lg transition-all text-sm font-semibold whitespace-nowrap flex-1 sm:flex-none ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-primary)]/30 scale-105'
                    : 'bg-[var(--color-background-elevated)]/50 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-elevated)] hover:scale-105 border border-transparent hover:border-[var(--color-border)]'
                }`}
                onClick={() => onTabChange?.(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}