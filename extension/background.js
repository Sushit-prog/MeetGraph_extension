const API_BASE_URL = 'http://localhost:8000';

let currentMeetingId = null;
let transcriptBuffer = [];
let meetingStartTime = null;
let currentPlatform = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'MEETING_START':
      handleMeetingStart(message.payload);
      break;
    case 'MEETING_END':
      handleMeetingEnd();
      break;
    case 'TRANSCRIPT_CHUNK':
      handleTranscriptChunk(message.payload, sender.tab);
      break;
    case 'GET_MEETING_STATE':
      sendResponse(getMeetingState());
      break;
    case 'GET_EXTRACTIONS':
      fetchExtractions(sendResponse);
      return true;
    case 'SEARCH_CONTEXT':
      searchContext(message.payload.query, sendResponse);
      return true;
    case 'SIDEBAR_READY':
      if (currentMeetingId) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'UPDATE_SIDEBAR',
          payload: getMeetingState()
        });
      }
      break;
  }
});

async function handleMeetingStart(payload) {
  const { platform, meetingTitle, participants } = payload;
  
  currentPlatform = platform;
  meetingStartTime = new Date().toISOString();
  transcriptBuffer = [];
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: meetingTitle || `${platform} Meeting - ${meetingStartTime}`,
        platform: platform,
        started_at: meetingStartTime,
        participants: participants || []
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      currentMeetingId = data.id;
      console.log('[MeetGraph] Meeting started with ID:', currentMeetingId);
    } else {
      console.error('[MeetGraph] Failed to create meeting:', response.status);
    }
  } catch (error) {
    console.error('[MeetGraph] Error starting meeting:', error);
  }
}

async function handleMeetingEnd() {
  if (transcriptBuffer.length > 0 && currentMeetingId) {
    const fullTranscript = transcriptBuffer.join('\n');
    
    try {
      await fetch(`${API_BASE_URL}/api/meetings/${currentMeetingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: fullTranscript,
          ended_at: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('[MeetGraph] Error saving transcript:', error);
    }
  }
  
  currentMeetingId = null;
  transcriptBuffer = [];
  meetingStartTime = null;
  currentPlatform = null;
}

async function handleTranscriptChunk(payload, tab) {
  const { text, timestamp, speaker } = payload;
  
  console.log('[MeetGraph BG] Handling transcript chunk, tab.id:', tab?.id, 'meetingId:', currentMeetingId);
  
  transcriptBuffer.push(text);
  
  if (currentMeetingId && tab?.id) {
    try {
      await fetch(`${API_BASE_URL}/api/meetings/${currentMeetingId}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          timestamp: timestamp,
          speaker: speaker
        })
      });
      
      console.log('[MeetGraph BG] Transcript sent, fetching extractions...');
      
      const response = await fetch(`${API_BASE_URL}/api/meetings/${currentMeetingId}/extractions`);
      if (response.ok) {
        const extractions = await response.json();
        console.log('[MeetGraph BG] Got extractions, sending to tab:', tab.id);
        chrome.tabs.sendMessage(tab.id, {
          type: 'UPDATE_SIDEBAR',
          payload: {
            isActive: true,
            extractions: extractions
          }
        }, (result) => {
          if (chrome.runtime.lastError) {
            console.log('[MeetGraph BG] Error sending to tab:', chrome.runtime.lastError.message);
          } else {
            console.log('[MeetGraph BG] Message sent successfully');
          }
        });
      } else {
        console.log('[MeetGraph BG] Extraction failed with status:', response.status);
      }
    } catch (error) {
      console.error('[MeetGraph BG] Error:', error);
    }
  } else {
    console.log('[MeetGraph BG] No meeting ID or tab ID');
  }
}

async function fetchExtractions(sendResponse) {
  if (!currentMeetingId) {
    sendResponse({ decisions: [], actionItems: [], blockers: [] });
    return;
  }
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/meetings/${currentMeetingId}/extractions`,
      {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      }
    );
    
    if (response.ok) {
      const extractions = await response.json();
      sendResponse(extractions);
    } else {
      sendResponse({ decisions: [], actionItems: [], blockers: [] });
    }
  } catch (error) {
    console.error('[MeetGraph] Error fetching extractions:', error);
    sendResponse({ decisions: [], actionItems: [], blockers: [] });
  }
}

async function searchContext(query, sendResponse) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/knowledge/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      body: JSON.stringify({ query, limit: 5 })
    });
    
    if (response.ok) {
      const results = await response.json();
      sendResponse(results);
    } else {
      sendResponse([]);
    }
  } catch (error) {
    console.error('[MeetGraph] Error searching context:', error);
    sendResponse([]);
  }
}

function getMeetingState() {
  return {
    isActive: currentMeetingId !== null,
    meetingId: currentMeetingId,
    platform: currentPlatform,
    startTime: meetingStartTime,
    transcriptLength: transcriptBuffer.length
  };
}

async function getAuthToken() {
  const result = await chrome.storage.local.get(['authToken']);
  return result.authToken || '';
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.authToken) {
    console.log('[MeetGraph] Auth token updated');
  }
});
