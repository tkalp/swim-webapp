"""
Swimmer Data Aggregator
Transforms raw database records into intelligent coaching insights
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
import statistics
from dataclasses import dataclass
from collections import defaultdict
from supabase import Client


@dataclass
class PerformanceDataPoint:
    """Single performance measurement"""
    date: datetime
    distance: int
    time_seconds: float
    stroke: str
    activity: str
    training_session_id: str


@dataclass
class CoachFeedback:
    """Coach feedback from practice notes"""
    date: datetime
    overall_rating: int
    effort_level: int
    technique_quality: int
    positivity: int
    what_went_well: str
    areas_for_improvement: str
    next_session_focus: str


@dataclass
class WorkoutEffectiveness:
    """Effectiveness metrics for a specific workout"""
    workout_id: str
    workout_name: str
    avg_performance_improvement: float
    avg_coach_satisfaction: float
    attendance_impact: float
    technique_improvement: float
    optimal_timing_score: float


class SwimmerDataAggregator:
    """
    Aggregates and analyzes swimmer data to provide intelligent coaching insights
    """
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
    
    def _interval_to_seconds(self, interval_str: str) -> float:
        """Convert PostgreSQL interval string to seconds"""
        if not interval_str:
            return 0.0
        
        try:
            # PostgreSQL intervals come as strings like "00:01:23.45" or "01:23.45"
            # Handle both HH:MM:SS.mmm and MM:SS.mmm formats
            parts = interval_str.split(':')
            
            if len(parts) == 3:  # HH:MM:SS.mmm
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = float(parts[2])
                result = hours * 3600 + minutes * 60 + seconds
                print(f"Parsed time '{interval_str}' as {result} seconds")
                return result
            elif len(parts) == 2:  # MM:SS.mmm
                minutes = int(parts[0])
                seconds = float(parts[1])
                result = minutes * 60 + seconds
                print(f"Parsed time '{interval_str}' as {result} seconds")
                return result
            else:  # Just seconds
                result = float(interval_str)
                print(f"Parsed time '{interval_str}' as {result} seconds")
                return result
                
        except (ValueError, IndexError) as e:
            print(f"Error parsing interval '{interval_str}': {e}")
            return 0.0
    
    def get_swimmer_performance_timeline(self, swimmer_id: str, days_back: int = 90) -> Dict:
        """
        Analyze swimmer's performance patterns over time
        
        Returns comprehensive timeline with trends, plateaus, and predictions
        """
        # Get performance data
        performance_data = self._fetch_swimmer_results(swimmer_id, days_back)
        
        if not performance_data:
            return {"error": "No performance data found", "swimmer_id": swimmer_id}
        
        # Group by stroke and distance for trend analysis
        stroke_trends = self._analyze_stroke_trends(performance_data)
        distance_trends = self._analyze_distance_trends(performance_data)
        
        # Detect plateaus and breakthroughs
        plateau_analysis = self._detect_performance_plateaus(performance_data)
        
        # Calculate training response patterns
        response_patterns = self._analyze_training_response(swimmer_id, performance_data)
        
        # Identify seasonal patterns
        seasonal_patterns = self._identify_seasonal_patterns(performance_data)
        
        return {
            "swimmer_id": swimmer_id,
            "analysis_period_days": days_back,
            "stroke_trends": stroke_trends,
            "distance_trends": distance_trends,
            "plateau_analysis": plateau_analysis,
            "training_response": response_patterns,
            "seasonal_patterns": seasonal_patterns,
            "recommendations": self._generate_performance_recommendations(
                stroke_trends, plateau_analysis, response_patterns
            )
        }
    
    def get_workout_effectiveness_scores(self, workout_id: str) -> Dict:
        """
        Calculate effectiveness metrics for a specific workout
        
        Analyzes impact on performance, coach satisfaction, and athlete response
        """
        # Get all sessions that used this workout
        sessions = self._fetch_workout_sessions(workout_id)
        
        if not sessions:
            return {"error": "No sessions found for workout", "workout_id": workout_id}
        
        # Calculate performance impact
        performance_impact = self._calculate_performance_impact(workout_id, sessions)
        
        # Analyze coach feedback
        coach_satisfaction = self._analyze_coach_satisfaction(sessions)
        
        # Check attendance patterns
        attendance_impact = self._analyze_attendance_impact(sessions)
        
        # Assess technique improvement
        technique_impact = self._assess_technique_impact(sessions)
        
        # Determine optimal timing
        timing_analysis = self._analyze_optimal_timing(sessions)
        
        # Calculate overall effectiveness score
        effectiveness_score = self._calculate_overall_effectiveness(
            performance_impact, coach_satisfaction, attendance_impact, technique_impact
        )
        
        return {
            "workout_id": workout_id,
            "effectiveness_score": effectiveness_score,
            "performance_impact": performance_impact,
            "coach_satisfaction": coach_satisfaction,
            "attendance_impact": attendance_impact,
            "technique_impact": technique_impact,
            "optimal_timing": timing_analysis,
            "recommendations": self._generate_workout_recommendations(
                effectiveness_score, performance_impact, timing_analysis
            )
        }
    
    def get_coach_feedback_patterns(self, swimmer_id: str) -> Dict:
        """
        Analyze patterns in training sessions the swimmer attended
        
        Since coach feedback is session-level, we analyze the sessions this swimmer attended
        """
        try:
            print(f"Starting coaching feedback analysis for swimmer: {swimmer_id}")
            
            # Get sessions this swimmer attended
            attended_sessions = self._fetch_swimmer_attended_sessions(swimmer_id)
            
            if not attended_sessions:
                print("No attended sessions found")
                return {"error": "No training session attendance found", "swimmer_id": swimmer_id}
            
            print(f"Found {len(attended_sessions)} attended sessions")
            
            # Analyze the quality of sessions this swimmer attended
            session_quality_trends = self._analyze_session_quality_trends(attended_sessions)
            
            # Extract coaching themes from sessions attended
            coaching_themes = self._extract_session_coaching_themes(attended_sessions)
            
            # Analyze training frequency and consistency
            attendance_patterns = self._analyze_attendance_patterns(swimmer_id, attended_sessions)
            
            # Correlate session quality with swimmer's performance
            session_performance_correlation = self._correlate_session_quality_performance(
                swimmer_id, attended_sessions
            )
            
            result = {
                "swimmer_id": swimmer_id,
                "sessions_analyzed": len(attended_sessions),
                "session_quality_trends": session_quality_trends,
                "coaching_themes": coaching_themes,
                "attendance_patterns": attendance_patterns,
                "session_performance_correlation": session_performance_correlation,
                "insights": self._generate_session_insights(
                    session_quality_trends, coaching_themes, attendance_patterns
                )
            }
            
            print("Successfully completed coaching feedback analysis")
            return result
            
        except Exception as e:
            print(f"Error in get_coach_feedback_patterns: {e}")
            import traceback
            traceback.print_exc()
            return {
                "error": f"Analysis failed: {str(e)}", 
                "swimmer_id": swimmer_id
            }
    
    # Private helper methods for data analysis
    def _fetch_swimmer_results(self, swimmer_id: str, days_back: int) -> List[PerformanceDataPoint]:
        """Fetch swimmer performance results from database"""
        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).isoformat()
        
        try:
            response = (
                self.supabase
                .table('workout_result')
                .select('''
                    distance,
                    time_result,
                    stroke,
                    activity,
                    training_session_id,
                    performed_on,
                    training_sessions(
                        start_date
                    )
                ''')
                .eq('swimmer_id', swimmer_id)
                .gte('training_sessions.start_date', cutoff_date)
                .not_.is_('time_result', 'null')
                .not_.is_('training_session_id', 'null')
                .order('performed_on', desc=False)
                .execute()
            )
            
            results = []
            for row in response.data:
                # Use performed_on if available, otherwise fall back to session start_date
                if row.get('performed_on'):
                    date_str = row['performed_on']
                else:
                    date_str = row['training_sessions']['start_date']
                
                # Parse datetime and ensure it's timezone-aware
                if date_str.endswith('Z'):
                    date_str = date_str[:-1] + '+00:00'
                parsed_date = datetime.fromisoformat(date_str)
                if parsed_date.tzinfo is None:
                    parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                
                results.append(PerformanceDataPoint(
                    date=parsed_date,
                    distance=row['distance'],
                    time_seconds=self._interval_to_seconds(row['time_result']),
                    stroke=row['stroke'],
                    activity=row['activity'],
                    training_session_id=row['training_session_id']
                ))
            
            return results
            
        except Exception as e:
            print(f"Error fetching swimmer results: {e}")
            return []
    
    def _analyze_stroke_trends(self, performance_data: List[PerformanceDataPoint]) -> Dict:
        """Analyze performance trends by stroke type and activity"""
        stroke_activity_data = defaultdict(list)
        
        for point in performance_data:
            # Group by both stroke and activity (swim, pull, kick)
            key = f"{point.stroke}_{point.activity}"
            stroke_activity_data[key].append({
                'date': point.date,
                'time': point.time_seconds,
                'distance': point.distance
            })
        
        trends = {}
        for stroke_activity, data in stroke_activity_data.items():
            if len(data) >= 3:  # Need minimum data points for trend analysis
                # Sort by date to ensure chronological order
                data.sort(key=lambda x: x['date'])
                times = [d['time'] for d in data]
                
                # Use linear regression for better trend analysis
                improvement_rate = self._calculate_improvement_rate(times)
                
                # Determine trend direction based on improvement rate
                # Positive improvement_rate means getting faster (good)
                # Negative improvement_rate means getting slower (bad)
                if improvement_rate > 1.0:  # More than 1% improvement
                    trend_direction = 'improving'
                elif improvement_rate < -1.0:  # More than 1% decline
                    trend_direction = 'declining'
                else:
                    trend_direction = 'stable'
                
                stroke, activity = stroke_activity.split('_')
                display_name = f"{stroke} ({activity})" if activity != 'swim' else stroke
                
                trends[display_name] = {
                    'trend_direction': trend_direction,
                    'improvement_rate_percent': improvement_rate,
                    'data_points': len(data),
                    'current_form': self._assess_current_form(times[-3:]),
                    'activity': activity,
                    'stroke': stroke
                }
        
        return trends
    
    def _detect_performance_plateaus(self, performance_data: List[PerformanceDataPoint]) -> Dict:
        """Detect when swimmer performance has plateaued"""
        # Group by stroke and distance combination
        stroke_distance_groups = defaultdict(list)
        
        for point in performance_data:
            key = f"{point.stroke}_{point.distance}"
            stroke_distance_groups[key].append(point.time_seconds)
        
        plateaus = {}
        for key, times in stroke_distance_groups.items():
            if len(times) >= 5:  # Need sufficient data
                plateau_detected = self._is_plateau(times)
                if plateau_detected:
                    stroke, distance = key.split('_')
                    plateaus[key] = {
                        'stroke': stroke,
                        'distance': int(distance),
                        'plateau_duration_sessions': len(times),
                        'confidence': self._calculate_plateau_confidence(times)
                    }
        
        return plateaus
    
    def _calculate_improvement_rate(self, times: List[float]) -> float:
        """Calculate percentage improvement rate"""
        if len(times) < 2:
            return 0.0
        
        # For small datasets, use first and last times directly
        # For larger datasets, use averages to smooth noise
        if len(times) <= 4:
            first_time = times[0]
            last_time = times[-1]
        else:
            first_time = statistics.mean(times[:2])  # Average of first 2
            last_time = statistics.mean(times[-2:])  # Average of last 2
        
        improvement_rate = ((first_time - last_time) / first_time) * 100
        
        print(f"Improvement rate calculation:")
        print(f"  Times: {times}")
        print(f"  First time: {first_time:.2f}s, Last time: {last_time:.2f}s")
        print(f"  Improvement rate: {improvement_rate:.2f}% (positive = faster/better)")
        
        return improvement_rate
    
    def _is_plateau(self, times: List[float], threshold: float = 0.02) -> bool:
        """Detect if performance has plateaued (< 2% improvement)"""
        if len(times) < 5:
            return False
        
        recent_times = times[-5:]
        variation = (max(recent_times) - min(recent_times)) / statistics.mean(recent_times)
        
        return variation < threshold
    
    def _generate_performance_recommendations(self, stroke_trends: Dict, 
                                           plateau_analysis: Dict, 
                                           response_patterns: Dict) -> List[str]:
        """Generate actionable recommendations based on performance analysis"""
        recommendations = []
        
        # Stroke-specific recommendations
        for stroke_activity, trend in stroke_trends.items():
            if trend['trend_direction'] == 'declining':
                # In swimming, "declining" trend_direction means slower times (bad performance)
                recommendations.append(
                    f"Focus on {stroke_activity} technique - times getting slower at {abs(trend['improvement_rate_percent']):.1f}% rate"
                )
            elif trend['trend_direction'] == 'improving':
                # In swimming, "improving" trend_direction means faster times (good performance)  
                recommendations.append(
                    f"Excellent {stroke_activity} progress - times getting faster by {abs(trend['improvement_rate_percent']):.1f}%. Maintain current training approach"
                )
            elif trend['trend_direction'] == 'stable':
                recommendations.append(
                    f"{stroke_activity} times are stable - consider varying training intensity to break through plateau"
                )
        
        # Plateau recommendations
        for event, plateau in plateau_analysis.items():
            stroke, distance = plateau['stroke'], plateau['distance']
            recommendations.append(
                f"Break {stroke} {distance}m plateau with varied training stimulus - consider different energy zones"
            )
        
        return recommendations
    
    def _analyze_distance_trends(self, performance_data: List[PerformanceDataPoint]) -> Dict:
        """Analyze performance trends by distance"""
        distance_data = defaultdict(list)
        
        for point in performance_data:
            distance_data[point.distance].append({
                'date': point.date,
                'time': point.time_seconds,
                'stroke': point.stroke
            })
        
        trends = {}
        for distance, data in distance_data.items():
            if len(data) >= 3:
                times = [d['time'] for d in data]
                trends[distance] = {
                    'trend_direction': 'improving' if times[-1] < times[0] else 'declining',
                    'improvement_rate_percent': self._calculate_improvement_rate(times),
                    'consistency_score': self._calculate_consistency_score(times),
                    'optimal_stroke': self._find_optimal_stroke_for_distance(data)
                }
        
        return trends
    
    def _analyze_training_response(self, swimmer_id: str, performance_data: List[PerformanceDataPoint]) -> Dict:
        """Analyze how swimmer responds to different training loads"""
        # Get training session intensities and volumes
        session_loads = self._fetch_training_loads(swimmer_id)
        
        # Correlate training load with subsequent performance
        response_patterns = {}
        
        for session_load in session_loads:
            # Find performances within 3 days after training
            subsequent_performances = [
                p for p in performance_data 
                if p.date > session_load['date'] and 
                (p.date - session_load['date']).days <= 3
            ]
            
            if subsequent_performances:
                avg_performance = statistics.mean([p.time_seconds for p in subsequent_performances])
                response_patterns[session_load['intensity']] = {
                    'avg_response_time': avg_performance,
                    'response_count': len(subsequent_performances),
                    'optimal_recovery_days': self._calculate_optimal_recovery(session_load, subsequent_performances)
                }
        
        return response_patterns
    
    def _identify_seasonal_patterns(self, performance_data: List[PerformanceDataPoint]) -> Dict:
        """Identify seasonal performance patterns"""
        monthly_performance = defaultdict(list)
        
        for point in performance_data:
            month = point.date.month
            monthly_performance[month].append(point.time_seconds)
        
        patterns = {}
        for month, times in monthly_performance.items():
            if len(times) >= 3:
                patterns[month] = {
                    'avg_performance': statistics.mean(times),
                    'performance_variance': statistics.stdev(times) if len(times) > 1 else 0,
                    'best_performance': min(times),
                    'sample_size': len(times)
                }
        
        # Identify peak and low seasons
        if patterns:
            best_month = min(patterns.keys(), key=lambda m: patterns[m]['avg_performance'])
            worst_month = max(patterns.keys(), key=lambda m: patterns[m]['avg_performance'])
            
            patterns['peak_season'] = best_month
            patterns['low_season'] = worst_month
        
        return patterns
    
    def _fetch_workout_sessions(self, workout_id: str) -> List[Dict]:
        """Fetch all training sessions that used this workout"""
        try:
            response = (
                self.supabase
                .table('training_sessions')
                .select('''
                    id,
                    start_date,
                    swimmer_count,
                    training_session_post_practice_notes(
                        overall_rating,
                        effort_level,
                        technique_quality
                    )
                ''')
                .eq('workout_id', workout_id)
                .order('training_sessions(start_date)', desc=True)
                .execute()
            )
            
            sessions = []
            for row in response.data:
                # Handle the joined practice notes data
                practice_notes = row.get('training_session_post_practice_notes', [{}])
                notes = practice_notes[0] if practice_notes else {}
                
                sessions.append({
                    'session_id': row['id'],
                    'date': datetime.fromisoformat(row['start_date'].replace('Z', '+00:00')).replace(tzinfo=timezone.utc),
                    'swimmer_count': row['swimmer_count'],
                    'overall_rating': notes.get('overall_rating'),
                    'effort_level': notes.get('effort_level'),
                    'technique_quality': notes.get('technique_quality')
                })
            
            return sessions
            
        except Exception as e:
            print(f"Error fetching workout sessions: {e}")
            return []
    
    def _calculate_performance_impact(self, workout_id: str, sessions: List[Dict]) -> Dict:
        """Calculate how this workout impacts performance"""
        performance_improvements = []
        
        for session in sessions:
            # Get performances before and after this session
            before_after = self._get_before_after_performance(session['session_id'])
            if before_after:
                improvement = (before_after['before'] - before_after['after']) / before_after['before']
                performance_improvements.append(improvement * 100)  # Convert to percentage
        
        if performance_improvements:
            return {
                'avg_improvement_percent': statistics.mean(performance_improvements),
                'improvement_consistency': statistics.stdev(performance_improvements) if len(performance_improvements) > 1 else 0,
                'positive_impact_rate': len([i for i in performance_improvements if i > 0]) / len(performance_improvements),
                'sample_size': len(performance_improvements)
            }
        
        return {'error': 'No performance impact data available'}
    
    def _analyze_coach_satisfaction(self, sessions: List[Dict]) -> Dict:
        """Analyze coach satisfaction with this workout"""
        ratings = [s for s in sessions if s['overall_rating'] is not None]
        
        if not ratings:
            return {'error': 'No coach ratings available'}
        
        overall_scores = [r['overall_rating'] for r in ratings]
        effort_scores = [r['effort_level'] for r in ratings if r['effort_level'] is not None]
        technique_scores = [r['technique_quality'] for r in ratings if r['technique_quality'] is not None]
        
        return {
            'avg_overall_rating': statistics.mean(overall_scores),
            'avg_effort_rating': statistics.mean(effort_scores) if effort_scores else None,
            'avg_technique_rating': statistics.mean(technique_scores) if technique_scores else None,
            'rating_consistency': statistics.stdev(overall_scores) if len(overall_scores) > 1 else 0,
            'high_satisfaction_rate': len([r for r in overall_scores if r >= 4]) / len(overall_scores),
            'sample_size': len(ratings)
        }
    
    def _analyze_attendance_impact(self, sessions: List[Dict]) -> Dict:
        """Analyze how this workout affects attendance"""
        attendance_data = [s['swimmer_count'] for s in sessions if s['swimmer_count'] is not None]
        
        if len(attendance_data) < 2:
            return {'error': 'Insufficient attendance data'}
        
        # Compare with average attendance for other workouts
        avg_other_attendance = self._get_average_attendance_other_workouts()
        
        return {
            'avg_attendance': statistics.mean(attendance_data),
            'attendance_variance': statistics.stdev(attendance_data),
            'vs_other_workouts': statistics.mean(attendance_data) - avg_other_attendance,
            'retention_score': self._calculate_retention_score(sessions),
            'sample_size': len(attendance_data)
        }
    
    def _assess_technique_impact(self, sessions: List[Dict]) -> Dict:
        """Assess how this workout impacts technique development"""
        technique_ratings = [s['technique_quality'] for s in sessions if s['technique_quality'] is not None]
        
        if not technique_ratings:
            return {'error': 'No technique ratings available'}
        
        return {
            'avg_technique_rating': statistics.mean(technique_ratings),
            'technique_improvement_trend': self._calculate_technique_trend(sessions),
            'high_technique_rate': len([r for r in technique_ratings if r >= 4]) / len(technique_ratings),
            'sample_size': len(technique_ratings)
        }
    
    def _analyze_optimal_timing(self, sessions: List[Dict]) -> Dict:
        """Determine optimal timing for this workout"""
        day_performance = defaultdict(list)
        time_performance = defaultdict(list)
        
        for session in sessions:
            day_of_week = session['date'].weekday()
            hour = session['date'].hour
            
            if session['overall_rating']:
                day_performance[day_of_week].append(session['overall_rating'])
                time_performance[hour].append(session['overall_rating'])
        
        optimal_day = max(day_performance.keys(), 
                         key=lambda d: statistics.mean(day_performance[d])) if day_performance else None
        optimal_hour = max(time_performance.keys(), 
                          key=lambda h: statistics.mean(time_performance[h])) if time_performance else None
        
        return {
            'optimal_day_of_week': optimal_day,
            'optimal_hour': optimal_hour,
            'day_performance_variance': {d: statistics.mean(ratings) for d, ratings in day_performance.items()},
            'time_performance_variance': {h: statistics.mean(ratings) for h, ratings in time_performance.items()}
        }
    
    def _calculate_overall_effectiveness(self, performance_impact: Dict, coach_satisfaction: Dict, 
                                       attendance_impact: Dict, technique_impact: Dict) -> float:
        """Calculate overall workout effectiveness score (0-100)"""
        scores = []
        weights = []
        
        # Performance impact (40% weight)
        if 'avg_improvement_percent' in performance_impact:
            scores.append(min(100, max(0, performance_impact['avg_improvement_percent'] * 10 + 50)))
            weights.append(0.4)
        
        # Coach satisfaction (30% weight)
        if 'avg_overall_rating' in coach_satisfaction:
            scores.append(coach_satisfaction['avg_overall_rating'] * 20)  # Convert 5-point to 100-point
            weights.append(0.3)
        
        # Attendance impact (20% weight)
        if 'vs_other_workouts' in attendance_impact:
            scores.append(min(100, max(0, attendance_impact['vs_other_workouts'] * 5 + 50)))
            weights.append(0.2)
        
        # Technique impact (10% weight)
        if 'avg_technique_rating' in technique_impact:
            scores.append(technique_impact['avg_technique_rating'] * 20)
            weights.append(0.1)
        
        if scores:
            return sum(score * weight for score, weight in zip(scores, weights)) / sum(weights)
        
        return 0.0
    
    def _generate_workout_recommendations(self, effectiveness_score: float, 
                                        performance_impact: Dict, timing_analysis: Dict) -> List[str]:
        """Generate actionable workout recommendations"""
        recommendations = []
        
        if effectiveness_score < 60:
            recommendations.append("Consider modifying workout structure - effectiveness below optimal threshold")
        
        if 'positive_impact_rate' in performance_impact and performance_impact['positive_impact_rate'] < 0.6:
            recommendations.append("Low positive impact rate - review workout intensity and volume")
        
        if 'optimal_day_of_week' in timing_analysis and timing_analysis['optimal_day_of_week'] is not None:
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            optimal_day = days[timing_analysis['optimal_day_of_week']]
            recommendations.append(f"Schedule on {optimal_day} for optimal results")
        
        return recommendations
    
    def _assess_current_form(self, recent_times: List[float]) -> str:
        """Assess swimmer's current form based on recent performances"""
        if len(recent_times) < 2:
            return "insufficient_data"
        
        trend = recent_times[-1] - recent_times[0]
        variance = statistics.stdev(recent_times) if len(recent_times) > 1 else 0
        
        if trend < -0.5 and variance < 1.0:
            return "excellent"
        elif trend < 0:
            return "good"
        elif trend > 1.0:
            return "declining"
        else:
            return "stable"
    
    def _calculate_plateau_confidence(self, times: List[float]) -> float:
        """Calculate confidence level for plateau detection"""
        if len(times) < 3:
            return 0.0
        
        variance = statistics.stdev(times)
        mean_time = statistics.mean(times)
        coefficient_of_variation = variance / mean_time
        
        # Lower variation = higher confidence in plateau
        return max(0.0, min(1.0, 1.0 - (coefficient_of_variation * 10)))
    
    # Additional helper methods for complex analysis
    def _calculate_consistency_score(self, times: List[float]) -> float:
        """Calculate how consistent performances are (0-1 scale)"""
        if len(times) < 2:
            return 0.0
        
        variance = statistics.stdev(times)
        mean_time = statistics.mean(times)
        
        # Lower coefficient of variation = higher consistency
        cv = variance / mean_time
        return max(0.0, min(1.0, 1.0 - cv))
    
    def _find_optimal_stroke_for_distance(self, data: List[Dict]) -> str:
        """Find which stroke performs best at this distance"""
        stroke_performance = defaultdict(list)
        
        for d in data:
            stroke_performance[d['stroke']].append(d['time'])
        
        if not stroke_performance:
            return "unknown"
        
        # Find stroke with best average time
        best_stroke = min(stroke_performance.keys(), 
                         key=lambda s: statistics.mean(stroke_performance[s]))
        
        return best_stroke
    
    def _fetch_training_loads(self, swimmer_id: str) -> List[Dict]:
        """Fetch training load data for response analysis"""
        # This would be implemented based on your training load tracking
        # For now, return empty list - implement when training load tracking is available
        return []
    
    def _calculate_optimal_recovery(self, session_load: Dict, performances: List[PerformanceDataPoint]) -> int:
        """Calculate optimal recovery days after training load"""
        if not performances:
            return 1
        
        # Find best performance and its timing relative to training
        best_performance = min(performances, key=lambda p: p.time_seconds)
        recovery_days = (best_performance.date - session_load['date']).days
        
        return max(1, recovery_days)
    
    def _get_before_after_performance(self, session_id: str) -> Optional[Dict]:
        """Get performance before and after a training session"""
        # This would query for performances in time windows before/after session
        # Implementation depends on your specific performance tracking
        return None
    
    def _get_average_attendance_other_workouts(self) -> float:
        """Get average attendance for other workout types"""
        try:
            response = (
                self.supabase
                .table('training_sessions')
                .select('swimmer_count')
                .not_.is_('swimmer_count', 'null')
                .execute()
            )
            
            if response.data:
                attendance_values = [row['swimmer_count'] for row in response.data]
                return statistics.mean(attendance_values)
            
            return 0.0
            
        except Exception as e:
            print(f"Error fetching average attendance: {e}")
            return 0.0
    
    def _calculate_retention_score(self, sessions: List[Dict]) -> float:
        """Calculate swimmer retention score for this workout"""
        if len(sessions) < 2:
            return 0.0
        
        # Simple retention: attendance doesn't drop significantly over time
        early_sessions = sessions[-3:] if len(sessions) >= 3 else sessions[:1]
        recent_sessions = sessions[:3] if len(sessions) >= 3 else sessions[-1:]
        
        early_avg = statistics.mean([s['swimmer_count'] for s in early_sessions if s['swimmer_count']])
        recent_avg = statistics.mean([s['swimmer_count'] for s in recent_sessions if s['swimmer_count']])
        
        return min(1.0, recent_avg / early_avg if early_avg > 0 else 0.0)
    
    def _calculate_technique_trend(self, sessions: List[Dict]) -> str:
        """Calculate trend in technique ratings over time"""
        technique_ratings = [(s['date'], s['technique_quality']) 
                           for s in sessions if s['technique_quality'] is not None]
        
        if len(technique_ratings) < 2:
            return "insufficient_data"
        
        # Sort by date and compare early vs recent
        technique_ratings.sort(key=lambda x: x[0])
        early_avg = statistics.mean([r[1] for r in technique_ratings[:len(technique_ratings)//2]])
        recent_avg = statistics.mean([r[1] for r in technique_ratings[len(technique_ratings)//2:]])
        
        if recent_avg > early_avg + 0.2:
            return "improving"
        elif recent_avg < early_avg - 0.2:
            return "declining"
        else:
            return "stable"
    
    def _fetch_coach_feedback(self, swimmer_id: str) -> List[CoachFeedback]:
        """Fetch coach feedback history for swimmer"""
        try:
            response = (
                self.supabase
                .table('training_session_post_practice_notes')
                .select('''
                    overall_rating,
                    effort_level,
                    technique_quality,
                    positivity,
                    what_went_well,
                    areas_for_improvement,
                    next_session_focus,
                    training_sessions(
                        start_date,
                        training_attendance(
                            swimmer_id
                        )
                    )
                ''')
                .eq('training_sessions.training_attendance.swimmer_id', swimmer_id)
                .not_.is_('overall_rating', 'null')
                .order('training_sessions(start_date)', desc=True)
                .limit(100)
                .execute()
            )
            
            feedback = []
            for row in response.data:
                # Parse datetime and ensure it's timezone-aware
                date_str = row['training_sessions']['start_date']
                if date_str.endswith('Z'):
                    date_str = date_str[:-1] + '+00:00'
                parsed_date = datetime.fromisoformat(date_str)
                if parsed_date.tzinfo is None:
                    parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                
                feedback.append(CoachFeedback(
                    date=parsed_date,
                    overall_rating=row['overall_rating'],
                    effort_level=row['effort_level'],
                    technique_quality=row['technique_quality'],
                    positivity=row['positivity'],
                    what_went_well=row['what_went_well'] or "",
                    areas_for_improvement=row['areas_for_improvement'] or "",
                    next_session_focus=row['next_session_focus'] or ""
                ))
            
            return feedback
            
        except Exception as e:
            print(f"Error fetching coach feedback: {e}")
            return []
    
    def _analyze_rating_trends(self, feedback_data: List[CoachFeedback]) -> Dict:
        """Analyze trends in coach ratings over time"""
        if len(feedback_data) < 3:
            return {"error": "Insufficient feedback data for trend analysis"}
        
        # Sort by date (most recent first from query, so reverse for chronological)
        feedback_data.sort(key=lambda x: x.date)
        
        overall_ratings = [f.overall_rating for f in feedback_data]
        effort_ratings = [f.effort_level for f in feedback_data if f.effort_level is not None]
        technique_ratings = [f.technique_quality for f in feedback_data if f.technique_quality is not None]
        
        def calculate_trend(ratings):
            if len(ratings) < 3:
                return {"direction": "insufficient_data", "slope": 0}
            
            # Simple linear trend calculation
            x_values = list(range(len(ratings)))
            n = len(ratings)
            x_mean = statistics.mean(x_values)
            y_mean = statistics.mean(ratings)
            
            slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, ratings)) / sum((x - x_mean) ** 2 for x in x_values)
            
            direction = "improving" if slope > 0.1 else "declining" if slope < -0.1 else "stable"
            
            return {
                "direction": direction,
                "slope": slope,
                "current_avg": statistics.mean(ratings[-3:]),
                "historical_avg": statistics.mean(ratings[:-3]) if len(ratings) > 3 else statistics.mean(ratings)
            }
        
        return {
            "overall_trend": calculate_trend(overall_ratings),
            "effort_trend": calculate_trend(effort_ratings),
            "technique_trend": calculate_trend(technique_ratings),
            "data_span_days": (feedback_data[-1].date - feedback_data[0].date).days,
            "total_feedback_points": len(feedback_data)
        }
    
    def _extract_improvement_themes(self, feedback_data: List[CoachFeedback]) -> Dict:
        """Extract recurring themes from improvement areas"""
        improvement_text = [f.areas_for_improvement.lower() for f in feedback_data if f.areas_for_improvement]
        
        if not improvement_text:
            return {"error": "No improvement area feedback available"}
        
        # Simple keyword analysis - in production, you'd use NLP
        technique_keywords = ['technique', 'stroke', 'form', 'mechanics', 'timing']
        endurance_keywords = ['endurance', 'stamina', 'cardio', 'fitness', 'conditioning']
        speed_keywords = ['speed', 'pace', 'fast', 'sprint', 'explosive']
        mentality_keywords = ['focus', 'mental', 'concentration', 'confidence', 'attitude']
        
        themes = {
            'technique_focus': sum(any(keyword in text for keyword in technique_keywords) for text in improvement_text),
            'endurance_focus': sum(any(keyword in text for keyword in endurance_keywords) for text in improvement_text),
            'speed_focus': sum(any(keyword in text for keyword in speed_keywords) for text in improvement_text),
            'mental_focus': sum(any(keyword in text for keyword in mentality_keywords) for text in improvement_text)
        }
        
        # Calculate percentages
        total_mentions = sum(themes.values())
        if total_mentions > 0:
            theme_percentages = {k: (v / total_mentions) * 100 for k, v in themes.items()}
        else:
            theme_percentages = themes
        
        # Find most common theme
        primary_focus = max(themes.keys(), key=lambda k: themes[k]) if total_mentions > 0 else "none"
        
        return {
            "theme_percentages": theme_percentages,
            "primary_focus_area": primary_focus,
            "total_improvement_mentions": total_mentions,
            "recent_focus": self._analyze_recent_focus(feedback_data[-5:]) if len(feedback_data) >= 5 else None
        }
    
    def _extract_strength_patterns(self, feedback_data: List[CoachFeedback]) -> Dict:
        """Extract recurring themes from what went well"""
        strength_text = [f.what_went_well.lower() for f in feedback_data if f.what_went_well]
        
        if not strength_text:
            return {"error": "No strength feedback available"}
        
        # Analyze consistent strengths
        technique_strengths = sum('technique' in text or 'form' in text for text in strength_text)
        effort_strengths = sum('effort' in text or 'work' in text or 'hard' in text for text in strength_text)
        attitude_strengths = sum('attitude' in text or 'positive' in text or 'energy' in text for text in strength_text)
        improvement_strengths = sum('improvement' in text or 'progress' in text or 'better' in text for text in strength_text)
        
        strengths = {
            'consistent_technique': technique_strengths,
            'strong_effort': effort_strengths,
            'positive_attitude': attitude_strengths,
            'shows_improvement': improvement_strengths
        }
        
        total_mentions = sum(strengths.values())
        strength_percentages = {k: (v / total_mentions) * 100 for k, v in strengths.items()} if total_mentions > 0 else strengths
        
        return {
            "strength_percentages": strength_percentages,
            "dominant_strength": max(strengths.keys(), key=lambda k: strengths[k]) if total_mentions > 0 else "none",
            "consistency_score": self._calculate_strength_consistency(feedback_data)
        }
    
    def _correlate_feedback_performance(self, swimmer_id: str, feedback_data: List[CoachFeedback]) -> Dict:
        """Correlate coach feedback with actual performance outcomes"""
        # Get performance data for the same time period
        if not feedback_data:
            return {"error": "No feedback data"}
        
        earliest_date = min(f.date for f in feedback_data)
        days_span = (datetime.now(timezone.utc) - earliest_date).days
        
        performance_data = self._fetch_swimmer_results(swimmer_id, days_span)
        
        if not performance_data:
            return {"error": "No performance data for correlation"}
        
        correlations = {}
        
        # Correlate ratings with subsequent performance
        for feedback in feedback_data:
            # Find performances within 7 days after this feedback
            subsequent_performances = [
                p for p in performance_data 
                if p.date > feedback.date and (p.date - feedback.date).days <= 7
            ]
            
            if subsequent_performances:
                avg_performance = statistics.mean([p.time_seconds for p in subsequent_performances])
                
                # Store correlation data
                feedback_key = f"{feedback.date.isoformat()}"
                correlations[feedback_key] = {
                    "overall_rating": feedback.overall_rating,
                    "subsequent_performance": avg_performance,
                    "days_to_performance": statistics.mean([(p.date - feedback.date).days for p in subsequent_performances]),
                    "performance_count": len(subsequent_performances)
                }
        
        if not correlations:
            return {"error": "No correlation data found"}
        
        # Calculate correlation coefficients
        ratings = [c["overall_rating"] for c in correlations.values()]
        performances = [c["subsequent_performance"] for c in correlations.values()]
        
        if len(ratings) >= 3:
            correlation_coefficient = self._calculate_correlation(ratings, performances)
            
            return {
                "correlation_coefficient": correlation_coefficient,
                "correlation_strength": self._interpret_correlation(correlation_coefficient),
                "data_points": len(correlations),
                "predictive_value": "high" if abs(correlation_coefficient) > 0.6 else "moderate" if abs(correlation_coefficient) > 0.3 else "low"
            }
        
        return {"error": "Insufficient data for correlation analysis"}
    
    def _assess_intervention_effectiveness(self, swimmer_id: str, feedback_data: List[CoachFeedback]) -> Dict:
        """Assess effectiveness of coaching interventions"""
        interventions = []
        
        for i, feedback in enumerate(feedback_data[:-1]):  # Exclude last one as we need a "next" feedback
            if feedback.next_session_focus:
                next_feedback = feedback_data[i + 1]
                
                # Simple intervention effectiveness: did the rating improve?
                improvement = next_feedback.overall_rating - feedback.overall_rating
                
                interventions.append({
                    "focus_area": feedback.next_session_focus.lower(),
                    "improvement": improvement,
                    "days_between": (next_feedback.date - feedback.date).days
                })
        
        if not interventions:
            return {"error": "No coaching interventions found"}
        
        # Analyze intervention effectiveness
        positive_interventions = [i for i in interventions if i["improvement"] > 0]
        
        return {
            "total_interventions": len(interventions),
            "successful_interventions": len(positive_interventions),
            "success_rate": len(positive_interventions) / len(interventions),
            "avg_improvement": statistics.mean([i["improvement"] for i in interventions]),
            "most_effective_focus": self._find_most_effective_focus(interventions)
        }
    
    def _generate_feedback_predictions(self, rating_trends: Dict, improvement_themes: Dict, 
                                     correlation_data: Dict) -> Dict:
        """Generate predictions based on feedback patterns"""
        predictions = {}
        
        # Predict next rating based on trend
        if "overall_trend" in rating_trends and rating_trends["overall_trend"]["direction"] != "insufficient_data":
            trend = rating_trends["overall_trend"]
            current_avg = trend["current_avg"]
            slope = trend["slope"]
            
            predicted_next_rating = min(5, max(1, current_avg + slope))
            
            predictions["next_rating_prediction"] = {
                "predicted_rating": round(predicted_next_rating, 1),
                "confidence": "high" if abs(slope) > 0.2 else "moderate" if abs(slope) > 0.1 else "low"
            }
        
        # Predict focus areas based on themes
        if "primary_focus_area" in improvement_themes:
            predictions["recommended_focus"] = improvement_themes["primary_focus_area"]
        
        # Predict performance correlation
        if "correlation_coefficient" in correlation_data:
            predictions["performance_correlation"] = {
                "strength": correlation_data["correlation_strength"],
                "predictive_reliability": correlation_data["predictive_value"]
            }
        
        return predictions
    
    # Helper methods for feedback analysis
    def _analyze_recent_focus(self, recent_feedback: List[CoachFeedback]) -> str:
        """Analyze focus areas in recent feedback"""
        recent_improvements = [f.areas_for_improvement.lower() for f in recent_feedback if f.areas_for_improvement]
        
        if not recent_improvements:
            return "no_recent_focus"
        
        # Count keywords in recent feedback
        technique_count = sum('technique' in text for text in recent_improvements)
        endurance_count = sum('endurance' in text for text in recent_improvements)
        
        if technique_count > endurance_count:
            return "technique_focused"
        elif endurance_count > technique_count:
            return "endurance_focused"
        else:
            return "balanced_focus"
    
    def _calculate_strength_consistency(self, feedback_data: List[CoachFeedback]) -> float:
        """Calculate how consistently strengths are mentioned"""
        if len(feedback_data) < 3:
            return 0.0
        
        # Simple consistency: how often are strengths mentioned
        strength_mentions = sum(1 for f in feedback_data if f.what_went_well)
        
        return strength_mentions / len(feedback_data)
    
    def _calculate_correlation(self, x_values: List[float], y_values: List[float]) -> float:
        """Calculate Pearson correlation coefficient"""
        if len(x_values) != len(y_values) or len(x_values) < 2:
            return 0.0
        
        n = len(x_values)
        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(y_values)
        
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values))
        x_variance = sum((x - x_mean) ** 2 for x in x_values)
        y_variance = sum((y - y_mean) ** 2 for y in y_values)
        
        if x_variance == 0 or y_variance == 0:
            return 0.0
        
        return numerator / (x_variance * y_variance) ** 0.5
    
    def _interpret_correlation(self, correlation: float) -> str:
        """Interpret correlation coefficient strength"""
        abs_corr = abs(correlation)
        
        if abs_corr >= 0.8:
            return "very_strong"
        elif abs_corr >= 0.6:
            return "strong"
        elif abs_corr >= 0.4:
            return "moderate"
        elif abs_corr >= 0.2:
            return "weak"
        else:
            return "very_weak"
    
    def _find_most_effective_focus(self, interventions: List[Dict]) -> str:
        """Find which coaching focus areas are most effective"""
        focus_improvements = defaultdict(list)
        
        for intervention in interventions:
            focus_improvements[intervention["focus_area"]].append(intervention["improvement"])
        
        if not focus_improvements:
            return "none"
        
        # Find focus area with highest average improvement
        best_focus = max(focus_improvements.keys(), 
                        key=lambda f: statistics.mean(focus_improvements[f]))
        
        return best_focus

    def _fetch_swimmer_attended_sessions(self, swimmer_id: str) -> List[Dict]:
        """Fetch training sessions this swimmer attended"""
        try:
            print(f"Fetching sessions for swimmer: {swimmer_id}")
            
            response = (
                self.supabase
                .table('training_attendance')
                .select('''
                    training_session_id,
                    training_sessions(
                        id,
                        start_date,
                        workout_id,
                        training_session_post_practice_notes(
                            overall_rating,
                            effort_level,
                            technique_quality,
                            positivity,
                            what_went_well,
                            areas_for_improvement,
                            next_session_focus
                        )
                    )
                ''')
                .eq('swimmer_id', swimmer_id)
                .eq("status", "present")
                .order('training_sessions(start_date)', desc=True)
                .limit(50)
                .execute()
            )
            
            print(f"Raw response data count: {len(response.data) if response.data else 0}")
            if response.data:
                print(f"Sample response structure: {response.data[0]}")
            
            sessions = []
            for row in response.data:
                session_data = row['training_sessions']
                if not session_data:
                    print(f"Skipping row with no session data: {row}")
                    continue
                    
                # Parse datetime and ensure it's timezone-aware
                date_str = session_data['start_date']
                if date_str.endswith('Z'):
                    date_str = date_str[:-1] + '+00:00'
                parsed_date = datetime.fromisoformat(date_str)
                if parsed_date.tzinfo is None:
                    parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                
                # Get practice notes - check if it's a single object or array
                practice_notes_data = session_data.get('training_session_post_practice_notes')
                if isinstance(practice_notes_data, dict):
                    # Single object format
                    notes = practice_notes_data
                elif isinstance(practice_notes_data, list) and practice_notes_data:
                    # Array format - take first item
                    notes = practice_notes_data[0]
                else:
                    # No notes available
                    notes = {}
                
                sessions.append({
                    'session_id': session_data['id'],
                    'date': parsed_date,
                    'workout_id': session_data['workout_id'],
                    'overall_rating': notes.get('overall_rating'),
                    'effort_level': notes.get('effort_level'),
                    'technique_quality': notes.get('technique_quality'),
                    'positivity': notes.get('positivity'),
                    'what_went_well': notes.get('what_went_well', ''),
                    'areas_for_improvement': notes.get('areas_for_improvement', ''),
                    'next_session_focus': notes.get('next_session_focus', '')
                })
            
            print(f"Successfully processed {len(sessions)} sessions")
            return sessions
            
        except Exception as e:
            print(f"Error fetching swimmer attended sessions: {e}")
            return []

    def _analyze_session_quality_trends(self, sessions: List[Dict]) -> Dict:
        """Analyze trends in the quality of sessions this swimmer attended"""
        sessions_with_ratings = [s for s in sessions if s['overall_rating'] is not None]
        
        if len(sessions_with_ratings) < 3:
            return {"error": "Insufficient session rating data"}
        
        # Sort by date for trend analysis
        sessions_with_ratings.sort(key=lambda x: x['date'])
        
        ratings = [s['overall_rating'] for s in sessions_with_ratings]
        effort_levels = [s['effort_level'] for s in sessions_with_ratings if s['effort_level'] is not None]
        technique_levels = [s['technique_quality'] for s in sessions_with_ratings if s['technique_quality'] is not None]
        
        def calculate_trend(values):
            if len(values) < 3:
                return {"direction": "insufficient_data", "average": 0}
            
            # Compare first half to second half
            mid = len(values) // 2
            first_half_avg = statistics.mean(values[:mid])
            second_half_avg = statistics.mean(values[mid:])
            
            difference = second_half_avg - first_half_avg
            direction = "improving" if difference > 0.2 else "declining" if difference < -0.2 else "stable"
            
            return {
                "direction": direction,
                "average": statistics.mean(values),
                "recent_average": statistics.mean(values[-5:]) if len(values) >= 5 else statistics.mean(values),
                "trend_change": difference
            }
        
        return {
            "session_quality_trend": calculate_trend(ratings),
            "session_effort_trend": calculate_trend(effort_levels),
            "session_technique_trend": calculate_trend(technique_levels),
            "total_sessions_analyzed": len(sessions_with_ratings),
            "average_session_quality": statistics.mean(ratings),
            "quality_consistency": statistics.stdev(ratings) if len(ratings) > 1 else 0
        }

    def _extract_session_coaching_themes(self, sessions: List[Dict]) -> Dict:
        """Extract coaching themes from sessions this swimmer attended"""
        # Combine all coaching feedback from sessions attended
        improvement_texts = [s['areas_for_improvement'].lower() for s in sessions if s['areas_for_improvement']]
        strength_texts = [s['what_went_well'].lower() for s in sessions if s['what_went_well']]
        focus_texts = [s['next_session_focus'].lower() for s in sessions if s['next_session_focus']]
        
        # Analyze themes in attended sessions
        technique_mentions = sum('technique' in text or 'stroke' in text or 'form' in text 
                                for text in improvement_texts + focus_texts)
        endurance_mentions = sum('endurance' in text or 'fitness' in text or 'cardio' in text 
                                for text in improvement_texts + focus_texts)
        speed_mentions = sum('speed' in text or 'pace' in text or 'fast' in text 
                            for text in improvement_texts + focus_texts)
        
        positive_mentions = sum('good' in text or 'excellent' in text or 'strong' in text 
                               for text in strength_texts)
        
        total_feedback_sessions = len([s for s in sessions if s['areas_for_improvement'] or s['what_went_well']])
        
        return {
            "coaching_focus_areas": {
                "technique_focus_frequency": technique_mentions,
                "endurance_focus_frequency": endurance_mentions,
                "speed_focus_frequency": speed_mentions,
                "positive_feedback_frequency": positive_mentions
            },
            "sessions_with_feedback": total_feedback_sessions,
            "primary_coaching_theme": self._determine_primary_theme(technique_mentions, endurance_mentions, speed_mentions),
            "feedback_coverage": total_feedback_sessions / len(sessions) if sessions else 0
        }

    def _analyze_attendance_patterns(self, swimmer_id: str, sessions: List[Dict]) -> Dict:
        """Analyze this swimmer's attendance patterns"""
        if not sessions:
            return {"error": "No attendance data"}
        
        # Sort sessions by date
        sessions.sort(key=lambda x: x['date'])
        
        # Get the total date range
        date_range = (sessions[-1]['date'] - sessions[0]['date']).days if len(sessions) > 1 else 1
        sessions_per_week = (len(sessions) / date_range) * 7 if date_range > 0 else 0
        
        # Calculate attendance consistency based on gaps between sessions
        session_dates = [s['date'].date() for s in sessions]
        gaps_between_sessions = []
        
        for i in range(1, len(session_dates)):
            gap = (session_dates[i] - session_dates[i-1]).days
            gaps_between_sessions.append(gap)
        
        # Calculate average gap and consistency
        avg_gap = statistics.mean(gaps_between_sessions) if gaps_between_sessions else 0
        
        # Better consistency calculation: lower variation in gaps = higher consistency
        if len(gaps_between_sessions) > 1:
            gap_std = statistics.stdev(gaps_between_sessions)
            # Normalize consistency score: lower standard deviation = higher consistency
            # Expected gap for regular attendance might be 2-3 days
            expected_gap = 3.0  # Assume training every 3 days on average
            consistency_score = max(0, min(1, 1 - (gap_std / expected_gap)))
        else:
            consistency_score = 1 if len(sessions) == 1 else 0
        
        # Calculate recent attendance trend (last 4 weeks vs previous 4 weeks)
        now = datetime.now(timezone.utc)
        four_weeks_ago = now - timedelta(weeks=4)
        eight_weeks_ago = now - timedelta(weeks=8)
        
        recent_sessions = [s for s in sessions if s['date'] >= four_weeks_ago]
        previous_sessions = [s for s in sessions if eight_weeks_ago <= s['date'] < four_weeks_ago]
        
        attendance_trend = "stable"
        if len(previous_sessions) > 0:
            recent_rate = len(recent_sessions)
            previous_rate = len(previous_sessions)
            
            if recent_rate > previous_rate * 1.2:
                attendance_trend = "improving"
            elif recent_rate < previous_rate * 0.8:
                attendance_trend = "declining"
        
        return {
            "total_sessions_attended": len(sessions),
            "sessions_per_week": round(sessions_per_week, 1),
            "average_gap_between_sessions": round(avg_gap, 1),
            "attendance_consistency_score": round(consistency_score, 2),
            "most_recent_session": sessions[-1]['date'].isoformat() if sessions else None,
            "attendance_span_days": date_range,
            "attendance_trend": attendance_trend,
            "recent_sessions_count": len(recent_sessions),
            "previous_sessions_count": len(previous_sessions)
        }

    def _correlate_session_quality_performance(self, swimmer_id: str, sessions: List[Dict]) -> Dict:
        """Correlate the quality of training sessions with swimmer's performance"""
        # Get swimmer's performance data
        performance_data = self._fetch_swimmer_results(swimmer_id, 90)
        
        if not performance_data or not sessions:
            return {"error": "Insufficient data for correlation"}
        
        correlations = []
        
        for session in sessions:
            if session['overall_rating'] is None:
                continue
                
            # Find performances within 7 days after this session
            subsequent_performances = [
                p for p in performance_data 
                if p.date > session['date'] and (p.date - session['date']).days <= 7
            ]
            
            if subsequent_performances:
                avg_performance = statistics.mean([p.time_seconds for p in subsequent_performances])
                correlations.append({
                    'session_quality': session['overall_rating'],
                    'subsequent_performance': avg_performance,
                    'performance_count': len(subsequent_performances)
                })
        
        if len(correlations) < 3:
            return {"error": "Insufficient data for meaningful correlation"}
        
        # Calculate correlation between session quality and subsequent performance
        session_qualities = [c['session_quality'] for c in correlations]
        performances = [c['subsequent_performance'] for c in correlations]
        
        correlation_coefficient = self._calculate_correlation(session_qualities, performances)
        
        return {
            "correlation_coefficient": correlation_coefficient,
            "correlation_strength": self._interpret_correlation(correlation_coefficient),
            "data_points": len(correlations),
            "interpretation": "Higher session quality correlates with better performance" if correlation_coefficient < -0.3 else 
                            "Higher session quality correlates with worse performance" if correlation_coefficient > 0.3 else
                            "Session quality shows weak correlation with performance"
        }

    def _generate_session_insights(self, quality_trends: Dict, coaching_themes: Dict, attendance_patterns: Dict) -> Dict:
        """Generate insights based on session analysis"""
        insights = []
        
        # Session quality insights
        if "session_quality_trend" in quality_trends:
            trend = quality_trends["session_quality_trend"]
            if trend["direction"] == "improving":
                insights.append(f"Training session quality improving - recent average: {trend['recent_average']:.1f}/5.0")
            elif trend["direction"] == "declining":
                insights.append(f"Training session quality declining - recent average: {trend['recent_average']:.1f}/5.0")
            else:
                insights.append(f"Consistent training session quality - average: {trend['average']:.1f}/5.0")
        
        # Attendance insights
        if "sessions_per_week" in attendance_patterns:
            frequency = attendance_patterns["sessions_per_week"]
            if frequency >= 4:
                insights.append(f"Excellent attendance - {frequency} sessions per week")
            elif frequency >= 2:
                insights.append(f"Good attendance - {frequency} sessions per week")
            else:
                insights.append(f"Low attendance - {frequency} sessions per week")
        
        # Coaching focus insights
        if "coaching_focus_areas" in coaching_themes:
            focus = coaching_themes["coaching_focus_areas"]
            max_focus = max(focus['technique_focus_frequency'], focus['endurance_focus_frequency'], focus['speed_focus_frequency'])
            if max_focus == focus['technique_focus_frequency'] and max_focus > 0:
                insights.append("Coaches frequently focus on technique improvement in your sessions")
            elif max_focus == focus['endurance_focus_frequency'] and max_focus > 0:
                insights.append("Coaches frequently focus on endurance development in your sessions")
            elif max_focus == focus['speed_focus_frequency'] and max_focus > 0:
                insights.append("Coaches frequently focus on speed development in your sessions")
        
        return {
            "key_insights": insights,
            "overall_assessment": self._generate_overall_assessment(quality_trends, attendance_patterns),
            "recommendations": self._generate_session_recommendations(quality_trends, coaching_themes, attendance_patterns)
        }

    def _determine_primary_theme(self, technique: int, endurance: int, speed: int) -> str:
        """Determine the primary coaching theme"""
        if technique >= endurance and technique >= speed:
            return "technique_focused"
        elif endurance >= speed:
            return "endurance_focused"
        else:
            return "speed_focused"

    def _generate_overall_assessment(self, quality_trends: Dict, attendance_patterns: Dict) -> str:
        """Generate overall assessment of swimmer's training experience"""
        if "session_quality_trend" in quality_trends and "sessions_per_week" in attendance_patterns:
            quality_avg = quality_trends["session_quality_trend"]["average"]
            attendance_freq = attendance_patterns["sessions_per_week"]
            
            if quality_avg >= 4.0 and attendance_freq >= 3:
                return "excellent_training_environment"
            elif quality_avg >= 3.5 and attendance_freq >= 2:
                return "good_training_environment"
            elif quality_avg >= 3.0:
                return "adequate_training_environment"
            else:
                return "improvement_needed"
        
        return "insufficient_data"

    def _generate_session_recommendations(self, quality_trends: Dict, coaching_themes: Dict, attendance_patterns: Dict) -> List[str]:
        """Generate recommendations based on session analysis"""
        recommendations = []
        
        # Attendance recommendations
        if "sessions_per_week" in attendance_patterns:
            if attendance_patterns["sessions_per_week"] < 2:
                recommendations.append("Consider increasing training frequency - aim for at least 2-3 sessions per week")
            elif attendance_patterns["attendance_consistency_score"] < 0.7:
                recommendations.append("Focus on consistent attendance - regular training yields better results")
        
        # Session quality recommendations
        if "session_quality_trend" in quality_trends:
            trend = quality_trends["session_quality_trend"]
            if trend["direction"] == "declining":
                recommendations.append("Discuss training satisfaction with coach - session quality trending downward")
            elif trend["average"] < 3.5:
                recommendations.append("Work with coach to improve training session experience")
        
        # If no specific issues, provide positive reinforcement
        if not recommendations:
            recommendations.append("Maintain current training approach - good attendance and session quality")
        
        return recommendations