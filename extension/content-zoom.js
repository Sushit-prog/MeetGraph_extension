(function() {
  'use strict';

  const PLATFORM = 'zoom';
  const CHUNK_INTERVAL = 30000;
  const TRANSCRIPT_SELECTORS = [
    '.transcript-tab',
    '[class*="transcript"]',
    '.zmmtg-scroll-view__scroll-view--scrollable',
    '[aria-label*="transcript"]',
    '.meeting-transcript',
    '#transcript-container'
  ];

  let transcriptObserver = null;
  let lastTranscriptLength = 0;
  let meetingTitle = '';
  let participants = [];
  let chunkIntervalId = null;
  let transcriptBuffer = [];

  function init() {
    console.log('[MeetGraph] Content script loaded for Zoom');
    detectMeeting();
    setupMeetingDetection();
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
    return window.location.href.includes('zoom.us') && 
           (window.location.href.includes('/w/') || window.location.href.includes('/j/'));
  }

  async function detectMeeting() {
    await waitForElement('.meeting-info, .meeting-title, [class*="header"]');

    setTimeout(() => {
      meetingTitle = getMeetingTitle();
      participants = getParticipants();
      
      console.log('[MeetGraph] Meeting detected:', meetingTitle);
      console.log('[MeetGraph] Participants:', participants);

      startCapture();
    }, 2000);
  }

  function getMeetingTitle() {
    const selectors = [
      '.meeting-title',
      '.meeting-info h2',
      '[class*="topic"]',
      '[class*="meeting-topic"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }
    return `Zoom Meeting - ${new Date().toLocaleString()}`;
  }

  function getParticipants() {
    const names = [];
    const selectors = [
      '.participant-name',
      '[class*="participant"] [class*="name"]',
      '.footer-button__button-text'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const name = el.textContent.trim();
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
    findAndObserveTranscript();
    startChunkInterval();
  }

  async function startMeeting() {
    try {
      await backgroundAPI.startMeeting({
        platform: PLATFORM,
        meetingTitle: meetingTitle,
        participants: participants
      });
    } catch (error) {
      console.error('[MeetGraph] Error starting meeting:', error);
    }
  }

  function findAndObserveTranscript() {
    let transcriptElement = null;

    for (const selector of TRANSCRIPT_SELECTORS) {
      transcriptElement = document.querySelector(selector);
      if (transcriptElement) {
        console.log('[MeetGraph] Found transcript element:', selector);
        break;
      }
    }

    if (!transcriptElement) {
      console.log('[MeetGraph] Transcript element not found, retrying...');
      setTimeout(findAndObserveTranscript, 2000);
      return;
    }

    observeTranscript(transcriptElement);
  }

  function observeTranscript(element) {
    transcriptObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = extractTranscriptText(node);
              if (text) {
                processTranscriptEntry(text);
              }
            }
          });
        }
      });
    });

    transcriptObserver.observe(element, {
      childList: true,
      subtree: true
    });

    const existingText = extractTranscriptText(element);
    if (existingText) {
      processTranscriptEntry(existingText);
    }
  }

  function extractTranscriptText(element) {
    const text = element.textContent?.trim();
    if (text && text.length > 10) {
      return text;
    }
    
    const captionElements = element.querySelectorAll('[class*="caption"], [class*="transcript-item"]');
    if (captionElements.length > 0) {
      return Array.from(captionElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(' ');
    }
    
    return null;
  }

  function processTranscriptEntry(text) {
    if (text.length <= lastTranscriptLength) {
      return;
    }
    
    const newText = text.substring(lastTranscriptLength).trim();
    if (newText.length > 5) {
      transcriptBuffer.push(newText);
      lastTranscriptLength = text.length;
    }
  }

  function startChunkInterval() {
    chunkIntervalId = setInterval(async () => {
      if (transcriptBuffer.length > 0) {
        const chunk = transcriptBuffer.join('\n');
        
        try {
          await backgroundAPI.sendTranscriptChunk({
            text: chunk,
            timestamp: new Date().toISOString(),
            speaker: null
          });
          
          console.log('[MeetGraph] Sent transcript chunk:', chunk.length, 'chars');
        } catch (error) {
          console.error('[MeetGraph] Error sending chunk:', error);
        }
      }
    }, CHUNK_INTERVAL);
  }

  function endMeeting() {
    if (transcriptObserver) {
      transcriptObserver.disconnect();
    }
    if (chunkIntervalId) {
      clearInterval(chunkIntervalId);
    }
    backgroundAPI.endMeeting();
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

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

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
    if (document.visibilityState === 'hidden') {
      console.log('[MeetGraph] Tab hidden');
    } else if (document.visibilityState === 'visible') {
      console.log('[MeetGraph] Tab visible');
    }
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
