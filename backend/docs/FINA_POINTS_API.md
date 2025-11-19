# FINA Points API

Backend API endpoints for calculating FINA (World Aquatics) points for swimming performances.

## Endpoints

### 1. Get Swimmer's FINA Points Summary

Calculate FINA points for all of a swimmer's results.

**Endpoint:** `GET /api/swimmers/{swimmer_id}/fina-points`

**Query Parameters:**
- `gender` (required): `male` or `female`
- `course` (optional, default: `LCM`): `LCM` (long course 50m) or `SCM` (short course 25m)
- `activity` (optional, default: `swim`): Activity type filter
- `equipment` (optional, default: `none`): Equipment filter

**Example Request:**
```bash
GET /api/swimmers/123/fina-points?gender=male&course=LCM
```

**Example Response:**
```json
{
  "swimmer_id": "123",
  "gender": "male",
  "course": "LCM",
  "overall_best_fina_points": 782,
  "overall_average_fina_points": 658,
  "total_results": 45,
  "by_stroke": {
    "freestyle": {
      "best_fina_points": 782,
      "average_fina_points": 702,
      "total_results": 15,
      "best_by_distance": {
        "50": {
          "id": "result-uuid-1",
          "distance": 50,
          "time_result": "00:00:23.98",
          "time_seconds": 23.98,
          "fina_points": 782,
          "performed_on": "2024-08-15"
        },
        "100": {
          "id": "result-uuid-2",
          "distance": 100,
          "time_result": "00:00:54.23",
          "time_seconds": 54.23,
          "fina_points": 701,
          "performed_on": "2024-09-22"
        }
      }
    },
    "backstroke": {
      "best_fina_points": 682,
      "average_fina_points": 658,
      "total_results": 10,
      "best_by_distance": { ... }
    }
  },
  "results_with_points": [
    {
      "id": "result-uuid-1",
      "distance": 50,
      "stroke": "freestyle",
      "time_result": "00:00:23.98",
      "time_seconds": 23.98,
      "performed_on": "2024-08-15",
      "fina_points": 782,
      "result_units": "LCM"
    }
    // ... more results sorted by FINA points (highest first)
  ]
}
```

### 2. Get Supported Events

Get list of all events supported for FINA point calculation.

**Endpoint:** `GET /api/swimmers/fina/supported-events`

**Query Parameters:**
- `course` (optional, default: `LCM`): `LCM` or `SCM`

**Example Request:**
```bash
GET /api/swimmers/fina/supported-events?course=LCM
```

**Example Response:**
```json
{
  "course": "LCM",
  "events": {
    "male": {
      "freestyle": [50, 100, 200, 400, 800, 1500],
      "backstroke": [50, 100, 200],
      "breaststroke": [50, 100, 200],
      "butterfly": [50, 100, 200],
      "individual medley": [200, 400]
    },
    "female": {
      "freestyle": [50, 100, 200, 400, 800, 1500],
      "backstroke": [50, 100, 200],
      "breaststroke": [50, 100, 200],
      "butterfly": [50, 100, 200],
      "individual medley": [200, 400]
    }
  }
}
```

## FINA Point Calculation

### Formula
```
FINA Points = 1000 × (Base Time / Actual Time)³
```

Where:
- **Base Time**: World Record approved by World Aquatics for that event (stroke, distance, gender, course)
- **Actual Time**: The swimmer's actual time in seconds
- **Points Range**: 100 (minimum) to 1100 (maximum)

A world record performance receives approximately 1000 points.

### Base Times

Base times are defined annually by World Aquatics based on approved World Records:

- **LCM (Long Course)**: Base times defined at year end (December 31st) using World Records up to that date
  - LCM 2025: Valid January 1 - December 31, 2025 (based on WRs until Dec 31, 2024)

- **SCM (Short Course)**: Base times defined at year end (August 31st) using World Records up to that date  
  - SCM 2025: Valid September 1, 2025 - August 31, 2026 (based on WRs until Aug 31, 2024)

The base times are published on the World Aquatics website within one month after the end of the relevant period.

**Source**: https://www.worldaquatics.com/swimming/points (Last updated: 01/09/2025)

### Stroke Name Normalization
The API accepts variations of stroke names:
- `freestyle`, `free`, `front crawl` → `freestyle`
- `backstroke`, `back` → `backstroke`
- `breaststroke`, `breast` → `breaststroke`
- `butterfly`, `fly` → `butterfly`
- `individual medley`, `IM`, `medley` → `individual medley`

## Frontend Integration

### TypeScript Types
```typescript
interface FinaPointsResponse {
  swimmer_id: string;
  gender: 'male' | 'female';
  course: 'LCM' | 'SCM';
  overall_best_fina_points: number;
  overall_average_fina_points: number;
  total_results: number;
  by_stroke: {
    [stroke: string]: {
      best_fina_points: number;
      average_fina_points: number;
      total_results: number;
      best_by_distance: {
        [distance: string]: {
          id: string;
          distance: number;
          time_result: string;
          time_seconds: number;
          fina_points: number;
          performed_on: string;
        };
      };
    };
  };
  results_with_points: Array<{
    id: string;
    distance: number;
    stroke: string;
    time_result: string;
    time_seconds: number;
    performed_on: string;
    fina_points: number;
    result_units: string;
  }>;
}
```

### Example API Call
```typescript
async function getSwimmerFinaPoints(swimmerId: string, gender: 'male' | 'female', course: 'LCM' | 'SCM' = 'LCM') {
  const response = await fetch(
    `/api/swimmers/${swimmerId}/fina-points?gender=${gender}&course=${course}`
  );
  return await response.json();
}
```

## Use Cases

1. **Performance Comparison**
   - Compare performances across different strokes and distances
   - Normalize results using FINA points instead of raw times

2. **Progress Tracking**
   - Track FINA points progression over time
   - Show improvement across all events

3. **Goal Setting**
   - Calculate what time is needed to reach target FINA points
   - Set targets for regional/national competition standards

4. **Best Times Dashboard**
   - Add FINA points column to best times table
   - Show best FINA score for each stroke
   - Display overall average FINA points

5. **Stroke Analysis**
   - Identify strongest and weakest strokes using normalized points
   - Compare relative ability across disciplines

## References

- [FINA/World Aquatics Points System](https://www.worldaquatics.com/swimming/points)
- [SwimStats FINA Calculator](https://www.swimstats.net/finacalculator)
