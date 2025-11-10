import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getEventAttempts, type EventQuery, formatTime } from '../../../features/swimmers/bestTimesApi'
import AttemptsStats from './AttemptsStats'
import AttemptsChart from './AttemptsChart'
import { X, AlertCircle, Activity, Edit2, Calendar, Clock } from 'lucide-react'

export default function AttemptsModal({
  open, onClose, query, onEditAttempt
}: { open: boolean; onClose: ()=>void; query: EventQuery; onEditAttempt?: (attemptId: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [rows, setRows] = useState<Array<{ id:string; performedOn:string|null; timeSeconds:number; timeResult:string }>>([])

  useEffect(() => {
    if (!open) return
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const r = await getEventAttempts(query)
        if (!mounted) return
        setRows(r)
        setErr('')
      } catch (e:any) {
        setErr(e.message ?? 'Failed to load attempts')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [open, query])

  const data = useMemo(() => rows.map((r, i) => ({
    i: i + 1,
    date: r.performedOn ? new Date(r.performedOn).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) : `#${i+1}`,
    seconds: r.timeSeconds
  })), [rows])

  const first = rows[0]?.timeSeconds
  const last = rows[rows.length-1]?.timeSeconds
  const best = rows.reduce((m, r) => r.timeSeconds < m ? r.timeSeconds : m, Number.POSITIVE_INFINITY)
  const delta = (first && last) ? (last - first) : 0 // negative is improvement
  const improvedPct = (first && last) ? Math.round(((first - last) / first) * 100) : 0

  if (!open) return null

  const captialize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-background-secondary border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="relative flex items-center justify-between p-6 sm:p-8 border-b border-border bg-background-elevated">
          {/* Gradient top bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-dark via-primary to-accent"></div>
          
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
              {query.distance}{query.units === 'yards' ? 'Y' : 'M'} {captialize(query.stroke)} {captialize(query.activity)}
            </h2>
            {query.equipment !== 'none' && (
              <p className="text-text-secondary text-sm">
                Equipment: <span className="font-semibold text-primary">{query.equipment}</span>
              </p>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-background-tertiary border border-border text-text-muted hover:bg-background-secondary hover:border-danger hover:text-danger hover:scale-105 transition-all flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {err && (
            <div className="bg-background-elevated border border-danger rounded-xl p-4 mb-6 flex items-center gap-3 animate-in slide-in-from-top duration-300">
              <AlertCircle size={20} className="text-danger shrink-0" />
              <p className="text-danger text-sm">{err}</p>
            </div>
          )}

          {loading && (
            <div className="space-y-6">
              {/* Loading stats */}
              <div className="flex flex-col sm:flex-row gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex-1 h-32 bg-background-elevated rounded-2xl border border-border animate-pulse">
                    <div className="p-6">
                      <div className="h-4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded mb-3"></div>
                      <div className="h-6 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded mb-2"></div>
                      <div className="h-3 w-2/3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Loading chart */}
              <div className="h-96 bg-background-elevated rounded-2xl border border-border animate-pulse">
                <div className="p-6">
                  <div className="h-6 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded mb-6"></div>
                  <div className="h-64 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded"></div>
                </div>
              </div>
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-background-elevated border-2 border-dashed border-border rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary mb-4">
                <Activity size={32} />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Attempts Yet</h3>
              <p className="text-text-muted">No attempts have been recorded for this event.</p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-500 delay-200">
              <AttemptsStats
                first={first!}
                last={last!}
                best={best}
                totalAttempts={rows.length}
                delta={delta}
                improvedPct={improvedPct}
              />

              <AttemptsChart
                data={data}
                bestTime={best}
              />

              {/* List of all attempts with edit buttons */}
              <div className="bg-background-elevated border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-background-secondary/50">
                  <h3 className="text-sm font-semibold text-text-primary">All Attempts</h3>
                  <p className="text-xs text-text-tertiary mt-1">
                    {rows.length} {rows.length === 1 ? 'attempt' : 'attempts'} recorded
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {rows.map((row, index) => {
                    const isBest = row.timeSeconds === best
                    return (
                      <div
                        key={row.id}
                        className="p-4 hover:bg-background-secondary/50 transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {/* Attempt number */}
                          <div className="w-8 h-8 rounded-lg bg-background-tertiary border border-border flex items-center justify-center text-xs font-semibold text-text-secondary">
                            #{index + 1}
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Calendar size={14} className="text-text-muted" />
                            <span className="text-sm text-text-secondary">
                              {row.performedOn
                                ? new Date(row.performedOn).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Unknown'}
                            </span>
                          </div>

                          {/* Time */}
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                            isBest
                              ? 'bg-gradient-to-r from-primary/20 to-accent/20 border-primary/40'
                              : 'bg-background-tertiary border-border/50'
                          }`}>
                            <Clock size={14} className={isBest ? 'text-primary' : 'text-text-muted'} />
                            <span className={`text-lg font-bold ${
                              isBest ? 'text-primary' : 'text-text-primary'
                            }`}>
                              {formatTime(row.timeSeconds)}
                            </span>
                            {isBest && (
                              <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-primary bg-primary/10 rounded">
                                BEST
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit button */}
                        {onEditAttempt && (
                          <button
                            onClick={() => onEditAttempt(row.id)}
                            className="p-2 rounded-lg bg-background-tertiary border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent transition-all duration-200 hover:scale-105"
                            title="Edit attempt"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
