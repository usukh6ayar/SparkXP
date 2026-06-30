import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import WordsPage from './pages/words/WordsPage';
import LessonsPage from './pages/lessons/LessonsPage';
import ReadingPage from './pages/reading/ReadingPage';
import IdiomsPage from './pages/idioms/IdiomsPage';
import QuizzesPage from './pages/quizzes/QuizzesPage';
import UsersPage from './pages/users/UsersPage';
import MonitorPage from './pages/monitor/MonitorPage';
import SettingsPage from './pages/settings/SettingsPage';
import LeaderboardPage from './pages/leaderboard/LeaderboardPage';
import AiBuddyPage from './pages/buddy/AiBuddyPage';
import ClassesPage from './pages/classes/ClassesPage';
import OrganizationsPage from './pages/organizations/OrganizationsPage';
import UsagePage from './pages/usage/UsagePage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import GuidePage from './pages/guide/GuidePage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <RequireAdmin>
                <Layout />
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="/words" replace />} />
            <Route path="/words"         element={<WordsPage />} />
            <Route path="/lessons"       element={<LessonsPage />} />
            <Route path="/reading"       element={<ReadingPage />} />
            <Route path="/idioms"        element={<IdiomsPage />} />
            <Route path="/quizzes"       element={<QuizzesPage />} />
            <Route path="/users"         element={<UsersPage />} />
            <Route path="/classes"       element={<ClassesPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/leaderboard"   element={<LeaderboardPage />} />
            <Route path="/buddy"         element={<AiBuddyPage />} />
            <Route path="/usage"         element={<UsagePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/monitor"       element={<MonitorPage />} />
            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="/guide"         element={<GuidePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
