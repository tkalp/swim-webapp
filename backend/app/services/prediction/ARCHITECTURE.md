# Swimming Prediction Service - Architecture Documentation

## 📋 Overview

The Swimming Prediction Service is a comprehensive, modular system for predicting race outcomes and individual swimmer improvements. It analyzes historical performance data, applies physiological constraints, and integrates training context to generate realistic, data-driven predictions.

## 🎯 Core Capabilities

### 1. **Head-to-Head Race Predictions**
Predicts the outcome of races between two swimmers using multi-factor weighted analysis.

### 2. **Individual Improvement Predictions**
Forecasts future performance for individual swimmers based on trends, training, and physiological limits.

## 🏗️ Architecture

### **Modular Design**
The service is organized into specialized modules, each with a single responsibility:

```
prediction/
├── __init__.py                      # Package interface
├── models.py                        # Data models
├── prediction_service.py            # Main service interface
├── race_prediction.py               # Head-to-head predictions
├── improvement_prediction.py        # Individual improvements
├── statistical_analysis.py          # Statistical calculations
├── physiological_constraints.py     # Physiological modeling
├── training_analysis.py             # Training alignment
├── event_relationships.py           # Event mapping
└── time_utils.py                    # Time parsing & conversion
```

### **Module Responsibilities**

#### **models.py** - Data Structures
Defines dataclasses for structured data:
- `RacePrediction`: Head-to-head outcome
- `PredictionAnalysis`: Multi-event comparison
- `WorkoutContext`: Training session data
- `ImprovementPrediction`: Individual forecast

#### **time_utils.py** - Time Operations
- `TimeParser`: Parse time strings (mm:ss.ms format)
- `PoolConverter`: Convert times between SCM/LCM pools
- `DifferentialCalculator`: Sigmoid-based probability scoring

#### **statistical_analysis.py** - Statistical Engine
- `ImprovementAnalyzer`: Trend analysis, consistency scoring
- `TrendPredictor`: Future time prediction with caps
- `ConfidenceCalculator`: Multi-factor confidence scoring

#### **physiological_constraints.py** - Reality Checks
- `PhysiologicalLimits`: Elite benchmarks by event
- `ConstraintApplicator`: Apply diminishing returns, pace constraints
- `AgeGroupAdjustments`: Age-specific multipliers

#### **training_analysis.py** - Training Context
- `TrainingAlignmentAnalyzer`: Workout-event alignment scoring
- `WorkoutVolumeAnalyzer`: Volume and effort metrics

#### **event_relationships.py** - Event Mapping
- `EventRelationshipMapper`: Related event identification
- `EventDataExtractor`: Time series extraction
- `RelatedDataSupplementer`: Cross-event data supplementation

#### **race_prediction.py** - Head-to-Head Engine
- `RacePredictorEngine`: Core race prediction logic
- `ComparisonAnalyzer`: Multi-event comparison orchestration

#### **improvement_prediction.py** - Improvement Engine
- `ImprovementPredictorEngine`: Individual prediction orchestration

#### **prediction_service.py** - Public API
Main service interface maintaining backward compatibility.

---

## 🔬 How It Works

### **Head-to-Head Race Prediction**

#### **Multi-Factor Weighted Analysis**

```python
Total Score = Σ(Factor × Weight)

Factors:
1. Current Differential (50%) - Sigmoid conversion of time difference
2. Improvement Rate (30%)     - Trend velocity comparison
3. Consistency (15%)           - Standard deviation analysis
4. Recent Form (5%)            - First-half vs second-half comparison
```

#### **Prediction Pipeline**

```
Historical Data
    ↓
Factor Calculation
    ├── Differential Factor    (time_b - time_a → sigmoid)
    ├── Improvement Factor     (rate_b - rate_a → scaled sigmoid)
    ├── Consistency Factor     (std_b - std_a → scaled sigmoid)
    └── Recent Form Factor     (avg_b - avg_a → sigmoid)
    ↓
Weighted Summation
    ↓
Probability Calculation
    ├── swimmer_a_probability = total_score × 100
    └── swimmer_b_probability = (1 - total_score) × 100
    ↓
Confidence Assessment
    ├── Data quality bonus (trend data + recent form)
    └── Margin-based thresholds (high/medium/low)
    ↓
Future Time Prediction
    ├── Apply improvement rate × attempts
    └── Conservative dampening (80%)
    ↓
RacePrediction Output
```

