import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SquadsPage from "./pages/Squads";
import AddSquadPage from "./pages/AddSquad";
import SquadPage from "./pages/Squad";
import EditSquadPage from "./pages/EditSquad";
import SwimmerPage from "./pages/SwimmerPage";
import AICoachPage from "./pages/AICoachPage";
import WorkoutViewPage from "./pages/WorkoutView";
import WorkoutFormPage from "./pages/WorkoutForm";

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/squads" element={<SquadsPage />} />
        <Route path="/squads/new" element={<AddSquadPage />} />
        <Route path="/squads/:squadId/edit" element={<EditSquadPage />} />
        <Route path="/squads/:squadId" element={<SquadPage />} />
        <Route path="/swimmers/:swimmerId" element={<SwimmerPage />} />
        <Route path="/workouts/:workoutId" element={<WorkoutViewPage />} />
        <Route path="/workouts/:workoutId/edit" element={<WorkoutFormPage />} />
        <Route path="/workouts/create" element={<WorkoutFormPage />} />
        <Route path="/ai-coach" element={<AICoachPage />} />
      </Route>
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}
