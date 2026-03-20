# WorkoutForm Module

Workout creation and editing form with an editor-first, on-demand analysis layout.

## Structure

```
WorkoutForm/
├── index.tsx                          # Main page component (orchestration)
├── hooks/
│   └── useWorkoutForm.ts             # Custom hook for form state and logic
└── components/
    ├── index.ts                      # Component exports
    ├── WorkoutFormHeader.tsx          # Header with save/cancel/visibility
    ├── ErrorAlert.tsx                # Error message display
    ├── WorkoutNameInput.tsx          # Workout name input field
    ├── WorkoutDescriptionTextarea.tsx # Workout description textarea
    └── EffortLevelSlider.tsx         # Effort level range slider
```

## Layout

```
+------------------------------------------------------------------+
| [Name field                          ] [Classification v] [Save] |
+------------------------------------------------------------------+
|                                                                   |
|  [Workout text editor - full width, monospace, spacious]          |
|  (placeholder: "Write your workout here...")                      |
|                                                                   |
+------------------------------------------------------------------+
| [Effort: ----o------] [Tags: + Add] [Visibility: Private v]      |
|                                          [Analyze]                |
+------------------------------------------------------------------+
| WorkoutMetricsCard (appears after analysis)                       |
+------------------------------------------------------------------+
```

## Data Flow

1. **Initial Load**: `useWorkoutForm` fetches existing workout data (edit mode)
2. **User Input**: Components call `setFormData` with updates
3. **Analyze**: User clicks "Analyze" button to trigger on-demand workout analysis via `useWorkoutAnalysis`
4. **Stale Marking**: Editing text after analysis marks metrics as stale
5. **Submit**: `handleSubmit` sends data to API and navigates away

## Key Dependencies

- `WorkoutMetricsCard` (`@/components/workout`) - displays analysis results
- `useWorkoutAnalysis` (`@/hooks`) - manages analyze trigger + stale state
- `TagManager` (`@/components/workout`) - tag selection UI

## Usage

```tsx
import WorkoutFormPage from "./pages/WorkoutForm";

// In router
<Route path="/workouts/create" element={<WorkoutFormPage />} />
<Route path="/workouts/:workoutId/edit" element={<WorkoutFormPage />} />
```
