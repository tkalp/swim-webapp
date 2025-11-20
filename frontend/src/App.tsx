import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ProtectedRoute from './routes/ProtectedRoute';
import { GlobalLayout } from './components/layout/GlobalLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SquadsPage from './pages/Squads';
import AddSquadPage from './pages/AddSquad';
import SquadPage from './pages/Squad';
import EditSquadPage from './pages/EditSquad';
import SwimmerPage from './pages/SwimmerPage';
import ExternalSwimmerPage from './pages/ExternalSwimmerPage';
import AICoachPage from './pages/AICoachPage';
import WorkoutViewPage from './pages/WorkoutView';
import WorkoutFormPage from './pages/WorkoutForm';
import WorkoutsLibraryPage from './pages/WorkoutsLibrary';
import CoachNetworkPage from './pages/CoachNetwork';
import { analytics } from './lib/mixpanel';

export default function App() {
  const location = useLocation();

  // Track page views
  useEffect(() => {
    analytics.trackPageView(location.pathname);
  }, [location]);

  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/squads" replace />} />
        <Route
          element={
            <GlobalLayout>
              <SquadsPage />
            </GlobalLayout>
          }
          path="/squads"
        />
        <Route
          element={
            <GlobalLayout>
              <AddSquadPage />
            </GlobalLayout>
          }
          path="/squads/new"
        />
        <Route
          element={
            <GlobalLayout>
              <EditSquadPage />
            </GlobalLayout>
          }
          path="/squads/:squadId/edit"
        />
        <Route
          element={
            <GlobalLayout>
              <SquadPage />
            </GlobalLayout>
          }
          path="/squads/:squadId"
        />
        <Route
          element={
            <GlobalLayout>
              <SwimmerPage />
            </GlobalLayout>
          }
          path="/swimmers/:swimmerId"
        />
        <Route
          element={
            <GlobalLayout>
              <ExternalSwimmerPage />
            </GlobalLayout>
          }
          path="/swimmer/:slug"
        />
        <Route
          element={
            <GlobalLayout>
              <WorkoutsLibraryPage />
            </GlobalLayout>
          }
          path="/workouts"
        />
        <Route
          element={
            <GlobalLayout>
              <WorkoutViewPage />
            </GlobalLayout>
          }
          path="/workouts/:workoutId"
        />
        <Route
          element={
            <GlobalLayout>
              <WorkoutFormPage />
            </GlobalLayout>
          }
          path="/workouts/:workoutId/edit"
        />
        <Route
          element={
            <GlobalLayout>
              <WorkoutFormPage />
            </GlobalLayout>
          }
          path="/workouts/create"
        />
        <Route
          element={
            <GlobalLayout>
              <CoachNetworkPage />
            </GlobalLayout>
          }
          path="/network"
        />
        <Route
          element={
            <GlobalLayout>
              <AICoachPage />
            </GlobalLayout>
          }
          path="/ai-coach"
        />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  );
}
