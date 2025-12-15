"""Swimmer comparison service for head-to-head analysis."""
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, date
from collections import defaultdict
import statistics

from app.utils.age_calculator import calculate_age, calculate_age_whole_years
from app.services.trend_analysis_service import TrendAnalysisService, ComparativeTrend
from app.services.prediction import PredictionService


class SwimmerComparisonService:
    """Service for comparing performance between two swimmers."""
    
    @staticmethod
    def compare_swimmers(
        swimmer_a_data: Dict[str, Any],
        swimmer_b_data: Dict[str, Any],
        results_a: List[Dict[str, Any]],
        results_b: List[Dict[str, Any]],
        normalize_by_age: bool = False,
        target_age: Optional[int] = None,
        events_filter: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Compare two swimmers with comprehensive analysis.
        
        Args:
            swimmer_a_data: Swimmer A details (id, name, date_of_birth, squad info)
            swimmer_b_data: Swimmer B details
            results_a: All workout results for swimmer A
            results_b: All workout results for swimmer B
            normalize_by_age: If True, only compare results from matching ages
            target_age: Specific age to compare (requires normalize_by_age=True)
            events_filter: List of event keys to include (e.g., ["100_free", "200_im"])
            
        Returns:
            Comprehensive comparison dictionary
        """
        dob_a = swimmer_a_data['date_of_birth']
        dob_b = swimmer_b_data['date_of_birth']
        
        # Filter and enrich results with age data
        enriched_a = SwimmerComparisonService._enrich_results_with_age(results_a, dob_a)
        enriched_b = SwimmerComparisonService._enrich_results_with_age(results_b, dob_b)
        
        # Apply age normalization if requested
        if normalize_by_age:
            enriched_a, enriched_b = SwimmerComparisonService._filter_by_age(
                enriched_a, enriched_b, target_age
            )
        
        # Apply event filter
        if events_filter:
            enriched_a = [r for r in enriched_a if SwimmerComparisonService._get_event_key(r) in events_filter]
            enriched_b = [r for r in enriched_b if SwimmerComparisonService._get_event_key(r) in events_filter]
        
        # Get personal bests for each event
        pb_a = SwimmerComparisonService._get_personal_bests(enriched_a)
        pb_b = SwimmerComparisonService._get_personal_bests(enriched_b)
        
        # Build head-to-head comparison
        head_to_head = SwimmerComparisonService._build_head_to_head(pb_a, pb_b)
        
        # Calculate summary statistics
        summary = SwimmerComparisonService._calculate_summary(head_to_head, swimmer_a_data, swimmer_b_data)
        
        # Calculate trend analysis for overlapping events
        trend_comparisons = SwimmerComparisonService._calculate_trend_comparisons(
            enriched_a, enriched_b, dob_a, dob_b
        )
        
        # Generate race predictions with historical data
        prediction_analysis = PredictionService.predict_all_events(
            head_to_head,
            trend_comparisons,
            enriched_a,
            enriched_b
        )
        
        return {
            "swimmer_a": {
                "id": swimmer_a_data['id'],
                "name": f"{swimmer_a_data['first_name']} {swimmer_a_data['last_name']}",
                "age": calculate_age_whole_years(dob_a),
                "squad": swimmer_a_data.get('squad_name'),
                "total_results": len(enriched_a)
            },
            "swimmer_b": {
                "id": swimmer_b_data['id'],
                "name": f"{swimmer_b_data['first_name']} {swimmer_b_data['last_name']}",
                "age": calculate_age_whole_years(dob_b),
                "squad": swimmer_b_data.get('squad_name'),
                "total_results": len(enriched_b)
            },
            "comparison_settings": {
                "normalize_by_age": normalize_by_age,
                "target_age": target_age,
                "events_filter": events_filter
            },
            "summary": summary,
            "head_to_head": head_to_head,
            "trend_analysis": trend_comparisons,
            "predictions": {
                "events": [
                    {
                        "event": p.event,
                        "swimmer_a_probability": p.swimmer_a_probability,
                        "swimmer_b_probability": p.swimmer_b_probability,
                        "confidence_level": p.confidence_level,
                        "predicted_differential": p.predicted_differential,
                        "predicted_time_a": p.predicted_time_a,
                        "predicted_time_b": p.predicted_time_b,
                        "factors": p.factors
                    }
                    for p in prediction_analysis.predictions
                ],
                "overall_favorite": prediction_analysis.overall_favorite,
                "average_confidence": prediction_analysis.average_confidence
            }
        }
    
    @staticmethod
    def _enrich_results_with_age(
        results: List[Dict[str, Any]],
        date_of_birth: str
    ) -> List[Dict[str, Any]]:
        """Add age and age_whole fields to each result."""
        enriched = []
        
        for result in results:
            performed_on = result.get('performed_on')
            if not performed_on:
                continue
            
            if isinstance(performed_on, str):
                perf_date = datetime.strptime(performed_on, '%Y-%m-%d').date()
            else:
                perf_date = performed_on
            
            age = calculate_age(date_of_birth, perf_date)
            
            enriched_result = {**result}
            enriched_result['age'] = age
            enriched_result['age_whole'] = int(age)
            enriched.append(enriched_result)
        
        return enriched
    
    @staticmethod
    def _filter_by_age(
        results_a: List[Dict[str, Any]],
        results_b: List[Dict[str, Any]],
        target_age: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Filter results to only matching ages.
        
        If target_age specified, filter to that age.
        Otherwise, filter to overlapping age ranges.
        """
        if target_age is not None:
            # Filter both to specific age
            filtered_a = [r for r in results_a if r['age_whole'] == target_age]
            filtered_b = [r for r in results_b if r['age_whole'] == target_age]
            return filtered_a, filtered_b
        
        # Find overlapping ages
        ages_a = {r['age_whole'] for r in results_a}
        ages_b = {r['age_whole'] for r in results_b}
        overlapping_ages = ages_a & ages_b
        
        if not overlapping_ages:
            # No overlap, return empty
            return [], []
        
        # Filter to overlapping ages
        filtered_a = [r for r in results_a if r['age_whole'] in overlapping_ages]
        filtered_b = [r for r in results_b if r['age_whole'] in overlapping_ages]
        
        return filtered_a, filtered_b
    
    @staticmethod
    def _get_event_key(result: Dict[str, Any]) -> str:
        """Generate event key from result."""
        distance = result.get('distance')
        stroke = result.get('stroke')
        result_units = result.get('result_units', 'SCM')
        activity = result.get('activity', 'swim')
        
        return f"{distance}_{stroke}_{result_units}_{activity}"
    
    @staticmethod
    def _get_personal_bests(results: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Get personal best for each event.
        
        Returns:
            Dict keyed by event_key with best result data
        """
        event_bests = {}
        
        for result in results:
            event_key = SwimmerComparisonService._get_event_key(result)
            time_seconds = SwimmerComparisonService._parse_time_to_seconds(result.get('time_result') or '')
            
            if time_seconds is None:
                continue
            
            # Keep best (fastest/lowest) time
            if event_key not in event_bests or time_seconds < event_bests[event_key]['time_seconds']:
                event_bests[event_key] = {
                    **result,
                    'time_seconds': time_seconds
                }
        
        return event_bests
    
    @staticmethod
    def _build_head_to_head(
        pb_a: Dict[str, Dict[str, Any]],
        pb_b: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Build event-by-event comparison."""
        comparisons = []
        
        # Get all events from both swimmers
        all_events = set(pb_a.keys()) | set(pb_b.keys())
        
        for event_key in sorted(all_events):
            result_a = pb_a.get(event_key)
            result_b = pb_b.get(event_key)
            
            comparison = {
                "event_key": event_key,
                "event": SwimmerComparisonService._format_event_name(event_key),
                "swimmer_a": None,
                "swimmer_b": None,
                "differential": None,
                "percentage_faster": None,
                "faster_swimmer": None
            }
            
            if result_a:
                comparison["swimmer_a"] = {
                    "time": result_a['time_result'],
                    "time_seconds": result_a['time_seconds'],
                    "age": result_a.get('age'),
                    "date": str(result_a.get('performed_on', ''))
                }
            
            if result_b:
                comparison["swimmer_b"] = {
                    "time": result_b['time_result'],
                    "time_seconds": result_b['time_seconds'],
                    "age": result_b.get('age'),
                    "date": str(result_b.get('performed_on', ''))
                }
            
            # Calculate differential if both have times
            if result_a and result_b:
                time_a = result_a['time_seconds']
                time_b = result_b['time_seconds']
                
                differential = time_a - time_b
                comparison["differential"] = differential
                comparison["percentage_faster"] = (abs(differential) / max(time_a, time_b)) * 100
                comparison["faster_swimmer"] = "swimmer_a" if time_a < time_b else "swimmer_b"
            
            comparisons.append(comparison)
        
        return comparisons
    
    @staticmethod
    def _calculate_summary(
        head_to_head: List[Dict[str, Any]],
        swimmer_a_data: Dict[str, Any],
        swimmer_b_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate summary statistics from head-to-head comparison."""
        total_events = len(head_to_head)
        both_competed = [h for h in head_to_head if h['faster_swimmer'] is not None]
        
        swimmer_a_faster_count = sum(1 for h in both_competed if h['faster_swimmer'] == 'swimmer_a')
        swimmer_b_faster_count = sum(1 for h in both_competed if h['faster_swimmer'] == 'swimmer_b')
        
        # Calculate average differential where both competed
        differentials = [h['differential'] for h in both_competed if h['differential'] is not None]
        avg_differential = statistics.mean(differentials) if differentials else None
        
        # Categorize events by stroke
        stroke_breakdown = defaultdict(lambda: {"a_faster_count": 0, "b_faster_count": 0, "total": 0})
        
        for h in both_competed:
            # Extract stroke from event_key (format: "distance_stroke_units_activity")
            parts = h['event_key'].split('_')
            if len(parts) >= 2:
                stroke = parts[1]
                stroke_breakdown[stroke]['total'] += 1
                if h['faster_swimmer'] == 'swimmer_a':
                    stroke_breakdown[stroke]['a_faster_count'] += 1
                else:
                    stroke_breakdown[stroke]['b_faster_count'] += 1
        
        return {
            "total_events_compared": len(both_competed),
            "total_unique_events": total_events,
            "swimmer_a_faster_count": swimmer_a_faster_count,
            "swimmer_b_faster_count": swimmer_b_faster_count,
            "average_time_differential": avg_differential,
            "stroke_breakdown": dict(stroke_breakdown)
        }
    
    @staticmethod
    def _calculate_trend_comparisons(
        results_a: List[Dict[str, Any]],
        results_b: List[Dict[str, Any]],
        dob_a: str,
        dob_b: str
    ) -> Dict[str, Any]:
        """
        Calculate trend analysis for events both swimmers have competed in.
        
        Returns trend analysis per event plus overall trend.
        """
        # Group results by event
        events_a = defaultdict(list)
        events_b = defaultdict(list)
        
        for result in results_a:
            event_key = SwimmerComparisonService._get_event_key(result)
            events_a[event_key].append(result)
        
        for result in results_b:
            event_key = SwimmerComparisonService._get_event_key(result)
            events_b[event_key].append(result)
        
        # Find overlapping events
        common_events = set(events_a.keys()) & set(events_b.keys())
        
        event_trends = {}
        
        for event_key in common_events:
            # Only analyze if both have multiple results
            if len(events_a[event_key]) >= 2 and len(events_b[event_key]) >= 2:
                trend_comparison = TrendAnalysisService.compare_trends(
                    events_a[event_key],
                    dob_a,
                    events_b[event_key],
                    dob_b
                )
                
                if trend_comparison:
                    event_trends[event_key] = {
                        "event": SwimmerComparisonService._format_event_name(event_key),
                        "swimmer_a": {
                            "improvement_per_year": trend_comparison.swimmer_a_trend.improvement_per_year,
                            "velocity_category": trend_comparison.swimmer_a_trend.velocity_category,
                            "consistency_score": trend_comparison.swimmer_a_trend.consistency_score,
                            "data_points": trend_comparison.swimmer_a_trend.data_points,
                            "predicted_next_year": trend_comparison.swimmer_a_trend.predicted_next_year
                        },
                        "swimmer_b": {
                            "improvement_per_year": trend_comparison.swimmer_b_trend.improvement_per_year,
                            "velocity_category": trend_comparison.swimmer_b_trend.velocity_category,
                            "consistency_score": trend_comparison.swimmer_b_trend.consistency_score,
                            "data_points": trend_comparison.swimmer_b_trend.data_points,
                            "predicted_next_year": trend_comparison.swimmer_b_trend.predicted_next_year
                        },
                        "comparison": {
                            "relative_velocity": trend_comparison.relative_velocity,
                            "velocity_advantage": trend_comparison.velocity_advantage
                        }
                    }
        
        # Calculate overall trend if we have enough total data
        overall_trend = None
        if len(results_a) >= 5 and len(results_b) >= 5:
            # For overall trend, use all results (not event-specific)
            overall_comparison = TrendAnalysisService.compare_trends(
                results_a, dob_a, results_b, dob_b
            )
            
            if overall_comparison:
                overall_trend = {
                    "swimmer_a": {
                        "improvement_per_year": overall_comparison.swimmer_a_trend.improvement_per_year,
                        "velocity_category": overall_comparison.swimmer_a_trend.velocity_category,
                        "consistency_score": overall_comparison.swimmer_a_trend.consistency_score
                    },
                    "swimmer_b": {
                        "improvement_per_year": overall_comparison.swimmer_b_trend.improvement_per_year,
                        "velocity_category": overall_comparison.swimmer_b_trend.velocity_category,
                        "consistency_score": overall_comparison.swimmer_b_trend.consistency_score
                    },
                    "comparison": {
                        "relative_velocity": overall_comparison.relative_velocity,
                        "velocity_advantage": overall_comparison.velocity_advantage
                    }
                }
        
        return {
            "by_event": event_trends,
            "overall": overall_trend,
            "events_analyzed": len(event_trends)
        }
    
    @staticmethod
    def _parse_time_to_seconds(time_str: str) -> Optional[float]:
        """Parse time string to seconds."""
        import re
        
        if not isinstance(time_str, str):
            return None
        
        match = re.match(r'(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)', time_str)
        if not match:
            return None
        
        hours = int(match.group(1)) if match.group(1) else 0
        minutes = int(match.group(2)) if match.group(2) else 0
        seconds = float(match.group(3))
        
        return hours * 3600 + minutes * 60 + seconds
    
    @staticmethod
    def _format_event_name(event_key: str) -> str:
        """Format event key to readable name."""
        parts = event_key.split('_')
        if len(parts) < 2:
            return event_key
        
        distance = parts[0]
        stroke = parts[1].title()
        units = parts[2] if len(parts) > 2 else 'SCM'
        activity = parts[3] if len(parts) > 3 else 'swim'
        
        if activity != 'swim':
            return f"{distance}m {stroke} {activity.title()} ({units})"
        return f"{distance}m {stroke} ({units})"
