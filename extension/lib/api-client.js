const API_BASE_URL = 'http://localhost:8000';

class MeetGraphAPI {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getAuthToken() {
    const result = await chrome.storage.local.get(['authToken']);
    return result.authToken || '';
  }

  async request(endpoint, options = {}) {
    const token = await this.getAuthToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async createMeeting(data) {
    return this.request('/api/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMeeting(id, data) {
    return this.request(`/api/meetings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getMeeting(id) {
    return this.request(`/api/meetings/${id}`);
  }

  async listMeetings(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/meetings?${queryString}`);
  }

  async sendTranscriptChunk(meetingId, data) {
    return this.request(`/api/meetings/${meetingId}/transcript`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getExtractions(meetingId) {
    return this.request(`/api/meetings/${meetingId}/extractions`);
  }

  async getActionItems(meetingId) {
    return this.request(`/api/meetings/${meetingId}/action-items`);
  }

  async searchKnowledge(query, limit = 5) {
    return this.request('/api/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  async getDecisionArchaeology(decisionId) {
    return this.request(`/api/knowledge/decisions/${decisionId}/archaeology`);
  }

  async getDecisions() {
    return this.request('/api/knowledge/decisions');
  }

  async getGraph(limit = 100) {
    return this.request(`/api/knowledge/graph?limit=${limit}`);
  }
}

const api = new MeetGraphAPI();

function sendToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

const backgroundAPI = {
  startMeeting: (payload) => sendToBackground({ type: 'MEETING_START', payload }),
  endMeeting: () => sendToBackground({ type: 'MEETING_END' }),
  sendTranscriptChunk: (payload) => sendToBackground({ type: 'TRANSCRIPT_CHUNK', payload }),
  getMeetingState: () => sendToBackground({ type: 'GET_MEETING_STATE' }),
  getExtractions: () => sendToBackground({ type: 'GET_EXTRACTIONS' }),
  searchContext: (query) => sendToBackground({ type: 'SEARCH_CONTEXT', payload: { query } }),
  sidebarReady: () => sendToBackground({ type: 'SIDEBAR_READY' }),
};
