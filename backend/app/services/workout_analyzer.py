"""
Workout Analyzer Module
Handles analysis and breakdown calculations for swimming workouts
"""

from typing import Any, Dict, List, Optional
from .workout_parser import WorkoutParser
from app.utils import logger


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
    
    # ============================================================================
    # Enhanced Analysis Methods (Phases 1-3)
    # ============================================================================
    
    def _generate_equipment_breakdown(self, sets: List[Dict]) -> Dict:
        """Generate equipment usage breakdown from sets"""
        equipment_usage = {}
        
        for set_info in sets:
            if set_info.get('equipment'):
                for equip in set_info['equipment']:
                    if equip not in equipment_usage:
                        equipment_usage[equip] = 0
                    equipment_usage[equip] += set_info['total_distance']
            
            # Also check breakdown components
            if 'breakdown_components' in set_info and set_info['breakdown_components']:
                for component in set_info['breakdown_components']:
                    if component.get('equipment'):
                        for equip in component['equipment']:
                            if equip not in equipment_usage:
                                equipment_usage[equip] = 0
                            equipment_usage[equip] += component['total_distance']
        
        return {'breakdown': equipment_usage}
    
    def _generate_intensity_breakdown(self, sets: List[Dict]) -> Dict:
        """Generate intensity type breakdown from sets"""
        intensity_usage = {}
        
        for set_info in sets:
            intensity = set_info.get('intensity', {})
            if intensity and intensity.get('type'):
                intensity_type = intensity['type']
                if intensity_type not in intensity_usage:
                    intensity_usage[intensity_type] = 0
                intensity_usage[intensity_type] += set_info['total_distance']
            
            # Also check breakdown components
            if 'breakdown_components' in set_info and set_info['breakdown_components']:
                for component in set_info['breakdown_components']:
                    comp_intensity = component.get('intensity', {})
                    if comp_intensity and comp_intensity.get('type'):
                        intensity_type = comp_intensity['type']
                        if intensity_type not in intensity_usage:
                            intensity_usage[intensity_type] = 0
                        intensity_usage[intensity_type] += component['total_distance']
        
        return {'breakdown': intensity_usage}
    
    def _generate_drill_breakdown(self, sets: List[Dict]) -> Dict:
        """Generate drill usage breakdown from sets"""
        drill_usage = {}
        
        for set_info in sets:
            if set_info.get('drill_name'):
                drill = set_info['drill_name']
                if drill not in drill_usage:
                    drill_usage[drill] = 0
                drill_usage[drill] += set_info['total_distance']
            
            # Also check breakdown components
            if 'breakdown_components' in set_info and set_info['breakdown_components']:
                for component in set_info['breakdown_components']:
                    if component.get('drill_name'):
                        drill = component['drill_name']
                        if drill not in drill_usage:
                            drill_usage[drill] = 0
                        drill_usage[drill] += component['total_distance']
        
        return {'breakdown': drill_usage}
    
    def analyze_workout_enhanced(self, workout_text: str, workout_id: str = "CUSTOM") -> Dict:
        """Complete analysis including Phase 1-3 enhancements"""
        # Get base analysis
        base_analysis = self.analyze_workout(workout_text, workout_id)
        
        # Add enhanced breakdowns
        sets = self.parser.extract_sets(workout_text)
        if sets:
            equipment_analysis = self._generate_equipment_breakdown(sets)
            intensity_analysis = self._generate_intensity_breakdown(sets)
            drill_analysis = self._generate_drill_breakdown(sets)
            
            base_analysis['equipment_breakdown'] = equipment_analysis['breakdown']
            base_analysis['intensity_breakdown'] = intensity_analysis['breakdown']
            base_analysis['drill_breakdown'] = drill_analysis['breakdown']
            
            # Count progressive and superset workouts
            progressive_count = sum(1 for s in sets if s.get('is_progressive'))
            superset_count = sum(1 for s in sets if s.get('is_superset'))
            
            base_analysis['progressive_sets'] = progressive_count
            base_analysis['superset_sets'] = superset_count
        
        return base_analysis

    # ============================================================================
    # V2 Analysis (LLM primary, regex fallback)
    # ============================================================================

    async def analyze_workout_v2(self, workout_text: str) -> dict[str, Any]:
        """Analyze workout: LLM parser (primary) -> regex (fallback) -> totals -> duration."""
        from .workout_llm_parser import parse_workout_with_llm
        from .workout_totals import compute_totals

        parser_used = "llm"
        try:
            parsed = await parse_workout_with_llm(workout_text)
        except Exception as e:
            logger.warning(f"LLM parser failed, falling back to regex: {e}")
            parsed = self._regex_fallback(workout_text)
            parser_used = "regex"

        totals = compute_totals(parsed.get("sections", []))
        time_est = self._estimate_duration(parsed.get("sections", []))

        return {
            "parser_used": parser_used,
            "sections": parsed.get("sections", []),
            **totals,
            "estimated_duration_minutes": time_est["total_minutes"],
            "rest_time_minutes": time_est["rest_minutes"],
        }

    def _regex_fallback(self, workout_text: str) -> dict[str, Any]:
        """Parse with regex and convert to the sections format."""
        sets = self.parser.extract_sets(workout_text)
        converted_sets: list[dict[str, Any]] = []
        for s in sets:
            converted_sets.append({
                "reps": s.get("reps", 1),
                "distance": s.get("unit_distance", s.get("distance", 0)),
                "stroke": s.get("stroke", "choice"),
                "activity": s.get("activity", "swim"),
                "energy_zone": s.get("energy_zone", "en2"),
                "interval": "",
                "equipment": s.get("equipment", []),
                "notes": "",
            })
        if converted_sets:
            return {"sections": [{"name": "Full Workout", "sets": converted_sets}]}
        return {"sections": []}

    def _estimate_duration(self, sections: list[dict]) -> dict[str, float]:
        """Estimate duration in minutes from parsed sections.

        For sets WITH an interval: total = interval × reps (rest is baked in).
        For sets WITHOUT an interval: total = inferred pace × reps.
        Explicit rest lines (e.g. "2:00 rest") are added on top.

        Returns dict with total_minutes and rest_minutes (explicit rest only).
        """
        set_seconds: float = 0
        explicit_rest_seconds: float = 0

        for section in sections:
            rounds = max(1, int(section.get("rounds", 1) or 1))
            section_seconds: float = 0

            for s in section.get("sets", []):
                reps = s.get("reps", 1)
                distance = s.get("distance", 0)
                stroke = s.get("stroke", "freestyle")
                activity = s.get("activity", "swim")
                interval_str = s.get("interval", "")

                if interval_str:
                    # Interval given: total = interval × reps
                    try:
                        clean = interval_str.replace("@", "").strip()
                        parts = clean.split(":")
                        if len(parts) == 2:
                            interval_secs = int(parts[0]) * 60 + int(parts[1])
                        else:
                            interval_secs = int(parts[0])
                        section_seconds += interval_secs * reps
                    except (ValueError, IndexError):
                        # Bad format — infer from pace
                        section_seconds += self.estimator.estimate_swim_time(distance, stroke, activity) * reps
                else:
                    # No interval — infer from pace tables
                    section_seconds += self.estimator.estimate_swim_time(distance, stroke, activity) * reps

            # Multiply by rounds for compound sections
            set_seconds += section_seconds * rounds

            # Explicit rest periods (e.g. "2:00 rest") — per round
            for r in section.get("rest_seconds", []):
                explicit_rest_seconds += r * rounds

        total = set_seconds + explicit_rest_seconds
        return {
            "total_minutes": round(total / 60, 1),
            "rest_minutes": round(explicit_rest_seconds / 60, 1),
        }

    @staticmethod
    def _default_rest_for_distance(distance: int) -> int:
        """Return default rest seconds between reps based on distance."""
        if distance <= 25:
            return 10
        elif distance <= 50:
            return 15
        elif distance <= 100:
            return 20
        elif distance <= 200:
            return 30
        else:
            return 45