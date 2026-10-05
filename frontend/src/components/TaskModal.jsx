import { useState, useEffect } from "react";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

export default function TaskModal({ task, members, membersError, membersLoading, onSave, onClose }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    deadline: "",
    assigned_to: "",
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "TODO",
        priority: task.priority || "MEDIUM",
        deadline: task.deadline ? task.deadline.substring(0, 16) : "",
        assigned_to: task.assigned_to || "",
      });
    }
  }, [task]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      assigned_to: form.assigned_to || null,
    };
    onSave(payload);
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {task?.id ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              required
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className={inputCls}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                className={inputCls}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned To
            </label>
            <select
              className={inputCls}
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            >
              <option value="">Unassigned</option>
              {membersLoading && <option disabled value="">Loading employees…</option>}
              {!membersLoading && !membersError && !members?.length && <option disabled value="">No employees available</option>}
              {members?.filter((member) => !member.has_active_task).map((member) => (
                <option key={member.id} value={member.id}>{member.username}</option>
              ))}
              {members?.filter((member) => member.has_active_task).map((member) => (
                <option key={member.id} value={member.id} disabled>
                  {member.username}
                </option>
              ))}
            </select>
            {membersError && <p className="text-xs text-red-600 mt-1">{membersError}</p>}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deadline
            </label>
            <input
              type="datetime-local"
              className={inputCls}
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              {task?.id ? "Save Changes" : "Create Task"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
/*

**What this does:**
```
A popup form for creating or editing tasks:
- If task has an id → Edit mode (prefills form)
- If no id → Create mode (empty form)

Fields:
- Title (required)
- Description
- Status dropdown
- Priority dropdown
- Assign to member dropdown
- Deadline picker
*/