---

### **Individual Improvement Prediction**

#### **Prediction Flow**

```
Historical Times (3+ required)
    ↓
Base Trend Analysis
    ├── Improvement per attempt (rolling window)
    ├── Consistency scoring (normalized std dev)
    ├── Recent form analysis (half-comparison)
    └── PB recency calculation
    ↓
Context Integration
    ├── Attendance adjustment (70%+ boost, <50% penalty)
    ├── Time gap multipliers (age-group specific)
    ├── Squad comparison (relative improvement rate)
    └── Training alignment (workout-event matching)
    ↓
Base Prediction
    ├── Linear projection with conservatism (80%)
    └── Initial caps (5% improvement, 10% regression)
    ↓
Early Caps (Skill-Level Based)
    ├── Beginner (>200% elite): 3% max
    ├── Intermediate (150-200%): 4% max
    └── Advanced (<150%): 5% max
    ↓
Attendance & Time Gap Adjustments
    ├── Scale improvement by attendance multiplier
    └── Apply age-group time gap multiplier
    ↓
Physiological Constraints
    ├── Diminishing returns near elite (dampening curve)
    ├── Distance-specific caps (longer = stricter)
    ├── Pace reality checks (can't maintain sprint pace)
    └── Absolute floor (95% of elite time)
    ↓
Confidence Calculation (0-110 points)
    ├── Data quantity (0-30)
    ├── Consistency (0-20)
    ├── Trend clarity (0-15)
    ├── Training volume (0-10)
    ├── PB recency (0-10)
    ├── Attendance (0-15)
    ├── Squad data (0-10)
    └── Workout alignment (0-15)
    ↓
ImprovementPrediction Output
```

---

## 🧮 Key Algorithms

### **Sigmoid Probability Conversion**
```python
P(A wins) = 1 / (1 + e^(-k × differential))

Where:
- differential = time_b - time_a (seconds)
- k = 0.5 (calibrated for swimming)
- 5 second advantage → ~90% probability
- 2 second advantage → ~70% probability
```

### **Improvement Rate Calculation**
```python
rate = mean([t[i] - t[i-1] for i in range(1, len(recent_times))])

- Uses sliding window (default 5 attempts)
- Negative rate = getting faster
```

### **Physiological Diminishing Returns**
```python
proximity = (current - elite) / (threshold - elite)  # 0 to 1
dampening = 0.1 + (0.9 × proximity)
adjusted_improvement = improvement × dampening

- At threshold (115% elite): 100% of improvement
- At elite level: 10% of improvement (very hard)
```

### **Distance Scaling (Cross-Event)**
```python
scaled_time = original_time × (target_distance / source_distance)^1.06

Power law exponent (1.06) accounts for:
- Fatigue accumulation
- Pace slowdown over distance
```

### **Pool Conversion (SCM ↔ LCM)**
```python
Conversion factors (based on turn advantage):
50m:  ±1.5%
100m: ±2.5%
200m: ±3.0%
400m: ±3.5%
800m: ±3.8%
1500m: ±4.0%

LCM_time = SCM_time × (1 + factor)  # SCM → LCM (slower)
SCM_time = LCM_time × (1 - factor)  # LCM → SCM (faster)
```

### **Training Alignment Scoring**
```python
# Target profiles by distance
50m:   60% sprint, 30% mixed, 10% technique (effort 7-10)
100m:  50% sprint, 30% mixed, 20% endurance/tech (effort 6-9)
200m:  50% mixed, 30% endurance, 20% sprint/tech (effort 5-8)
800m+: 60% endurance, 30% mixed, 10% technique (effort 3-6)

alignment = (profile_similarity × 0.6) + (effort_match × 0.4)
```

---

## 📊 Data Requirements

### **Minimum Requirements**
- **Race Prediction**: 2+ times per swimmer
- **Improvement Prediction**: 3+ historical times

### **Optimal Data**
- **Historical Times**: 5-10+ results
- **Recent Times**: Last 3-5 performances
- **Training Context**: 4+ weeks of workout data
- **Squad Context**: Average improvement rate
- **Age Data**: For age-group adjustments

