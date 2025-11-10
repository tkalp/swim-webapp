"""
Workout Analyzer Module
Handles analysis and breakdown calculations for swimming workouts
"""

from typing import Dict, List, Optional
from .workout_parser import WorkoutParser


class WorkoutTimeEstimator:
    """Estimate workout duration including swimming and rest time"""
    
    def __init__(self):
        # Average pace per 100m in seconds by stroke and activity type
        self.pace_per_100m = {
            'freestyle': {'swim': 90, 'kick': 150, 'pull': 105, 'drill': 120},
            'backstroke': {'swim': 110, 'kick': 160, 'pull': 125, 'drill': 140},
            'breaststroke': {'swim': 130, 'kick': 180, 'pull': 145, 'drill': 160},
            'butterfly': {'swim': 120, 'kick': 170, 'pull': 135, 'drill': 150},
            'im': {'swim': 110, 'kick': 160, 'pull': 125, 'drill': 140},
            'choice': {'swim': 100, 'kick': 155, 'pull': 115, 'drill': 130}
        }
        
        # Default rest time estimates (seconds)
        self.default_rest = {
            25: 10, 50: 15, 100: 20, 200: 30, 400: 60
        }
    
    def estimate_swim_time(self, distance: int, stroke: str, activity: str) -> float:
        """Estimate swimming time for a given distance"""
        if stroke not in self.pace_per_100m:
            stroke = 'freestyle'
        
        if activity not in self.pace_per_100m[stroke]:
            activity = 'swim'
            
        pace_100m = self.pace_per_100m[stroke][activity]
        return (distance / 100) * pace_100m
    
    def estimate_rest_time(self, distance: int, interval_time: Optional[float] = None) -> float:
        """Estimate rest time between sets"""
        if interval_time:
            swim_time = self.estimate_swim_time(distance, 'freestyle', 'swim')
            rest_time = max(0, interval_time - swim_time)
            return rest_time
        
        if distance <= 25:
            return self.default_rest[25]
        elif distance <= 50:
            return self.default_rest[50]
        elif distance <= 100:
            return self.default_rest[100]
        elif distance <= 200:
            return self.default_rest[200]
        else:
            return self.default_rest[400]
    
    def estimate_workout_duration(self, sets: List[Dict]) -> Dict:
        """Estimate total workout duration"""
        if not sets:
            return {'total_time': 0, 'swim_time': 0, 'rest_time': 0}
        
        total_swim_time = 0
        total_rest_time = 0
        
        total_other_time = 0
        
        for idx, set_info in enumerate(sets):
            distance = set_info['distance']
            reps = set_info['reps']
            stroke = set_info['stroke']
            activity = set_info['activity']
            interval_time = set_info.get('interval_time')
            
            # Check if this is an explicit rest instruction
            if stroke == 'rest' and 'rest_time' in set_info:
                total_rest_time += set_info['rest_time']
                continue
            
            # Check if this is an "other" activity (e.g., Turn Work)
            if stroke == 'other' and 'other_time' in set_info:
                total_other_time += set_info['other_time']
                continue
            
            # Check if set has breakdown_components
            breakdown_components = set_info.get('breakdown_components', [])
            
            if breakdown_components:
                # If the parent set has an interval time, use it for the whole set
                if interval_time:
                    # Set has interval like "6x50 @ 1:15", total time = interval_time * reps
                    set_time = interval_time * reps
                    total_swim_time += set_time
                else:
                    # No parent interval, check if components have their own intervals
                    set_time = 0
                    
                    for comp in breakdown_components:
                        comp_reps = comp.get('reps', 0)
                        comp_distance = comp.get('distance', distance)
                        comp_stroke = comp.get('stroke', stroke)
                        comp_activity = comp.get('activity', activity)
                        comp_interval_time = comp.get('interval_time')
                        
                        if comp_interval_time:
                            # Component has its own interval time
                            comp_total_time = comp_interval_time * comp_reps
                        else:
                            # No interval time, just estimate swim time
                            comp_swim_time_per_rep = self.estimate_swim_time(comp_distance, comp_stroke, comp_activity)
                            comp_total_time = comp_swim_time_per_rep * comp_reps
                        
                        set_time += comp_total_time
                    
                    total_swim_time += set_time
            else:
                # Standard set logic (no breakdown components)
                if interval_time:
                    # For interval sets like "8 x 50 @ 1:30"
                    # Total time for the set = interval_time * reps
                    # This becomes the "swim time" (rest is embedded in the interval)
                    set_time = interval_time * reps
                    total_swim_time += set_time
                else:
                    # No interval time: just calculate swim time
                    swim_time_per_rep = self.estimate_swim_time(distance, stroke, activity)
                    set_time = swim_time_per_rep * reps
                    total_swim_time += set_time
            
            # Add rest between sets (90 seconds default, unless it's the last set)
            # Skip rest after the last set
            # if idx < len(sets) - 1:
            #     # Don't add rest after rest or other activity sets
            #     if stroke not in ['rest', 'other']:
            #         total_rest_time += 90
        
        return {
            'total_time': total_swim_time + total_rest_time + total_other_time,
            'swim_time': total_swim_time,
            'rest_time': total_rest_time,
            'other_time': total_other_time
        }


