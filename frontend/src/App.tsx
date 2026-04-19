import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { AuthSuccessPage } from './pages/AuthSuccessPage'
import { DashboardPage } from './pages/DashboardPage'
import { RepositoryDetailPage } from './pages/RepositoryDetailPage'
import { ScanDetailPage } from './pages/ScanDetailPage'
import { RequireAuth } from './state/auth/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/success" element={<AuthSuccessPage />} />

      {/* Protected dashboard routes */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/repos/:repositoryId"
        element={
          <RequireAuth>
            <RepositoryDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/scans/:scanResultId"
        element={
          <RequireAuth>
            <ScanDetailPage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
