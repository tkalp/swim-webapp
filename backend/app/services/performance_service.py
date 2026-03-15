"""Performance service for swim times, best splits, and FINA points."""
from typing import Dict, List, Optional, Any
import statistics
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.workout import WorkoutResultRepository, RaceSplitRepository
from app.services.authorization_service import AuthorizationService
from app.services.prediction.time_utils import PoolConverter
from app.domain.value_objects.time import interval_to_seconds


class PerformanceService:
    """Service for performance analysis and metrics."""

    def __init__(
        self,
        db: AsyncSession,
        workout_repo: Optional[WorkoutResultRepository] = None,
        split_repo: Optional[RaceSplitRepository] = None,
        auth_service: Optional[AuthorizationService] = None
    ):
        self.db = db
        self.workout_repo = workout_repo or WorkoutResultRepository(db)
        self.split_repo = split_repo or RaceSplitRepository(db)
        self.auth_service = auth_service or AuthorizationService(db=db)

    async def _verify_swimmer_access(self, swimmer_id: str, coach_id: Optional[str]) -> None:
        if not coach_id:
            return
        await self.auth_service.verify_swimmer_ownership(swimmer_id, coach_id)

    async def get_best_times(
        self,
        swimmer_id: str,
        user_id: Optional[str] = None,
        interval: Optional[str] = None,
        stroke: Optional[str] = None,
        distance: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get best times for a swimmer with filters, including converted times for missing courses."""
        await self._verify_swimmer_access(swimmer_id, user_id)

        results = await self.workout_repo.find_best_times(
            swimmer_id=swimmer_id,
            interval=interval,
            stroke=stroke,
            distance=distance
        )

        # Add converted times for missing courses
        results_with_conversions = self._add_course_conversions(results)

        return results_with_conversions

    async def get_best_splits(
        self,
        swimmer_id: str,
        user_id: Optional[str] = None,
        interval: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get best splits for a swimmer."""
        await self._verify_swimmer_access(swimmer_id, user_id)

        splits = await self.workout_repo.find_best_splits(
            swimmer_id=swimmer_id,
            interval=interval
        )

        # Sort by speed (time in seconds)
        for split in splits:
            if "cumulative_time" in split:
                split["time_seconds"] = interval_to_seconds(split["cumulative_time"])

        splits.sort(key=lambda x: x.get("time_seconds", float("inf")))

        return splits

    async def get_workout_results(
        self,
        swimmer_id: str,
        user_id: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get workout results for a swimmer."""
        await self._verify_swimmer_access(swimmer_id, user_id)
        return await self.workout_repo.find_by_swimmer_id(swimmer_id, limit=limit)

    async def get_race_splits(
        self,
        result_id: str,
        swimmer_id: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get race splits for a specific result."""
        await self._verify_swimmer_access(swimmer_id, user_id)
        return await self.split_repo.find_by_result_id(result_id)

    async def add_workout_results(
        self,
        results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Bulk add workout results (used by sync process)."""
        return await self.workout_repo.bulk_insert(results)

    async def add_race_splits(
        self,
        splits: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Bulk add race splits (used by sync process)."""
        return await self.split_repo.bulk_insert(splits)

    async def get_overall_rankings(
        self,
        squad_id: str,
        result_units: str,
        user_id: Optional[str] = None,
        db: "AsyncSession" = None
    ) -> List[Dict[str, Any]]:
        """Get overall pentathlon rankings for a squad."""
        from sqlalchemy import select, and_
        from app.infrastructure.models import Swimmer, WorkoutResult

        active_db = db or self.db
        if not active_db:
            raise Exception("Database session is required")

        # Define the pentathlon events
        PENTATHLON_EVENTS = [
            {'distance': 50, 'stroke': 'fly'},
            {'distance': 100, 'stroke': 'back'},
            {'distance': 100, 'stroke': 'breast'},
            {'distance': 200, 'stroke': 'free'},
            {'distance': 200, 'stroke': 'im'}
        ]

        # Get all swimmers in the squad
        swimmer_result = await active_db.execute(
            select(
                Swimmer.id,
                Swimmer.first_name,
                Swimmer.last_name,
                Swimmer.date_of_birth,
                Swimmer.sex,
            ).where(Swimmer.squad_id == squad_id)
        )
        swimmer_rows = swimmer_result.all()

        if not swimmer_rows:
            return []

        swimmers = {}
        swimmer_ids = []
        for row in swimmer_rows:
            sid = str(row.id) if hasattr(row.id, 'hex') else row.id
            swimmers[sid] = {
                'id': sid,
                'first_name': row.first_name,
                'last_name': row.last_name,
                'date_of_birth': row.date_of_birth,
                'sex': row.sex,
            }
            swimmer_ids.append(row.id)

        # Get best times for all pentathlon events
        results_result = await active_db.execute(
            select(
                WorkoutResult.swimmer_id,
                WorkoutResult.distance,
                WorkoutResult.stroke,
                WorkoutResult.time_result,
            ).where(
                and_(
                    WorkoutResult.swimmer_id.in_(swimmer_ids),
                    WorkoutResult.activity == 'swim',
                    WorkoutResult.equipment == 'none',
                    WorkoutResult.result_units == result_units,
                    WorkoutResult.time_result.isnot(None),
                )
            )
        )
        result_rows = results_result.all()

        if not result_rows:
            return []

        # Group results by swimmer and event
        swimmer_events: Dict[str, Dict[str, float]] = {}

        for row in result_rows:
            swimmer_id = str(row.swimmer_id) if hasattr(row.swimmer_id, 'hex') else row.swimmer_id
            distance = row.distance
            stroke = row.stroke

            event_key = f"{distance}_{stroke}"
            is_pentathlon = any(
                e['distance'] == distance and e['stroke'] == stroke
                for e in PENTATHLON_EVENTS
            )

            if not is_pentathlon:
                continue

            if swimmer_id not in swimmer_events:
                swimmer_events[swimmer_id] = {}

            time_seconds = interval_to_seconds(row.time_result)
            if time_seconds and time_seconds > 0:
                if event_key not in swimmer_events[swimmer_id]:
                    swimmer_events[swimmer_id][event_key] = time_seconds
                else:
                    swimmer_events[swimmer_id][event_key] = min(
                        swimmer_events[swimmer_id][event_key],
                        time_seconds
                    )

        # Build rankings
        rankings = []
        for swimmer_id, events in swimmer_events.items():
            required_events = {f"{e['distance']}_{e['stroke']}" for e in PENTATHLON_EVENTS}
            has_all_events = required_events.issubset(events.keys())

            swimmer = swimmers[swimmer_id]
            swimmer_name = f"{swimmer.get('first_name', '')} {swimmer.get('last_name', '')}".strip()

            total_time = sum(events.values()) if has_all_events else None

            rankings.append({
                'swimmer_id': swimmer_id,
                'swimmer_name': swimmer_name,
                'date_of_birth': swimmer.get('date_of_birth'),
                'sex': swimmer.get('sex'),
                'fifty_fly': events.get('50_fly'),
                'hundred_back': events.get('100_back'),
                'hundred_breast': events.get('100_breast'),
                'two_hundred_free': events.get('200_free'),
                'two_hundred_im': events.get('200_im'),
                'total_time': total_time,
                'events_completed': len(events),
                'has_all_events': has_all_events
            })

        rankings.sort(key=lambda x: (
            not x['has_all_events'],
            x['total_time'] if x['total_time'] else float('inf')
        ))

        return rankings

    @staticmethod
    def calculate_consistency_score(improvements: List[float]) -> float:
        """Calculate consistency score from improvement percentages across events."""
        if len(improvements) < 2:
            return 100.0

        abs_improvements = [abs(x) for x in improvements]
        mean_abs = statistics.mean(abs_improvements)

        if mean_abs == 0:
            return 100.0

        std_dev = statistics.stdev(abs_improvements) if len(abs_improvements) > 1 else 0
        consistency = max(0, 1 - (std_dev / mean_abs))
        return round(consistency * 100, 2)

    @staticmethod
    def calculate_weighted_improvement(timeline: List[Dict], first_time: float) -> float:
        """Calculate weighted improvement prioritizing recent attempts."""
        if len(timeline) < 1 or first_time == 0:
            return 0.0

        if len(timeline) == 1:
            improvement = ((timeline[0]['time'] - first_time) / first_time) * 100
            return round(improvement, 2)

        n = len(timeline)
        weighted_sum = 0.0
        weight_sum = 0.0

        for i, entry in enumerate(timeline):
            weight = ((i + 1) / n) ** 2 * n
            weighted_sum += entry['time'] * weight
            weight_sum += weight

        weighted_time = weighted_sum / weight_sum if weight_sum > 0 else timeline[-1]['time']
        improvement = ((weighted_time - first_time) / first_time) * 100
        return round(improvement, 2)

    @staticmethod
    def calculate_trend_velocity(timeline: List[Dict]) -> float:
        """Calculate trend velocity using linear regression."""
        if len(timeline) < 2:
            return 0.0

        try:
            first_date_str = timeline[0]['date']
            first_date = datetime.strptime(first_date_str, "%Y-%m-%d")

            x_vals = []
            y_vals = []

            for entry in timeline:
                try:
                    entry_date = datetime.strptime(entry['date'], "%Y-%m-%d")
                    days_elapsed = (entry_date - first_date).days
                    x_vals.append(days_elapsed)
                    y_vals.append(entry['time'])
                except (ValueError, TypeError):
                    continue

            if len(x_vals) < 2:
                return 0.0

            n = len(x_vals)
            x_mean = statistics.mean(x_vals)
            y_mean = statistics.mean(y_vals)

            numerator = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
            denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))

            if denominator == 0:
                return 0.0

            slope = numerator / denominator
            return round(slope, 4)

        except (ValueError, TypeError, ZeroDivisionError):
            return 0.0

    @staticmethod
    def calculate_per_event_consistency(attempts: List[float]) -> float:
        """Calculate consistency score for a single event's attempts."""
        if len(attempts) < 2:
            return 100.0

        mean_time = statistics.mean(attempts)
        if mean_time == 0:
            return 100.0

        std_dev = statistics.stdev(attempts)
        coefficient_of_variation = std_dev / mean_time

        consistency = max(0, 100 * (1 - min(coefficient_of_variation, 1.0)))
        return round(consistency, 2)

    def _add_course_conversions(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add converted times for events missing in LCM or SCM."""
        try:
            events_map: Dict[str, Dict[str, Any]] = {}

            for result in results:
                distance = result.get('distance')
                stroke = result.get('stroke')
                activity = result.get('activity')
                equipment = result.get('equipment')
                result_units = result.get('result_units', 'SCM')

                if not all([distance, stroke, activity, equipment]):
                    continue

                event_key = f"{distance}-{stroke}-{activity}-{equipment}"

                if event_key not in events_map:
                    events_map[event_key] = {
                        'distance': distance,
                        'stroke': stroke,
                        'activity': activity,
                        'equipment': equipment,
                        'SCM': None,
                        'SCM_seconds': None,
                        'LCM': None,
                        'LCM_seconds': None
                    }

                try:
                    time_seconds = interval_to_seconds(result.get('time_result'))
                    if not time_seconds or time_seconds <= 0:
                        continue

                    current_best_seconds = events_map[event_key][f'{result_units}_seconds']
                    if current_best_seconds is None or time_seconds < current_best_seconds:
                        events_map[event_key][result_units] = result
                        events_map[event_key][f'{result_units}_seconds'] = time_seconds
                except Exception:
                    continue

            output_results = list(results)

            for event_key, event_data in events_map.items():
                scm_result = event_data['SCM']
                scm_seconds = event_data['SCM_seconds']
                lcm_result = event_data['LCM']
                lcm_seconds = event_data['LCM_seconds']
                distance = event_data['distance']

                if scm_result and not lcm_result and distance and scm_seconds:
                    try:
                        converted_seconds = PoolConverter.convert(
                            time_seconds=scm_seconds,
                            distance=distance,
                            from_pool='SCM',
                            to_pool='LCM'
                        )

                        if converted_seconds:
                            converted_result = {
                                **scm_result,
                                'result_units': 'LCM',
                                'time_result': self._seconds_to_interval_string(converted_seconds),
                                'is_converted': True,
                                'converted_from': 'SCM',
                                'original_time_seconds': scm_seconds,
                                'converted_time_seconds': converted_seconds
                            }
                            output_results.append(converted_result)
                    except Exception:
                        continue

                elif lcm_result and not scm_result and distance and lcm_seconds:
                    try:
                        converted_seconds = PoolConverter.convert(
                            time_seconds=lcm_seconds,
                            distance=distance,
                            from_pool='LCM',
                            to_pool='SCM'
                        )

                        if converted_seconds:
                            converted_result = {
                                **lcm_result,
                                'result_units': 'SCM',
                                'time_result': self._seconds_to_interval_string(converted_seconds),
                                'is_converted': True,
                                'converted_from': 'LCM',
                                'original_time_seconds': lcm_seconds,
                                'converted_time_seconds': converted_seconds
                            }
                            output_results.append(converted_result)
                    except Exception:
                        continue

            return output_results

        except Exception:
            return results

    @staticmethod
    def _seconds_to_interval_string(seconds: float) -> str:
        """Convert seconds to PostgreSQL interval string format."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
