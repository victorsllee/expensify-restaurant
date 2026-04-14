import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UploadProvider } from './contexts/UploadContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Capture from './pages/Capture';
import ReviewQueue from './pages/ReviewQueue';
import HistoryPage from './pages/History';
import Settings from './pages/Settings';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  return <>{children}</>;
};

function AppRoutes() {
  const { currentUser } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/capture" element={<ProtectedRoute><Capture /></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><ReviewQueue /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UploadProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </UploadProvider>
    </AuthProvider>
  );
}
