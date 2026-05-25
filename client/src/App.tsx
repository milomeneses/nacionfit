import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AppLayout } from './components/AppLayout';
import { Hoy } from './pages/Hoy';
import { Sueno } from './pages/Sueno';
import { Ajustes } from './pages/Ajustes';
import { Antojos } from './pages/Antojos';
import { Patrones } from './pages/Patrones';
import { Coach } from './pages/Coach';
import { Reviews } from './pages/Reviews';
import { Tools } from './pages/Tools';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg font-body text-ink/60">
        Cargando…
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && user ? <Navigate to="/app" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={!loading && user ? <Navigate to="/app" replace /> : <Register />}
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Hoy />} />
        <Route path="antojos" element={<Antojos />} />
        <Route path="patrones" element={<Patrones />} />
        <Route path="sueno" element={<Sueno />} />
        <Route path="coach" element={<Coach />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="reviews/:weekStart" element={<Reviews />} />
        <Route path="tools" element={<Tools />} />
        <Route path="settings" element={<Ajustes />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
