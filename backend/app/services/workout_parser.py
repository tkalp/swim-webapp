"""
Workout Parser Module
Handles parsing of swimming workout text into structured data
"""

import re
import pandas as pd
from typing import Dict, List, Optional


class WorkoutParser:
    """Parse swimming workout text to extract structured data"""
    
    def __init__(self):
        # Stroke patterns
        self.stroke_patterns = {
            'freestyle': r'\b(?:free|freestyle|fr)\b',
            'backstroke': r'\b(?:back|backstroke|bk)\b', 
            'breaststroke': r'\b(?:breast|breaststroke|br|brst|breastroke)\b',
            'butterfly': r'\b(?:fly|butterfly|bf)\b',
            'im': r'\b(?:im|individual medley)\b',
            'choice': r'\b(?:ch|choice)\b'
        }
        
        # Activity patterns
        self.activity_patterns = {
            'kick': r'\b(?:kick|kicking|k)\b',
            'pull': r'\b(?:pull|pulling)\b',
            'drill': r'\b(?:drill|drills|dr|scull|sculling|tarzan|underwater)\b',
            'swim': r'\b(?:swim|swimming|sprint)\b'
        }
        
        # Energy zone patterns
        self.energy_zone_patterns = {
            'en1': r'\ben1\b',
            'en2': r'\ben2\b', 
            'en3': r'\ben3\b',
            'en4': r'\ben4\b',
            'sprint': r'\b(?:sprint|sp)\b'
        }
        
        # Equipment patterns (Phase 1)
        self.equipment_patterns = {
            'fins': r'\b(?:fins?|flippers?)\b',
            'paddles': r'\b(?:paddles?|pads?)\b',
            'buoy': r'\b(?:buoy|pull\s*buoy)\b',
            'snorkel': r'\b(?:snorkel|snk)\b',
            'band': r'\b(?:band|ankle\s*band)\b',
            'board': r'\b(?:board|kickboard|kb)\b',
            'parachute': r'\b(?:parachute|chute)\b',
            'tempo_trainer': r'\b(?:tempo\s*trainer|tt)\b'
        }
        
        # Drill patterns (Phase 2)
        self.drill_patterns = {
            'catch_up': r'\b(?:catch\s*up|catchup)\b',
            'single_arm': r'\b(?:single\s*arm|sa|one\s*arm)\b',
            'fur_trader': r'\b(?:fur\s*trader)\b',
            'sl_kick': r'\b(?:sl\s*kick|streamline\s*kick)\b',
            'spin_im': r'\b(?:spin\s*im)\b',
            'tarzan': r'\b(?:tarzan)\b',
            'fist_drill': r'\b(?:fist|fists)\b',
            'fingertip_drag': r'\b(?:fingertip\s*drag|ftd)\b',
            '6_kick': r'\b(?:6\s*kick|six\s*kick)\b',
            '3_stroke': r'\b(?:3\s*stroke|three\s*stroke)\b',
            'underwater': r'\b(?:underwater|uw)\b',
            'vertical_kick': r'\b(?:vertical\s*kick|vk)\b',
            'sculling': r'\b(?:scull|sculling)\b'
        }
        
        # Intensity patterns (Phase 1)
        self.intensity_patterns = {
            'build': r'\b(?:build|building)\b',
            'descend': r'\b(?:descend|descending|desc)\b',
            'negative_split': r'\b(?:negative\s*split|neg\s*split|ns)\b',
            'fast': r'\b(?:fast|hard|strong)\b',
            'easy': r'\b(?:easy|ez|light|recovery)\b',
            'moderate': r'\b(?:moderate|mod)\b',
            'max': r'\b(?:max|maximum|all\s*out)\b',
            'pace_target': r'\b(?:pb|pr|race\s*pace|goal\s*pace)(?:\s*[+\-]\s*\d+)?\b'
        }
        
        # Distance patterns
        self.set_pattern = r'(\d+)\s*x\s*(\d+)'
        self.standalone_pattern = r'^\s*(\d+)\s*(?:m|meters|yds|yards)?\s+'
        self.yards_pattern = r'\((\d+)\s+yards?\)'
        self.meters_pattern = r'\((\d+)\s+meters?\)'
        
        # Time patterns
        self.time_pattern = r'@\s*(\d+):(\d+)'
        self.interval_pattern = r'(\d+):(\d+)'
        
        # Progressive interval patterns (Phase 3)
        self.progressive_interval_pattern = r'@\s*(\d+:\d+(?:\s*/\s*\d+:\d+)+)'
        
        # Mixed breakdown patterns (slash and plus notation)
        self.mixed_breakdown_pattern = r'as\s+(.+?)(?:\s+on\s+|\s*$)'
        self.component_separator_pattern = r'[/+]'
        
        # Distance sub-component pattern (Phase 2)
        self.distance_component_pattern = r'(\d+)\s*([a-zA-Z\s]+?)(?:\s*[-–—]\s*|\s*$)'
        
        # Cycle count pattern (Phase 3)
        self.cycle_pattern = r'by\s+(\d+)\s+cycles?'
        
        # Superset/bracket pattern (Phase 3)
        self.superset_pattern = r'(\d+)\s*x\s*\[([^\]]+)\]\s*(?:\+\s*(.+))?'
        
        # Round-based set patterns
        self.round_pattern = r'^(\d+)\s*(?:x|rounds?)\s*(?:of\s*)?$'
        self.inline_round_pattern = r'^(\d+)\s+rounds?\s+of\s+(.+)$'
        self.round_block_pattern = r'^(\d+)\s*(?:x|rounds?)\s*(?:of\s*)?\n((?:(?:\s+.*\n?))+)'
        
        # Non-swimming activity patterns
        self.non_swim_patterns = [
            r'dry\s*land',
            r'explanation',
            r'transition',
            r'\brest\b',
            r'\bbreak\b',
            r'minute[s]?\s+(?:dry\s*land|explanation|rest|break)',
            r'purpose:\s',
            r'total:\s',
            r'warm-up\s*\(\d+\s+(?:yards?|meters?)\)$',  # Only if it's the entire line
            r'pre-set\s*\(\d+\s+(?:yards?|meters?)\)$', 
            r'main\s+set\s*\(\d+\s+(?:yards?|meters?)\)$',
            r'cool-down\s*\(\d+\s+(?:yards?|meters?)\)$',
            r'rest\s+\d+:\d+\s+between',
            r'^focus\s+on\s+',  # Only if line starts with "Focus on"
            r'^practice\s+',    # Only if line starts with "Practice"
            r'^maximum\s+effort',  # Only if line starts with "Maximum effort"
            r'^maintain\s+',    # Only if line starts with "Maintain"
            r'^breathing\s+pattern',
            r'^stroke\s+rate',
            r'^count\s+strokes',
            r'^explosive\s+',   # Only if line starts with these
            r'^simulate\s+',
            r'^\s*[-•]\s+',     # Bullet points
            r'^technique\s+',
            r'^efficiency\s+',
            r'^velocity\s+',
            r'^recovery\s+',
            r'^lactate\s+clearance',
            r'^nervous\s+system',
            r'^fast-twitch\s+fibers',
            r'^full\s+recovery',
            r'^complete\s+recovery',
            r'^very\s+easy$',       # Only if entire line is "Very easy"
            r'^very\s+relaxed$',    # Only if entire line is "Very relaxed"
            r'^long,\s+smooth\s+strokes$',
            r'^controlled\s+breathing$',
            r'^any\s+stroke,\s+very\s+relaxed'
        ]
    
    def extract_sets(self, workout_text: str) -> List[Dict]:
        """Extract all sets from workout text"""
        if not workout_text or pd.isna(workout_text):
            return []
            
        sets = []
        
        # First, check for round-based patterns and expand them
        expanded_text = self._expand_round_patterns(workout_text)
        
        lines = expanded_text.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            original_line = lines[i]  # Keep original for indentation check
            
            if not line:
                i += 1
                continue
            
            # Check for explicit rest instructions (e.g., "10:00 Rest", "2:00 rest")
            rest_match = re.match(r'(\d+):(\d+)\s+rest\b', line, re.IGNORECASE)
            if rest_match:
                minutes = int(rest_match.group(1))
                seconds = int(rest_match.group(2))
                rest_seconds = minutes * 60 + seconds
                
                # Add a special "rest" set
                sets.append({
                    'distance': 0,
                    'reps': 1,
                    'total_distance': 0,
                    'stroke': 'rest',
                    'activity': 'rest',
                    'energy_zone': 'rest',
                    'rest_time': rest_seconds,
                    'interval_time': None,
                    'breakdown_components': []
                })
                i += 1
                continue
            
            # Check for time-based activities (e.g., "10:00 Turn Work", "5:00 Vertical Kicking")
            other_activity_match = re.match(r'(\d+):(\d+)\s+(.+)', line, re.IGNORECASE)
            if other_activity_match:
                minutes = int(other_activity_match.group(1))
                seconds = int(other_activity_match.group(2))
                activity_time = minutes * 60 + seconds
                activity_name = other_activity_match.group(3).strip()
                
                # Add a special "other" activity set
                sets.append({
                    'distance': 0,
                    'reps': 1,
                    'total_distance': 0,
                    'stroke': 'other',
                    'activity': 'other',
                    'energy_zone': 'en1',  # Default to easy zone
                    'other_time': activity_time,
                    'other_description': activity_name,
                    'interval_time': None,
                    'breakdown_components': []
                })
                i += 1
                continue
            
            # PHASE 3: Check for superset patterns BEFORE non-swimming check (e.g., "3 x [50 + 100] + 30 rest")
            superset_info = self._parse_superset(line)
            if superset_info:
                sets.append(superset_info)
                i += 1
                continue
            
            if self._is_non_swimming_activity(line):
                i += 1
                continue
                continue
                
            # Check for traditional set patterns (e.g., "4 x 100")
            set_matches = re.findall(self.set_pattern, line, re.IGNORECASE)
            
            if set_matches:
                for reps, distance in set_matches:
                    reps, distance = int(reps), int(distance)
                    
                    # Check if distance is in yards and convert to meters
                    if re.search(r'\byards?\b', line, re.IGNORECASE):
                        distance = int(distance * 0.9144)  # Convert yards to meters
                    
                    # Check for breakdown following this set (indented or pattern-based)
                    breakdown_lines = []
                    j = i + 1
                    while j < len(lines):
                        next_line = lines[j]
                        if next_line.strip() == "":
                            j += 1
                            continue
                        
                        # Check if line is indented (starts with tab or spaces)
                        is_indented = next_line.startswith(('\t', '    ', '  '))
                        
                        # Check if line matches breakdown patterns (even if not indented)
                        next_line_stripped = next_line.strip()
                        is_breakdown_pattern = (
                            re.match(r'^(?:odds?|evens?|reps?\s+\d+[-–]\d+|#\d+|\d+[-–]\d+):', next_line_stripped, re.IGNORECASE) or
                            re.match(r'^(?:odds?|evens?)(?:\s|$)', next_line_stripped, re.IGNORECASE)
                        )
                        
                        # Check if the indented line is actually another set (contains NxDistance pattern)
                        # If so, it's NOT a breakdown line, it's a separate set
                        is_separate_set = re.search(self.set_pattern, next_line_stripped, re.IGNORECASE)
                        
                        if (is_indented or is_breakdown_pattern) and not is_separate_set:
                            breakdown_lines.append(next_line_stripped)
                            j += 1
                        else:
                            break
                    
                    # If we found breakdown lines, parse them
                    if breakdown_lines:
                        breakdown_sets = self._parse_indented_breakdown(reps, reps * distance, line, breakdown_lines)
                        sets.extend(breakdown_sets)
                        i = j  # Skip past the breakdown lines
                    elif ' as ' in line.lower():
                        # For detailed workouts, treat "as" notation as a single set description
                        # rather than breaking it down into components
                        set_info = self._create_set_info(reps, distance, line)
                        sets.append(set_info)
                        i += 1
                    elif '(' in line and ')' in line:
                        # Check if this is a compound set (like "4 x 50 (25 Kick, 25 Drill)")
                        # These should be treated as single sets, not broken down into components
                        paren_content = re.search(r'\((.*?)\)', line)
                        if paren_content:
                            components_text = paren_content.group(1)
                            # If the parentheses contain stroke/activity descriptions (not just numbers)
                            # treat this as a compound set rather than a breakdown
                            if re.search(r'(?:kick|drill|swim|free|back|breast|fly|choice)', components_text.lower()):
                                # This is a compound set - keep as single set
                                set_info = self._create_set_info(reps, distance, line)
                                sets.append(set_info)
                                i += 1
                            else:
                                # This might be a distance breakdown
                                breakdown_sets = self._parse_complex_breakdown(reps, distance, line)
                                sets.extend(breakdown_sets)
                                i += 1
                        else:
                            set_info = self._create_set_info(reps, distance, line)
                            sets.append(set_info)
                            i += 1
                    else:
                        # Simple set
                        set_info = self._create_set_info(reps, distance, line)
                        sets.append(set_info)
                        i += 1
            else:
                # Check for yards or meters in parentheses (e.g., "COOL-DOWN (200 yards)")
                yards_match = re.search(self.yards_pattern, line, re.IGNORECASE)
                meters_match = re.search(self.meters_pattern, line, re.IGNORECASE)
                
                if yards_match:
                    # Convert yards to meters (1 yard = 0.9144 meters)
                    yards = int(yards_match.group(1))
                    distance = int(yards * 0.9144)
                    set_info = self._create_set_info(1, distance, line)
                    sets.append(set_info)
                elif meters_match:
                    distance = int(meters_match.group(1))
                    set_info = self._create_set_info(1, distance, line)
                    sets.append(set_info)
                else:
                    # Standalone distances
                    standalone_match = re.match(self.standalone_pattern, line)
                    if standalone_match:
                        distance = int(standalone_match.group(1))
                        
                        # Check for breakdown following this standalone distance (indented or pattern-based)
                        breakdown_lines = []
                        j = i + 1
                        while j < len(lines):
                            next_line = lines[j]
                            if next_line.strip() == "":
                                j += 1
                                continue
                            
                            # Check if line is indented (starts with tab or spaces)
                            is_indented = next_line.startswith(('\t', '    ', '  '))
                            
                            # Check if line matches breakdown patterns (even if not indented)
                            next_line_stripped = next_line.strip()
                            is_breakdown_pattern = (
                                re.match(r'^(?:odds?|evens?|reps?\s+\d+[-–]\d+|#\d+|\d+[-–]\d+):', next_line_stripped, re.IGNORECASE) or
                                re.match(r'^(?:odds?|evens?)(?:\s|$)', next_line_stripped, re.IGNORECASE) or
                                re.match(r'^[-–]\s*\d+', next_line_stripped)  # Match dash-prefixed distances
                            )
                            
                            if is_indented or is_breakdown_pattern:
                                breakdown_lines.append(next_line_stripped)
                                j += 1
                            else:
                                break
                        
                        # If we found breakdown lines, parse them
                        if breakdown_lines:
                            breakdown_sets = self._parse_indented_breakdown(1, distance, line, breakdown_lines)
                            sets.extend(breakdown_sets)
                            i = j  # Skip past the breakdown lines (don't increment again)
                        elif '(' in line and ')' in line:
                            sets.extend(self._parse_complex_set(distance, line))
                            i += 1
                        elif ' - ' in line and re.search(r' - \d+', line):
                            # Check for dash-separated breakdown (e.g., "200 Swim - 100 Free - 100 Back")
                            sets.extend(self._parse_dash_breakdown(distance, line))
                            i += 1
                        else:
                            set_info = self._create_set_info(1, distance, line)
                            sets.append(set_info)
                            i += 1
                    else:
                        i += 1
                        
        return sets
    
    def _create_set_info(self, reps: int, unit_distance: int, line: str) -> Dict:
        """Create standardized set information dictionary"""
        total_distance = reps * unit_distance
        
        # Extract new fields (Phases 1-3)
        equipment = self.identify_equipment(line)
        intensity = self.extract_intensity_markers(line)
        drill_name = self.identify_drill(line)
        cycle_count = self.extract_cycle_count(line)
        interval_time = self.extract_interval_time(line)
        is_progressive = self.is_progressive_interval(line)
        
        return {
            'reps': reps,
            'distance': unit_distance,  # Distance per rep (unit distance)
            'unit_distance': unit_distance,  # Distance per rep
            'total_distance': total_distance,  # Total distance for the set
            'line_text': line,
            'stroke': self.identify_stroke(line),
            'activity': self.identify_activity(line),
            'energy_zone': self.identify_energy_zone(line),
            'interval_time': interval_time,
            'equipment': equipment,  # Phase 1
            'intensity': intensity,  # Phase 1
            'drill_name': drill_name,  # Phase 2
            'cycle_count': cycle_count,  # Phase 3
            'is_progressive': is_progressive  # Phase 3
        }
    
    def _parse_indented_breakdown(self, reps: int, total_distance: int, parent_line: str, breakdown_lines: List[str]) -> List[Dict]:
        """Parse indented breakdown where sub-lines define components of the main set"""
        sets = []
        
        # Calculate unit distance per rep
        unit_distance = total_distance // reps if reps > 0 else total_distance
        
        # Extract distances from breakdown lines
        component_distances = []
        component_reps = []
        for breakdown_line in breakdown_lines:
            # Look for distance at the start of the line, optionally prefixed with dash
            distance_match = re.match(r'^[-–]?\s*(\d+)', breakdown_line.strip())
            if distance_match:
                num = int(distance_match.group(1))
                component_distances.append(num)
                component_reps.append(num)
            else:
                pass  # No distance found in this breakdown line
        
        # Check if component distances add up to the unit distance per rep (distance-based breakdown)
        if component_distances and sum(component_distances) == unit_distance:
            # This is a valid distance-based breakdown - create one set with breakdown components
            # Each component represents the distance per rep, multiplied by total reps
            
            set_info = self._create_set_info(reps, unit_distance, parent_line)
            
            # Create breakdown components for detailed stroke analysis
            breakdown_components = []
            for i, breakdown_line in enumerate(breakdown_lines):
                if i < len(component_distances):
                    comp_distance = component_distances[i]
                    # Remove dash prefix for stroke identification
                    clean_line = re.sub(r'^[-–]\s*', '', breakdown_line.strip())
                    
                    breakdown_components.append({
                        'reps': reps,  # Each component is done for all reps
                        'distance': comp_distance,
                        'total_distance': comp_distance * reps,  # Total across all reps
                        'stroke': self.identify_stroke(clean_line),
                        'activity': self.identify_activity(clean_line + " " + parent_line),
                        'equipment': self.identify_equipment(clean_line),
                        'intensity': self.extract_intensity_markers(clean_line),
                        'drill_name': self.identify_drill(clean_line),
                        'description': breakdown_line.strip()
                    })
            
            # Add breakdown components to the set
            if breakdown_components:
                set_info['breakdown_components'] = breakdown_components
                
                # Determine overall stroke for the set
                all_strokes = [comp['stroke'] for comp in breakdown_components]
                if len(set(all_strokes)) == 1:
                    set_info['stroke'] = all_strokes[0]
                else:
                    set_info['stroke'] = 'mixed'
                
                # Determine overall activity
                all_activities = [comp['activity'] for comp in breakdown_components]
                if len(set(all_activities)) == 1:
                    set_info['activity'] = all_activities[0]
                else:
                    set_info['activity'] = 'mixed'
            
            sets.append(set_info)
        # Check if this is a repetition-based breakdown (e.g., "1 - Free", "1 - Back", "1 - IM")
        elif component_reps and sum(component_reps) == reps and len(component_reps) > 1:
            # This is a repetition-based breakdown where numbers indicate how many of the total reps
            # each stroke should be done (e.g., 1 rep Free + 1 rep Back + 1 rep IM = 3 total reps)
            
            unit_distance = total_distance // reps if reps > 0 else total_distance
            set_info = self._create_set_info(reps, unit_distance, parent_line)
            
            # Create breakdown components for detailed stroke analysis
            breakdown_components = []
            for i, breakdown_line in enumerate(breakdown_lines):
                if i < len(component_reps):
                    comp_reps = component_reps[i]
                    comp_total_distance = comp_reps * unit_distance
                    # Remove dash prefix for stroke identification
                    clean_line = re.sub(r'^[-–]\s*\d+\s*[-–]?\s*', '', breakdown_line.strip())
                    
                    breakdown_components.append({
                        'reps': comp_reps,
                        'distance': unit_distance,
                        'total_distance': comp_total_distance,
                        'stroke': self.identify_stroke(clean_line),
                        'activity': self.identify_activity(clean_line + " " + parent_line),
                        'equipment': self.identify_equipment(clean_line),
                        'intensity': self.extract_intensity_markers(clean_line),
                        'drill_name': self.identify_drill(clean_line),
                        'description': breakdown_line.strip()
                    })
            
            # Add breakdown components to the set
            if breakdown_components:
                set_info['breakdown_components'] = breakdown_components
                
                # Determine overall stroke for the set
                all_strokes = [comp['stroke'] for comp in breakdown_components]
                if len(set(all_strokes)) == 1:
                    set_info['stroke'] = all_strokes[0]
                else:
                    set_info['stroke'] = 'mixed'
                
                # Determine overall activity
                all_activities = [comp['activity'] for comp in breakdown_components]
                if len(set(all_activities)) == 1:
                    set_info['activity'] = all_activities[0]
                else:
                    set_info['activity'] = 'mixed'
            
            sets.append(set_info)
        else:
            # Instructional breakdown (no distances) - create single set with breakdown details
            unit_distance = total_distance // reps if reps > 0 else total_distance
            set_info = self._create_set_info(reps, unit_distance, parent_line)
            
            # Parse breakdown components and add them to the set
            breakdown_components = []
            for breakdown_line in breakdown_lines:
                components = self._parse_complex_breakdown_component(breakdown_line.strip(), reps, unit_distance, parent_line)
                breakdown_components.extend(components)
            
            # Add breakdown components to the set
            if breakdown_components:
                set_info['breakdown_components'] = breakdown_components
                
                # Determine overall stroke/activity for the set
                # If all components have the same stroke, use that; otherwise use 'mixed'
                all_strokes = [comp['stroke'] for comp in breakdown_components]
                all_activities = [comp['activity'] for comp in breakdown_components]
                
                if len(set(all_strokes)) == 1:
                    set_info['stroke'] = all_strokes[0]
                else:
                    set_info['stroke'] = 'mixed'
                    
                if len(set(all_activities)) == 1:
                    set_info['activity'] = all_activities[0]
                else:
                    set_info['activity'] = 'mixed'
            else:
                # Fallback if no breakdown components were parsed
                all_breakdown_text = " ".join(breakdown_lines)
                combined_text = f"{parent_line} {all_breakdown_text}"
                set_info['stroke'] = self.identify_stroke(combined_text)
                set_info['activity'] = self.identify_activity(combined_text)
            
            sets.append(set_info)
        
        return sets
    
    def _parse_complex_breakdown_component(self, breakdown_line: str, total_reps: int, unit_distance: int, parent_line: str = "") -> List[Dict]:
        """Parse complex breakdown components that may contain slash-separated sub-components
        
        Examples:
        - "Odds: 25 Free Kick / 25 Fly Kick" -> multiple sub-components with different strokes
        - "Evens: 25 Fly Kick / 25 Back Kick" -> multiple sub-components with different strokes
        - "1-3: Kick" -> single component (fallback to simple parsing)
        """
        components = []
        breakdown_line_lower = breakdown_line.lower()
        
        # First, determine how many reps this breakdown applies to
        component_reps = 0
        
        # Handle odds/evens patterns
        if re.match(r'^odds?:', breakdown_line_lower):
            component_reps = (total_reps + 1) // 2  # For 4 reps: (4+1)//2 = 2 odds
        elif re.match(r'^evens?:', breakdown_line_lower):
            component_reps = total_reps // 2  # For 4 reps: 4//2 = 2 evens
        # Handle range patterns (e.g., "1-3:", "4-6:", "7-10:")
        elif range_match := re.match(r'^(\d+)[-–](\d+):', breakdown_line_lower):
            start = int(range_match.group(1))
            end = int(range_match.group(2))
            component_reps = end - start + 1
        # Handle single number patterns (e.g., "#1:", "#5:")
        elif re.match(r'^#?(\d+):', breakdown_line_lower):
            component_reps = 1
        # Handle list patterns (e.g., "1,3,5:", "2,4,6,8:")
        elif list_match := re.match(r'^([\d,\s]+):', breakdown_line_lower):
            numbers_str = list_match.group(1)
            numbers = [int(n.strip()) for n in numbers_str.split(',') if n.strip().isdigit()]
            component_reps = len(numbers)
        
        if component_reps == 0:
            return []  # Unable to parse reps
        
        # Extract the description part after the colon
        colon_index = breakdown_line.find(':')
        if colon_index == -1:
            return []
        
        description_part = breakdown_line[colon_index + 1:].strip()
        
        # PHASE 2: Check for distance sub-components (e.g., "30 Kick - 70 Swim")
        distance_components = self._parse_distance_components_in_breakdown(description_part, unit_distance)
        if distance_components:
            # Create a component for each distance sub-component
            result_components = []
            for dist_comp in distance_components:
                result_components.append({
                    'reps': component_reps,
                    'distance': dist_comp['distance'],
                    'total_distance': dist_comp['distance'] * component_reps,
                    'stroke': dist_comp['stroke'],
                    'activity': dist_comp['activity'],
                    'drill_name': dist_comp['drill_name'],
                    'equipment': dist_comp['equipment'],
                    'intensity': dist_comp['intensity'],
                    'interval_time': self.extract_interval_time(breakdown_line),
                    'description': f"{breakdown_line.split(':')[0]}: {description_part}"
                })
            return result_components
        
        # Check if this contains slash-separated sub-components with distances
        if '/' in description_part and re.search(r'\d+', description_part):
            # Parse slash-separated sub-components (e.g., "25 Free Kick / 25 Fly Kick")
            sub_parts = [part.strip() for part in description_part.split('/')]
            
            for sub_part in sub_parts:
                # Extract distance from sub-part (e.g., "25" from "25 Free Kick")
                distance_match = re.match(r'^(\d+)', sub_part)
                if distance_match:
                    sub_distance = int(distance_match.group(1))
                    # Calculate total distance for this sub-component across all reps
                    sub_total_distance = sub_distance * component_reps
                    
                    components.append({
                        'reps': component_reps,
                        'distance': sub_distance,
                        'total_distance': sub_total_distance,
                        'stroke': self.identify_stroke(sub_part),
                        'activity': self.identify_activity(sub_part),
                        'equipment': self.identify_equipment(sub_part),
                        'intensity': self.extract_intensity_markers(sub_part),
                        'drill_name': self.identify_drill(sub_part),
                        'interval_time': self.extract_interval_time(breakdown_line),
                        'description': f"{breakdown_line.split(':')[0]}: {sub_part}"
                    })
        else:
            # Fallback to simple component parsing (no sub-components)
            # Try to identify activity from breakdown line first, then fall back to parent line
            activity = self.identify_activity(breakdown_line)
            if activity == 'swim' and parent_line:
                # If breakdown doesn't specify activity (defaults to 'swim'), check parent
                parent_activity = self.identify_activity(parent_line)
                if parent_activity != 'swim':
                    activity = parent_activity
            
            # Same for stroke
            stroke = self.identify_stroke(breakdown_line)
            if stroke == 'freestyle' and parent_line:
                parent_stroke = self.identify_stroke(parent_line)
                if parent_stroke != 'freestyle':
                    stroke = parent_stroke
            
            components.append({
                'reps': component_reps,
                'distance': unit_distance,
                'total_distance': component_reps * unit_distance,
                'stroke': stroke,
                'activity': activity,
                'equipment': self.identify_equipment(breakdown_line),
                'intensity': self.extract_intensity_markers(breakdown_line),
                'drill_name': self.identify_drill(breakdown_line),
                'interval_time': self.extract_interval_time(breakdown_line),
                'description': breakdown_line
            })
        
        return components

    def _parse_breakdown_component(self, breakdown_line: str, total_reps: int) -> tuple:
        """Parse a breakdown component line to extract reps, stroke, and activity
        
        Examples:
        - "Odds: Free" -> (5, 'freestyle', 'swim') for 10 total reps
        - "Evens: Fly" -> (5, 'butterfly', 'swim') for 10 total reps  
        - "1-3: Kick" -> (3, 'freestyle', 'kick')
        - "4-6: Pull" -> (3, 'freestyle', 'pull')
        - "7-10: Swim" -> (4, 'freestyle', 'swim')
        """
        breakdown_line_lower = breakdown_line.lower()
        
        # Handle odds/evens patterns
        if re.match(r'^odds?:', breakdown_line_lower):
            reps = (total_reps + 1) // 2  # For 10 reps: (10+1)//2 = 5 odds
            stroke = self.identify_stroke(breakdown_line)
            activity = self.identify_activity(breakdown_line)
            return (reps, stroke, activity)
            
        elif re.match(r'^evens?:', breakdown_line_lower):
            reps = total_reps // 2  # For 10 reps: 10//2 = 5 evens
            stroke = self.identify_stroke(breakdown_line)
            activity = self.identify_activity(breakdown_line)
            return (reps, stroke, activity)
        
        # Handle range patterns (e.g., "1-3:", "4-6:", "7-10:")
        range_match = re.match(r'^(\d+)[-–](\d+):', breakdown_line_lower)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2))
            reps = end - start + 1
            stroke = self.identify_stroke(breakdown_line)
            activity = self.identify_activity(breakdown_line)
            return (reps, stroke, activity)
        
        # Handle single number patterns (e.g., "#1:", "#5:")
        single_match = re.match(r'^#?(\d+):', breakdown_line_lower)
        if single_match:
            reps = 1
            stroke = self.identify_stroke(breakdown_line)
            activity = self.identify_activity(breakdown_line)
            return (reps, stroke, activity)
        
        # Handle list patterns (e.g., "1,3,5:", "2,4,6,8:")
        list_match = re.match(r'^([\d,\s]+):', breakdown_line_lower)
        if list_match:
            numbers_str = list_match.group(1)
            numbers = [int(n.strip()) for n in numbers_str.split(',') if n.strip().isdigit()]
            reps = len(numbers)
            stroke = self.identify_stroke(breakdown_line)
            activity = self.identify_activity(breakdown_line)
            return (reps, stroke, activity)
        
        # Fallback: if no pattern matches, return 0 reps
        return (0, 'freestyle', 'swim')

    def _is_non_swimming_activity(self, line: str) -> bool:
        """Check if line describes non-swimming activity"""
        line_lower = line.lower()
        
        for pattern in self.non_swim_patterns:
            if re.search(pattern, line_lower):
                return True
                
        if re.match(r'^\s*\d+\s+minute[s]?\s', line_lower):
            return True
            
        return False
    
    def _expand_round_patterns(self, workout_text: str) -> str:
        """Expand round-based patterns into individual sets with stroke assignments"""
        lines = workout_text.split('\n')
        expanded_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            
            # Check for inline round pattern first (e.g., "3 rounds of 4 x 25")
            inline_round_match = re.match(self.inline_round_pattern, line, re.IGNORECASE)
            
            if inline_round_match:
                rounds = int(inline_round_match.group(1))
                set_content = inline_round_match.group(2).strip()
                
                # Expand the inline round pattern
                for round_num in range(rounds):
                    expanded_lines.append(f"# Round {round_num + 1} of {rounds}")
                    expanded_lines.append(set_content)
                
                i += 1
                continue
            
            # Check for block round pattern (e.g., "3x" or "3 rounds" or "3 rounds of")
            round_match = re.match(self.round_pattern, line, re.IGNORECASE)
            
            if round_match:
                rounds = int(round_match.group(1))
                
                # Collect the block that follows the round marker
                block_lines = []
                round_assignments = {}  # Store stroke/activity assignments per round
                i += 1
                
                while i < len(lines):
                    next_line = lines[i]
                    next_line_stripped = next_line.strip()
                    
                    # Empty line ends the round block
                    if not next_line_stripped:
                        i += 1
                        break
                    
                    # Check for round assignment pattern (e.g., "Round 1 - Free", "Round 2 - IM")
                    round_assignment_match = re.match(r'^round\s+(\d+)\s*[-–:]\s*(.+)$', next_line_stripped, re.IGNORECASE)
                    if round_assignment_match:
                        round_num = int(round_assignment_match.group(1))
                        assignment = round_assignment_match.group(2).strip()
                        round_assignments[round_num] = assignment
                        i += 1
                        continue
                    
                    # Stop if we hit another round pattern
                    if re.match(r'^\d+\s*(?:x|rounds?)\s*(?:of\s*)?$', next_line_stripped, re.IGNORECASE):
                        break
                    
                    # Stop if we hit a non-indented rest period (e.g., "2:00 Rest")
                    if (next_line_stripped and 
                        not next_line.startswith(' ') and 
                        not next_line.startswith('\t') and
                        re.match(r'^\d+:\d+\s+rest\b', next_line_stripped, re.IGNORECASE)):
                        break
                    
                    # Stop if we hit a line that looks like a new section
                    # (no indentation and contains swimming content that's clearly a new main section)
                    # But be more lenient - only break on strong indicators like section keywords or new round markers
                    if (next_line_stripped and 
                        not next_line.startswith(' ') and 
                        not next_line.startswith('\t') and
                        not next_line.startswith('-') and
                        # But NOT if it's a round assignment
                        not re.match(r'^round\s+\d+', next_line_stripped, re.IGNORECASE) and
                        # Only break on strong section indicators (warmup, main set, etc.) - NOT on regular sets
                        any(keyword in next_line_stripped.lower() for keyword in ['warmup', 'warm-up', 'cool', 'cooldown', 'cool-down', 'main set', 'pre-set'])):
                        break
                    
                    # Include the line if it's not empty and not a round assignment
                    if next_line_stripped and not round_assignment_match:
                        block_lines.append(next_line)
                    
                    i += 1
                
                # Expand the block for each round with stroke assignments
                if block_lines:
                    for round_num in range(1, rounds + 1):
                        expanded_lines.append(f"# Round {round_num} of {rounds}")
                        
                        # Get the stroke assignment for this round (if any)
                        assignment = round_assignments.get(round_num, '')
                        
                        # Add each line in the block for this round, appending assignment if present
                        for block_line in block_lines:
                            block_line_stripped = block_line.strip()
                            
                            if assignment:
                                # Append the assignment to each set line if it contains a set pattern
                                if re.search(r'\d+\s*x\s*\d+', block_line_stripped):
                                    # This is a set line - append the assignment (no indentation)
                                    expanded_lines.append(f"{block_line_stripped} {assignment}")
                                else:
                                    # Non-set line (notes, etc.) - keep as-is without indentation
                                    expanded_lines.append(block_line_stripped)
                            else:
                                # No assignment - add stripped line (remove indentation)
                                # This prevents lines from being interpreted as breakdowns later
                                expanded_lines.append(block_line_stripped)
                else:
                    # No block found, keep original line
                    expanded_lines.append(lines[i-1])
            else:
                expanded_lines.append(lines[i])
                i += 1
        
        return '\n'.join(expanded_lines)

    def _parse_as_breakdown(self, reps: int, total_distance: int, line: str) -> List[Dict]:
        """Parse sets with 'as' notation like '4x100 as 50 Free Kick / 50 Fly Swim'"""
        sets = []
        
        # Extract the breakdown part after "as"
        as_match = re.search(self.mixed_breakdown_pattern, line, re.IGNORECASE)
        if not as_match:
            return [self._create_set_info(reps, total_distance, line)]
        
        breakdown_text = as_match.group(1).strip()
        
        # Split by separators (/ or +)
        components = re.split(self.component_separator_pattern, breakdown_text)
        components = [comp.strip() for comp in components if comp.strip()]
        
        if not components:
            return [self._create_set_info(reps, total_distance, line)]
        
        # Extract distances from each component
        component_info = []
        total_component_distance = 0
        
        for component in components:
            # Look for distance at the beginning of component
            distance_match = re.search(r'^(\d+)', component.strip())
            if distance_match:
                comp_distance = int(distance_match.group(1))
                total_component_distance += comp_distance
                component_info.append({
                    'distance': comp_distance,
                    'text': component,
                    'stroke': self.identify_stroke(component),
                    'activity': self.identify_activity(component)
                })
        
        # Validate that component distances sum to total distance
        if total_component_distance == total_distance and component_info:
            # Create a set for each component
            for comp in component_info:
                set_info = self._create_set_info(reps, comp['distance'], f"{line} - Component: {comp['text']}")
                set_info['stroke'] = comp['stroke']
                set_info['activity'] = comp['activity']
                sets.append(set_info)
        else:
            # Fallback to treating as single set if distances don't match
            sets.append(self._create_set_info(reps, total_distance, line))
        
        return sets

    def _parse_dash_breakdown(self, total_distance: int, line: str) -> List[Dict]:
        """Parse dash-separated breakdown format like '200 Swim - 100 Free - 100 Back'"""
        sets = []
        
        # Split on dashes and extract distance+stroke components
        parts = line.split(' - ')
        if len(parts) < 2:
            # Fallback if splitting doesn't work as expected
            return [self._create_set_info(1, total_distance, line)]
        
        # First part contains the total distance and possibly activity
        main_part = parts[0].strip()
        
        # Extract breakdown components from remaining parts
        breakdown_components = []
        total_breakdown_distance = 0
        
        for part in parts[1:]:
            part = part.strip()
            # Extract distance and stroke/activity from each component
            distance_match = re.match(r'^(\d+)\s*(.*)$', part)
            if distance_match:
                comp_distance = int(distance_match.group(1))
                comp_description = distance_match.group(2).strip()
                total_breakdown_distance += comp_distance
                
                breakdown_components.append({
                    'reps': 1,
                    'distance': comp_distance,
                    'total_distance': comp_distance,
                    'stroke': self.identify_stroke(comp_description),
                    'activity': self.identify_activity(comp_description + " " + main_part),
                    'description': part
                })
        
        # Check if breakdown distances add up to total distance
        if total_breakdown_distance == total_distance and breakdown_components:
            # Create a single set with breakdown components
            set_info = self._create_set_info(1, total_distance, line)
            set_info['breakdown_components'] = breakdown_components
            
            # Determine overall stroke for the set
            all_strokes = [comp['stroke'] for comp in breakdown_components]
            if len(set(all_strokes)) == 1:
                set_info['stroke'] = all_strokes[0]
            else:
                set_info['stroke'] = 'mixed'
            
            # Determine overall activity
            all_activities = [comp['activity'] for comp in breakdown_components]
            if len(set(all_activities)) == 1:
                set_info['activity'] = all_activities[0]
            else:
                set_info['activity'] = 'mixed'
            
            sets.append(set_info)
        else:
            # Fallback if distances don't add up
            sets.append(self._create_set_info(1, total_distance, line))
        
        return sets

    def _parse_complex_breakdown(self, reps: int, total_distance: int, line: str) -> List[Dict]:
        """Parse complex sets with distance breakdowns"""
        sets = []
        
        paren_content = re.search(r'\((.*?)\)', line)
        if not paren_content:
            return [self._create_set_info(reps, total_distance, line)]
            
        components_text = paren_content.group(1)
        components = [comp.strip() for comp in components_text.split(',')]
        
        component_distances = []
        for component in components:
            distance_match = re.search(r'(\d+)', component)
            if distance_match:
                component_distances.append(int(distance_match.group(1)))
        
        if sum(component_distances) == total_distance:
            for i, component in enumerate(components):
                if i < len(component_distances):
                    comp_distance = component_distances[i]
                    set_info = self._create_set_info(reps, comp_distance, f"{line} - Component: {component}")
                    set_info['stroke'] = self.identify_stroke(component + " " + line)
                    set_info['activity'] = self.identify_activity(component + " " + line)
                    sets.append(set_info)
        else:
            sets.append(self._create_set_info(reps, total_distance, line))
        
        return sets
    
    def _parse_complex_set(self, total_distance: int, line: str) -> List[Dict]:
        """Parse complex sets like '300 CH (25 Drill, 25 Swim)'"""
        sets = []
        
        paren_content = re.search(r'\((.*?)\)', line)
        if not paren_content:
            return sets
            
        components = paren_content.group(1).split(',')
        total_component_distance = 0
        
        for component in components:
            component = component.strip()
            distance_match = re.search(r'(\d+)', component)
            if distance_match:
                comp_distance = int(distance_match.group(1))
                total_component_distance += comp_distance
        
        if total_component_distance > 0:
            cycles = total_distance // total_component_distance
            
            for component in components:
                component = component.strip()
                distance_match = re.search(r'(\d+)', component)
                if distance_match:
                    comp_distance = int(distance_match.group(1))
                    set_info = self._create_set_info(cycles, comp_distance, f"{line} - Component: {component}")
                    set_info['stroke'] = self.identify_stroke(component + " " + line)
                    set_info['activity'] = self.identify_activity(component + " " + line)
                    sets.append(set_info)
        
        return sets
    
    def identify_stroke(self, text: str) -> str:
        """Identify primary stroke in text"""
        text_lower = text.lower()
        
        # Check for multiple strokes indicating IM or mixed stroke
        found_strokes = []
        for stroke, pattern in self.stroke_patterns.items():
            if re.search(pattern, text_lower):
                found_strokes.append(stroke)
        
        # If we found multiple different strokes, classify appropriately
        if len(found_strokes) > 1:
            # Check if it's the classic IM sequence (fly, back, breast, free)
            im_strokes = {'butterfly', 'backstroke', 'breaststroke', 'freestyle'}
            if set(found_strokes) >= im_strokes or len(found_strokes) >= 3:
                return 'im'
            else:
                return 'mixed'
        elif found_strokes:
            return found_strokes[0]
        
        return 'freestyle'
    
    def identify_activity(self, text: str) -> str:
        """Identify activity type"""
        text_lower = text.lower()
        
        # Check for multiple activities
        found_activities = []
        for activity, pattern in self.activity_patterns.items():
            if re.search(pattern, text_lower):
                found_activities.append(activity)
        
        # If multiple activities found, determine the best classification
        if len(found_activities) > 1:
            # If swim is present with others, prioritize mixed or swim based on context
            if 'swim' in found_activities:
                return 'mixed'
            else:
                # Multiple non-swim activities (e.g., kick and drill)
                return 'mixed'
        elif found_activities:
            return found_activities[0]
        
        return 'swim'
    
    def identify_energy_zone(self, text: str) -> str:
        """Identify energy zone based on explicit markers or intensity descriptors"""
        text_lower = text.lower()
        
        # First check for explicit energy zone markers (EN1, EN2, SP1, etc.)
        for zone, pattern in self.energy_zone_patterns.items():
            if re.search(pattern, text_lower):
                return zone
        
        # If no explicit zone, infer from intensity markers
        # Race pace, PB, PR (with or without modifiers like +10, -5) -> sprint zone
        if re.search(r'\b(?:race\s*pace|pb|pr|max|maximum|all\s*out|sprint)(?:\s*[+\-]\s*\d+)?', text_lower):
            return 'sprint'
        
        # Fast, hard, strong -> EN3 (threshold/anaerobic)
        if re.search(r'\b(?:fast|hard|strong)\b', text_lower):
            return 'en3'
        
        # Build, descend -> EN2 (aerobic with variation)
        if re.search(r'\b(?:build|descend|negative\s*split)\b', text_lower):
            return 'en2'
        
        # Easy, recovery, light -> EN1 (aerobic base)
        if re.search(r'\b(?:easy|ez|light|recovery)\b', text_lower):
            return 'en1'
        
        # Moderate -> EN2
        if re.search(r'\b(?:moderate|mod)\b', text_lower):
            return 'en2'
        
        # Default to EN1 if no intensity markers found
        return 'en1'
    
    def extract_interval_time(self, text: str) -> Optional[float]:
        """Extract interval time in seconds (returns first interval for progressive sets)"""
        # PHASE 3: Check for progressive intervals first
        progressive = self.extract_progressive_intervals(text)
        if progressive and len(progressive) > 0:
            return progressive[0]  # Return first interval for backward compatibility
        
        # Check for "on X:XX" pattern (most common in swim workouts)
        on_time_match = re.search(r'\bon\s+(\d+):(\d+)', text, re.IGNORECASE)
        if on_time_match:
            minutes, seconds = map(int, on_time_match.groups())
            return minutes * 60 + seconds
        
        # Check for @ pattern with full minutes:seconds
        at_time_matches = re.findall(self.time_pattern, text)
        if at_time_matches:
            minutes, seconds = map(int, at_time_matches[0])
            return minutes * 60 + seconds
        
        # Check for short format like "@ :45" or "@:40" or just ":45"
        short_time_match = re.search(r'[@\s]:(\d+)', text)
        if short_time_match:
            return int(short_time_match.group(1))
        
        # General time pattern (without @ or on) - be careful not to match timestamps
        # Only match if followed by common context words or end of string
        time_match = re.search(r'(\d+):(\d+)(?:\s+(?:per|interval|pace|rest)|$)', text)
        if time_match:
            minutes, seconds = map(int, time_match.groups())
            return minutes * 60 + seconds
        
        return None
    
    # ============================================================================
    # PHASE 1: Equipment and Intensity Recognition
    # ============================================================================
    
    def identify_equipment(self, text: str) -> List[str]:
        """Identify equipment mentioned in the text"""
        text_lower = text.lower()
        equipment = []
        
        for equip_name, pattern in self.equipment_patterns.items():
            if re.search(pattern, text_lower):
                equipment.append(equip_name)
        
        return equipment
    
    def extract_intensity_markers(self, text: str) -> Dict[str, any]:
        """Extract intensity markers and pace targets from text"""
        text_lower = text.lower()
        intensity = {
            'type': None,
            'pace_target': None,
            'modifier': None
        }
        
        # Check for intensity types
        for intensity_type, pattern in self.intensity_patterns.items():
            if re.search(pattern, text_lower):
                intensity['type'] = intensity_type
                break
        
        # Check for pace targets with modifiers (e.g., PB+5, PR-3)
        pace_match = re.search(r'\b(pb|pr|race\s*pace|goal\s*pace)\s*([+\-])\s*(\d+)\b', text_lower)
        if pace_match:
            intensity['pace_target'] = pace_match.group(1).replace(' ', '_')
            intensity['modifier'] = f"{pace_match.group(2)}{pace_match.group(3)}"
        elif re.search(r'\b(pb|pr|race\s*pace|goal\s*pace)\b', text_lower):
            # Pace target without modifier
            pace_simple = re.search(r'\b(pb|pr|race\s*pace|goal\s*pace)\b', text_lower)
            intensity['pace_target'] = pace_simple.group(1).replace(' ', '_')
        
        return intensity
    
    # ============================================================================
    # PHASE 2: Drill Recognition and Distance Sub-components
    # ============================================================================
    
    def identify_drill(self, text: str) -> Optional[str]:
        """Identify drill name from text"""
        text_lower = text.lower()
        
        for drill_name, pattern in self.drill_patterns.items():
            if re.search(pattern, text_lower):
                return drill_name
        
        return None
    
    def _parse_distance_components_in_breakdown(self, line: str, total_distance: int) -> List[Dict]:
        """Parse distance sub-components within a breakdown line (e.g., '30 Kick - 70 Swim')"""
        components = []
        
        # Match patterns like "30 Kick - 70 Swim" or "100 Swim — 100 Fur Trader"
        sub_component_pattern = r'(\d+)\s+([a-zA-Z\s]+?)(?:\s*[-–—]\s*|$)'
        matches = re.finditer(sub_component_pattern, line)
        
        accumulated_distance = 0
        for match in matches:
            distance = int(match.group(1))
            description = match.group(2).strip()
            accumulated_distance += distance
            
            # Don't exceed total distance
            if accumulated_distance > total_distance:
                break
            
            component = {
                'distance': distance,
                'stroke': self.identify_stroke(description),
                'activity': self.identify_activity(description),
                'drill_name': self.identify_drill(description),
                'equipment': self.identify_equipment(description),
                'intensity': self.extract_intensity_markers(description)
            }
            components.append(component)
        
        # Only return if we successfully parsed components that match the total
        if components and accumulated_distance == total_distance:
            return components
        
        return []
    
    # ============================================================================
    # PHASE 3: Progressive Intervals, Supersets, and Cycle Counts
    # ============================================================================
    
    def is_progressive_interval(self, text: str) -> bool:
        """Check if the set has progressive intervals (multiple time values)"""
        # Look for pattern like "@ 1:30 / 1:25 / 1:20"
        return bool(re.search(self.progressive_interval_pattern, text))
    
    def extract_progressive_intervals(self, text: str) -> Optional[List[float]]:
        """Extract progressive interval times in seconds"""
        match = re.search(self.progressive_interval_pattern, text)
        if not match:
            return None
        
        # Split the matched group by / to get individual times
        times_str = match.group(1)
        time_parts = re.split(r'\s*/\s*', times_str)
        
        intervals = []
        for time_part in time_parts:
            time_match = re.match(r'(\d+):(\d+)', time_part)
            if time_match:
                minutes, seconds = map(int, time_match.groups())
                intervals.append(minutes * 60 + seconds)
        
        return intervals if intervals else None
    
    def extract_cycle_count(self, text: str) -> Optional[int]:
        """Extract cycle count from text (e.g., 'by 8 cycles')"""
        match = re.search(self.cycle_pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return None
    
    def _parse_superset(self, line: str) -> Optional[Dict]:
        """Parse superset notation like '3 x [50 + 100] + 30 rest'"""
        match = re.search(self.superset_pattern, line)
        if not match:
            return None
        
        reps = int(match.group(1))
        inner_content = match.group(2)
        rest_content = match.group(3) if match.group(3) else None
        
        # Parse the inner content for distances
        inner_distances = re.findall(r'(\d+)', inner_content)
        
        if not inner_distances:
            return None
        
        # Calculate total distance per rep
        distances = [int(d) for d in inner_distances]
        unit_distance = sum(distances)
        
        superset_info = {
            'reps': reps,
            'distance': unit_distance,
            'unit_distance': unit_distance,
            'total_distance': reps * unit_distance,
            'line_text': line,
            'components': distances,
            'rest': rest_content,
            'is_superset': True,
            'stroke': self.identify_stroke(line),
            'activity': self.identify_activity(line),
            'energy_zone': self.identify_energy_zone(line),
            'interval_time': self.extract_interval_time(line),
            'equipment': self.identify_equipment(line),
            'intensity': self.extract_intensity_markers(line),
            'drill_name': self.identify_drill(line),
            'cycle_count': self.extract_cycle_count(line),
            'is_progressive': self.is_progressive_interval(line)
        }
        
        return superset_info
