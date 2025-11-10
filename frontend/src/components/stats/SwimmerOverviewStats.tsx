import { TrendingUp, Users, Clock, Calendar, Target } from 'lucide-react';

type Props = {
  presentPct: number;
  attendance?: { present: number; late: number; absent: number } | null;
  totalAttendance: number;
  avgPerWeek: number;
  weeksInRange: number;
};

export default function SwimmerOverviewStats({
  presentPct, attendance, totalAttendance, avgPerWeek, weeksInRange
}: Props) {
  const stats = [
    {
      label: 'Attendance Rate',
      value: `${presentPct}%`,
      subtitle: 'Present out of total',
      icon: Target,
      color: 'text-accent',
      bgColor: 'from-accent/20 to-accent/10',
      borderColor: 'border-accent/30',
    },
    {
      label: 'Present',
      value: attendance?.present ?? 0,
      subtitle: `of ${totalAttendance}`,
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'from-success/20 to-success/10',
      borderColor: 'border-success/30',
    },
    {
      label: 'Late',
      value: attendance?.late ?? 0,
      subtitle: `of ${totalAttendance}`,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'from-warning/20 to-warning/10',
      borderColor: 'border-warning/30',
    },
    {
      label: 'Absent',
      value: attendance?.absent ?? 0,
      subtitle: `of ${totalAttendance}`,
      icon: Users,
      color: 'text-danger',
      bgColor: 'from-danger/20 to-danger/10',
      borderColor: 'border-danger/30',
    },
    {
      label: 'Avg / Week',
      value: avgPerWeek,
      subtitle: `${weeksInRange} week(s) in range`,
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'from-primary/20 to-primary/10',
      borderColor: 'border-primary/30',
    },
  ];

  return (
    <section className="flex flex-wrap gap-3">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={stat.label}
            className={`flex-1 min-w-[150px] bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border ${stat.borderColor} rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 group`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.bgColor} flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                <IconComponent size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text-tertiary uppercase tracking-wider font-medium truncate">
                  {stat.label}
                </div>
              </div>
            </div>
            
            <div className="ml-12">
              <div className={`text-2xl font-bold ${stat.color} group-hover:scale-105 transition-transform duration-300`}>
                {stat.value}
              </div>
              <div className="text-xs text-text-secondary truncate">
                {stat.subtitle}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
