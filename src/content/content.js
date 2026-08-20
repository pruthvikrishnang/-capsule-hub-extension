// Capsule Hub - Intelligent Local Context Extraction
// 🔒 PRIVACY: All processing happens locally. Zero external calls.
// 💡 Works even when AI is out of tokens!

console.log("[Capsule Hub] Content script loaded on", window.location.hostname);

// Provider configurations
const PROVIDERS = {
  chatgpt: {
    name: "ChatGPT",
    domains: ["chatgpt.com", "chat.openai.com"],
    selectors: {
      userMessage: '[data-message-author-role="user"], .user-message',
      assistantMessage: '[data-message-author-role="assistant"], .assistant-message',
      input: '#prompt-textarea, div[contenteditable="true"][data-id], textarea[rows]',
      sendButton: 'button[data-testid="send-button"], button[aria-label="Send"]'
    }
  },
  claude: {
    name: "Claude",
    domains: ["claude.ai"],
    selectors: {
      userMessage: '[data-testid="user-message"], div.font-user-message',
      assistantMessage: '.font-claude-message, [class*="assistant-message"]',
      input: 'div[contenteditable="true"][role="textbox"], div.ProseMirror[contenteditable="true"]',
      sendButton: 'button[aria-label="Send Message"]'
    }
  },
  gemini: {
    name: "Gemini",
    domains: ["gemini.google.com"],
    selectors: {
      userMessage: 'user-query, .query-text',
      assistantMessage: 'model-turn, .model-response',
      input: 'div[contenteditable="true"], rich-textarea div[contenteditable="true"]',
      sendButton: 'button[aria-label="Send message"]'
    }
  },
  deepseek: {
    name: "DeepSeek",
    domains: ["deepseek.com", "chat.deepseek.com"],
    selectors: {
      userMessage: '[class*="user-message"], .ds-chat-turn--user',
      assistantMessage: '.ds-markdown, [class*="assistant-message"]',
      input: '#chat-input, textarea[placeholder*="message"], div[contenteditable="true"]',
      sendButton: 'button[class*="send"]'
    }
  }
};

// Detect provider
function detectProvider() {
  const host = window.location.hostname;
  for (const [key, provider] of Object.entries(PROVIDERS)) {
    if (provider.domains.some(domain => host.includes(domain))) {
      return key;
    }
  }
  return null;
}

// Extract and clean messages
function extractMessages() {
  const providerKey = detectProvider();
  if (!providerKey) return [];

  const provider = PROVIDERS[providerKey];
  const userSelector = provider.selectors.userMessage;
  const assistantSelector = provider.selectors.assistantMessage;

  const elements = Array.from(document.querySelectorAll(`${userSelector}, ${assistantSelector}`));
  const messages = [];

  elements.forEach(element => {
    let role = 'unknown';
    if (element.matches(userSelector)) {
      role = 'user';
    } else if (element.matches(assistantSelector)) {
      role = 'assistant';
    }

    // Clean the text
    const clone = element.cloneNode(true);
    const toRemove = clone.querySelectorAll('button, svg, [aria-hidden="true"], [role="button"], img[class*="avatar"]');
    toRemove.forEach(el => el.remove());

    let text = (clone.innerText || clone.textContent || "").trim();
    text = text.replace(/^(Copy|Copy code|Regenerate|Good response|Bad response)\s*/gim, '');

    if (text && role !== 'unknown') {
      messages.push({ role, text });
    }
  });

  return messages;
}

// Intelligent local analysis - NO external API calls!
function analyzeConversation(messages) {
  if (!messages || messages.length === 0) {
    return null;
  }

  const userMessages = messages.filter(m => m.role === 'user').map(m => m.text);
  const assistantMessages = messages.filter(m => m.role === 'assistant').map(m => m.text);

  // 1. Extract objective from user messages
  const objective = extractObjective(userMessages);

  // 2. Extract key decisions
  const decisions = extractDecisions(messages);

  // 3. Track progress
  const progress = trackProgress(assistantMessages);

  // 4. Extract technical details
  const technicalDetails = extractTechnicalDetails(messages);

  // 5. Extract all code blocks
  const codeBlocks = extractCodeBlocks(messages);

  // 6. Determine current state
  const currentState = determineCurrentState(messages);

  return {
    objective,
    decisions,
    progress,
    technicalDetails,
    codeBlocks,
    currentState,
    messageCount: messages.length,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length
  };
}

