import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type BestTimeResult } from '@/services/workoutResultService';
import { useSquadQualifiersOptimized } from '@/hooks/useSquadQualifiers';
import { StandardsSelector } from '@/components/swimmers/timeStandards';
import { calculateSwimmerAge, mapGenderToStandards, timeStringToSeconds, getStandardsForEvent } from '@/services/swimmerStandards';
import { formatTime } from '@/utils/timeUtils';
import { Target } from 'lucide-react';
import {
  QualifiersSummary,
  QualifiersTable,
  type Swimmer,
  type EventKey,
  type SwimmerQualification,
  COMMON_EVENTS,
} from './index';

type Props = {
  squadId: string;
};

export default function SquadQualifiersTab({ squadId }: Props) {
  // OPTIMIZED: Use single query instead of N+1 queries
  const { data: qualifiersData, isLoading: loading, error: queryError } = useSquadQualifiersOptimized(squadId);
  
  const [selectedStandardsSetId, setSelectedStandardsSetId] = useState<string | null>(null);
  const [poolType, setPoolType] = useState<'SCM' | 'LCM'>('SCM');
  const [standardsMap, setStandardsMap] = useState<Map<string, number>>(new Map());

  const error = queryError ? String(queryError) : '';
  
  // Transform API data to component format
  const swimmers: Swimmer[] = useMemo(() => {
    if (!qualifiersData?.swimmers) return [];
    return qualifiersData.swimmers.map(s => ({
      id: s.swimmer_id,
      first_name: s.first_name,
      last_name: s.last_name,
      date_of_birth: s.date_of_birth,
      sex: s.sex,
    }));
  }, [qualifiersData]);

  const bestTimesMap = useMemo(() => {
    if (!qualifiersData?.swimmers) return new Map<string, BestTimeResult[]>();
    
    const map = new Map<string, BestTimeResult[]>();
    qualifiersData.swimmers.forEach(swimmer => {
      const bestTimes: BestTimeResult[] = swimmer.best_times.map(bt => ({
        id: "test",
        distance: bt.distance,
        stroke: bt.stroke,
        activity: bt.activity,
        equipment: bt.equipment,
        resultUnits: bt.result_units,
        timeSeconds: bt.time_seconds,
        performedOn: bt.performed_on,
        attemptsCount: 1, // Not used in this component
        recentTrend: null, // Not used in this component,
        eventKey: `${bt.distance}M_${bt.stroke}_${bt.activity}_${bt.result_units}_${bt.equipment}`,
        units: bt.result_units,
        timeResult: "", // Alias for clarity
        numberOfResults: 1, // Not used in this component
      }));
      map.set(swimmer.swimmer_id, bestTimes);
    });
    return map;
  }, [qualifiersData]);

  useEffect(() => {
    if (selectedStandardsSetId && swimmers.length > 0) {
      loadAllStandards();
    } else {
      setStandardsMap(new Map());
    }
  }, [selectedStandardsSetId, swimmers, poolType]);

  const loadAllStandards = async () => {
    if (!selectedStandardsSetId || swimmers.length === 0) return;

    const map = new Map<string, number>();
    
    // Collect all unique age/gender combinations
    const swimmerProfiles = new Set<string>();
    const ageGenderMap = new Map<string, { age: number; gender: string }>();
    
    for (const swimmer of swimmers) {
      const age = calculateSwimmerAge(swimmer.date_of_birth);
      const gender = mapGenderToStandards(swimmer.sex);
      if (gender === 'X') continue;
      
      const key = `${age}-${gender}`;
      if (!swimmerProfiles.has(key)) {
        swimmerProfiles.add(key);
        ageGenderMap.set(key, { age, gender });
      }
    }

    // Build a single query for all needed standards
    const { data: standards, error } = await supabase
      .from('time_standards')
      .select('distance, stroke, age_group_min, age_group_max, gender, standard_level, scm_time, lcm_time')
      .eq('set_id', selectedStandardsSetId)
      .order('standard_level', { ascending: true });

    if (error) {
      console.error('Error loading standards:', error);
      return;
    }

    if (!standards) return;

    // Build the map from the results
    for (const [profileKey, profile] of ageGenderMap) {
      for (const event of COMMON_EVENTS) {
        const timeField = poolType === 'SCM' ? 'scm_time' : 'lcm_time';
        
        // Find matching standard that has a time for this pool type
        // Check for gender-specific standard first, then fall back to mixed/open (X)
        const matchingStandard = standards.find(s => 
          s.distance === event.distance &&
          s.stroke === event.stroke &&
          s[timeField] != null &&
          (s.gender === profile.gender || s.gender === 'X') &&
          profile.age >= (s.age_group_min || 0) &&
          profile.age <= (s.age_group_max || 999)
        );

        if (matchingStandard) {
          const timeString = matchingStandard[timeField];
          
          if (timeString) {
            const key = `${event.distance}-${event.stroke}-${poolType}-${profile.age}-${profile.gender}`;
            map.set(key, timeStringToSeconds(timeString));
          }
        }
      }
    }
    
    setStandardsMap(map);
  };

  const getStandardTime = useCallback((
    distance: number,
    stroke: string,
    poolType: string,
    age: number,
    sex: string
  ): number | null => {
    const gender = mapGenderToStandards(sex);
    if (gender === 'X') return null;
    
    const key = `${distance}-${stroke}-${poolType}-${age}-${gender}`;
    return standardsMap.get(key) ?? null;
  }, [standardsMap]);

  const swimmerQualifications = useMemo(() => {
    if (!selectedStandardsSetId) return [];

    // Create events for the selected pool type
    const currentEvents = COMMON_EVENTS.map(event => ({
      ...event,
      poolType: poolType
    }));

    return swimmers.map(swimmer => {
      const age = calculateSwimmerAge(swimmer.date_of_birth);
      const bestTimes = bestTimesMap.get(swimmer.id) || [];
      
      const timesMap = new Map<string, BestTimeResult>();
      bestTimes.forEach(time => {
        if (time.activity?.toLowerCase() === 'swim' && time.equipment?.toLowerCase() === 'none') {
          const key = `${time.distance}-${time.stroke.toLowerCase()}-${time.resultUnits}`;
          const existing = timesMap.get(key);
          if (!existing || time.timeSeconds < existing.timeSeconds) {
            timesMap.set(key, time);
          }
        }
      });

      let qualifiedCount = 0;
      let closeCount = 0;

      currentEvents.forEach(event => {
        const key = `${event.distance}-${event.stroke}-${event.poolType}`;
        const bestTime = timesMap.get(key);
        
        if (bestTime) {
          const standardTime = getStandardTime(
            event.distance,
            event.stroke,
            event.poolType,
            age,
            swimmer.sex
          );

          if (standardTime) {
            const gap = ((bestTime.timeSeconds - standardTime) / standardTime) * 100;
            if (gap < 0) qualifiedCount++;
            else if (gap < 5) closeCount++;
          }
        }
      });

      return {
        swimmer,
        age,
        bestTimes: timesMap,
        qualifiedCount,
        closeCount,
      };
    });
  }, [swimmers, bestTimesMap, selectedStandardsSetId, getStandardTime, poolType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-lg">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!selectedStandardsSetId) {
    return (
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 bg-linear-to-br from-slate-950/50 via-transparent to-slate-950/50">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-linear-to-r from-violet-400 to-fuchsia-400 bg-clip-text">Qualifiers</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 font-medium">View swimmer qualification status for selected time standards</p>
        </div>
        <StandardsSelector
          selectedSetId={selectedStandardsSetId}
          onSetChange={setSelectedStandardsSetId}
        />
        <div className="p-6 sm:p-8 text-center bg-slate-900/50 rounded-lg border border-slate-700/50 mt-4 sm:mt-6">
          <Target size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400">Select a time standards set to view qualifications</p>
        </div>
      </div>
    );
  }


  const totalQualified = swimmerQualifications.filter(sq => sq.qualifiedCount > 0).length;
  const totalClose = swimmerQualifications.filter(sq => sq.closeCount > 0).length;

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 bg-linear-to-br from-slate-950/50 via-transparent to-slate-950/50">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-linear-to-r from-violet-400 to-fuchsia-400 bg-clip-text">Qualifiers</h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1 font-medium">View swimmer qualification status for selected time standards</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
        <StandardsSelector
          selectedSetId={selectedStandardsSetId}
          onSetChange={setSelectedStandardsSetId}
        />
        
        {/* Pool Type Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500">Pool Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPoolType('SCM')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                poolType === 'SCM'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
              }`}
            >
              SCM (25m)
            </button>
            <button
              onClick={() => setPoolType('LCM')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                poolType === 'LCM'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
              }`}
            >
              LCM (50m)
            </button>
          </div>
        </div>
      </div>

      <QualifiersSummary
        totalQualified={totalQualified}
        totalClose={totalClose}
        totalSwimmers={swimmers.length}
      />

      <QualifiersTable
        swimmers={swimmerQualifications}
        events={COMMON_EVENTS.map(e => ({ ...e, poolType }))}
        getStandardTime={getStandardTime}
        formatTime={formatTime}
      />
    </div>
  );
}