class WorkoutAnalyzer:
    """Main analyzer class that coordinates parsing and analysis"""
    
    def __init__(self):
        self.parser = WorkoutParser()
        self.estimator = WorkoutTimeEstimator()
    
    def analyze_workout(self, workout_text: str, workout_id: str = "CUSTOM") -> Dict:
        """Complete analysis of a single workout"""
        sets = self.parser.extract_sets(workout_text)
        
        if not sets:
            return {
                'workout_id': workout_id,
                'total_meters': 0,
                'total_sets': 0,
                'estimated_duration_minutes': 0,
                'stroke_breakdown': {},
                'activity_breakdown': {},
                'energy_zone_breakdown': {},
                'error': 'No sets found'
            }
        
        # Get breakdowns
        stroke_analysis = self._generate_stroke_breakdown(sets)
        activity_analysis = self._generate_activity_breakdown(sets)
        energy_analysis = self._generate_energy_zone_breakdown(sets)
        
        # Get time estimation
        duration = self.estimator.estimate_workout_duration(sets)
        
        # Calculate percentages
        stroke_percentages = self._calculate_percentages(stroke_analysis['breakdown'])
        activity_percentages = self._calculate_percentages(activity_analysis['breakdown'])
        energy_percentages = self._calculate_percentages(energy_analysis['breakdown'])
        
        # Calculate estimated calories
        # Formula: 0.9 calories per meter (rough average for swimming)
        # More accurate would factor in stroke type and intensity, but this is a good baseline
        total_meters = stroke_analysis['breakdown']['total']
        estimated_calories = round(total_meters * 0.5)
        
        return {
            'workout_id': workout_id,
            'total_meters': total_meters,
            'total_sets': len(sets),
            'estimated_duration_minutes': duration['total_time'] / 60,
            'swim_time_minutes': duration['swim_time'] / 60,
            'rest_time_minutes': duration['rest_time'] / 60,
            'other_time_minutes': duration.get('other_time', 0) / 60,
            'estimated_calories': estimated_calories,
            'stroke_breakdown': stroke_analysis['breakdown'],
            'stroke_percentages': stroke_percentages,
            'activity_breakdown': activity_analysis['breakdown'],
            'activity_percentages': activity_percentages,
            'energy_zone_breakdown': energy_analysis['breakdown'],
            'energy_zone_percentages': energy_percentages,
            'sets_details': sets[:20]  # Limit for web display
        }
    
    def _generate_stroke_breakdown(self, sets: List[Dict]) -> Dict:
        """Generate stroke breakdown from sets"""
        breakdown = {
            'freestyle': 0, 'backstroke': 0, 'breaststroke': 0,
            'butterfly': 0, 'im': 0, 'choice': 0, 'mixed': 0, 'total': 0
        }
        
        for set_info in sets:
            # Skip rest and other activity sets (no distance to count)
            if set_info.get('stroke') in ['rest', 'other']:
                continue
                
            # If the set has breakdown components, use those for more detailed analysis
            if 'breakdown_components' in set_info and set_info['breakdown_components']:
                for component in set_info['breakdown_components']:
                    stroke = component['stroke']
                    distance = component['total_distance']
                    breakdown[stroke] += distance
                    breakdown['total'] += distance
            else:
                # Use the set's overall stroke
                stroke = set_info['stroke']
                distance = set_info['total_distance']
                breakdown[stroke] += distance
                breakdown['total'] += distance
        
        return {'breakdown': breakdown}
    
    def _generate_activity_breakdown(self, sets: List[Dict]) -> Dict:
        """Generate activity breakdown from sets"""
        breakdown = {
            'swim': 0, 'kick': 0, 'pull': 0, 'drill': 0, 'mixed': 0, 'total': 0
        }
        
        for set_info in sets:
            # Skip rest and other activity sets (no distance to count)
            if set_info.get('activity') in ['rest', 'other']:
                continue
                
            # If the set has breakdown components, use those for more detailed analysis
            if 'breakdown_components' in set_info and set_info['breakdown_components']:
                for component in set_info['breakdown_components']:
                    activity = component['activity']
                    distance = component['total_distance']
                    breakdown[activity] += distance
                    breakdown['total'] += distance
            else:
                # Use the set's overall activity
                activity = set_info['activity']
                distance = set_info['total_distance']
                breakdown[activity] += distance
                breakdown['total'] += distance
        
        return {'breakdown': breakdown}
    
    def _generate_energy_zone_breakdown(self, sets: List[Dict]) -> Dict:
        """Generate energy zone breakdown from sets"""
        breakdown = {
            'en1': 0, 'en2': 0, 'en3': 0, 'en4': 0, 'sprint': 0, 'total': 0
        }
        
        for set_info in sets:
            # Skip rest and other activity sets (no distance to count)
            if set_info.get('stroke') in ['rest', 'other']:
                continue
                
            zone = set_info.get('energy_zone', 'en1')
            distance = set_info['total_distance']
            breakdown[zone] += distance
            breakdown['total'] += distance
        
        return {'breakdown': breakdown}
    
    def _calculate_percentages(self, breakdown: Dict) -> Dict:
        """Calculate percentage distribution"""
        total = breakdown.get('total', 0)
        if total == 0:
            return {key: 0 for key in breakdown.keys()}
        
        return {
            key: (value / total) * 100 
            for key, value in breakdown.items() 
            if key != 'total'
        }
    
    def get_workout_classification(self, analysis: Dict) -> str:
        """Classify workout type based on analysis"""
        total_meters = analysis['total_meters']
        energy_percentages = analysis['energy_zone_percentages']
        activity_percentages = analysis['activity_percentages']
        
        # Distance-based classification
        if total_meters >= 4000:
            base_type = "Distance/Endurance"
        elif total_meters >= 2500:
            base_type = "Moderate Volume"
        elif total_meters >= 1500:
            base_type = "Short/Sprint"
        else:
            base_type = "Technique/Recovery"
        
        # Intensity modifier
        high_intensity = energy_percentages.get('en3', 0) + energy_percentages.get('en4', 0) + energy_percentages.get('sprint', 0)
        if high_intensity > 30:
            intensity_mod = "High Intensity"
        elif energy_percentages.get('en2', 0) > 40:
            intensity_mod = "Threshold"
        else:
            intensity_mod = "Aerobic"
        
        # Activity modifier
        if activity_percentages.get('drill', 0) > 25:
            activity_mod = "Technique Focus"
        elif activity_percentages.get('kick', 0) > 20:
            activity_mod = "Kick Focus"
        else:
            activity_mod = ""
        
        # Combine classifications
        classification_parts = [base_type, intensity_mod]
        if activity_mod:
            classification_parts.append(activity_mod)
        
        return " - ".join(classification_parts)