// components/ui/Breadcrumb.tsx
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center gap-2 text-sm ${className}`}
    >
      <ol className="flex items-center gap-2">
        {/* Home link */}
        <li>
          <Link
            to="/squads"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors duration-200"
            aria-label="Home"
          >
            <Home size={16} />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li key={index} className="flex items-center gap-2">
              <ChevronRight size={16} className="text-slate-600" aria-hidden="true" />
              
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="text-slate-400 hover:text-cyan-400 transition-colors duration-200 font-medium"
                >
                  {item.label}
                </Link>
              ) : (
                <span 
                  className={isLast ? 'text-slate-200 font-semibold' : 'text-slate-400 font-medium'}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
