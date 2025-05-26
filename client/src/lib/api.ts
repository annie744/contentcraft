import { apiRequest } from './queryClient';

// Auth endpoints
export const getGoogleAuthUrl = async () => {
  const res = await apiRequest('GET', '/api/auth/google');
  return res.json();
};

export const getLinkedInAuthUrl = async () => {
  const res = await apiRequest('GET', '/api/auth/linkedin');
  return res.json();
};

export const getFacebookAuthUrl = async () => {
  const res = await apiRequest('GET', '/api/auth/facebook');
  return res.json();
};

export const logout = async () => {
  const res = await apiRequest('GET', '/api/auth/logout');
  return res.json();
};

// User endpoints
export const fetchUser = async () => {
  const res = await apiRequest('GET', '/api/user');
  return res.json();
};

// Google accounts
export const fetchGoogleAccounts = async () => {
  const res = await apiRequest('GET', '/api/google-accounts');
  return res.json();
};

export const disconnectGoogleAccount = async (id: number) => {
  const res = await apiRequest('DELETE', `/api/google-accounts/${id}`);
  return res.json();
};

// Calendar events
export const fetchCalendarEvents = async () => {
  const res = await apiRequest('GET', '/api/calendar-events');
  return res.json();
};

export const syncCalendarEvents = async () => {
  const res = await apiRequest('POST', '/api/calendar-events/sync');
  return res.json();
};

export const toggleEventRecording = async (id: number, isRecordingEnabled: boolean) => {
  const res = await apiRequest('PATCH', `/api/calendar-events/${id}/toggle-recording`, {
    isRecordingEnabled
  });
  return res.json();
};

// Meetings
export const fetchMeetings = async () => {
  const res = await apiRequest('GET', '/api/meetings');
  return res.json();
};

export const fetchMeeting = async (id: number) => {
  const res = await apiRequest('GET', `/api/meetings/${id}`);
  return res.json();
};

// Meeting contents
export const fetchMeetingContents = async (meetingId: number) => {
  const res = await apiRequest('GET', `/api/meetings/${meetingId}/contents`);
  return res.json();
};

export const generateFollowUpEmail = async (meetingId: number) => {
  const res = await apiRequest('POST', `/api/meetings/${meetingId}/generate-email`);
  return res.json();
};

export const generateSocialPost = async (meetingId: number, platform: string, automationId?: number) => {
  const res = await apiRequest('POST', `/api/meetings/${meetingId}/generate-social-post`, {
    platform,
    automationId
  });
  return res.json();
};

export const publishSocialPost = async (postId: number) => {
  const res = await apiRequest('POST', `/api/social-posts/${postId}/publish`);
  return res.json();
};

// Automations
export const fetchAutomations = async () => {
  const res = await apiRequest('GET', '/api/automations');
  return res.json();
};

export const createAutomation = async (data: {
  name: string;
  platform: string;
  prompt: string;
  isActive: boolean;
}) => {
  const res = await apiRequest('POST', '/api/automations', data);
  return res.json();
};

export const updateAutomation = async (id: number, data: {
  name?: string;
  prompt?: string;
  isActive?: boolean;
}) => {
  const res = await apiRequest('PATCH', `/api/automations/${id}`, data);
  return res.json();
};

export const deleteAutomation = async (id: number) => {
  const res = await apiRequest('DELETE', `/api/automations/${id}`);
  return res.json();
};

// Settings
export const fetchSettings = async () => {
  const res = await apiRequest('GET', '/api/settings');
  return res.json();
};

export const updateSettings = async (data: {
  botJoinMinutesBefore?: number;
  autoJoinNewEvents?: boolean;
}) => {
  const res = await apiRequest('PATCH', '/api/settings', data);
  return res.json();
};

// Social accounts
export const fetchSocialAccounts = async () => {
  const res = await apiRequest('GET', '/api/social-accounts');
  return res.json();
};

export const disconnectSocialAccount = async (id: number) => {
  const res = await apiRequest('DELETE', `/api/social-accounts/${id}`);
  return res.json();
};