// Extract objective from user messages
function extractObjective(userMessages) {
  if (userMessages.length === 0) return 'No objective identified';

  // Analyze first 5 user messages for the main goal
  const goalPatterns = [
    /(?:i (?:want|need|'d like) (?:to|you to))\s+(.+?)(?:\.|$)/i,
    /(?:help me|please)\s+(.+?)(?:\.|$)/i,
    /(?:build|create|make|develop|implement|design)\s+(?:a|an|the)?\s*(.+?)(?:\.|$)/i,
    /(?:can you|could you)\s+(.+?)(?:\?|$)/i,
    /(?:how (?:do|can|to))\s+(.+?)(?:\?|$)/i
  ];

  // Check first 5 user messages
  for (let i = 0; i < Math.min(5, userMessages.length); i++) {
    const msg = userMessages[i];
    
    for (const pattern of goalPatterns) {
      const match = msg.match(pattern);
      if (match && match[1] && match[1].length > 10 && match[1].length < 200) {
        let goal = match[1].trim();
        goal = goal.replace(/[?.!]+$/, '');
        return goal.charAt(0).toUpperCase() + goal.slice(1);
      }
    }
  }

  // Fallback: Use the most substantial user message
  const substantial = userMessages
    .filter(m => m.length > 20)
    .sort((a, b) => b.length - a.length);

  if (substantial.length > 0) {
    const msg = substantial[0];
    const sentences = msg.split(/[.!?]+/).filter(s => s.trim().length > 15);
    if (sentences.length > 0) {
      return sentences[0].trim().charAt(0).toUpperCase() + sentences[0].trim().slice(1);
    }
  }

  return userMessages[0].substring(0, 100);
}

// Extract key decisions
function extractDecisions(messages) {
  const decisions = [];
  const decisionPatterns = [
    /(?:let's (?:go with|use|choose|implement|try))\s+(.+?)(?:\.|$)/i,
    /(?:i(?:'ll| will) use)\s+(.+?)(?:\.|$)/i,
    /(?:we(?:'ll| will| should) use)\s+(.+?)(?:\.|$)/i,
    /(?:decided to|decision:|chosen:?)\s*(.+?)(?:\.|$)/i,
    /(?:the best (?:approach|way|method) is)\s+(.+?)(?:\.|$)/i,
    /(?:good idea[.!]\s*(?:let's|we'll|we will))\s+(.+?)(?:\.|$)/i
  ];

  messages.forEach(msg => {
    const sentences = msg.text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    sentences.forEach(sentence => {
      decisionPatterns.forEach(pattern => {
        const match = sentence.match(pattern);
        if (match && match[1] && match[1].length > 10) {
          decisions.push(match[1].trim());
        }
      });
    });
  });

  return [...new Set(decisions)].slice(0, 5);
}

// Track progress
function trackProgress(assistantMessages) {
  const completed = [];
  const pending = [];

  const completedPatterns = [
    /(?:i(?:'ve| have) (?:created|built|implemented|added|fixed|completed|finished|written|set up))\s+(.+?)(?:\.|$)/i,
    /(?:here(?:'s| is) (?:the|your|a))\s+(.+?)(?:\.|$)/i,
    /(?:the (?:code|function|component|file|feature) (?:is|has been))\s+(.+?)(?:\.|$)/i,
    /(?:done[.!]|completed[.!]|finished[.!]|ready[.!])/i
  ];

  const pendingPatterns = [
    /(?:you (?:can|could|should|might want to) (?:also|additionally|next))\s+(.+?)(?:\.|$)/i,
    /(?:still need to|todo|remaining|yet to|left to do)\s+(.+?)(?:\.|$)/i,
    /(?:next (?:step|we should|you should))\s+(.+?)(?:\.|$)/i,
    /(?:would you like me to|should i)\s+(.+?)(?:\?|$)/i
  ];

  assistantMessages.forEach(msg => {
    const sentences = msg.split(/[.!?]+/).filter(s => s.trim().length > 15);
    sentences.forEach(sentence => {
      completedPatterns.forEach(pattern => {
        const match = sentence.match(pattern);
        if (match && match[1]) {
          completed.push(match[1].trim());
        } else if (pattern.test(sentence) && !match) {
          completed.push(sentence.trim());
        }
      });

      pendingPatterns.forEach(pattern => {
        const match = sentence.match(pattern);
        if (match && match[1]) {
          pending.push(match[1].trim());
        }
      });
    });
  });

  return {
    completed: [...new Set(completed)].slice(0, 5),
    pending: [...new Set(pending)].slice(0, 3)
  };
}

// Extract technical details
function extractTechnicalDetails(messages) {
  const details = [];
  const techPatterns = [
    /(?:using|with|in)\s+([\w\s]+?)(?:\s+(?:for|to|and)|\.)/i,
    /(?:framework|library|language|tool|platform):\s*([\w\s]+)/i,
    /(?:version|requirement|constraint|limitation):\s*([\w\s]+)/i
  ];

  const techKeywords = [
    'react', 'vue', 'angular', 'javascript', 'typescript', 'python', 'java',
    'node', 'express', 'django', 'flask', 'database', 'api', 'rest', 'graphql',
    'jwt', 'authentication', 'authorization', 'css', 'html', 'sql', 'mongodb',
    'postgresql', 'docker', 'kubernetes', 'aws', 'git', 'webpack', 'vite'
  ];

  messages.forEach(msg => {
    const text = msg.text.toLowerCase();
    techKeywords.forEach(keyword => {
      if (text.includes(keyword) && !details.includes(keyword)) {
        details.push(keyword);
      }
    });
  });

  return details.slice(0, 8);
}

// Extract code blocks
function extractCodeBlocks(messages) {
  const codeBlocks = [];
  const codeRegex = /```[\s\S]*?```/g;

  messages.forEach(msg => {
    let match;
    while ((match = codeRegex.exec(msg.text)) !== null) {
      codeBlocks.push({
        code: match[0],
        role: msg.role
      });
    }
  });

  return codeBlocks;
}

// Determine current state
function determineCurrentState(messages) {
  if (messages.length === 0) return 'Empty conversation';

  const lastMsg = messages[messages.length - 1];
  
  if (lastMsg.role === 'assistant') {
    const completionIndicators = [
      /(?:done|completed|finished|that's it|all set|there you go)/i,
      /(?:let me know if you (?:need|have) (?:anything|any questions))/i,
      /(?:is there anything else)/i,
      /(?:feel free to ask)/i
    ];

    for (const pattern of completionIndicators) {
      if (pattern.test(lastMsg.text)) {
        return 'Task completed, awaiting user feedback or next request';
      }
    }

    return 'Implementation provided, awaiting user review';
  }

  if (lastMsg.role === 'user') {
    if (/\?/.test(lastMsg.text)) {
      return 'Question asked, awaiting AI response';
    }
    if (/^(thanks|thank you|perfect|great|awesome)/i.test(lastMsg.text)) {
      return 'User satisfied, conversation may be complete';
    }
    return 'User input provided, awaiting AI response';
  }

  return 'Conversation in progress';
}

// Create intelligent capsule - ALL LOCAL, NO API CALLS!
function createIntelligentCapsule(messages = extractMessages()) {
  const providerKey = detectProvider();
  if (!providerKey) {
    throw new Error("Not on a supported AI platform");
  }

  const provider = PROVIDERS[providerKey];
  // const messages = extractMessages();
  
  if (messages.length === 0) {
    throw new Error("No conversation found. Start chatting first!");
  }

  // Analyze the conversation locally
  const analysis = analyzeConversation(messages);
  
  if (!analysis) {
    throw new Error("Failed to analyze conversation");
  }

  // Generate capsule name from objective
  let capsuleName = analysis.objective;
  if (capsuleName.length > 60) {
    capsuleName = capsuleName.substring(0, 57) + "...";
  }

  // Create the capsule text
  let capsule = '';

  capsule += `[CONTEXT CAPSULE]\n`;
  capsule += `[${analysis.messageCount} messages compressed]\n\n`;

  // Objective
  capsule += `## OBJECTIVE\n${analysis.objective}\n\n`;

  // Key Decisions
  if (analysis.decisions.length > 0) {
    capsule += `## KEY DECISIONS\n`;
    analysis.decisions.forEach(decision => {
      capsule += `- ${decision}\n`;
    });
    capsule += '\n';
  }

  // Progress
  if (analysis.progress.completed.length > 0 || analysis.progress.pending.length > 0) {
    capsule += `## PROGRESS\n`;
    analysis.progress.completed.forEach(item => {
      capsule += `✅ ${item}\n`;
    });
    analysis.progress.pending.forEach(item => {
      capsule += `⏳ ${item}\n`;
    });
    capsule += '\n';
  }

  // Technical Details
  if (analysis.technicalDetails.length > 0) {
    capsule += `## TECHNICAL DETAILS\n`;
    capsule += `Technologies: ${analysis.technicalDetails.join(', ')}\n\n`;
  }

  // Code Blocks
  if (analysis.codeBlocks.length > 0) {
    capsule += `## CODE (${analysis.codeBlocks.length} blocks)\n`;
    analysis.codeBlocks.forEach((block, i) => {
      capsule += `${block.code}\n\n`;
    });
  }

  // Current State
  capsule += `## CURRENT STATE\n${analysis.currentState}\n\n`;

  capsule += `[END CAPSULE - Continue from current state]`;

  return {
    name: capsuleName,
    text: capsule,
    messageCount: analysis.messageCount,
    provider: provider.name,
    timestamp: Date.now()
  };
}

// Inject text into input field
function injectText(element, text) {
  element.focus();

  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    const setter = Object.getOwnPropertyDescriptor(
      element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;

    if (setter) {
      setter.call(element, text);
    } else {
      element.value = text;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element.isContentEditable) {
    element.innerText = text;
    element.dispatchEvent(new InputEvent('input', {
      inputType: 'insertText',
      data: text,
      bubbles: true,
      cancelable: false,
      composed: true
    }));
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractMessages") {
    const messages = extractMessages();
    sendResponse({ success: true, messages, provider: detectProvider() });
    return false;
  }

  if (request.action === "createCapsule") {
    try {
      const capsule = createIntelligentCapsule();
      sendResponse({ success: true, capsule });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  if (request.action === "ping") {
    sendResponse({ alive: true, provider: detectProvider() });
    return false;
  }

  return false;
});

// Check for pending injection
chrome.storage.local.get('pendingContext', (data) => {
  if (data?.pendingContext) {
    const context = data.pendingContext;
    const currentProvider = detectProvider();
    const timeDiff = Date.now() - context.timestamp;

    if (context.targetAI === currentProvider && timeDiff < 120000) {
      const init = async () => {
        const provider = PROVIDERS[currentProvider];
        let attempts = 0;
        const maxAttempts = 40;

        const pollInterval = setInterval(() => {
          attempts++;
          const inputElement = document.querySelector(provider.selectors.input);

          if (inputElement) {
            clearInterval(pollInterval);
            setTimeout(() => {
              injectText(inputElement, context.text);
              chrome.storage.local.remove('pendingContext');
              showToast("✅ Context injected! Press Enter to continue.", "success");
            }, 800);
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            navigator.clipboard.writeText(context.text);
            showToast("⚠️ Auto-inject failed. Context copied to clipboard.", "warning");
          }
        }, 500);
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 500);
      } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
      }
    } else if (timeDiff >= 120000) {
      chrome.storage.local.remove('pendingContext');
    }
  }
});

// Toast notification
function showToast(message, type = "success") {
  const existing = document.getElementById('capsule-hub-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'capsule-hub-toast';
  toast.textContent = message;

  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    background: type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
    zIndex: '999999',
    opacity: '0',
    transform: 'translateY(-20px)',
    transition: 'all 0.4s ease'
  });

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}
