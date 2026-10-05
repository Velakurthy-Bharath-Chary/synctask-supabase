import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-blue-600 text-white px-4 py-3 shadow-md">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-wide">
          ⚡ SyncTask
        </Link>

        {user && (
          <>
            {/* Desktop */}
            <div className="hidden sm:flex items-center gap-4">
              <span className="text-sm">{user.username}</span>
              <NotificationBell />
              <button
                onClick={handleLogout}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
              >
                Logout
              </button>
            </div>

            {/* Mobile */}
            <div className="flex sm:hidden items-center gap-3">
              <NotificationBell />
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-white text-2xl"
              >
                ☰
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && user && (
        <div className="sm:hidden mt-3 border-t border-blue-500 pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{user.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-white text-blue-600 px-3 py-2 rounded text-sm font-medium hover:bg-blue-50"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
