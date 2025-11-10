# WorkoutForm Module

This module contains the workout creation and editing form, refactored into modular, single-responsibility components.

## Structure

```
WorkoutForm/
├── index.tsx                       # Main page component (orchestration)
├── hooks/
│   └── useWorkoutForm.ts          # Custom hook for form state and logic
└── components/
    ├── index.ts                   # Component exports
    ├── WorkoutFormHeader.tsx      # Header with save/cancel buttons
    ├── ErrorAlert.tsx             # Error message display
    ├── WorkoutNameInput.tsx       # Workout name input field
    ├── WorkoutDescriptionTextarea.tsx  # Workout description textarea
    ├── EffortLevelSlider.tsx      # Effort level range slider
    └── EditMetricModal.tsx        # Modal for editing metrics
```

## Component Responsibilities

### `index.tsx` (Main Component)
- Orchestrates all subcomponents
- Manages modal state for metric editing
- Handles layout and composition
- Delegates business logic to the custom hook

### `hooks/useWorkoutForm.ts`
- Form state management (`formData`)
- Loading states (`loading`, `loadingWorkout`)
- Error handling
- API integration (create, update, fetch workout)
- Analysis data handling
- Form submission and validation
- Navigation logic

### Components

#### `WorkoutFormHeader`
- Displays page title (Create/Edit)
- Cancel button with navigation
- Submit button with loading states
- Success state display

#### `ErrorAlert`
- Displays error messages
- Dismissible alert UI
- Conditional rendering

#### `WorkoutNameInput`
- Single text input for workout name
- Required field validation
- Auto-focus capability

#### `WorkoutDescriptionTextarea`
- Multi-line textarea for workout description
- Tab key handling for indentation
- Placeholder with example format

#### `EffortLevelSlider`
- Range slider for effort level (1-10)
- Visual labels (Easy/Moderate/Hard)
- Real-time value display

#### `EditMetricModal`
- Modal dialog for editing metrics
- Supports distance, duration, and calories
- Keyboard shortcuts (Enter to save)
- Input validation and formatting

## Usage

Import and use the main component:

```tsx
import WorkoutFormPage from "./pages/WorkoutForm";

// In router
<Route path="/workouts/create" element={<WorkoutFormPage />} />
<Route path="/workouts/:workoutId/edit" element={<WorkoutFormPage />} />
```

## Data Flow

1. **Initial Load**: `useWorkoutForm` fetches existing workout data (edit mode)
2. **User Input**: Components call `setFormData` with updates
3. **Analysis**: `RealtimeWorkoutAnalyzer` provides auto-calculated metrics
4. **Metric Edit**: Click metric card → Modal opens → Save updates `formData`
5. **Submit**: `handleSubmit` sends data to API and navigates away

## Benefits of Modularization

- **Single Responsibility**: Each component has one clear purpose
- **Testability**: Components can be tested in isolation
- **Reusability**: Components can be reused in other forms
- **Maintainability**: Easy to locate and fix issues
- **Readability**: Clear separation of concerns
- **Type Safety**: Full TypeScript support throughout
