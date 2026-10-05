import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getProject, getAssignableUsers } from "../api/projectApi";
import { getTasks, createTask, updateTask, deleteTask, getTaskRequests, createTaskRequest, decideTaskRequest } from "../api/taskApi";
import { useWebSocket } from "../context/WebSocketContext";
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";
import TaskRequestModal from "../components/TaskRequestModal";
import { useAuth } from "../context/AuthContext";

const COLUMNS = ["TODO", "IN_PROGRESS", "DONE"];
const COLUMN_LABELS = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export default function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { connectToProject, subscribe } = useWebSocket();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskRequests, setTaskRequests] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [requestingTask, setRequestingTask] = useState(null);
  const [assignableUsersError, setAssignableUsersError] = useState("");
  const [assignableUsersLoading, setAssignableUsersLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshTaskRequests = useCallback(async () => {
    try {
      const response = await getTaskRequests(projectId);
      setTaskRequests(response.data);
    } catch {
      // Keep the board usable if the request panel is temporarily unavailable.
    }
  }, [projectId]);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        getProject(projectId),
        getTasks(projectId),
      ]);
      setProject(projRes.data);
      setTasks(taskRes.data);
      setError("");

      setLoading(false);
      void refreshTaskRequests();
    } catch (err) {
      setError("Failed to load project. You may not have access.");
    } finally {
      setLoading(false);
    }
  }, [projectId, refreshTaskRequests]);

  useEffect(() => {
    fetchData();
    connectToProject(projectId);

    // Listen for real-time task events
    const unsubCreate = subscribe("task_created", (msg) => {
      setTasks((prev) => {
        if (prev.find((t) => t.id === msg.task.id)) return prev;
        return [...prev, { ...msg.task }];
      });
    });

    const unsubUpdate = subscribe("task_updated", (msg) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === msg.task.id ? { ...t, ...msg.task } : t))
      );
    });

    const unsubDelete = subscribe("task_deleted", (msg) => {
      setTasks((prev) => prev.filter((t) => t.id !== msg.task_id));
    });

    const unsubTaskRequest = subscribe("task_request_created", refreshTaskRequests);
    const unsubTaskDecision = subscribe("task_request_decided", refreshTaskRequests);

    const unsubProjectUpdate = subscribe("project_updated", (msg) => {
      if (msg?.project?.id === projectId) {
        setProject((prev) => ({ ...prev, ...msg.project }));
      }
    });

    const unsubMemberJoined = subscribe("member_joined", (msg) => {
      if (msg?.project_id === projectId) {
        fetchData();
      }
    });

    const unsubProjectDelete = subscribe("project_deleted", (msg) => {
      if (msg?.project_id === projectId) {
        navigate("/");
      }
    });

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
      unsubTaskRequest();
      unsubTaskDecision();
      unsubProjectUpdate();
      unsubMemberJoined();
      unsubProjectDelete();
    };
  }, [projectId, connectToProject, subscribe, fetchData, refreshTaskRequests, navigate]);

  const openTaskModal = (task = null) => {
    setEditingTask(task);
    setShowModal(true);
    setAssignableUsersError("");
    setAssignableUsersLoading(true);
    getAssignableUsers(projectId)
      .then((response) => setAssignableUsers(response.data))
      .catch(() => setAssignableUsersError("Could not load employees. Close and reopen this form to try again."))
      .finally(() => setAssignableUsersLoading(false));
  };

  const handleSaveTask = async (formData) => {
    try {
      let savedTask;
      if (editingTask?.id) {
        const response = await updateTask(editingTask.id, formData);
        savedTask = response.data;
        setTasks((current) => current.map((task) => task.id === savedTask.id ? savedTask : task));
      } else {
        const response = await createTask(projectId, formData);
        savedTask = response.data;
        setTasks((current) => current.some((task) => task.id === savedTask.id) ? current : [...current, savedTask]);
      }
      setShowModal(false);
      setEditingTask(null);
      void fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save task.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await deleteTask(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (err) {
      alert("Failed to delete task.");
    }
  };

  const handleRequestTaskChange = async (data) => {
    try {
      const response = await createTaskRequest(requestingTask.id, data);
      setTaskRequests((current) => [response.data, ...current]);
      setRequestingTask(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to submit request.");
    }
  };

  const handleRequestDecision = async (request, approve) => {
    const note = approve ? null : window.prompt("Reason for rejecting this request:");
    if (!approve && note === null) return;
    if (!approve && !note.trim()) {
      alert("Please enter a reason so the employee understands the decision.");
      return;
    }
    try {
      const response = await decideTaskRequest(request.id, { approve, decision_note: note || null });
      setTaskRequests((current) => current.map((item) => item.id === request.id ? response.data : item));
      if (approve) {
        setTasks((current) => current.map((task) => {
          if (task.id !== response.data.task_id) return task;
          return response.data.request_type === "STATUS"
            ? { ...task, status: response.data.requested_status }
            : { ...task, deadline: response.data.requested_deadline };
        }));
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update request.");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-lg">Loading project...</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen flex-col gap-4">
      <div className="text-red-500">{error}</div>
      <button onClick={() => navigate("/")} className="text-blue-600 hover:underline">
        Back to Dashboard
      </button>
    </div>
  );

  const tasksByStatus = COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status);
    return acc;
  }, {});
  const isOwner = project?.owner_id === user?.id;
  const visibleRequests = taskRequests.filter((request) => isOwner ? request.status === "PENDING" : true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Project Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-400 mb-1">
              <Link to="/" className="hover:text-blue-600">
                Dashboard
              </Link>{" "}
              / {project?.name}
            </div>
            <h1 className="text-xl font-bold text-gray-800">{project?.name}</h1>
            {project?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              👥 {project?.members?.length} member
              {project?.members?.length !== 1 ? "s" : ""}
            </div>
            <Link
              to={`/projects/${projectId}/analytics`}
              className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50"
            >
              📊 Analytics
            </Link>
            {isOwner && <button
              onClick={() => openTaskModal()}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Add Task
            </button>}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map((status) => (
            <div key={status} className="bg-white rounded-xl border shadow-sm">
              <div className="px-4 py-3 border-b flex justify-between items-center">
                <h2 className="font-semibold text-gray-700">
                  {COLUMN_LABELS[status]}
                </h2>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {tasksByStatus[status].length}
                </span>
              </div>
              <div className="p-3 space-y-3 min-h-32">
                {tasksByStatus[status].length === 0 ? (
                  <p className="text-center text-gray-300 text-sm py-6">
                    No tasks
                  </p>
                ) : (
                  tasksByStatus[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      members={project?.members}
                      isOwner={isOwner}
                      hasPendingRequest={taskRequests.some((request) => request.task_id === task.id && request.requester_id === user?.id && request.status === "PENDING")}
                      onEdit={openTaskModal}
                      onRequest={setRequestingTask}
                      onDelete={handleDeleteTask}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {visibleRequests.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <section className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold text-gray-700 mb-3">{isOwner ? "Pending employee requests" : "My task requests"}</h3>
            <div className="space-y-3">
              {visibleRequests.map((request) => (
                <article key={request.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-gray-800">{request.task_title} · {request.request_type === "STATUS" ? "Status approval" : "Deadline extension"}</p>
                    <p className="text-gray-600 mt-1">
                      {request.request_type === "STATUS" ? `Requested status: ${request.requested_status?.replace("_", " ")}` : `Requested deadline: ${request.requested_deadline ? new Date(request.requested_deadline).toLocaleString() : "—"}`}
                    </p>
                    <p className="text-gray-500 mt-1">{isOwner ? request.requester.username : "You"}{request.message ? ` · ${request.message}` : ""}</p>
                    {!isOwner && request.status !== "PENDING" && <p className="text-gray-500 mt-1">{request.status}{request.decision_note ? ` · ${request.decision_note}` : ""}</p>}
                  </div>
                  {isOwner && <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleRequestDecision(request, true)} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">Approve</button>
                    <button onClick={() => handleRequestDecision(request, false)} className="text-sm bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">Reject</button>
                  </div>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Team Members */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Team Members</h3>
          <div className="flex flex-wrap gap-2">
            {project?.members?.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {m.user.username[0].toUpperCase()}
                </div>
                <span className="text-sm text-gray-700">{m.user.username}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {showModal && (
        <TaskModal
          task={editingTask}
          members={assignableUsers}
          membersError={assignableUsersError}
          membersLoading={assignableUsersLoading}
          onSave={handleSaveTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}
      {requestingTask && (
        <TaskRequestModal
          task={requestingTask}
          onSubmit={handleRequestTaskChange}
          onClose={() => setRequestingTask(null)}
        />
      )}
    </div>
  );
}
