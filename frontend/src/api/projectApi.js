import api from "./axios";

export const getMyProjects = () => api.get("/projects");
export const getAllProjects = () => api.get("/projects/all");
export const getProject = (id) => api.get(`/projects/${id}`);
export const createProject = (data) => api.post("/projects", data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const getAssignableUsers = (projectId) => api.get(`/projects/${projectId}/assignable-users`);
