import { useState, useEffect, useCallback } from "react";
import { getMyProjects, getAllProjects, createProject } from "../api/projectApi";
import ProjectCard from "../components/ProjectCard";
import { useWebSocket } from "../context/WebSocketContext";

export default function Dashboard() {
  const { subscribe } = useWebSocket();
  const [myProjects, setMyProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [tab, setTab] = useState("mine");
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseLoaded, setBrowseLoaded] = useState(false);
  const [error, setError] = useState("");

  const fetchMyProjects = useCallback(async (quiet = true) => {
    if (!quiet) setLoading(true);
    try {
      const mine = await getMyProjects();
      setMyProjects(mine.data);
    } catch {
      setError("Failed to load projects.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const fetchBrowseProjects = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const response = await getAllProjects();
      setAllProjects(response.data);
      setBrowseLoaded(true);
    } catch {
      setError("Failed to load projects to browse.");
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const loadInitialProjects = useCallback(async () => {
    setLoading(true);
    setBrowseLoading(true);
    const [mine, browse] = await Promise.allSettled([getMyProjects(), getAllProjects()]);
    if (mine.status === "fulfilled") {
      setMyProjects(mine.value.data);
    } else {
      setError("Failed to load projects.");
    }
    if (browse.status === "fulfilled") {
      setAllProjects(browse.value.data);
      setBrowseLoaded(true);
    } else {
      setError("Failed to load projects to browse.");
    }
    setLoading(false);
    setBrowseLoading(false);
  }, []);

  useEffect(() => {
    // Load both lists together so projects already in My Projects never flash
    // in Browse before membership data arrives.
    void loadInitialProjects();
    const refresh = setInterval(() => {
      void fetchMyProjects(true);
      void fetchBrowseProjects();
    }, 30000);
    return () => clearInterval(refresh);
  }, [fetchMyProjects, fetchBrowseProjects, loadInitialProjects]);

  useEffect(() => subscribe("project_deleted", (message) => {
    const deletedId = String(message.project_id);
    setMyProjects((projects) => projects.filter((project) => String(project.id) !== deletedId));
    setAllProjects((projects) => projects.filter((project) => String(project.id) !== deletedId));
  }), [subscribe]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createProject(newProject);
      setNewProject({ name: "", description: "" });
      setShowCreate(false);
      void fetchMyProjects(true);
      if (browseLoaded) void fetchBrowseProjects();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create project.");
    }
  };

  const myProjectIds = new Set(myProjects.map((p) => p.id));
  const browsableProjects = allProjects.filter((p) => !myProjectIds.has(p.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Workspace</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage your collaborative projects
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
          >
            + New Project
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {["mine", "browse"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === "browse") void fetchBrowseProjects();
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${tab === t
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border hover:bg-gray-50"
                }`}
            >
              {t === "mine"
                ? `My Projects (${myProjects.length})`
                : `Browse (${browsableProjects.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            Loading projects...
          </div>
        ) : tab === "mine" ? (
          myProjects.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-2">No projects yet</p>
              <p className="text-sm">
                Create a project, or ask its owner to assign you a task to join its team.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myProjects.map((p) => (
                <ProjectCard key={p.id} project={p} isMember={true} onDeleted={fetchMyProjects} />
              ))}
            </div>
          )
        ) : browseLoading ? (
          <div className="text-center py-16 text-gray-400">Loading projects to browse...</div>
        ) : (
          browsableProjects.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No other projects available.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {browsableProjects.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border shadow p-5">
                  <ProjectCard project={p} isMember={false} />
                  <p className="mt-3 text-center text-xs text-gray-500">Ask the project owner to assign you a task to join.</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g. E-Commerce Redesign"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="What is this project about?"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
