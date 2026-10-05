import { useState } from "react";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

export default function TaskRequestModal({ task, onSubmit, onClose }) {
  const [type, setType] = useState("STATUS");
  const [requestedStatus, setRequestedStatus] = useState(task.status);
  const [requestedDeadline, setRequestedDeadline] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      request_type: type,
      requested_status: type === "STATUS" ? requestedStatus : null,
      requested_deadline: type === "DEADLINE" ? new Date(requestedDeadline).toISOString() : null,
      message: message.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Request a task change</h2>
            <p className="text-sm text-gray-500 mt-1">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request</label>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="STATUS">Submit status for approval</option>
              <option value="DEADLINE">Request deadline extension</option>
            </select>
          </div>
          {type === "STATUS" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status to submit</label>
              <select className={inputCls} value={requestedStatus} onChange={(e) => setRequestedStatus(e.target.value)}>
                {STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requested new deadline</label>
              <input required type="datetime-local" className={inputCls} value={requestedDeadline} onChange={(e) => setRequestedDeadline(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Current deadline: {task.deadline ? new Date(task.deadline).toLocaleString() : "Not set"}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea className={inputCls} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Send request</button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
