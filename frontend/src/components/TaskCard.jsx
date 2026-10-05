import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = {
  TODO: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  DONE: "bg-green-100 text-green-800",
};

const PRIORITY_COLORS = {
  LOW: "text-green-600",
  MEDIUM: "text-yellow-600",
  HIGH: "text-red-600",
};

export default function TaskCard({ task, onEdit, onDelete, onRequest, members, isOwner, hasPendingRequest }) {
  const { user } = useAuth();
  const isAssignedToMe = task.assigned_to === user?.id;
  const assignee = members?.find((m) => m.user?.id === task.assigned_to)?.user;

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800 truncate flex-1">
          {task.title}
        </h3>
        <span className={`text-xs font-bold ml-2 ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
          {task.status.replace("_", " ")}
        </span>

        {assignee && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            👤 {assignee.username}
          </span>
        )}

        {task.deadline && (
          <span className="text-xs text-gray-400">
            📅 {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>

      {(isOwner || isAssignedToMe) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
          {isOwner ? (
            <button
              onClick={() => onEdit(task)}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Edit task
            </button>
          ) : (
            hasPendingRequest ? (
              <span className="text-xs text-amber-700 font-medium">Change request pending approval</span>
            ) : (
              <button
                onClick={() => onRequest(task)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Request status or deadline change
              </button>
            )
          )}
          {isOwner && (
            <button
              onClick={() => onDelete(task.id)}
              className="text-xs text-red-500 hover:underline font-medium"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
