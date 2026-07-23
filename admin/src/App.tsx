import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { Layout } from './components/Layout';
import Login from './pages/Login';

// Route pages are code-split (lazy) so the admin loads only the current page's
// JS instead of shipping all ~18 pages (incl. the 1200-line WordsPage) in the
// initial bundle. The Layout's <Suspense> shows a spinner while a chunk loads.
const WordsPage = lazy(() => import('./pages/words/WordsPage'));
const LessonsPage = lazy(() => import('./pages/lessons/LessonsPage'));
const IdiomsPage = lazy(() => import('./pages/idioms/IdiomsPage'));
const ExercisesPage = lazy(() => import('./pages/exercises/ExercisesPage'));
const QuizzesPage = lazy(() => import('./pages/quizzes/QuizzesPage'));
const IeltsPage = lazy(() => import('./pages/ielts/IeltsPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const MonitorPage = lazy(() => import('./pages/monitor/MonitorPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const LeaderboardPage = lazy(() => import('./pages/leaderboard/LeaderboardPage'));
const AiBuddyPage = lazy(() => import('./pages/buddy/AiBuddyPage'));
const ClassesPage = lazy(() => import('./pages/classes/ClassesPage'));
const OrganizationsPage = lazy(() => import('./pages/organizations/OrganizationsPage'));
const UsagePage = lazy(() => import('./pages/usage/UsagePage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const GuidePage = lazy(() => import('./pages/guide/GuidePage'));
const SafetyEventsPage = lazy(() => import('./pages/safety/SafetyEventsPage'));
const BuddyFeedbackPage = lazy(() => import('./pages/feedback/BuddyFeedbackPage'));

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
            <Route path="/idioms"        element={<IdiomsPage />} />
            <Route path="/exercises"     element={<ExercisesPage />} />
            <Route path="/quizzes"       element={<QuizzesPage />} />
            <Route path="/ielts"         element={<IeltsPage />} />
            <Route path="/users"         element={<UsersPage />} />
            <Route path="/classes"       element={<ClassesPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/leaderboard"   element={<LeaderboardPage />} />
            <Route path="/buddy"         element={<AiBuddyPage />} />
            <Route path="/usage"         element={<UsagePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/monitor"       element={<MonitorPage />} />
            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="/safety"        element={<SafetyEventsPage />} />
            <Route path="/buddy-feedback" element={<BuddyFeedbackPage />} />
            <Route path="/guide"         element={<GuidePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
