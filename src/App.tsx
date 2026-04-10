import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import DashboardPage from "./pages/DashboardPage";
import ExercisePage from "./pages/ExercisePage";
import WeekPage from "./pages/WeekPage";
import SeasonPage from "./pages/SeasonPage";
import SessionPage from "./pages/SessionPage";
import SettingsPage from "./pages/SettingsPage";
import ImportPage from "./pages/ImportPage";
import SetsPage from "./pages/SetsPage";
import ConfigProgramsPage from "./pages/ConfigProgramsPage";
import ConfigProgramDetailPage from "./pages/ConfigProgramDetailPage";
import ConfigSessionDetailPage from "./pages/ConfigSessionDetailPage";
import ConfigExercisePage from "./pages/ConfigExercisePage";
import SessionSummaryPage from "./pages/SessionSummaryPage";
import WeekSummaryPage from "./pages/WeekSummaryPage";
import SeasonSummaryPage from "./pages/SeasonSummaryPage";
import BackupPage from "./pages/BackupPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PWAInstallPrompt />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/season" element={<SeasonPage />} />
        <Route path="/week" element={<WeekPage />} />
        <Route path="/week/:weekInstanceId" element={<WeekPage />} />
        <Route path="/week/:weekInstanceId/summary" element={<WeekSummaryPage />} />
        <Route path="/season/:seasonInstanceId/summary" element={<SeasonSummaryPage />} />
        <Route path="/session/:sessionInstanceId" element={<SessionPage />} />
        <Route path="/session/:sessionInstanceId/summary" element={<SessionSummaryPage />} />
        <Route path="/exercise/:exerciseInstanceId" element={<ExercisePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/sets" element={<SetsPage />} />
        <Route path="/config/programs" element={<ConfigProgramsPage />} />
        <Route path="/config/programs/:seasonTemplateId" element={<ConfigProgramDetailPage />} />
        <Route path="/config/sessions/:sessionTemplateId" element={<ConfigSessionDetailPage />} />
        <Route path="/config/exercises/:exerciseTemplateId" element={<ConfigExercisePage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}