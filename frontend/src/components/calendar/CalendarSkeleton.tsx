// components/calendar/CalendarSkeleton.tsx

export function CalendarSkeleton() {
  return (
    <div className="w-full h-full min-h-[700px] bg-gradient-to-br from-[#0A0B0F] via-[#111827] to-[#0A0B0F] rounded-2xl p-6 shadow-2xl border border-gray-800/50 relative overflow-hidden animate-pulse">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(34, 211, 238, 0.15) 1px, transparent 0)',
        backgroundSize: '32px 32px'
      }}></div>
      
      <div className="relative z-10 space-y-5">
        {/* Toolbar Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-cyan-500/20">
          {/* Navigation buttons */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-800/60 border border-cyan-500/20"></div>
            <div className="w-20 h-10 rounded-xl bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/30"></div>
            <div className="w-10 h-10 rounded-xl bg-gray-800/60 border border-cyan-500/20"></div>
          </div>
          
          {/* Month label */}
          <div className="h-9 w-48 rounded-lg bg-gradient-to-r from-cyan-500/20 to-teal-500/20"></div>
          
          {/* View switcher */}
          <div className="flex gap-2 bg-gray-800/60 p-1.5 rounded-xl border border-cyan-500/20">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-16 h-9 rounded-lg bg-gray-700/30"></div>
            ))}
          </div>
        </div>
        
        {/* Calendar Grid Skeleton */}
        <div className="bg-gray-800/40 border border-cyan-500/15 rounded-2xl overflow-hidden p-4">
          {/* Header row */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                <span className="text-cyan-400/50 text-xs font-bold">{day}</span>
              </div>
            ))}
          </div>
          
          {/* Calendar days grid */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-gray-900/40 rounded-lg border border-gray-700/30 p-2 relative"
              >
                {/* Day number skeleton */}
                <div className="w-8 h-6 bg-gray-700/50 rounded absolute top-2 right-2"></div>
                
                {/* Random event skeletons */}
                {i % 3 === 0 && (
                  <div className="absolute bottom-2 left-2 right-2 space-y-1">
                    <div className="h-6 bg-cyan-500/20 rounded border-l-4 border-cyan-500/40"></div>
                  </div>
                )}
                {i % 5 === 0 && (
                  <div className="absolute bottom-2 left-2 right-2 space-y-1">
                    <div className="h-6 bg-teal-500/20 rounded border-l-4 border-teal-500/40"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent animate-shimmer"></div>
      </div>
      
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}
