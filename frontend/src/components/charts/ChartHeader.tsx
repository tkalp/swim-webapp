import { BarChart3, TrendingUp } from "lucide-react";

export default function ChartHeader({title, subtitle, total}:{title: string, subtitle?: string, total: number}) {
  return (
    <div className="chart-header">
        <div className="chart-title-section">
          <div className="chart-icon">
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 className="chart-title">{title}</h3>
            {subtitle && <p className="chart-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="chart-total">
          <TrendingUp size={16} className="total-icon" />
          <span className="total-label">Total:</span>
          <span className="total-value">{total}</span>
        </div>
      </div>
  )
}