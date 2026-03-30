import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import ExercisePage from "./pages/ExercisePage";
import HomePage from "./pages/HomePage";
import SessionPage from "./pages/SessionPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/week" element={<HomePage />} />
        <Route path="/session/:sessionInstanceId" element={<SessionPage />} />
        <Route path="/exercise/:exerciseInstanceId" element={<ExercisePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
