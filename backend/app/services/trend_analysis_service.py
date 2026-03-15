"""Trend analysis service for swimmer performance over time."""
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, date
import statistics
from dataclasses import dataclass

from app.utils.age_calculator import calculate_age


@dataclass
class TrendPoint:
    """Single data point in a performance trend."""
    date: date
    age: float
    time_seconds: float
    event: str
    result_units: str


@dataclass
class TrendAnalysis:
    """Analysis of performance trend over time."""
    improvement_per_year: float  # Seconds improved per year (negative = getting faster)
    total_improvement: float  # Total improvement from first to last (negative = faster)
    consistency_score: float  # 0-100, higher = more consistent improvement
    data_points: int
    date_range_days: int
    velocity_category: str  # "rapid", "moderate", "slow", "plateaued", "declining"
    predicted_next_year: Optional[float]  # Predicted time in one year


@dataclass
class ComparativeTrend:
    """Comparative trend analysis between two swimmers."""
    swimmer_a_trend: TrendAnalysis
    swimmer_b_trend: TrendAnalysis
    relative_velocity: float  # How much faster A is improving vs B (per year)
    velocity_advantage: str  # "swimmer_a", "swimmer_b", or "similar"


class TrendAnalysisService:
    """Service for analyzing performance trends and predicting future results."""
    
    @staticmethod
    def calculate_trend(
        results: List[Dict[str, Any]],
        date_of_birth: str
    ) -> Optional[TrendAnalysis]:
        """
        Calculate performance trend from a series of results.
        
        Uses linear regression to determine improvement rate and consistency.
        
        Args:
            results: List of workout results with 'performed_on' and 'time_result' fields
            date_of_birth: Swimmer's date of birth for age calculation
            
        Returns:
            TrendAnalysis object or None if insufficient data
        """
        if len(results) < 2:
            return None
        
        # Convert results to trend points
        points: List[TrendPoint] = []
        
        for result in results:
            performed_on = result.get('performed_on')
            time_result = result.get('time_result')
            
            if not performed_on or not time_result:
                continue
            
            # Parse date
            if isinstance(performed_on, str):
                perf_date = datetime.strptime(performed_on, '%Y-%m-%d').date()
            else:
                perf_date = performed_on
            
            # Calculate age at performance
            age = calculate_age(date_of_birth, perf_date)
            
            # Parse time to seconds
            time_seconds = TrendAnalysisService._parse_time_to_seconds(time_result)
            if time_seconds is None:
                continue
            
            points.append(TrendPoint(
                date=perf_date,
                age=age,
                time_seconds=time_seconds,
                event=f"{result.get('distance')}m {result.get('stroke')}",
                result_units=result.get('result_units', 'SCM')
            ))
        
        if len(points) < 2:
            return None
        
        # Sort by date
        points.sort(key=lambda p: p.date)
        
        # Calculate linear regression
        # x = days since first result, y = time in seconds
        first_date = points[0].date
        x_values = [float((p.date - first_date).days) for p in points]
        y_values = [p.time_seconds for p in points]
        
        slope, intercept = TrendAnalysisService._linear_regression(x_values, y_values)
        
        # Convert slope from seconds/day to seconds/year
        improvement_per_year = slope * 365.25
        
        # Calculate total improvement (first vs last)
        total_improvement = points[-1].time_seconds - points[0].time_seconds
        
        # Calculate consistency score (R²)
        consistency_score = TrendAnalysisService._calculate_r_squared(x_values, y_values, slope, intercept)
        
        # Determine velocity category
        velocity_category = TrendAnalysisService._categorize_velocity(improvement_per_year)
        
        # Predict time in one year
        date_range_days = (points[-1].date - points[0].date).days
        future_days = date_range_days + 365
        predicted_next_year = slope * future_days + intercept if consistency_score > 0.3 else None
        
        return TrendAnalysis(
            improvement_per_year=improvement_per_year,
            total_improvement=total_improvement,
            consistency_score=consistency_score * 100,  # Convert to 0-100 scale
            data_points=len(points),
            date_range_days=date_range_days,
            velocity_category=velocity_category,
            predicted_next_year=predicted_next_year
        )
    
    @staticmethod
    def compare_trends(
        swimmer_a_results: List[Dict[str, Any]],
        swimmer_a_dob: str,
        swimmer_b_results: List[Dict[str, Any]],
        swimmer_b_dob: str
    ) -> Optional[ComparativeTrend]:
        """
        Compare improvement trends between two swimmers.
        
        Args:
            swimmer_a_results: Results for swimmer A
            swimmer_a_dob: Swimmer A's date of birth
            swimmer_b_results: Results for swimmer B
            swimmer_b_dob: Swimmer B's date of birth
            
        Returns:
            ComparativeTrend object or None if insufficient data
        """
        trend_a = TrendAnalysisService.calculate_trend(swimmer_a_results, swimmer_a_dob)
        trend_b = TrendAnalysisService.calculate_trend(swimmer_b_results, swimmer_b_dob)
        
        if not trend_a or not trend_b:
            return None
        
        # Calculate relative velocity (negative = A improving faster)
        relative_velocity = trend_a.improvement_per_year - trend_b.improvement_per_year
        
        # Determine velocity advantage
        if abs(relative_velocity) < 0.5:  # Less than 0.5 seconds/year difference
            velocity_advantage = "similar"
        elif relative_velocity < 0:
            velocity_advantage = "swimmer_a"
        else:
            velocity_advantage = "swimmer_b"
        
        return ComparativeTrend(
            swimmer_a_trend=trend_a,
            swimmer_b_trend=trend_b,
            relative_velocity=relative_velocity,
            velocity_advantage=velocity_advantage,
        )
    
    @staticmethod
    def _parse_time_to_seconds(time_str: str) -> Optional[float]:
        """Parse time string to seconds."""
        import re
        
        if not isinstance(time_str, str):
            return None
        
        # Handle formats: "1:23.45", "23.45", "1:23:45.67"
        match = re.match(r'(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)', time_str)
        if not match:
            return None
        
        hours = int(match.group(1)) if match.group(1) else 0
        minutes = int(match.group(2)) if match.group(2) else 0
        seconds = float(match.group(3))
        
        return hours * 3600 + minutes * 60 + seconds
    
    @staticmethod
    def _linear_regression(x: List[float], y: List[float]) -> Tuple[float, float]:
        """
        Calculate linear regression (least squares fit).
        
        Returns:
            Tuple of (slope, intercept)
        """
        n = len(x)
        
        if n == 0:
            return 0.0, 0.0
        
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(y)
        
        # Calculate slope
        numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return 0.0, y_mean
        
        slope = numerator / denominator
        intercept = y_mean - slope * x_mean
        
        return slope, intercept
    
    @staticmethod
    def _calculate_r_squared(
        x: List[float],
        y: List[float],
        slope: float,
        intercept: float
    ) -> float:
        """
        Calculate R² (coefficient of determination) for goodness of fit.
        
        Returns:
            R² value between 0 and 1 (1 = perfect fit)
        """
        if len(y) == 0:
            return 0.0
        
        y_mean = statistics.mean(y)
        
        # Total sum of squares
        ss_tot = sum((yi - y_mean) ** 2 for yi in y)
        
        if ss_tot == 0:
            return 1.0  # Perfect fit if no variance
        
        # Residual sum of squares
        ss_res = sum((y[i] - (slope * x[i] + intercept)) ** 2 for i in range(len(y)))
        
        r_squared = 1 - (ss_res / ss_tot)
        
        return max(0.0, min(1.0, r_squared))  # Clamp to [0, 1]
    
    @staticmethod
    def _categorize_velocity(improvement_per_year: float) -> str:
        """
        Categorize improvement velocity.
        
        Args:
            improvement_per_year: Seconds improved per year (negative = faster)
            
        Returns:
            Category string
        """
        if improvement_per_year < -3.0:
            return "rapid"
        elif improvement_per_year < -1.0:
            return "moderate"
        elif improvement_per_year < -0.2:
            return "slow"
        elif improvement_per_year < 0.2:
            return "plateaued"
        else:
            return "declining"
    
