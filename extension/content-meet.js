(function() {
  'use strict';

  const PLATFORM = 'google-meet';
  const CHUNK_INTERVAL = 30000;
  const SIDEBAR_HTML = `
    <div id="meetgraph-sidebar" class="meetgraph-sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">MG</span>
          <span class="logo-text">MeetGraph</span>
        </div>
        <button id="toggle-sidebar" class="toggle-btn" title="Collapse sidebar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
        </button>
      </div>
      <div class="sidebar-content">
        <div id="meeting-status" class="status-section">
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Not in meeting</span>
          </div>
          <div id="meeting-info" style="font-size: 11px; color: #6b7280; margin-top: 4px;"></div>
          <button id="refresh-extractions" style="margin-top: 8px; padding: 6px 12px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Refresh</button>
          <button id="send-chunk" style="margin-top: 4px; padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Send Chunk</button>
        </div>
        <div class="tabs">
          <button class="tab-btn active" data-tab="decisions">Decisions</button>
          <button class="tab-btn" data-tab="actions">Actions</button>
          <button class="tab-btn" data-tab="context">Context</button>
        </div>
        <div id="decisions-panel" class="tab-panel active">
          <div class="panel-header">
            <h3>Decisions Made</h3>
            <span id="decisions-count" class="count-badge">0</span>
          </div>
          <div id="decisions-list" class="items-list">
            <div class="empty-state"><p>No decisions recorded yet</p></div>
          </div>
        </div>
        <div id="actions-panel" class="tab-panel">
          <div class="panel-header">
            <h3>Action Items</h3>
            <span id="actions-count" class="count-badge">0</span>
          </div>
          <div id="actions-list" class="items-list">
            <div class="empty-state"><p>No action items yet</p></div>
          </div>
        </div>
        <div id="context-panel" class="tab-panel">
          <div class="panel-header">
            <h3>Related Context</h3>
          </div>
          <div class="search-box">
            <input type="text" id="context-search" placeholder="Search past meetings...">
            <button id="search-btn" class="search-btn">&#128269;</button>
          </div>
          <div id="context-list" class="items-list">
            <div class="empty-state"><p>Search for related discussions</p></div>
          </div>
        </div>
      </div>
      <div class="sidebar-footer">
        <button id="archaeology-btn" class="footer-btn">
          <span>Decision Archaeology</span>
        </button>
      </div>
    </div>
  `;

  const SIDEBAR_CSS = `
    .meetgraph-sidebar { position: fixed; top: 0; right: 0; width: 320px; height: 100vh; background: #fff; border-left: 1px solid #e5e7eb; box-shadow: -4px 0 10px rgba(0,0,0,0.1); z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-icon { width: 28px; height: 28px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; }
    .logo-text { font-weight: 600; font-size: 16px; }
    .toggle-btn { width: 28px; height: 28px; border: none; background: transparent; cursor: pointer; border-radius: 4px; }
    .sidebar-content { flex: 1; overflow-y: auto; padding: 16px; }
    .status-section { margin-bottom: 16px; }
    .status-indicator { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f9fafb; border-radius: 6px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; }
    .status-dot.active { background: #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .status-text { font-size: 13px; color: #6b7280; }
    .tabs { display: flex; gap: 4px; margin-bottom: 16px; background: #f9fafb; padding: 4px; border-radius: 8px; }
    .tab-btn { flex: 1; padding: 8px; border: none; background: transparent; cursor: pointer; border-radius: 6px; font-size: 12px; font-weight: 500; color: #6b7280; }
    .tab-btn.active { background: #fff; color: #6366f1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .panel-header h3 { font-size: 14px; font-weight: 600; }
    .count-badge { background: #6366f1; color: #fff; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
    .items-list { display: flex; flex-direction: column; gap: 8px; }
    .item-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .item-title { font-weight: 500; font-size: 13px; margin-bottom: 4px; }
    .item-description { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    .item-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #9ca3af; }
    .item-badge { display: inline-flex; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .item-badge.high { background: #fef2f2; color: #ef4444; }
    .item-badge.medium { background: #fffbeb; color: #f59e0b; }
    .item-badge.low { background: #f0fdf4; color: #10b981; }
    .item-badge.pending { background: #eff6ff; color: #6366f1; }
    .item-badge.completed { background: #f0fdf4; color: #10b981; }
    .empty-state { text-align: center; padding: 24px; color: #9ca3af; font-size: 13px; }
    .search-box { display: flex; gap: 8px; margin-bottom: 12px; }
    .search-box input { flex: 1; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; }
    .search-box input:focus { border-color: #6366f1; outline: none; }
    .search-btn { width: 36px; height: 36px; border: none; background: #6366f1; color: #fff; border-radius: 6px; cursor: pointer; }
    .sidebar-footer { padding: 12px 16px; border-top: 1px solid #e5e7eb; background: #f9fafb; }
    .footer-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    .footer-btn:hover { border-color: #6366f1; color: #6366f1; }
  `;

  let transcriptObserver = null;
  let bodyObserver = null;
  let meetingTitle = '';
  let participants = [];
  let chunkIntervalId = null;
  let transcriptBuffer = [];
  let captionsEnabled = false;
  let seenMessages = new Set();
  let lastCapturedText = '';
  let currentMeetingId = null;
  const API_BASE_URL = 'http://localhost:8000';

  function init() {
    console.log('[MeetGraph] Content script loaded for Google Meet');
    injectSidebar();
    setupMessageListener();
    detectMeeting();
    setupMeetingDetection();
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[MeetGraph] Received message:', message.type);
      if (message.type === 'UPDATE_SIDEBAR' && message.payload) {
        console.log('[MeetGraph] Updating sidebar with:', message.payload);
        updateSidebarWithExtractions(message.payload);
      }
    });
  }

  function updateSidebarWithExtractions(payload) {
    console.log('[MeetGraph] updateSidebarWithExtractions called with:', JSON.stringify(payload));
    
    if (!payload) {
      console.log('[MeetGraph] No payload, returning');
      return;
    }
    
    if (payload.meetingId) {
      currentMeetingId = payload.meetingId;
    }
    
    const container = document.getElementById('meetgraph-sidebar');
    console.log('[MeetGraph] Sidebar container exists:', !!container);
    
    if (!container) {
      console.log('[MeetGraph] Sidebar not found, injecting...');
      injectSidebar();
    }
    
    updateSidebarStatus(payload.isActive, currentMeetingId);
    
    if (payload.extractions) {
      const { decisions = [], actionItems = [] } = payload.extractions;
      console.log('[MeetGraph] Rendering', decisions.length, 'decisions and', actionItems.length, 'actions');
      renderDecisions(decisions);
      renderActionItems(actionItems);
    } else {
      console.log('[MeetGraph] No extractions in payload');
    }
  }

  function renderDecisions(decisions) {
    const container = document.getElementById('decisions-list');
    const countBadge = document.getElementById('decisions-count');
    
    console.log('[MeetGraph] renderDecisions container:', !!container, 'decisions:', decisions.length);
    
    if (!container) {
      console.log('[MeetGraph] decisions-list container not found!');
      return;
    }
    
    if (countBadge) {
      countBadge.textContent = decisions.length;
    }
    
    if (decisions.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No decisions recorded yet</p></div>';
      return;
    }
    
    container.innerHTML = decisions.map(decision => `
      <div class="item-card">
        <div class="item-title">${escapeHtml(decision.title || 'Untitled Decision')}</div>
        <div class="item-description">${escapeHtml(decision.description || '')}</div>
        <div class="item-meta">
          <span class="item-badge ${getConfidenceLevel(decision.confidence)}">
            ${Math.round((decision.confidence || 0) * 100)}% confidence
          </span>
        </div>
      </div>
    `).join('');
  }

  function renderActionItems(items) {
    const container = document.getElementById('actions-list');
    const countBadge = document.getElementById('actions-count');
    
    if (!container) return;
    
    if (countBadge) {
      countBadge.textContent = items.length;
    }
    
    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No action items yet</p></div>';
      return;
    }
    
    container.innerHTML = items.map(item => `
      <div class="item-card">
        <div class="item-title">${escapeHtml(item.task || 'Untitled Task')}</div>
        <div class="item-meta">
          ${item.owner ? `<span>Owner: ${escapeHtml(item.owner)}</span>` : ''}
          <span class="item-badge ${item.status || 'pending'}">${item.status || 'pending'}</span>
        </div>
      </div>
    `).join('');
  }

  function getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  function injectSidebar() {
    console.log('[MeetGraph] Attempting to inject sidebar...');
    
    if (document.getElementById('meetgraph-sidebar')) {
      console.log('[MeetGraph] Sidebar already exists');
      return;
    }

    const style = document.createElement('style');
    style.id = 'meetgraph-sidebar-styles';
    style.textContent = SIDEBAR_CSS;
    document.head.appendChild(style);

    const sidebarContainer = document.createElement('div');
    sidebarContainer.id = 'meetgraph-root';
    sidebarContainer.innerHTML = SIDEBAR_HTML;
    document.body.appendChild(sidebarContainer);

    console.log('[MeetGraph] Sidebar injected successfully');
    setupSidebarEventListeners();
  }

  function setupSidebarEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `${tabName}-panel`));
      });
    });

    document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('meetgraph-sidebar')?.classList.toggle('collapsed');
    });

    document.getElementById('search-btn')?.addEventListener('click', performContextSearch);
    document.getElementById('context-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performContextSearch();
    });

    document.getElementById('refresh-extractions')?.addEventListener('click', async () => {
      console.log('[MeetGraph] Manual refresh clicked, meeting ID:', currentMeetingId);
      if (currentMeetingId) {
        await fetchAndRenderExtractions(currentMeetingId);
      } else {
        console.log('[MeetGraph] No meeting ID to refresh');
      }
    });

    document.getElementById('send-chunk')?.addEventListener('click', () => {
      console.log('[MeetGraph] Manual send chunk clicked');
      sendChunkNow();
    });
  }

  async function fetchAndRenderExtractions(meetingId) {
    console.log('[MeetGraph] Fetching extractions for meeting:', meetingId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/extractions`);
      if (response.ok) {
        const extractions = await response.json();
        console.log('[MeetGraph] Got extractions:', extractions);
        renderDecisions(extractions.decisions || []);
        renderActionItems(extractions.actionItems || []);
      } else {
        console.log('[MeetGraph] Failed to fetch, status:', response.status);
      }
    } catch (error) {
      console.error('[MeetGraph] Error fetching:', error);
    }
  }

  async function performContextSearch() {
    const input = document.getElementById('context-search');
    const query = input?.value.trim();
    if (!query) return;

    const container = document.getElementById('context-list');
    if (container) {
      container.innerHTML = '<div class="empty-state"><p>Searching...</p></div>';
    }

    chrome.runtime.sendMessage({ type: 'SEARCH_CONTEXT', payload: { query } }, (response) => {
      renderContextResults(response || []);
    });
  }

  function renderContextResults(results) {
    const container = document.getElementById('context-list');
    if (!container) return;

    if (!results || results.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No related context found</p></div>';
      return;
    }

    container.innerHTML = results.map(result => `
      <div class="item-card">
        <div class="item-title">${escapeHtml(result.title || result.topic || 'Related Discussion')}</div>
        <div class="item-description">${escapeHtml(result.description || result.excerpt || '')}</div>
        <div class="item-meta">
          <span>${result.date || ''}</span>
          ${result.similarity ? `<span>${Math.round(result.similarity * 100)}% match</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setupMeetingDetection() {
    const urlObserver = new URLObserver(() => {
      if (isMeetingPage()) {
        detectMeeting();
      }
    });
    urlObserver.start();
  }

  function isMeetingPage() {
    return window.location.href.includes('meet.google.com') && 
           !window.location.href.includes('calendar');
  }

  async function detectMeeting() {
    await waitForElement('[data-meeting-title], .iTTzVb, [aria-label*="meeting"]', 5000);

    setTimeout(() => {
      meetingTitle = getMeetingTitle();
      participants = getParticipants();
      
      console.log('[MeetGraph] Meeting detected:', meetingTitle);
      console.log('[MeetGraph] Participants:', participants);

      startCapture();
    }, 2000);
  }

  function getMeetingTitle() {
    const selectors = ['[data-meeting-title]', '.iTTzVb', '[aria-label*="meeting name"]', '.zWguib'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim() || element.getAttribute('data-meeting-title');
      }
    }
    return `Google Meet - ${new Date().toLocaleString()}`;
  }

  function getParticipants() {
    const names = [];
    const selectors = ['[data-name]', '.zWguib [name]', '[aria-label*="participant"]'];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const name = el.getAttribute('data-name') || el.textContent.trim();
        if (name && !names.includes(name) && name.length > 2 && name.length < 50) {
          names.push(name);
        }
      });
    }
    return names;
  }

  function startCapture() {
    console.log('[MeetGraph] Starting transcript capture');
    
    startMeeting();
    enableCaptions();
    findAndObserveTranscript();
    startChunkInterval();
  }

  function updateSidebarStatus(isActive, meetingId) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const meetingInfo = document.getElementById('meeting-info');
    
    if (statusDot) statusDot.classList.toggle('active', isActive);
    if (statusText) {
      statusText.textContent = isActive ? `Meeting Active - ${PLATFORM}` : 'Not in meeting';
    }
    if (meetingInfo && meetingId) {
      meetingInfo.textContent = `Meeting ID: ${meetingId}`;
    }
  }

  async function startMeeting() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle || `${PLATFORM} Meeting - ${new Date().toISOString()}`,
          platform: PLATFORM,
          started_at: new Date().toISOString(),
          participants: participants || []
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        currentMeetingId = data.id;
        console.log('[MeetGraph] Meeting created with ID:', currentMeetingId);
        updateSidebarStatus(true, currentMeetingId);
      }
    } catch (error) {
      console.error('[MeetGraph] Error starting meeting:', error);
    }
  }

  function enableCaptions() {
    const captionButtonSelectors = [
      '[aria-label*="Turn on captions"]',
      '[aria-label*="Turn on live captions"]',
      '[aria-label*="Enable captions"]',
      '[jsname=" captions-button"]',
      '[class*="captions"]'
    ];

    for (const selector of captionButtonSelectors) {
      const button = document.querySelector(selector);
      if (button) {
        console.log('[MeetGraph] Found captions button:', selector);
        button.click();
        captionsEnabled = true;
        break;
      }
    }

    if (!captionsEnabled) {
      console.log('[MeetGraph] Caption button not found, will capture via observer');
    }
  }

  function findAndObserveTranscript() {
    const selectors = [
      'div.ygicle.VbkSUe',
      'div.ygicle',
      'div.VbkSUe'
    ];
    
    let transcriptElement = null;
    let foundSelector = null;
    
    for (const selector of selectors) {
      transcriptElement = document.querySelector(selector);
      if (transcriptElement) {
        foundSelector = selector;
        break;
      }
    }
    
    if (transcriptElement) {
      console.log('[MeetGraph] Found caption element:', foundSelector, 'class:', transcriptElement.className);
      observeTranscript(transcriptElement);
    } else {
      console.log('[MeetGraph] No caption element found, trying fallback');
      observeBodyFallback();
    }
  }

  function observeTranscript(element) {
    console.log('[MeetGraph] Setting up MutationObserver on:', element.className);
    
    transcriptObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent?.trim();
              if (text && text.length > 10 && !isSystemMessage(text) && looksLikeSpeech(text)) {
                console.log('[MeetGraph] Captured speech from childList:', text.substring(0, 80));
                processTranscriptEntry(text);
              }
            }
          });
        }
        
        if (mutation.type === 'characterData') {
          const text = mutation.target.textContent?.trim();
          if (text && text.length > 10 && !isSystemMessage(text) && looksLikeSpeech(text)) {
            console.log('[MeetGraph] Captured speech from characterData:', text.substring(0, 80));
            processTranscriptEntry(text);
          }
        }
      });
      
      const currentText = element.textContent?.trim();
      if (currentText && currentText !== lastCapturedText && currentText.length > 10 && !isSystemMessage(currentText) && looksLikeSpeech(currentText)) {
        console.log('[MeetGraph] Captured speech from textContent:', currentText.substring(0, 80));
        processTranscriptEntry(currentText);
        lastCapturedText = currentText;
      }
    });

    transcriptObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });

    setTimeout(() => {
      const existingText = element.textContent?.trim();
      if (existingText && existingText.length > 10 && !isSystemMessage(existingText) && looksLikeSpeech(existingText)) {
        console.log('[MeetGraph] Initial transcript text:', existingText.substring(0, 80));
        processTranscriptEntry(existingText);
        lastCapturedText = existingText;
      }
    }, 1000);
  }

  function isSystemMessage(text) {
    const lower = text.toLowerCase();
    
    const uiPatterns = [
      'videocam',
      'videocam_off',
      'front_hand',
      'raising your hand',
      'low hand',
      'frame_person',
      'visual_effects',
      'more_vert',
      'blur',
      'background',
      '浸浸',
      'mic',
      'mute',
      'unmute',
      'camera',
      'screen share',
      'stopped sharing',
      'joined',
      'left',
      'has joined',
      'has left',
      'waiting for',
      'to join',
      'admitted',
      'removed',
      'presenting',
      'click',
      'settings',
      'people',
      'chat',
      'captions',
      'turn on',
      'host',
      'poll',
      'breakout'
    ];
    
    for (const pattern of uiPatterns) {
      if (lower.includes(pattern)) {
        return true;
      }
    }
    
    if (lower.includes('_') || lower.includes('icon') || lower.includes('button')) {
      return true;
    }
    
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 3) {
      return true;
    }
    
    return false;
  }

  function looksLikeSpeech(text) {
    const wordCount = text.split(/\s+/).length;
    const lower = text.toLowerCase();
    
    if (wordCount < 5) return false;
    
    const nonSpeechPatterns = [
      /^[a-z_]+$/,
      /^\d+$/,
      /^[\u4e00-\u9fff]+$/,
      /^\s*[\u4e00-\u9fff}\s*$/
    ];
    
    for (const pattern of nonSpeechPatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }
    
    const speechIndicators = [
      'the ', 'is ', 'are ', 'was ', 'were ', 'have ', 'has ', 'will ',
      'can ', 'should ', 'would ', 'could ', 'need ', 'to ', 'and ', 'but ',
      'we ', 'i ', 'you ', 'they ', 'it ', 'this ', 'that ', 'for ',
      'so ', 'because ', 'if ', 'when ', 'what ', 'how ', 'why '
    ];
    
    for (const indicator of speechIndicators) {
      if (lower.includes(indicator)) {
        return true;
      }
    }
    
    return wordCount >= 8;
  }

  function observeBodyFallback() {
    if (bodyObserver) {
      bodyObserver.disconnect();
    }

    console.log('[MeetGraph] Using body observer fallback');

    const selectors = [
      'div.ygicle.VbkSUe',
      'div.ygicle',
      'div.VbkSUe'
    ];

    bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent?.trim();
              if (text && text.length > 10 && text.length < 500 && !isSystemMessage(text) && looksLikeSpeech(text)) {
                processTranscriptEntry(text);
              }
            }
          });
        }
      });

      for (const selector of selectors) {
        const transcriptElement = document.querySelector(selector);
        if (transcriptElement && !transcriptObserver) {
          console.log('[MeetGraph] Found caption element via fallback:', selector);
          observeTranscript(transcriptElement);
          if (bodyObserver) {
            bodyObserver.disconnect();
            bodyObserver = null;
          }
          return;
        }
      }
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function processTranscriptEntry(text) {
    if (!text || text.length < 5) return;
    
    const textHash = simpleHash(text);
    if (seenMessages.has(textHash)) {
      return;
    }
    seenMessages.add(textHash);

    transcriptBuffer.push(text);
    console.log('[MeetGraph] Added to buffer, total:', transcriptBuffer.length, 'chunks, meetingId:', currentMeetingId);
    
    if (currentMeetingId && transcriptBuffer.length > 0) {
      sendChunkNow();
    }
  }

  async function sendChunkNow() {
    if (!currentMeetingId) {
      console.log('[MeetGraph] No meeting ID, cannot send chunk');
      return;
    }
    
    if (transcriptBuffer.length === 0) {
      console.log('[MeetGraph] Buffer empty, nothing to send');
      return;
    }
    
    const chunk = transcriptBuffer.join('\n');
    console.log('[MeetGraph] Sending chunk now:', chunk.length, 'chars, buffer:', transcriptBuffer.length);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings/${currentMeetingId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunk,
          timestamp: new Date().toISOString(),
          speaker: null
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[MeetGraph] Chunk sent, extractions:', result.extractions);
        
        if (result.extractions) {
          renderDecisions(result.extractions.decisions || []);
          renderActionItems(result.extractions.actionItems || []);
        }
      } else {
        console.log('[MeetGraph] Failed to send, status:', response.status);
      }
      
      transcriptBuffer = [];
    } catch (error) {
      console.error('[MeetGraph] Error sending chunk:', error);
    }
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  function startChunkInterval() {
    console.log('[MeetGraph] Starting chunk interval (30 seconds)');
    chunkIntervalId = setInterval(() => {
      console.log('[MeetGraph] Interval tick - buffer:', transcriptBuffer.length, 'meetingId:', currentMeetingId);
      if (transcriptBuffer.length > 0 && currentMeetingId) {
        sendChunkNow();
      } else if (!currentMeetingId) {
        console.log('[MeetGraph] Interval: no meeting ID yet');
      } else if (transcriptBuffer.length === 0) {
        console.log('[MeetGraph] Interval: buffer empty');
      }
    }, 30000);
  }

  function endMeeting() {
    if (transcriptObserver) {
      transcriptObserver.disconnect();
    }
    if (bodyObserver) {
      bodyObserver.disconnect();
    }
    if (chunkIntervalId) {
      clearInterval(chunkIntervalId);
    }
    updateSidebarStatus(false);
    chrome.runtime.sendMessage({ type: 'MEETING_END' });
  }

  async function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  class URLObserver {
    constructor(callback) {
      this.callback = callback;
      this.lastUrl = location.href;
    }

    start() {
      this.interval = setInterval(() => {
        if (location.href !== this.lastUrl) {
          this.lastUrl = location.href;
          this.callback();
        }
      }, 1000);
    }

    stop() {
      if (this.interval) {
        clearInterval(this.interval);
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    console.log('[MeetGraph] Tab visibility:', document.visibilityState);
  });

  window.addEventListener('beforeunload', () => {
    endMeeting();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
