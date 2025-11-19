// components/ui/PageHeader.tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import logo from '../../assets/logo.png';

type Tab = {
  key: string;
  label: string;
};

type PageHeaderProps = {
  title: string | React.ReactNode;
  backLabel?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  className?: string;
  rightContent?: React.ReactNode;
};

export default function PageHeader({
  title,
  backLabel = 'Back',
  tabs = [],
  activeTab,
  onTabChange,
  className = '',
  rightContent,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={`bg-background-primary/50 border-b border-border/30 ${className}`.trim()}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button & Title */}
        <div className="flex items-center gap-4 mb-4">
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-primary hover:bg-background-elevated/60 transition-all group"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">{backLabel}</span>
          </button>
          <div className="h-6 w-px bg-border/40"></div>
          <h1 className="text-3xl font-bold text-text-primary">
            {title}
          </h1>
          {rightContent && (
            <>
              <div className="h-6 w-px bg-border/40 ml-auto"></div>
              <div className="flex items-center gap-3">
                {rightContent}
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex gap-1 border-b border-border/20 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`px-6 py-3 text-sm font-semibold transition-all relative ${
                  activeTab === tab.key
                    ? 'text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => onTabChange?.(tab.key)}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-dark via-primary to-accent"></div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}