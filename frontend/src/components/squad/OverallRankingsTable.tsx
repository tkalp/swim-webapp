import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSquadOverallRankings, formatTime, OverallRanking } from '../../services/workoutResultService'
import { Trophy, Medal, Award } from 'lucide-react'

interface OverallRankingsTableProps {
  squadId: string
}

export const OverallRankingsTable: React.FC<OverallRankingsTableProps> = ({ squadId }) => {
  // Fetch SCM rankings
  const { data: scmRankings = [], isLoading: scmLoading, error: scmError } = useQuery({
    queryKey: ['overallRankings', squadId, 'SCM'],
    queryFn: () => getSquadOverallRankings(squadId, 'SCM'),
    enabled: !!squadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch LCM rankings
  const { data: lcmRankings = [], isLoading: lcmLoading, error: lcmError } = useQuery({
    queryKey: ['overallRankings', squadId, 'LCM'],
    queryFn: () => getSquadOverallRankings(squadId, 'LCM'),
    enabled: !!squadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const loading = scmLoading || lcmLoading
  const error = scmError || lcmError ? 'Failed to load overall rankings' : null

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />;
    return <span className="text-sm font-semibold text-slate-400">#{rank}</span>;
  }

  const renderRankingsTable = (rankings: OverallRanking[], title: string) => {
    if (rankings.length === 0) {
      return (
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-100 mb-3">{title}</h3>
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl border border-slate-800/60 p-8 text-center">
            <p className="text-slate-400 text-sm">No rankings available</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-slate-100 mb-3">{title}</h3>
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl border border-slate-800/60 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-700/60">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Swimmer</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">50 Fly</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">100 Back</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">100 Breast</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">200 Free</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">200 IM</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((ranking, index) => {
                  const isIncomplete = !ranking.has_all_events
                  
                  return (
                    <tr
                      key={ranking.swimmer_id}
                      className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${
                        isIncomplete ? 'opacity-50 bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {ranking.has_all_events ? getRankIcon(index + 1) : <span className="text-slate-500">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-100">{ranking.swimmer_name}</span>
                          {isIncomplete && (
                            <span className="text-xs text-slate-500">
                              {ranking.events_completed}/5 events
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-300">
                        {ranking.fifty_fly ? formatTime(ranking.fifty_fly) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-300">
                        {ranking.hundred_back ? formatTime(ranking.hundred_back) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-300">
                        {ranking.hundred_breast ? formatTime(ranking.hundred_breast) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-300">
                        {ranking.two_hundred_free ? formatTime(ranking.two_hundred_free) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-300">
                        {ranking.two_hundred_im ? formatTime(ranking.two_hundred_im) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-cyan-400">
                          {ranking.total_time ? formatTime(ranking.total_time) : <span className="text-slate-500">—</span>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 backdrop-blur-xl rounded-xl border border-red-800/60 p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 p-4 bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/60">
        <p className="text-sm text-slate-300">
          Overall Rankings show swimmers' combined times across 5 pentathlon events: <strong>50 Fly</strong>, <strong>100 Back</strong>, <strong>100 Breast</strong>, <strong>200 Free</strong>, and <strong>200 IM</strong>.
          Only swimmers with all 5 events receive a rank.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderRankingsTable(scmRankings, 'Short Course (SCM)')}
        {renderRankingsTable(lcmRankings, 'Long Course (LCM)')}
      </div>
    </div>
  )
}
