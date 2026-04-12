import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store.js';
import ErrorBoundary from './components/common/ErrorBoundary.js';
import ToastContainer from './components/common/ToastContainer.js';
import LoginPage from './pages/LoginPage.js';
import DashboardPage from './pages/DashboardPage.js';
import BoardPage from './pages/BoardPage.js';
import FeaturePlanningPage from './pages/FeaturePlanningPage.js';
import FeatureDetailPage from './pages/FeatureDetailPage.js';
import ProjectSettingsPage from './pages/ProjectSettingsPage.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/board"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <BoardPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/settings"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <ProjectSettingsPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/features/:featureId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <FeatureDetailPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/features/:featureId/plan"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <FeaturePlanningPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </ErrorBoundary>
  );
}