---

## 🎯 Confidence Levels

### **Head-to-Head Confidence**
```
High:   ≥30 points (probability margin + data bonus)
Medium: 15-29 points
Low:    <15 points

Data bonuses:
- Trend analysis available: +10
- Recent form data: +5
```

### **Improvement Confidence**
```
High:   ≥70 points (64% of max score)
Medium: 40-69 points (37-63%)
Low:    <40 points

Max possible: 110 (with workout data), 95 (without)
```

---

## 🚀 Usage Examples

### **Basic Race Prediction**
```python
from app.services.prediction import PredictionService

prediction = PredictionService.predict_race_outcome(
    event="100m Freestyle SCM",
    swimmer_a_data={
        'time': 56.2,
        'all_times': [57.8, 57.1, 56.8, 56.2],
        'recent_times': [56.8, 56.2]
    },
    swimmer_b_data={
        'time': 57.5,
        'all_times': [58.5, 58.0, 57.8, 57.5],
        'recent_times': [57.8, 57.5]
    }
)

print(f"Swimmer A probability: {prediction.swimmer_a_probability}%")
print(f"Confidence: {prediction.confidence_level}")
print(f"Predicted differential: {prediction.predicted_differential}s")
```

### **Comprehensive Improvement Prediction**
```python
from app.services.prediction import PredictionService, WorkoutContext

workouts = [
    WorkoutContext(
        total_meters=4000,
        effort_level=7,
        session_date="2025-12-10",
        workout_type="sprint"
    ),
    # ... more workouts
]

prediction = PredictionService.predict_improvement(
    event="100m Freestyle SCM",
    current_best=56.2,
    all_times=[57.8, 57.1, 56.8, 56.2],
    attempts_until_target=3,
    attendance_rate=85.0,
    swimmer_age=15,
    days_since_last_result=30,
    recent_workouts=workouts
)

print(f"Current best: {prediction.current_best}s")
print(f"Predicted time: {prediction.predicted_time}s")
print(f"Expected improvement: {prediction.improvement_expected}s")
print(f"Confidence: {prediction.confidence_level}")
print(f"Factors: {prediction.factors}")
```

---

## 🔧 Design Principles

### **1. Single Responsibility**
Each module has one clear purpose.

### **2. Composability**
Modules can be used independently or composed together.

### **3. Testability**
Pure functions and dependency injection enable easy testing.

### **4. Explainability**
All predictions include factor breakdowns for transparency.

### **5. Conservative Predictions**
Multiple constraint layers prevent unrealistic forecasts.

### **6. Backward Compatibility**
Main service maintains original API surface.

---

## 🎨 Benefits of Modularization

### **Before (Monolithic)**
- 1324 lines in single file
- Deeply nested logic
- Difficult to test individual components
- Hard to understand data flow
- Challenging to modify constraints

### **After (Modular)**
- 9 focused modules (~150-300 lines each)
- Clear separation of concerns
- Each component independently testable
- Explicit data flow through modules
- Easy to modify/extend individual systems

---

## 🔮 Future Enhancements

### **Potential Additions**
1. **Machine Learning Integration**: Train on historical data
2. **Competition Context**: Taper, rest, competition level
3. **Environmental Factors**: Pool conditions, altitude
4. **Injury History**: Recovery curves, form restoration
5. **Technique Analysis**: Stroke efficiency metrics
6. **Seasonal Periodization**: Training cycle awareness

### **Extension Points**
- Add new constraint applicators
- Implement alternative statistical models
- Integrate external data sources
- Custom confidence calculators
- Domain-specific adjustment factors

---

## 📝 Notes

### **Calibration**
All coefficients (weights, caps, conversion factors) are based on:
- Swimming physiology research
- Elite performance data
- World record progressions
- Age-group development curves

### **Conservative by Design**
The system intentionally:
- Caps predictions (5% improvement max before constraints)
- Applies dampening factors (80% conservatism)
- Uses multiple constraint layers
- Requires minimum data thresholds

This prevents over-optimistic predictions that could misguide training planning.

---

**Last Updated**: December 15, 2025
**Version**: 2.0 (Modular Architecture)
