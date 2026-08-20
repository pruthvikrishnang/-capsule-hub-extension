// Capsule Hub - Popup Controller
// Intelligent context compression using AI

document.addEventListener("DOMContentLoaded", () => {
  // State
  let currentSession = null;
  let allCapsules = [];

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  
  const statusSection = $("status-section");
  const statusText = $("status-text");
  const btnSaveCapsule = $("btn-save-capsule");
  const btnCopyContext = $("btn-copy-context");
  const capsuleList = $("capsule-list");
  const emptyState = $("empty-state");
  const libraryCount = $("library-count");
  const searchInput = $("search-input");
  const btnManual = $("btn-manual");
  const manualText = $("manual-text");
  const toast = $("toast");

  // Initialize
  init();

  function init() {
    detectConversation();
    loadCapsuleLibrary();
    bindEvents();
  }

  function bindEvents() {
    btnSaveCapsule.addEventListener("click", saveCapsule);
    btnCopyContext.addEventListener("click", copyContext);
    btnManual.addEventListener("click", handleManualEntry);
    searchInput.addEventListener("input", (e) => filterCapsules(e.target.value));
  }

  // Detect conversation from active tab
  function detectConversation() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs?.length) {
        setStatus("No active tab", "error");
        disableActions();
        return;
      }

      const tab = tabs[0];
      
      if (!isSupportedUrl(tab.url)) {
        setStatus("Open ChatGPT, Claude, Gemini, or DeepSeek", "error");
        disableActions();
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "extractMessages" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          // Try injecting content script
          chrome.scripting?.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: "extractMessages" }, (response) => {
                handleDetectionResponse(response);
              });
            }, 500);
          }).catch(() => {
            setStatus("Failed to detect conversation", "error");
            disableActions();
          });
          return;
        }

        handleDetectionResponse(response);
      });
    });
  }

  function handleDetectionResponse(response) {
    if (response?.success && response.messages?.length > 0) {
      currentSession = {
        messages: response.messages,
        provider: response.provider
      };
      const msgCount = response.messages.length;
      const providerName = getProviderName(response.provider);
      setStatus(`✓ ${msgCount} messages from ${providerName}`, "active");
      enableActions();
    } else {
      setStatus("No conversation found. Start chatting first!", "error");
      disableActions();
    }
  }

  function getProviderName(providerKey) {
    const names = {
      chatgpt: "ChatGPT",
      claude: "Claude",
      gemini: "Gemini",
      deepseek: "DeepSeek"
    };
    return names[providerKey] || "AI";
  }

  function isSupportedUrl(url) {
    if (!url) return false;
    const supported = [
      "chatgpt.com", "chat.openai.com",
      "claude.ai",
      "gemini.google.com",
      "chat.deepseek.com", "deepseek.com"
    ];
    return supported.some(domain => url.includes(domain));
  }

  function setStatus(text, state = "") {
    statusText.textContent = text;
    statusSection.className = `status-section ${state}`;
  }

  function enableActions() {
    btnSaveCapsule.disabled = false;
    btnCopyContext.disabled = false;
  }

  function disableActions() {
    btnSaveCapsule.disabled = true;
    btnCopyContext.disabled = true;
  }

  // Save Capsule - Uses AI to create intelligent summary
  async function saveCapsule() {
    if (!currentSession?.messages) {
      showToast("No conversation to save", "error");
      return;
    }

    // Disable button and show progress
    btnSaveCapsule.disabled = true;
    btnSaveCapsule.innerHTML = '<span class="btn-icon">⏳</span><span>Creating capsule...</span>';

    try {
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs?.length) {
        throw new Error("No active tab");
      }

      // Send message to content script to create capsule using AI
      const response = await chrome.tabs.sendMessage(tabs[0].id, { action: "createCapsule" });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to create capsule");
      }

      const capsule = response.capsule;

      // Generate intelligent name from capsule content
      const capsuleName = generateCapsuleName(capsule.text);

      // Save to storage
      chrome.storage.local.get("capsuleLibrary", (data) => {
        const library = data?.capsuleLibrary || [];
        
        const capsuleData = {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
          name: capsuleName,
          text: capsule.text,
          messageCount: capsule.messageCount,
          provider: capsule.provider,
          timestamp: capsule.timestamp
        };

        library.unshift(capsuleData);
        
        // Keep max 50 capsules
        if (library.length > 50) library.length = 50;

        chrome.storage.local.set({ capsuleLibrary: library }, () => {
          showToast(`💊 Capsule saved: ${capsuleName}`, "success");
          loadCapsuleLibrary();
          
          // Re-enable button
          btnSaveCapsule.disabled = false;
          btnSaveCapsule.innerHTML = '<span class="btn-icon">💊</span><span>Save Capsule</span>';
        });
      });
    } catch (error) {
      console.error("[Capsule Hub] Save error:", error);
      showToast(error.message || "Failed to create capsule", "error");
      
      // Re-enable button
      btnSaveCapsule.disabled = false;
      btnSaveCapsule.innerHTML = '<span class="btn-icon">💊</span><span>Save Capsule</span>';
    }
  }

  // Generate intelligent name from capsule content
  function generateCapsuleName(capsuleText) {
    // Try to extract OBJECTIVE section
    const objectiveMatch = capsuleText.match(/## OBJECTIVE\s*\n(.+?)(?=\n##|\n\[END)/s);
    if (objectiveMatch) {
      let objective = objectiveMatch[1].trim();
      // Take first sentence or first 60 chars
      const firstSentence = objective.split(/[.!?]/)[0];
      if (firstSentence.length > 60) {
        return firstSentence.substring(0, 57) + "...";
      }
      return firstSentence;
    }

    // Fallback: first line that's not a header
    const lines = capsuleText.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('['));
    if (lines.length > 0) {
      let firstLine = lines[0].trim();
      if (firstLine.length > 60) {
        return firstLine.substring(0, 57) + "...";
      }
      return firstLine;
    }

    // Last resort
    return `Capsule ${new Date().toLocaleDateString()}`;
  }

  // Copy Context - Also uses AI
  async function copyContext() {
    if (!currentSession?.messages) {
      showToast("No conversation to copy", "error");
      return;
    }

    btnCopyContext.disabled = true;
    btnCopyContext.innerHTML = '<span class="btn-icon">⏳</span><span>Creating...</span>';

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs?.length) {
        throw new Error("No active tab");
      }

      const response = await chrome.tabs.sendMessage(tabs[0].id, { action: "createCapsule" });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to create context");
      }

      await navigator.clipboard.writeText(response.capsule.text);
      showToast("✅ Context copied to clipboard", "success");
    } catch (error) {
      console.error("[Capsule Hub] Copy error:", error);
      showToast(error.message || "Failed to copy", "error");
    } finally {
      btnCopyContext.disabled = false;
      btnCopyContext.innerHTML = '<span class="btn-icon">📋</span><span>Copy Context</span>';
    }
  }

  // Manual Entry
  function handleManualEntry() {
    const text = manualText.value.trim();
    if (!text) {
      showToast("Enter some text first", "error");
      return;
    }

    currentSession = {
      provider: "manual",
      messages: [{ role: "user", text: text }]
    };

    setStatus("Manual context loaded", "active");
    enableActions();
    showToast("✅ Manual context loaded", "success");
    manualText.value = "";
  }

  // Load Capsule Library
  function loadCapsuleLibrary() {
    chrome.storage.local.get("capsuleLibrary", (data) => {
      allCapsules = data?.capsuleLibrary || [];
      renderCapsules(allCapsules);
    });
  }

  // Render Capsules
  function renderCapsules(capsules) {
    libraryCount.textContent = `${capsules.length} capsule${capsules.length !== 1 ? 's' : ''}`;

    if (capsules.length === 0) {
      capsuleList.innerHTML = '';
      capsuleList.appendChild(emptyState);
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';
    capsuleList.innerHTML = '';

    capsules.forEach((capsule, idx) => {
      const item = createCapsuleElement(capsule, idx);
      capsuleList.appendChild(item);
    });
  }

  // Create Capsule Element
  function createCapsuleElement(capsule, idx) {
    const item = document.createElement("div");
    item.className = "capsule-item";
    item.draggable = true;

    const date = new Date(capsule.timestamp);
    const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    item.innerHTML = `
      <div class="capsule-name">${escapeHTML(capsule.name)}</div>
      <div class="capsule-meta">
        <span>${capsule.provider || 'Unknown'}</span>
        <span>${capsule.messageCount || '?'} msgs</span>
        <span>${dateStr}</span>
      </div>
      <div class="capsule-actions">
        <button class="capsule-btn use" data-idx="${idx}">Use</button>
        <button class="capsule-btn copy" data-idx="${idx}">Copy</button>
        <button class="capsule-btn delete" data-idx="${idx}">Delete</button>
      </div>
    `;

    // Drag and drop
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", capsule.text);
      e.dataTransfer.effectAllowed = "copy";
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    // Button actions
    item.querySelectorAll(".capsule-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.classList.contains("use") ? "use" : 
                      btn.classList.contains("copy") ? "copy" : "delete";
        const idx = parseInt(btn.dataset.idx);
        handleCapsuleAction(action, idx);
      });
    });

    return item;
  }

  // Handle Capsule Actions
  function handleCapsuleAction(action, idx) {
    const capsule = allCapsules[idx];
    if (!capsule) return;

    if (action === "use") {
      navigator.clipboard.writeText(capsule.text).then(() => {
        showToast(`✅ ${capsule.name} copied! Paste it anywhere.`, "success");
      });
    } else if (action === "copy") {
      navigator.clipboard.writeText(capsule.text).then(() => {
        showToast("📋 Copied to clipboard", "success");
      });
    } else if (action === "delete") {
      if (confirm(`Delete "${capsule.name}"?`)) {
        chrome.storage.local.get("capsuleLibrary", (data) => {
          const library = data?.capsuleLibrary || [];
          library.splice(idx, 1);
          chrome.storage.local.set({ capsuleLibrary: library }, () => {
            showToast("🗑️ Capsule deleted", "success");
            loadCapsuleLibrary();
          });
        });
      }
    }
  }

  // Filter Capsules
  function filterCapsules(query) {
    if (!query || query.trim() === '') {
      renderCapsules(allCapsules);
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = allCapsules.filter(capsule => {
      if (capsule.name && capsule.name.toLowerCase().includes(searchTerm)) return true;
      if (capsule.text && capsule.text.toLowerCase().includes(searchTerm)) return true;
      return false;
    });

    renderCapsules(filtered);
  }

  // Show Toast
  function showToast(message, type = "info") {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // Escape HTML
  function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
