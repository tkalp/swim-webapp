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
      color: 'text-blue-400',
      bgColor: 'from-blue-500/20 to-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      label: 'Present',
      value: attendance?.present ?? 0,
      subtitle: `of ${totalAttendance}`,
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'from-green-500/20 to-green-500/10',
      borderColor: 'border-green-500/30',
    },
    {
      label: 'Late',
      value: attendance?.late ?? 0,
      subtitle: `of ${totalAttendance}`,
      icon: Clock,
      color: 'text-orange-400',
      bgColor: 'from-orange-500/20 to-orange-500/10',
      borderColor: 'border-orange-500/30',
    },
    {
      label: 'Absent',
      value: attendance?.absent ?? 0,
      subtitle: `of ${totalAttendance}`,
      icon: Users,
      color: 'text-red-400',
      bgColor: 'from-red-500/20 to-red-500/10',
      borderColor: 'border-red-500/30',
    },
    {
      label: 'Avg / Week',
      value: avgPerWeek,
      subtitle: `${weeksInRange} week(s) in range`,
      icon: Calendar,
      color: 'text-cyan-400',
      bgColor: 'from-cyan-500/20 to-cyan-500/10',
      borderColor: 'border-cyan-500/30',
    },
  ];

  return (
    <section className="flex flex-wrap gap-3">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={stat.label}
            className={`flex-1 min-w-[150px] bg-slate-900/90 backdrop-blur-xl border ${stat.borderColor} rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 group`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-lg bg-linear-to-br ${stat.bgColor} flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                <IconComponent size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium truncate">
                  {stat.label}
                </div>
              </div>
            </div>
            
            <div className="ml-12">
              <div className={`text-2xl font-bold ${stat.color} group-hover:scale-105 transition-transform duration-300`}>
                {stat.value}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {stat.subtitle}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
