import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import Analytics from "./pages/Analytics";
import { useAuth } from "./context/AuthContext";

function SessionRedirect() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleExpiredSession = () => {
      logout();
      if (location.pathname !== "/login") navigate("/login", { replace: true });
    };
    window.addEventListener("auth:expired", handleExpiredSession);
    return () => window.removeEventListener("auth:expired", handleExpiredSession);
  }, [logout, navigate, location.pathname]);

  return null;
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <SessionRedirect />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute>
                  <Layout><ProjectView /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/analytics"
              element={
                <ProtectedRoute>
                  <Layout><Analytics /></Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
}
