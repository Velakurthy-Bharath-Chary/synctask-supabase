import api from "./axios";

export const getTasks = (projectId) => api.get(`/projects/${projectId}/tasks`);
export const createTask = (projectId, data) =>
  api.post("/tasks", { ...data, project_id: projectId });
export const updateTask = (taskId, data) => api.put(`/tasks/${taskId}`, data);
export const deleteTask = (taskId) => api.delete(`/tasks/${taskId}`);
export const getTaskLogs = (taskId) => api.get(`/tasks/${taskId}/logs`);
export const getAnalytics = (projectId) => api.get(`/analytics/projects/${projectId}`);
export const createTaskRequest = (taskId, data) => api.post(`/tasks/${taskId}/requests`, data);
export const getTaskRequests = (projectId) => api.get(`/projects/${projectId}/task-requests`);
export const decideTaskRequest = (requestId, data) => api.put(`/task-requests/${requestId}`, data);
