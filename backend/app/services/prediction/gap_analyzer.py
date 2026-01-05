"""Gap analysis for prediction misses - identifies root causes."""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta


class GapAnalyzer:
    """Analyzes why swimmers aren't meeting predictions."""
    
    @staticmethod
    def analyze_prediction_gap(
        achievement_rate: Optional[float],
        predictions_tested: int,
        swimmer_attendance_rate: Optional[float],
        squad_avg_attendance: Optional[float],
        recent_training_volume: Optional[int],
        squad_avg_volume: Optional[int],
        recent_workouts: Optional[List[Any]],
        days_since_last_result: Optional[int],
        avg_workout_effort: Optional[float]
    ) -> Dict[str, Any]:
        """
        Analyze why predictions aren't being met and identify likely causes.
        
        Returns:
            Dictionary with gap analysis including status, likely causes, and recommendations
        """
        if achievement_rate is None or predictions_tested < 3:
            return {
                'status': 'insufficient_data',
                'status_label': 'Not Enough Data',
                'likely_causes': [],
                'recommended_actions': [],
                'severity': 'none'
            }
        
        # Determine achievement status
        if achievement_rate >= 75:
            status = 'on_track'
            status_label = 'On Track'
            severity = 'none'
        elif achievement_rate >= 50:
            status = 'needs_attention'
            status_label = 'Needs Attention'
            severity = 'warning'
        else:
            status = 'intervention_required'
            status_label = 'Intervention Required'
            severity = 'critical'
        
        likely_causes = []
        recommended_actions = []
        
        # Only analyze if there's a gap
        if achievement_rate < 75:
            # Check attendance
            if swimmer_attendance_rate is not None:
                if swimmer_attendance_rate < 70:
                    impact = 'high' if swimmer_attendance_rate < 60 else 'medium'
                    likely_causes.append({
                        'factor': 'attendance',
                        'swimmer_value': swimmer_attendance_rate,
                        'squad_average': squad_avg_attendance,
                        'impact': impact,
                        'description': f'Missing {100 - swimmer_attendance_rate:.0f}% of training sessions'
                    })
                    recommended_actions.append({
                        'priority': 'high',
                        'action': f'Improve attendance to at least 75% (currently {swimmer_attendance_rate:.0f}%)',
                        'category': 'commitment'
                    })
                elif squad_avg_attendance and swimmer_attendance_rate < (squad_avg_attendance - 15):
                    likely_causes.append({
                        'factor': 'attendance',
                        'swimmer_value': swimmer_attendance_rate,
                        'squad_average': squad_avg_attendance,
                        'impact': 'medium',
                        'description': f'Below squad average attendance ({squad_avg_attendance:.0f}%)'
                    })
                    recommended_actions.append({
                        'priority': 'medium',
                        'action': 'Review schedule and commitment level with swimmer',
                        'category': 'commitment'
                    })
            
            # Check training volume
            if recent_training_volume is not None and squad_avg_volume is not None:
                volume_gap = (squad_avg_volume - recent_training_volume) / squad_avg_volume * 100
                if volume_gap > 30:
                    likely_causes.append({
                        'factor': 'training_volume',
                        'swimmer_value': recent_training_volume,
                        'squad_average': squad_avg_volume,
                        'impact': 'high',
                        'description': f'{volume_gap:.0f}% below squad average volume'
                    })
                    recommended_actions.append({
                        'priority': 'high',
                        'action': 'Increase training volume - swimmer completing significantly less than squad',
                        'category': 'training_load'
                    })
                elif volume_gap > 15:
                    likely_causes.append({
                        'factor': 'training_volume',
                        'swimmer_value': recent_training_volume,
                        'squad_average': squad_avg_volume,
                        'impact': 'medium',
                        'description': f'{volume_gap:.0f}% below squad average volume'
                    })
            
            # Check workout effort
            if avg_workout_effort is not None and avg_workout_effort < 6:
                likely_causes.append({
                    'factor': 'workout_effort',
                    'swimmer_value': avg_workout_effort,
                    'squad_average': None,
                    'impact': 'medium',
                    'description': f'Low average effort in training ({avg_workout_effort:.1f}/10)'
                })
                recommended_actions.append({
                    'priority': 'medium',
                    'action': 'Increase training intensity - effort levels below target',
                    'category': 'training_intensity'
                })
            
            # Check workout variety
            if recent_workouts:
                workout_types = [w.workout_type for w in recent_workouts if hasattr(w, 'workout_type')]
                if workout_types:
                    type_counts = {
                        'sprint': workout_types.count('sprint'),
                        'endurance': workout_types.count('endurance'),
                        'technique': workout_types.count('technique')
                    }
                    
                    total_workouts = len(workout_types)
                    if type_counts['sprint'] / total_workouts < 0.2:
                        likely_causes.append({
                            'factor': 'training_mix',
                            'swimmer_value': type_counts['sprint'],
                            'squad_average': None,
                            'impact': 'medium',
                            'description': f'Limited sprint work ({type_counts["sprint"]} of {total_workouts} sessions)'
                        })
                        recommended_actions.append({
                            'priority': 'medium',
                            'action': 'Add more high-intensity sprint sessions',
                            'category': 'training_mix'
                        })
            
            # Check time since last result
            if days_since_last_result is not None and days_since_last_result > 45:
                likely_causes.append({
                    'factor': 'inactivity',
                    'swimmer_value': days_since_last_result,
                    'squad_average': None,
                    'impact': 'high',
                    'description': f'{days_since_last_result} days since last recorded result'
                })
                recommended_actions.append({
                    'priority': 'high',
                    'action': 'Schedule more frequent testing/racing to track progress',
                    'category': 'testing_frequency'
                })
            
            # If low achievement but no obvious causes identified
            if not likely_causes and achievement_rate < 50:
                likely_causes.append({
                    'factor': 'technique_or_other',
                    'swimmer_value': None,
                    'squad_average': None,
                    'impact': 'medium',
                    'description': 'Times not improving despite consistent training'
                })
                recommended_actions.append({
                    'priority': 'high',
                    'action': 'Consider video analysis or technique review',
                    'category': 'technique'
                })
                recommended_actions.append({
                    'priority': 'medium',
                    'action': 'Review and potentially adjust training plan',
                    'category': 'programming'
                })
        
        return {
            'status': status,
            'status_label': status_label,
            'severity': severity,
            'likely_causes': likely_causes,
            'recommended_actions': sorted(recommended_actions, key=lambda x: 0 if x['priority'] == 'high' else 1),
            'achievement_rate': achievement_rate,
            'predictions_tested': predictions_tested
        }
    
    @staticmethod
    def get_status_message(status: str, achievement_rate: float) -> str:
        """Get human-readable status message."""
        if status == 'on_track':
            return f'On track - {achievement_rate:.0f}% of predictions achieved'
        elif status == 'needs_attention':
            return f'Below target - {achievement_rate:.0f}% achievement rate'
        elif status == 'intervention_required':
            return f'Action needed - Only {achievement_rate:.0f}% of predictions achieved'
        else:
            return 'Not enough data to assess'
