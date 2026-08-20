// Background service worker for Capsule Hub
// 🔒 PRIVACY: All processing happens locally. Zero external calls.

console.log("[Capsule Hub] Background service worker initialized.");

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openTabAndInject") {
    const { url, targetAI } = message;

    chrome.tabs.create({ url: url, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error("[Capsule Hub] Failed to create tab:", chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      console.log(`[Capsule Hub] Created new tab for ${targetAI} (Tab ID: ${tab.id})`);
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }

  if (message.action === "updateBadge") {
    const { text, color } = message;
    chrome.action.setBadgeText({ text: text || "" }).catch(err => {
      console.warn("[Capsule Hub] Badge update failed:", err);
    });
    if (color) {
      chrome.action.setBadgeBackgroundColor({ color: color }).catch(err => {
        console.warn("[Capsule Hub] Badge color update failed:", err);
      });
    }
    sendResponse({ success: true });
  }

  return false;
});

// Auto-clear expired pending contexts (every 5 minutes)
setInterval(() => {
  chrome.storage.local.get('pendingContext', (data) => {
    if (data?.pendingContext) {
      const timeDiff = Date.now() - data.pendingContext.timestamp;
      if (timeDiff > 120000) {
        chrome.storage.local.remove('pendingContext');
        console.log("[Capsule Hub] Auto-cleaned expired pending context");
      }
    }
  });
}, 300000);
