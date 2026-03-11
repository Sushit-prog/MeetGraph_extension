(function() {
  'use strict';

  let currentTab = 'decisions';
  let meetingState = null;
  let extractions = {
    decisions: [],
    actionItems: [],
    blockers: []
  };

  function init() {
    console.log('[MeetGraph] Sidebar initializing');
    injectSidebar();
    setupEventListeners();
    requestMeetingState();
    setupBackgroundListener();
  }

  function injectSidebar() {
    const existingSidebar = document.getElementById('meetgraph-sidebar');
    if (existingSidebar) {
      console.log('[MeetGraph] Sidebar already exists');
      return;
    }

    const sidebarPath = chrome.runtime.getURL('overlay/sidebar.html');
    
    fetch(sidebarPath)
      .then(response => response.text())
      .then(html => {
        const container = document.createElement('div');
        container.id = 'meetgraph-root';
        container.innerHTML = html;
        document.body.appendChild(container);
        console.log('[MeetGraph] Sidebar injected');
      })
      .catch(error => {
        console.error('[MeetGraph] Error loading sidebar:', error);
      });
  }

  function setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-btn')) {
        switchTab(e.target.dataset.tab);
      }
      
      if (e.target.id === 'toggle-sidebar') {
        toggleSidebar();
      }
      
      if (e.target.id === 'archaeology-btn' || e.target.closest('#archaeology-btn')) {
        openArchaeologyModal();
      }
      
      if (e.target.id === 'close-modal' || e.target.id === 'archaeology-modal') {
        closeArchaeologyModal();
      }
      
      if (e.target.id === 'search-btn') {
        performContextSearch();
      }
      
      if (e.target.id === 'archaeology-search-btn') {
        performArchaeologySearch();
      }
    });

    document.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (e.target.id === 'context-search') {
          performContextSearch();
        }
        if (e.target.id === 'archaeology-search') {
          performArchaeologySearch();
        }
      }
    });
  }

  function setupBackgroundListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'UPDATE_SIDEBAR') {
        updateSidebar(message.payload);
      }
    });
  }

  async function requestMeetingState() {
    try {
      const state = await backgroundAPI.getMeetingState();
      updateMeetingStatus(state);
    } catch (error) {
      console.error('[MeetGraph] Error getting meeting state:', error);
    }
  }

  function updateMeetingStatus(state) {
    meetingState = state;
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (state && state.isActive) {
      if (statusDot) statusDot.classList.add('active');
      if (statusText) {
        statusText.textContent = `Meeting Active - ${state.platform || 'Unknown'}`;
      }
      loadExtractions();
    } else {
      if (statusDot) statusDot.classList.remove('active');
      if (statusText) statusText.textContent = 'Not in meeting';
    }
  }

  async function loadExtractions() {
    try {
      const data = await backgroundAPI.getExtractions();
      if (data) {
        extractions = data;
        renderDecisions(data.decisions || []);
        renderActionItems(data.actionItems || []);
      }
    } catch (error) {
      console.error('[MeetGraph] Error loading extractions:', error);
    }
  }

  function updateSidebar(payload) {
    if (payload.extractions) {
      extractions = payload.extractions;
      renderDecisions(extractions.decisions || []);
      renderActionItems(extractions.actionItems || []);
    }
    if (payload.isActive !== undefined) {
      updateMeetingStatus(payload);
    }
  }

  function switchTab(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('meetgraph-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
    }
  }

  function renderDecisions(decisions) {
    const container = document.getElementById('decisions-list');
    const countBadge = document.getElementById('decisions-count');
    
    if (!container) return;
    
    if (countBadge) {
      countBadge.textContent = decisions.length;
    }
    
    if (decisions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No decisions recorded yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = decisions.map(decision => `
      <div class="item-card">
        <div class="item-title">${escapeHtml(decision.title)}</div>
        <div class="item-description">${escapeHtml(decision.description || '')}</div>
        <div class="item-meta">
          <span class="item-badge ${getConfidenceLevel(decision.confidence)}">
            ${Math.round(decision.confidence * 100)}% confidence
          </span>
          ${decision.participants && decision.participants.length > 0 ? 
            `<span>${decision.participants.join(', ')}</span>` : ''}
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
      container.innerHTML = `
        <div class="empty-state">
          <p>No action items yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = items.map(item => `
      <div class="item-card">
        <div class="item-title">${escapeHtml(item.task)}</div>
        <div class="item-meta">
          ${item.owner ? `<span>Owner: ${escapeHtml(item.owner)}</span>` : ''}
          ${item.deadline ? `<span>Due: ${formatDate(item.deadline)}</span>` : ''}
          <span class="item-badge ${item.status || 'pending'}">${item.status || 'pending'}</span>
        </div>
      </div>
    `).join('');
  }

  async function performContextSearch() {
    const input = document.getElementById('context-search');
    const container = document.getElementById('context-list');
    const query = input?.value.trim();
    
    if (!query || !container) return;
    
    container.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
    `;
    
    try {
      const results = await backgroundAPI.searchContext(query);
      renderContextResults(results);
    } catch (error) {
      console.error('[MeetGraph] Search error:', error);
      container.innerHTML = `
        <div class="empty-state">
          <p>Error searching context</p>
        </div>
      `;
    }
  }

  function renderContextResults(results) {
    const container = document.getElementById('context-list');
    
    if (!container) return;
    
    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No related context found</p>
        </div>
      `;
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

  function openArchaeologyModal() {
    const modal = document.getElementById('archaeology-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  function closeArchaeologyModal() {
    const modal = document.getElementById('archaeology-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  async function performArchaeologySearch() {
    const input = document.getElementById('archaeology-search');
    const container = document.getElementById('archaeology-results');
    const query = input?.value.trim();
    
    if (!query || !container) return;
    
    container.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
    `;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/knowledge/archaeology`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ query })
      });
      
      if (response.ok) {
        const results = await response.json();
        renderArchaeologyResults(results);
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <p>Error tracing decision history</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('[MeetGraph] Archaeology error:', error);
      container.innerHTML = `
        <div class="empty-state">
          <p>Unable to connect to server</p>
        </div>
      `;
    }
  }

  function renderArchaeologyResults(results) {
    const container = document.getElementById('archaeology-results');
    
    if (!container) return;
    
    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No decision history found for this topic</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = results.map((item, index) => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-date">${formatDate(item.date)}</div>
          <div class="timeline-title">${escapeHtml(item.title)}</div>
          <div class="timeline-text">${escapeHtml(item.description || item.rationale || '')}</div>
          ${item.arguments ? `
            <div class="item-meta" style="margin-top: 8px;">
              <strong>Arguments:</strong> ${item.arguments}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  function getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function getAuthToken() {
    const result = await chrome.storage.local.get(['authToken']);
    return result.authToken || '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
