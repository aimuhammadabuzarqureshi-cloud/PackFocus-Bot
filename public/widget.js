/**
 * Gemini Chatbot Widget — Self-contained embeddable chat widget
 * Usage: <script src="https://YOUR_SERVER/widget.js" data-chatbot-server="https://YOUR_SERVER"></script>
 */
(function () {
  'use strict';

  const scriptTag = document.currentScript;
  const SERVER = (scriptTag && scriptTag.getAttribute('data-chatbot-server')) || window.location.origin;

  // ─── Persistent Visitor Recognition (localStorage) ──────────────────────
  const STORAGE_KEY = 'cb_visitor';
  let visitor = {};
  try {
    visitor = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) { visitor = {}; }

  // Generate or reuse a persistent visitor ID
  if (!visitor.id) {
    visitor.id = 'v_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    saveVisitor();
  }

  const SESSION_ID = visitor.id;
  let leadCaptured = !!visitor.leadCaptured;

  function saveVisitor() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visitor)); } catch (e) {}
  }

  let uploadedLogo = null;
  let isOpen = false;
  let isProcessing = false;
  let voiceMode = false;
  let speakNextReply = false;
  let stopCurrentAudio = null;

  let currentBoxSpecs = {
    width: 6,
    height: 6,
    depth: 4,
    color: 'kraft',
    boxType: 'Mailer Box'
  };

  // ─── Mockup Wizard State ─────────────────────────────────────────────────
  let mockupWizard = {
    active: false,
    step: 0,
    boxType: '',
    material: '',
    materialLabel: '',
    printStyle: '',
    printLabel: '',
    width: 0,
    height: 0,
    depth: 0,
    dimensionLabel: ''
  };

  function resetWizard() {
    mockupWizard = {
      active: false, step: 0,
      boxType: '', material: '', materialLabel: '',
      printStyle: '', printLabel: '',
      width: 0, height: 0, depth: 0, dimensionLabel: ''
    };
  }

  // ─── Wizard Step Definitions ─────────────────────────────────────────────
  function startMockupWizard() {
    resetWizard();
    mockupWizard.active = true;
    mockupWizard.step = 1;
    wizardStep1_BoxType();
  }

  function createWizardChips(container, options, onSelect) {
    const selector = document.createElement('div');
    selector.className = 'cb-product-selector';
    selector.style.marginTop = '10px';
    options.forEach(opt => {
      const chip = document.createElement('button');
      chip.className = 'cb-product-chip';
      chip.style.margin = '4px';
      chip.textContent = opt.label;
      chip.addEventListener('click', () => {
        selector.querySelectorAll('button').forEach(b => {
          b.disabled = true;
          b.style.opacity = '0.5';
        });
        chip.style.opacity = '1';
        chip.style.background = 'var(--cb-primary)';
        chip.style.color = '#fff';
        chip.style.borderColor = 'var(--cb-primary)';
        addUserMessage(opt.label);
        onSelect(opt);
      });
      selector.appendChild(chip);
    });
    container.appendChild(selector);
  }

  // Predefined dimensions for specific box types (skip dimension step)
  const PREDEFINED_BOXES = {
    'Tissue Box':     { w: 9, h: 5, d: 3.5 },
    'Candle Box':     { w: 4, h: 4, d: 5 },
    'Pizza Box':      { w: 12, h: 12, d: 2 },
    'Cosmetic Box':   { w: 6, h: 6, d: 3 },
    'Soap Box':       { w: 3.5, h: 2.5, d: 1.5 },
    'Perfume Box':    { w: 3, h: 3, d: 5 },
    'Tea Box':        { w: 5, h: 3, d: 7 },
    'Chocolate Box':  { w: 8, h: 6, d: 2 }
  };

  // Step 1: Box Type
  function wizardStep1_BoxType() {
    const options = [
      { label: 'Mailer Box', value: 'Mailer Box' },
      { label: 'Shipping Box', value: 'Shipping Box' },
      { label: 'Gift Box', value: 'Gift Box' },
      { label: 'Product Box', value: 'Product Box' },
      { label: 'Tissue Box', value: 'Tissue Box' },
      { label: 'Candle Box', value: 'Candle Box' },
      { label: 'Cosmetic Box', value: 'Cosmetic Box' },
      { label: 'Soap Box', value: 'Soap Box' },
      { label: 'Perfume Box', value: 'Perfume Box' },
      { label: 'Pizza Box', value: 'Pizza Box' },
      { label: 'Chocolate Box', value: 'Chocolate Box' },
      { label: 'Tea Box', value: 'Tea Box' },
      { label: 'Display Box', value: 'Display Box' },
      { label: 'Sleeve Box', value: 'Sleeve Box' }
    ];
    addBotMessageWithChips(
      '**Step 1 — Box Type**\nWhat type of packaging do you need?',
      options,
      (selected) => {
        mockupWizard.boxType = selected.value;
        // Do not auto-fill dimensions here, we will ask standard vs custom in wizardGoToDimensions
        mockupWizard.step = 2;
        setTimeout(() => wizardStep2_Material(), 400);
      }
    );
  }

  // Step 2: Material
  function wizardStep2_Material() {
    const options = [
      { label: 'Kraft Brown', value: 'kraft' },
      { label: 'White Cardboard', value: '#ffffff' },
      { label: 'Black Cardboard', value: '#1a1a1a' },
      { label: 'Navy Blue', value: '#1e3a5f' },
      { label: 'Burgundy Red', value: '#722f37' },
      { label: 'Forest Green', value: '#228B22' },
      { label: 'Gold / Premium', value: '#b8860b' },
      { label: 'Corrugated Brown', value: 'corrugated' }
    ];
    addBotMessageWithChips(
      '**Step 2 — Material & Color**\nChoose the box material and color:',
      options,
      (selected) => {
        mockupWizard.material = selected.value;
        mockupWizard.materialLabel = selected.label;
        mockupWizard.step = 3;
        setTimeout(() => wizardStep3_PrintStyle(), 400);
      }
    );
  }

  // Step 3: Print Style
  function wizardStep3_PrintStyle() {
    const options = [
      { label: 'Logo on Front Only', value: 'logo-front' },
      { label: 'Logo on Lid / Top', value: 'logo-top' },
      { label: 'Fully Printed (All Over)', value: 'full-print-select' },
      { label: 'Logo Covers Entire Face', value: 'logo-full-face' },
      { label: 'Logo + Company Name', value: 'logo-text' },
      { label: 'Minimalist / Clean', value: 'minimal' }
    ];
    addBotMessageWithChips(
      '**Step 3 — Print Style**\nHow should your logo appear on the box?',
      options,
      (selected) => {
        if (selected.value === 'full-print-select') {
          // Show sub-options for fully printed
          setTimeout(() => wizardStep3b_FullPrintType(), 400);
        } else {
          mockupWizard.printStyle = selected.value;
          mockupWizard.printLabel = selected.label;
          mockupWizard.step = 4;
          setTimeout(() => wizardGoToDimensions(), 400);
        }
      }
    );
  }

  // Step 3b: Full Print sub-options
  function wizardStep3b_FullPrintType() {
    const options = [
      { label: 'Small Logo Pattern (Repeated)', value: 'full-pattern' },
      { label: 'Custom Artwork All Over', value: 'full-artwork' }
    ];
    addBotMessageWithChips(
      '**Fully Printed — What style?**',
      options,
      (selected) => {
        mockupWizard.printStyle = selected.value;
        mockupWizard.printLabel = selected.label;
        mockupWizard.step = 4;
        setTimeout(() => wizardGoToDimensions(), 400);
      }
    );
  }

  // Smart dimension routing — check if predefined box type, always ask standard vs custom
  function wizardGoToDimensions() {
    if (PREDEFINED_BOXES[mockupWizard.boxType]) {
      const dims = PREDEFINED_BOXES[mockupWizard.boxType];
      const standardSizeLabel = `${dims.w}×${dims.h}×${dims.d}`;
      const options = [
        { label: `Use Standard Size (${standardSizeLabel})`, value: 'standard' },
        { label: 'Enter Custom Size', value: 'custom' }
      ];
      addBotMessageWithChips(
        `For a **${mockupWizard.boxType}**, would you like to use standard dimensions or enter custom ones?`,
        options,
        (selected) => {
          if (selected.value === 'standard') {
            mockupWizard.width = dims.w;
            mockupWizard.height = dims.h;
            mockupWizard.depth = dims.d;
            mockupWizard.dimensionLabel = `${dims.w}×${dims.h}×${dims.d} (Standard ${mockupWizard.boxType})`;
            setTimeout(() => wizardConfirmAndGenerate(), 400);
          } else {
            mockupWizard.width = 0;
            mockupWizard.height = 0;
            mockupWizard.depth = 0;
            setTimeout(() => wizardStep4_Dimensions(), 400);
          }
        }
      );
    } else {
      wizardStep4_Dimensions();
    }
  }

  // Step 4: Dimensions
  function wizardStep4_Dimensions() {
    const options = [
      { label: '4×4×4 (Small)', value: '4x4x4', w: 4, h: 4, d: 4 },
      { label: '6×6×3 (Medium Flat)', value: '6x6x3', w: 6, h: 6, d: 3 },
      { label: '8×8×4 (Medium)', value: '8x8x4', w: 8, h: 8, d: 4 },
      { label: '10×10×5 (Large)', value: '10x10x5', w: 10, h: 10, d: 5 },
      { label: '12×9×4 (Mailer)', value: '12x9x4', w: 12, h: 9, d: 4 },
      { label: '14×10×6 (XL)', value: '14x10x6', w: 14, h: 10, d: 6 },
      { label: 'Custom Size', value: 'custom', w: 0, h: 0, d: 0 }
    ];
    addBotMessageWithChips(
      '**Step 4 — Dimensions**\nSelect the box size (L × W × H inches):',
      options,
      (selected) => {
        if (selected.value === 'custom') {
          showCustomDimensionInput();
        } else {
          mockupWizard.width = selected.w;
          mockupWizard.height = selected.h;
          mockupWizard.depth = selected.d;
          mockupWizard.dimensionLabel = selected.label;
          setTimeout(() => wizardConfirmAndGenerate(), 400);
        }
      }
    );
  }

  function showCustomDimensionInput() {
    const msg = document.createElement('div');
    msg.className = 'cb-msg cb-msg-bot';
    const formId = 'dim-form-' + Date.now();
    msg.innerHTML = `
      <div class="cb-msg-avatar">${ICONS.bot}</div>
      <div class="cb-msg-bubble">
        <p style="margin-top:0;margin-bottom:10px;font-weight:500;">Enter your custom dimensions (inches):</p>
        <form id="${formId}" style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:10px;color:var(--cb-text-muted);font-weight:600;">LENGTH</label>
            <input type="number" name="w" min="1" max="48" value="8" step="0.5" required style="width:60px;padding:6px 8px;border:1px solid var(--cb-border);border-radius:4px;font-size:13px;background:#fff;color:#333;text-align:center;" />
          </div>
          <span style="font-size:16px;color:var(--cb-text-muted);padding-bottom:6px;">×</span>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:10px;color:var(--cb-text-muted);font-weight:600;">WIDTH</label>
            <input type="number" name="h" min="1" max="48" value="8" step="0.5" required style="width:60px;padding:6px 8px;border:1px solid var(--cb-border);border-radius:4px;font-size:13px;background:#fff;color:#333;text-align:center;" />
          </div>
          <span style="font-size:16px;color:var(--cb-text-muted);padding-bottom:6px;">×</span>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:10px;color:var(--cb-text-muted);font-weight:600;">HEIGHT</label>
            <input type="number" name="d" min="1" max="48" value="4" step="0.5" required style="width:60px;padding:6px 8px;border:1px solid var(--cb-border);border-radius:4px;font-size:13px;background:#fff;color:#333;text-align:center;" />
          </div>
          <button type="submit" style="background:var(--cb-primary);color:#fff;border:none;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;white-space:nowrap;">Confirm ✓</button>
        </form>
      </div>`;
    messagesEl.appendChild(msg);
    scrollToBottom();

    document.getElementById(formId).addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const w = parseFloat(form.w.value);
      const h = parseFloat(form.h.value);
      const d = parseFloat(form.d.value);
      mockupWizard.width = w;
      mockupWizard.height = h;
      mockupWizard.depth = d;
      mockupWizard.dimensionLabel = `${w}×${h}×${d} (Custom)`;
      addUserMessage(`${w}" × ${h}" × ${d}"`);
      form.querySelectorAll('input, button').forEach(el => el.disabled = true);
      setTimeout(() => wizardConfirmAndGenerate(), 400);
    });
  }

  // Confirm & Generate
  function wizardConfirmAndGenerate() {
    // Build summary
    const summary = `**Your Custom Box Summary:**\n` +
      `- **Box Type:** ${mockupWizard.boxType}\n` +
      `- **Material:** ${mockupWizard.materialLabel}\n` +
      `- **Print Style:** ${mockupWizard.printLabel}\n` +
      `- **Dimensions:** ${mockupWizard.dimensionLabel}\n\n` +
      `**Generating your packaging mockup now...** This may take 10–15 seconds.`;

    addBotMessage(summary);

    // Update currentBoxSpecs for 3D canvas preview
    currentBoxSpecs.width = mockupWizard.width;
    currentBoxSpecs.height = mockupWizard.height;
    currentBoxSpecs.depth = mockupWizard.depth;
    currentBoxSpecs.color = mockupWizard.material === 'corrugated' ? 'kraft' : mockupWizard.material;
    currentBoxSpecs.boxType = mockupWizard.boxType;

    // Fire the single API call
    generateMockupFromWizard();
  }

  function addBotMessageWithChips(text, options, onSelect) {
    const msg = document.createElement('div');
    msg.className = 'cb-msg cb-msg-bot';
    msg.innerHTML = `
      <div class="cb-msg-avatar">${ICONS.bot}</div>
      <div class="cb-msg-bubble" style="position: relative; padding-right: 28px;">
        ${formatMarkdown(text)}
      </div>`;
    messagesEl.appendChild(msg);
    createWizardChips(msg.querySelector('.cb-msg-bubble'), options, onSelect);
    scrollToBottom();
  }

  function parseSpecsFromText(text) {
    const lower = text.toLowerCase();
    
    // 1. Detect dimensions (e.g. 4x4x4, 10x10, 4 by 4)
    const dimRegex = /(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by)\s*(\d+(?:\.\d+)?))?/gi;
    const match = dimRegex.exec(lower);
    if (match) {
      const w = parseFloat(match[1]);
      const h = parseFloat(match[2]);
      const d = match[3] ? parseFloat(match[3]) : Math.min(w, h);
      currentBoxSpecs.width = w;
      currentBoxSpecs.height = h;
      currentBoxSpecs.depth = d;
      console.log(`📏 Dynamic Specs - Dimensions: ${w}x${h}x${d}`);
    }

    // 2. Detect color preferences
    const colors = {
      white: '#ffffff',
      black: '#1a1a1a',
      blue: '#2563eb',
      green: '#16a34a',
      red: '#dc2626',
      pink: '#db2777',
      yellow: '#facc15',
      purple: '#9333ea',
      orange: '#ea580c',
      grey: '#4b5563',
      gray: '#4b5563'
    };
    
    let colorDetected = false;
    for (const [colorName, colorHex] of Object.entries(colors)) {
      if (lower.includes(colorName)) {
        currentBoxSpecs.color = colorHex;
        colorDetected = true;
        console.log(`🎨 Dynamic Specs - Color: ${colorName} (${colorHex})`);
        break;
      }
    }
    
    if (!colorDetected && (lower.includes('printed') || lower.includes('custom') || lower.includes('color'))) {
      currentBoxSpecs.color = '#ffffff';
      console.log(`🎨 Dynamic Specs - Color defaulted to white (#ffffff) for custom printed style.`);
    }

    // 3. Detect box types
    const boxTypes = ['pizza', 'sleeve', 'pouch', 'display', 'shoe', 'cosmetic', 'candle', 'mailer', 'shipping', 'gift', 'product'];
    for (const type of boxTypes) {
      if (lower.includes(type)) {
        const capitalized = type.charAt(0).toUpperCase() + type.slice(1) + ' Box';
        currentBoxSpecs.boxType = capitalized;
        console.log(`📦 Dynamic Specs - Box Type: ${capitalized}`);
        break;
      }
    }
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = SERVER + '/widget.css';
  document.head.appendChild(link);

  const ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18v-5a8 8 0 0 1 16 0v5"/><path d="M18 16a3 3 0 0 1-3 3h-2v-4h2a3 3 0 0 1 3 1zM6 16a3 3 0 0 0 3 3h2v-4H9a3 3 0 0 0-3 1z"/></svg>'
  };

  const widget = document.createElement('div');
  widget.id = 'gemini-chatbot-widget';
  widget.innerHTML = `
    <button class="cb-toggle-btn" id="cb-toggle" aria-label="Open chat">
      ${ICONS.chat}
    </button>
    <div class="cb-window" id="cb-window">
      <div class="cb-header" style="display: flex; align-items: center;">
        <div class="cb-header-avatar">${ICONS.bot}</div>
        <div class="cb-header-info">
          <div class="cb-header-title">AI Assistant</div>
          <div class="cb-header-status">Online</div>
        </div>
        <button class="cb-header-voice" id="cb-header-voice" title="Toggle Voice Mode" style="background:rgba(255,255,255,0.08); border:none; width:28px; height:28px; border-radius:50%; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:auto; margin-right:4px; outline:none; transition:background 0.2s, color 0.2s;">
          ${ICONS.headset}
        </button>
        <button class="cb-header-cta" id="cb-header-cta" style="background:#ffffff; color:#4f46e5; border:none; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:700; cursor:pointer; margin-right:8px; display:inline-block; outline:none; transition:opacity 0.2s; white-space:nowrap;">Quick Quote</button>
        <button class="cb-close-btn" id="cb-close-btn" aria-label="Close chat" style="margin-left:0;">${ICONS.close}</button>
      </div>
      <div class="cb-messages" id="cb-messages"></div>
      <div id="cb-upload-area"></div>
      <div class="cb-input-area">
        <div class="cb-input-row">
          <button class="cb-input-btn" id="cb-upload-btn" title="Upload logo">${ICONS.upload}</button>
          <button class="cb-input-btn" id="cb-mic-btn" title="Speak message">${ICONS.mic}</button>
          <textarea id="cb-input" placeholder="Type your message..." rows="1"></textarea>
          <button class="cb-input-btn cb-send-btn" id="cb-send-btn" title="Send" disabled>${ICONS.send}</button>
        </div>
        <input type="file" id="cb-file-input" accept="image/*" />
      </div>
      <div class="cb-powered">Powered by <a href="https://achivex.com/" target="_blank" rel="noopener">AchiveX</a></div>
    </div>
  `;
  document.body.appendChild(widget);

  const toggleBtn = document.getElementById('cb-toggle');
  const chatWindow = document.getElementById('cb-window');
  const closeBtn = document.getElementById('cb-close-btn');
  const headerCta = document.getElementById('cb-header-cta');
  const messagesEl = document.getElementById('cb-messages');
  const inputEl = document.getElementById('cb-input');
  const sendBtn = document.getElementById('cb-send-btn');
  const uploadBtn = document.getElementById('cb-upload-btn');
  const fileInput = document.getElementById('cb-file-input');
  const uploadArea = document.getElementById('cb-upload-area');

  const headerVoice = document.getElementById('cb-header-voice');

  headerCta.addEventListener('click', () => {
    showLeadForm();
  });

  headerVoice.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert("Speech-to-Text is not supported in this browser. Please try Chrome, Edge, or Safari!");
      return;
    }
    
    voiceMode = !voiceMode;
    if (voiceMode) {
      headerVoice.style.background = 'var(--cb-success)';
      headerVoice.style.color = '#fff';
      addBotMessage("**Voice Mode Enabled.** I am listening. Speak your request now, and I will reply aloud in real-time.");
      
      setTimeout(() => {
        if (recognition && !isListening) recognition.start();
      }, 1500);
    } else {
      headerVoice.style.background = 'rgba(255,255,255,0.08)';
      headerVoice.style.color = '#fff';
      addBotMessage("**Voice Mode Disabled.**");
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognition && isListening) {
        recognition.stop();
      }
    }
  });

  toggleBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    chatWindow.classList.toggle('cb-visible', isOpen);
    toggleBtn.classList.toggle('cb-open', isOpen);
    toggleBtn.innerHTML = isOpen ? ICONS.close : ICONS.chat;
    if (isOpen && messagesEl.children.length === 0) showWelcome();
    if (isOpen) inputEl.focus();
  });

  closeBtn.addEventListener('click', () => {
    isOpen = false;
    chatWindow.classList.remove('cb-visible');
    toggleBtn.classList.remove('cb-open');
    toggleBtn.innerHTML = ICONS.chat;
    if (stopCurrentAudio) {
      stopCurrentAudio();
    }
  });

  const micBtn = document.getElementById('cb-mic-btn');
  let isListening = false;
  let recognition = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = document.documentElement.lang || navigator.language || 'en-US';

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('cb-mic-active');
      micBtn.style.color = '#ef4444';
      inputEl.placeholder = 'Listening... Speak now...';
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('cb-mic-active');
      micBtn.style.color = '';
      inputEl.placeholder = 'Type your message...';
      
      if ((voiceMode || speakNextReply) && isOpen) {
        // Wait 500ms to ensure the onresult transcription has fully populated the textarea
        setTimeout(() => {
          if (inputEl.value.trim()) {
            sendMessage();
          }
        }, 500);
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      inputEl.value = (inputEl.value + ' ' + transcript).trim();
      updateSendButtonStatus();
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
      
      // Mark that this input came from speech/voice
      speakNextReply = true;
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
    };

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  } else {
    micBtn.addEventListener('click', () => {
      alert("Speech-to-Text is not fully supported in this browser. Please try Chrome, Edge, or Safari for the best voice experience!");
    });
  }

  function showIntakeForm(message, onComplete) {
    const formId = 'intake-form-' + Date.now();
    const msg = document.createElement('div');
    msg.className = 'cb-msg cb-msg-bot';
    msg.innerHTML = `
      <div class="cb-msg-avatar">${ICONS.bot}</div>
      <div class="cb-msg-bubble" style="width:100%;">
        <p style="margin:0 0 12px 0;font-size:13px;color:var(--cb-text);">${message || 'Please share your details so we can assist you further.'}</p>
        <form id="${formId}" style="display:flex;flex-direction:column;gap:8px;">
          <input type="text" name="name" placeholder="Full Name" required
            style="padding:9px 12px;border:1px solid var(--cb-border);border-radius:6px;font-size:13px;outline:none;background:#fff;color:#333;font-family:var(--cb-font);" />
          <input type="text" name="company" placeholder="Company Name"
            style="padding:9px 12px;border:1px solid var(--cb-border);border-radius:6px;font-size:13px;outline:none;background:#fff;color:#333;font-family:var(--cb-font);" />
          <input type="email" name="email" placeholder="Email Address" required
            style="padding:9px 12px;border:1px solid var(--cb-border);border-radius:6px;font-size:13px;outline:none;background:#fff;color:#333;font-family:var(--cb-font);" />
          <input type="tel" name="phone" placeholder="Phone Number"
            style="padding:9px 12px;border:1px solid var(--cb-border);border-radius:6px;font-size:13px;outline:none;background:#fff;color:#333;font-family:var(--cb-font);" />
          <select name="businessType" id="${formId}-btype"
            style="padding:9px 12px;border:1px solid var(--cb-border);border-radius:6px;font-size:13px;outline:none;background:#fff;color:#333;font-family:var(--cb-font);appearance:auto;">
            <option value="" disabled selected>Select your industry</option>
            <option value="E-commerce / Online Store">E-commerce / Online Store</option>
            <option value="Food & Beverage">Food & Beverage</option>
            <option value="Cosmetics & Beauty">Cosmetics & Beauty</option>
            <option value="Health & Wellness">Health & Wellness</option>
            <option value="Fashion & Apparel">Fashion & Apparel</option>
            <option value="Electronics & Tech">Electronics & Tech</option>
            <option value="Gifts & Events">Gifts & Events</option>
            <option value="Cannabis / CBD">Cannabis / CBD</option>
            <option value="Restaurant / Takeaway">Restaurant / Takeaway</option>
            <option value="Other">Other</option>
          </select>
          <input type="text" name="businessTypeOther" id="${formId}-other" placeholder="Please specify your industry"
            style="padding:9px 12px;border:1px solid var(--cb-border);border-radius:6px;font-size:13px;outline:none;background:#fff;color:#333;font-family:var(--cb-font);display:none;" />
          <button type="submit"
            style="background:var(--cb-primary);color:#fff;border:none;padding:10px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;font-family:var(--cb-font);margin-top:2px;">
            Continue
          </button>
        </form>
      </div>`;
    messagesEl.appendChild(msg);
    scrollToBottom();

    // Show/hide "Other" text input based on dropdown
    const btypeSelect = document.getElementById(formId + '-btype');
    const otherInput = document.getElementById(formId + '-other');
    btypeSelect.addEventListener('change', () => {
      if (btypeSelect.value === 'Other') {
        otherInput.style.display = 'block';
        otherInput.required = true;
        otherInput.focus();
      } else {
        otherInput.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
      }
    });

    document.getElementById(formId).addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;

      const leadData = {
        name: (form.querySelector('[name="name"]').value || '').trim(),
        company: (form.querySelector('[name="company"]').value || '').trim(),
        email: (form.querySelector('[name="email"]').value || '').trim(),
        phone: (form.querySelector('[name="phone"]').value || '').trim(),
        businessType: form.businessType.value === 'Other'
          ? (form.businessTypeOther.value.trim() || 'Other')
          : (form.businessType.value || ''),
        sessionId: SESSION_ID
      };

      // Immediately update UI — don't wait for server
      leadCaptured = true;
      visitor.name = leadData.name;
      visitor.email = leadData.email;
      visitor.company = leadData.company;
      visitor.businessType = leadData.businessType;
      visitor.leadCaptured = true;
      saveVisitor();

      msg.querySelector('.cb-msg-bubble').innerHTML = `
        <div style="text-align:center;padding:6px 0;">
          <div style="font-size:18px;color:var(--cb-success);font-weight:700;">&#10003;</div>
          <p style="margin:6px 0 0 0;font-weight:600;font-size:13px;color:var(--cb-text);">Thank you, ${leadData.name}.</p>
          <p style="margin:4px 0 0 0;font-size:12px;color:var(--cb-text-muted);">Your details have been saved.</p>
        </div>`;

      // Continue the conversation immediately
      if (onComplete) {
        setTimeout(() => onComplete(leadData), 600);
      } else {
        setTimeout(() => addBotMessage("Perfect. Now, how can I help you today? Just tell me what you're looking for — box type, dimensions, pricing — anything at all."), 600);
      }

      // Save to server in background (fire-and-forget)
      fetch(SERVER + '/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      }).catch(err => console.warn('Lead save background error:', err));
    });
  }

  function showWelcome() {
    const isReturning = visitor.name && visitor.leadCaptured;
    if (isReturning) {
      addBotMessage(`Welcome back, ${visitor.name}. Good to see you again.\n\nHow can I help you today?`, { showWelcomeSelector: true });
    } else {
      addBotMessage(`Hello, and welcome. I'm your Custom Packaging Assistant.\n\nHow can I help you today?`, { showWelcomeSelector: true });
    }
  }

  // ─── Image Lightbox (click-to-expand) ─────────────────────────────────────
  function openLightbox(src) {
    // Prevent duplicate overlays
    const existing = document.getElementById('cb-lightbox');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cb-lightbox';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:1000000;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.25s ease;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'position:absolute;top:16px;right:20px;background:none;border:none;color:#fff;font-size:32px;cursor:pointer;font-weight:300;line-height:1;opacity:0.7;transition:opacity 0.2s;';
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.7');

    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Packaging Mockup';
    img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5);object-fit:contain;cursor:default;';
    img.addEventListener('click', (e) => e.stopPropagation());

    overlay.appendChild(closeBtn);
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    // Close handlers
    const closeLightbox = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    };
    overlay.addEventListener('click', closeLightbox);
    closeBtn.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        closeLightbox();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  function formatMarkdown(text) {
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^[-•]\s+(.+)/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul><br><ul>/g, '');
    return html;
  }

  // Convert formatted text to natural spoken language for TTS
  function cleanTextForSpeech(text) {
    let t = text;

    // Strip HTML tags
    t = t.replace(/<\/?[^>]+(>|$)/g, '');

    // Strip markdown bold/italic/code
    t = t.replace(/\*\*(.+?)\*\*/g, '$1');
    t = t.replace(/\*(.+?)\*/g, '$1');
    t = t.replace(/`(.+?)`/g, '$1');

    // Convert bullet/list lines into flowing sentences
    // "• Small (4x4x4): £0.40/unit" → "Small, 4 by 4 by 4, around 40p per unit"
    t = t.replace(/^[\s]*[-•]\s*/gm, '. ');

    // Convert dimensions: "4x4x4" → "4 by 4 by 4"
    t = t.replace(/(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/g, '$1 by $2 by $3');
    t = t.replace(/(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/g, '$1 by $2');

    // Convert prices: "£0.40" → "40p", "£1.20" → "1 pound 20", "£39" → "39 pounds"
    t = t.replace(/£0\.(\d{2})/g, (_, cents) => `${parseInt(cents)} pence`);
    t = t.replace(/£(\d+)\.(\d{2})/g, (_, pounds, pence) => {
      const p = parseInt(pence);
      return p > 0 ? `${pounds} pounds ${p}` : `${pounds} pounds`;
    });
    t = t.replace(/£(\d+)/g, '$1 pounds');

    // Convert "/unit" → "per unit"
    t = t.replace(/\/unit/gi, ' per unit');
    t = t.replace(/\/month/gi, ' per month');

    // Convert price ranges: "£X-£Y" or "X-Y" with pounds already converted
    t = t.replace(/(\d+\s*pounds?\s*\d*)\s*[-–—to]+\s*(\d+\s*pounds?\s*\d*)/gi, '$1 to $2');
    t = t.replace(/(\d+\s*pence)\s*[-–—to]+\s*(\d+\s*pence)/gi, '$1 to $2');

    // Convert remaining dashes between numbers: "500-1000" → "500 to 1000"
    t = t.replace(/(\d+)\s*[-–]\s*(\d+)/g, '$1 to $2');

    // Remove colons after labels (sounds weird spoken): "Material: Kraft" → "Material, Kraft"
    t = t.replace(/(\w)\s*:\s*/g, '$1, ');

    // Convert "+" to "plus" in relevant context
    t = t.replace(/(\d)\+/g, '$1 plus');

    // Clean up multiple spaces and dots
    t = t.replace(/\.\s*\.\s*/g, '. ');
    t = t.replace(/\s{2,}/g, ' ');

    // Remove emoji
    t = t.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '');

    // Clean up orphan punctuation
    t = t.replace(/^\s*[.,;]\s*/gm, '');
    t = t.replace(/\s+([.,;!?])/g, '$1');

    return t.trim();
  }

  function draw3DBox(canvas, logoImg, productType) {
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 10;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dark radial gradient background
    const bgGrad = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, 160);
    bgGrad.addColorStop(0, '#1e1b4b');
    bgGrad.addColorStop(1, '#0f0f1c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Box dimensions scaled dynamically to match user's custom specs
    const maxSpec = Math.max(currentBoxSpecs.width, currentBoxSpecs.height, currentBoxSpecs.depth);
    const scale = 95 / maxSpec;
    
    const w = currentBoxSpecs.width * scale;
    const h = currentBoxSpecs.height * scale;
    const d = currentBoxSpecs.depth * scale;
    
    function project(x, y, z) {
      const cos30 = 0.866;
      const sin30 = 0.5;
      return {
        px: cx + (x - z) * cos30,
        py: cy - y + (x + z) * sin30
      };
    }
    
    const v000 = project(-w/2, 0, -d/2);
    const v100 = project(w/2, 0, -d/2);
    const v101 = project(w/2, 0, d/2);
    const v001 = project(-w/2, 0, d/2);
    
    const v010 = project(-w/2, h, -d/2);
    const v110 = project(w/2, h, -d/2);
    const v111 = project(w/2, h, d/2);
    const v011 = project(-w/2, h, d/2);
    
    // Custom shading helper for any hex color
    function shadeColor(hex, percent) {
      let c = hex.replace(/^\s*#|\s*$/g, '');
      if (c.length === 3) c = c.replace(/(.)/g, '$1$1');
      let r = parseInt(c.substr(0, 2), 16);
      let g = parseInt(c.substr(2, 2), 16);
      let b = parseInt(c.substr(4, 2), 16);
      
      r = Math.round(r * percent);
      g = Math.round(g * percent);
      b = Math.round(b * percent);
      
      return `#${(r < 256 ? r : 255).toString(16).padStart(2, '0')}${(g < 256 ? g : 255).toString(16).padStart(2, '0')}${(b < 256 ? b : 255).toString(16).padStart(2, '0')}`;
    }

    let cardTop, cardLeft, cardRight, strokeColor;

    if (currentBoxSpecs.color === 'kraft') {
      cardTop = '#d2a679';
      cardLeft = '#c3976a';
      cardRight = '#b4885b';
      strokeColor = '#9a6e43';
    } else {
      const baseColor = currentBoxSpecs.color;
      cardTop = baseColor;
      cardLeft = shadeColor(baseColor, 0.85);
      cardRight = shadeColor(baseColor, 0.75);
      strokeColor = shadeColor(baseColor, 0.6);
    }
    
    // Left Face
    ctx.fillStyle = cardLeft;
    ctx.beginPath();
    ctx.moveTo(v000.px, v000.py);
    ctx.lineTo(v010.px, v010.py);
    ctx.lineTo(v011.px, v011.py);
    ctx.lineTo(v001.px, v001.py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Right Face
    ctx.fillStyle = cardRight;
    ctx.beginPath();
    ctx.moveTo(v001.px, v001.py);
    ctx.lineTo(v011.px, v011.py);
    ctx.lineTo(v111.px, v111.py);
    ctx.lineTo(v101.px, v101.py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Top Face
    ctx.fillStyle = cardTop;
    ctx.beginPath();
    ctx.moveTo(v010.px, v010.py);
    ctx.lineTo(v110.px, v110.py);
    ctx.lineTo(v111.px, v111.py);
    ctx.lineTo(v011.px, v011.py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Project Logo onto Top Face
    ctx.save();
    const ox = v010.px;
    const oy = v010.py;
    const ux = v110.px - v010.px;
    const uy = v110.py - v010.py;
    const vx = v011.px - v010.px;
    const vy = v011.py - v010.py;
    
    ctx.beginPath();
    ctx.moveTo(v010.px, v010.py);
    ctx.lineTo(v110.px, v110.py);
    ctx.lineTo(v111.px, v111.py);
    ctx.lineTo(v011.px, v011.py);
    ctx.closePath();
    ctx.clip();
    
    const pad = 0.2; // 20% padding
    ctx.transform(ux * (1 - pad * 2), uy * (1 - pad * 2), vx * (1 - pad * 2), vy * (1 - pad * 2), ox + ux * pad + vx * pad, oy + uy * pad + vy * pad);
    
    ctx.drawImage(logoImg, 0, 0, 1, 1);
    ctx.restore();

    // Text Label showing specs
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const specStr = `${productType} (${currentBoxSpecs.width}"x${currentBoxSpecs.height}"x${currentBoxSpecs.depth}")`;
    ctx.fillText(specStr, canvas.width / 2, 24);
  }

  function addBotMessage(text, extras) {
    const msg = document.createElement('div');
    msg.className = 'cb-msg cb-msg-bot';
    let content = `
      <div class="cb-msg-avatar">${ICONS.bot}</div>
      <div class="cb-msg-bubble" style="position: relative; padding-right: 28px;">
        ${formatMarkdown(text)}
        <button class="cb-speaker-btn" title="Speak message" style="position: absolute; top: 6px; right: 6px; background: none; border: none; color: var(--cb-text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.5; transition: opacity 0.2s, color 0.2s; outline: none; border-radius: 50%; width: 20px; height: 20px;">
          ${ICONS.speaker}
        </button>
      </div>`;
    msg.innerHTML = content;
    messagesEl.appendChild(msg);

    const speakerBtn = msg.querySelector('.cb-speaker-btn');
    let activeAudio = null;

    function stopSpeaking() {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (speakerBtn) {
        speakerBtn.style.color = 'var(--cb-text-muted)';
        speakerBtn.querySelector('svg').style.stroke = 'var(--cb-text-muted)';
      }
    }

    stopCurrentAudio = stopSpeaking;

    function speakText() {
      stopSpeaking();
      
      // Convert structured/formatted text into natural spoken language
      const cleanText = cleanTextForSpeech(text);
      const lang = document.documentElement.lang || navigator.language || 'en-US';
      
      if (speakerBtn) {
        speakerBtn.style.color = 'var(--cb-success)';
        speakerBtn.querySelector('svg').style.stroke = 'var(--cb-success)';
      }
      
      // Split into sentence segments (max 180 characters per request for Translate TTS)
      const chunks = [];
      const rawChunks = cleanText.split(/([.!?。！？\n])+/);
      let currentChunk = "";
      
      for (let i = 0; i < rawChunks.length; i++) {
        const part = rawChunks[i];
        if (!part) continue;
        if ((currentChunk + part).length > 170) {
          if (currentChunk.trim()) chunks.push(currentChunk.trim());
          currentChunk = part;
        } else {
          currentChunk += part;
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      
      let chunkIndex = 0;
      
      function playNext() {
        if (!isOpen) {
          stopSpeaking();
          return;
        }
        
        if (chunkIndex >= chunks.length) {
          stopSpeaking();
          if (voiceMode && isOpen && recognition && !isListening) {
            recognition.start();
          }
          return;
        }
        
        const chunkText = chunks[chunkIndex++];
        
        fetch(`${SERVER}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunkText, lang: lang.split('-')[0] })
        })
        .then(res => {
          if (!res.ok) throw new Error('Server TTS failed');
          return res.blob();
        })
        .then(blob => {
          if (!isOpen) return;
          const audioUrl = URL.createObjectURL(blob);
          activeAudio = new Audio(audioUrl);
          activeAudio.onended = playNext;
          activeAudio.onerror = () => {
            fallbackNativeTTS(chunks.slice(chunkIndex - 1).join(". "), lang);
          };
          activeAudio.play().catch(err => {
            console.warn("Audio play failed, falling back to native TTS:", err);
            fallbackNativeTTS(chunks.slice(chunkIndex - 1).join(". "), lang);
          });
        })
        .catch(err => {
          console.warn("API TTS request failed, falling back to native TTS:", err);
          fallbackNativeTTS(chunks.slice(chunkIndex - 1).join(". "), lang);
        });
      }
      
      function fallbackNativeTTS(remainingText, langCode) {
        if (!window.speechSynthesis) return;
        
        const utterance = new SpeechSynthesisUtterance(remainingText);
        utterance.lang = langCode;
        if (window.speechSynthesis.getVoices) {
          const voices = window.speechSynthesis.getVoices();
          const matchingVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
          if (matchingVoice) utterance.voice = matchingVoice;
        }
        
        utterance.onstart = () => {
          if (speakerBtn) {
            speakerBtn.style.color = 'var(--cb-success)';
            speakerBtn.querySelector('svg').style.stroke = 'var(--cb-success)';
          }
        };
        
        utterance.onend = () => {
          if (speakerBtn) {
            speakerBtn.style.color = 'var(--cb-text-muted)';
            speakerBtn.querySelector('svg').style.stroke = 'var(--cb-text-muted)';
          }
          if (voiceMode && isOpen && recognition && !isListening) {
            recognition.start();
          }
        };
        
        utterance.onerror = () => {
          if (speakerBtn) {
            speakerBtn.style.color = 'var(--cb-text-muted)';
            speakerBtn.querySelector('svg').style.stroke = 'var(--cb-text-muted)';
          }
          if (voiceMode && isOpen && recognition && !isListening) {
            recognition.start();
          }
        };
        
        window.speechSynthesis.speak(utterance);
      }
      
      if (chunks.length > 0) {
        playNext();
      } else {
        if (voiceMode && isOpen && recognition && !isListening) {
          recognition.start();
        }
      }
    }

    if (speakerBtn) {
      speakerBtn.querySelector('svg').style.width = '12px';
      speakerBtn.querySelector('svg').style.height = '12px';
      speakerBtn.addEventListener('mouseenter', () => { speakerBtn.style.opacity = '1'; });
      speakerBtn.addEventListener('mouseleave', () => { speakerBtn.style.opacity = '0.5'; });
      speakerBtn.addEventListener('click', () => {
        if (activeAudio || (window.speechSynthesis && window.speechSynthesis.speaking)) {
          stopSpeaking();
        } else {
          speakText();
        }
      });
    }

    if (voiceMode || speakNextReply) {
      speakNextReply = false;
      setTimeout(() => {
        speakText();
      }, 400);
    }

    if (extras && extras.logoUrl) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 200;
      canvas.style.width = '100%';
      canvas.style.borderRadius = '10px';
      canvas.style.marginTop = '10px';
      canvas.style.border = '1px solid var(--cb-border)';
      canvas.style.display = 'block';
      msg.querySelector('.cb-msg-bubble').appendChild(canvas);
      
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.onload = () => {
        draw3DBox(canvas, logoImg, extras.productType || currentBoxSpecs.boxType || 'Custom Box');
      };
      logoImg.src = SERVER + extras.logoUrl;
    }

    if (extras && extras.imageUrl) {
      const img = document.createElement('img');
      img.src = SERVER + extras.imageUrl;
      img.alt = 'AI Generated Mockup';
      img.style.width = '100%';
      img.style.borderRadius = '10px';
      img.style.marginTop = '10px';
      img.style.border = '1px solid var(--cb-border)';
      img.style.display = 'block';
      img.style.cursor = 'pointer';
      img.title = 'Click to expand';
      img.addEventListener('click', () => openLightbox(img.src));
      msg.querySelector('.cb-msg-bubble').appendChild(img);
    }

    if (extras && (extras.imageUrl || extras.logoUrl)) {
      const bubble = msg.querySelector('.cb-msg-bubble');
      if (!bubble.querySelector('.cb-mockup-attribution')) {
        const attribution = document.createElement('div');
        attribution.className = 'cb-mockup-attribution';
        attribution.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 11px; color: var(--cb-text-muted); font-weight: 500;';
        
        const achivexLogo = document.createElement('img');
        achivexLogo.src = SERVER + '/achivex_logo.png';
        achivexLogo.alt = 'AchiveX Logo';
        achivexLogo.style.cssText = 'height: 14px; width: auto; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));';
        
        const attributionText = document.createElement('span');
        attributionText.innerHTML = 'Developed by <a href="https://www.achivex.com" target="_blank" rel="noopener" style="color: var(--cb-primary); text-decoration: none; font-weight: 600; transition: color 0.2s;">AchiveX LLC</a>';
        
        const link = attributionText.querySelector('a');
        link.addEventListener('mouseenter', () => {
          link.style.color = 'var(--cb-primary-hover, #6366f1)';
          link.style.textDecoration = 'underline';
        });
        link.style.cursor = 'pointer';
        link.addEventListener('mouseleave', () => {
          link.style.color = 'var(--cb-primary)';
          link.style.textDecoration = 'none';
        });

        attribution.appendChild(achivexLogo);
        attribution.appendChild(attributionText);
        bubble.appendChild(attribution);
      }
    }

    if (extras && extras.showProductSelector) {
      // When logo is uploaded, start the guided wizard instead of old product chips
      setTimeout(() => startMockupWizard(), 600);
    }

    if (extras && extras.showPostMockupActions) {
      const selector = document.createElement('div');
      selector.className = 'cb-product-selector';
      selector.style.marginTop = '12px';

      const actions = [
        { label: 'Get a Quote', action: 'quote' },
        { label: 'Try Different Style', action: 'retry' },
        { label: 'Talk to Specialist', action: 'specialist' }
      ];

      actions.forEach(act => {
        const chip = document.createElement('button');
        chip.className = 'cb-product-chip';
        chip.style.margin = '4px';
        chip.textContent = act.label;
        chip.addEventListener('click', () => {
          selector.querySelectorAll('button').forEach(b => b.disabled = true);
          addUserMessage(act.label);

          if (act.action === 'quote') {
            if (!leadCaptured) {
              showIntakeForm('To prepare your quote, we just need a few details:', (lead) => {
                const firstName = lead.name ? lead.name.split(' ')[0] : 'there';
                addBotMessage(`Thanks, ${firstName}. Our team will prepare a detailed quote and email it to you shortly.`);
              });
            } else {
              const firstName = visitor.name ? visitor.name.split(' ')[0] : 'there';
              addBotMessage(`Thanks, ${firstName}. I've sent this request to our team. They will prepare a detailed quote and email it to you shortly.`);
              fetch(SERVER + '/api/submit-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: visitor.name || '',
                  email: visitor.email || '',
                  company: visitor.company || '',
                  businessType: visitor.businessType || '',
                  sessionId: SESSION_ID
                })
              }).catch(err => console.warn(err));
            }
          } else if (act.action === 'retry') {
            startMockupWizard();
          } else if (act.action === 'specialist') {
            if (!leadCaptured) {
              showIntakeForm('To connect you with a specialist, please share your details:', (lead) => {
                const firstName = lead.name ? lead.name.split(' ')[0] : 'there';
                addBotMessage(`Thanks, ${firstName}. Our packaging specialist will reach out to you shortly. In the meantime, feel free to ask me anything.`);
              });
            } else {
              const firstName = visitor.name ? visitor.name.split(' ')[0] : 'there';
              addBotMessage(`Got it, ${firstName}. I've notified our specialist team. They will reach out to you shortly.`);
              fetch(SERVER + '/api/submit-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: visitor.name || '',
                  email: visitor.email || '',
                  company: visitor.company || '',
                  businessType: visitor.businessType || '',
                  sessionId: SESSION_ID
                })
              }).catch(err => console.warn(err));
            }
          }
        });
        selector.appendChild(chip);
      });
      msg.querySelector('.cb-msg-bubble').appendChild(selector);
    }

    if (extras && extras.showWelcomeSelector) {
      const selector = document.createElement('div');
      selector.className = 'cb-product-selector';
      selector.style.marginTop = '12px';
      
      const options = [
        { label: 'Get estimated quote', action: 'quote' },
        { label: 'Design a box mockup', action: 'mockup' },
        { label: 'Speak with specialist', action: 'specialist' },
        { label: 'Check order status', action: 'status' }
      ];
      
      options.forEach(opt => {
        const chip = document.createElement('button');
        chip.className = 'cb-product-chip';
        chip.style.margin = '4px';
        chip.textContent = opt.label;
        chip.addEventListener('click', () => {
          addUserMessage(opt.label);
          
          if (opt.action === 'quote') {
            showTyping();
            setTimeout(() => {
              hideTyping();
              if (!leadCaptured) {
                showIntakeForm('To get you an accurate quote, please share a few details:', (lead) => {
                  const firstName = lead.name ? lead.name.split(' ')[0] : 'there';
                  addBotMessage(`Got it, ${firstName}. Now just tell me the box style and size you need, and I'll give you a quick estimate.`);
                });
              } else {
                const firstName = visitor.name ? visitor.name.split(' ')[0] : 'there';
                addBotMessage(`Sure thing, ${firstName}. Just tell me the box style and dimensions you need, and I'll give you a quick estimate.`);
              }
            }, 600);
          } else if (opt.action === 'mockup') {
            showTyping();
            setTimeout(() => {
              hideTyping();
              addBotMessage("To get started, click the **upload button** below to attach your brand logo. I'll then guide you through choosing your box type, material, print style, and dimensions.");
            }, 600);
          } else if (opt.action === 'specialist') {
            showTyping();
            setTimeout(() => {
              hideTyping();
              if (!leadCaptured) {
                showIntakeForm('To connect you with a specialist, please share your details:', (lead) => {
                  const firstName = lead.name ? lead.name.split(' ')[0] : 'there';
                  addBotMessage(`Thanks, ${firstName}. Our packaging specialist will reach out to you shortly. Feel free to continue exploring.`);
                });
              } else {
                const firstName = visitor.name ? visitor.name.split(' ')[0] : 'there';
                addBotMessage(`Got it, ${firstName}. I've notified our specialist team. They will reach out to you shortly.`);
                fetch(SERVER + '/api/submit-lead', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: visitor.name || '',
                    email: visitor.email || '',
                    company: visitor.company || '',
                    businessType: visitor.businessType || '',
                    sessionId: SESSION_ID
                  })
                }).catch(err => console.warn(err));
              }
            }, 600);
          } else if (opt.action === 'status') {
            showTyping();
            setTimeout(() => {
              hideTyping();
              addBotMessage("To find your order status, please share your **Order ID** or the email address associated with your order, and I'll lookup your details!");
            }, 600);
          }
          
          selector.querySelectorAll('button').forEach(btn => btn.disabled = true);
        });
        selector.appendChild(chip);
      });
      
      msg.querySelector('.cb-msg-bubble').appendChild(selector);
    }

    scrollToBottom();
  }

  function showLeadForm(customMessage) {
    const msg = document.createElement('div');
    msg.className = 'cb-msg cb-msg-bot';
    
    const formId = 'lead-form-' + Date.now();
    const messageText = customMessage || "To get your final accurate quote and connect with our packaging specialists, please fill out your details below:";
    
    msg.innerHTML = `
      <div class="cb-msg-avatar">${ICONS.bot}</div>
      <div class="cb-msg-bubble">
        <p style="margin-top:0;margin-bottom:12px;font-weight:500;">${messageText}</p>
        <form id="${formId}" style="display:flex; flex-direction:column; gap:8px; background:rgba(0,0,0,0.02); border:1px solid var(--cb-border); padding:12px; border-radius:8px;">
          <input type="text" name="name" placeholder="Your Name" required style="padding:8px 10px; border:1px solid var(--cb-border); border-radius:4px; font-size:13px; outline:none; background:#ffffff; color:#333333;" />
          <input type="email" name="email" placeholder="Email Address" required style="padding:8px 10px; border:1px solid var(--cb-border); border-radius:4px; font-size:13px; outline:none; background:#ffffff; color:#333333;" />
          <input type="tel" name="phone" placeholder="Phone Number (Optional)" style="padding:8px 10px; border:1px solid var(--cb-border); border-radius:4px; font-size:13px; outline:none; background:#ffffff; color:#333333;" />
          <button type="submit" style="background:var(--cb-primary); color:#ffffff; border:none; padding:8px; border-radius:4px; font-weight:600; cursor:pointer; font-size:13px; transition:opacity 0.2s;">Submit Details</button>
        </form>
      </div>
    `;
    
    messagesEl.appendChild(msg);
    scrollToBottom();
    
    const form = document.getElementById(formId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      const name = form.name.value;
      const email = form.email.value;
      const phone = form.phone.value;
      
      try {
        const resp = await fetch(SERVER + '/api/submit-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, sessionId: SESSION_ID })
        });
        const data = await resp.json();
        if (data.success) {
          msg.querySelector('.cb-msg-bubble').innerHTML = `
            <div style="text-align:center; padding:8px 0;">
              <span style="font-size:24px; color:#10b981;">✓</span>
              <p style="margin:8px 0 0 0; font-weight:600; color:var(--cb-text-main);">Details Submitted!</p>
              <p style="margin:4px 0 0 0; font-size:12px; color:var(--cb-text-muted);">Our packaging specialist team will contact you at <strong>${email}</strong> shortly.</p>
            </div>
          `;
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Details';
          alert('Failed to submit. Please try again.');
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Details';
        alert('Network error. Please try again.');
      }
    });
  }

  function addUserMessage(text, isHtml) {
    const msg = document.createElement('div');
    msg.className = 'cb-msg cb-msg-user';
    const content = isHtml ? text : formatMarkdown(text);
    msg.innerHTML = `<div class="cb-msg-bubble">${content}</div>`;
    messagesEl.appendChild(msg);
    scrollToBottom();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'cb-typing';
    el.id = 'cb-typing';
    el.innerHTML = `<div class="cb-msg-avatar" style="background:var(--cb-surface-2);display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;flex-shrink:0">${ICONS.bot}</div><div class="cb-typing-dots"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  // Use window global because we need to clear by ID
  function hideTyping() {
    const el = document.getElementById('cb-typing');
    if (el) el.remove();
  }

  function scrollToBottom() {
    setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 50);
  }

  function updateSendButtonStatus() {
    sendBtn.disabled = !inputEl.value.trim() && !uploadedLogo;
  }

  async function handleLogoUpload(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      uploadArea.innerHTML = `
        <div class="cb-upload-preview" style="margin: 8px 16px; display: flex; align-items: center; background: rgba(0,0,0,0.05); border: 1px solid var(--cb-border); border-radius: 8px; padding: 6px 12px; gap: 10px;">
          <img src="${ev.target.result}" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: #fff;" />
          <div class="cb-upload-preview-info" style="flex-grow: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <div class="cb-upload-preview-name" style="font-weight: 600; color: var(--cb-text-main);">${file.name || 'Pasted Image'}</div>
            <div class="cb-upload-preview-size" style="color: var(--cb-text-muted);">Uploading...</div>
          </div>
          <button class="cb-upload-remove" id="cb-remove-upload" style="background: none; border: none; color: var(--cb-text-muted); cursor: pointer; font-size: 14px; padding: 4px;">✕</button>
        </div>
      `;
      document.getElementById('cb-remove-upload').addEventListener('click', clearUpload);
      updateSendButtonStatus();
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const resp = await fetch(SERVER + '/api/upload-logo', { method: 'POST', body: formData });
      const data = await resp.json();

      if (data.success) {
        uploadedLogo = { filename: data.filename, url: data.url, file };
        const sizeLabel = uploadArea.querySelector('.cb-upload-preview-size');
        if (sizeLabel) sizeLabel.textContent = 'Ready ✓';
        updateSendButtonStatus();
      } else {
        addBotMessage('Failed to upload logo. Please try again.');
        clearUpload();
      }
    } catch (err) {
      addBotMessage('Upload failed. Please check your connection and try again.');
      clearUpload();
    }
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if ((!text && !uploadedLogo) || isProcessing) return;

    const logoToSend = uploadedLogo;
    
    // Clear input UI upload area immediately, but keep uploadedLogo set in memory
    // so product chips can still access the uploaded logo
    uploadArea.innerHTML = '';

    let userMessageHtml = '';
    if (logoToSend) {
      userMessageHtml = text 
        ? `${text}<br><img src="${SERVER + logoToSend.url}" style="max-width: 140px; max-height: 140px; object-fit: contain; border-radius: 8px; margin-top: 6px; border: 1px solid rgba(255,255,255,0.1); background: #fff; padding: 4px; display: block;" />`
        : `<img src="${SERVER + logoToSend.url}" style="max-width: 140px; max-height: 140px; object-fit: contain; border-radius: 8px; margin-top: 6px; border: 1px solid rgba(255,255,255,0.1); background: #fff; padding: 4px; display: block;" />`;
      addUserMessage(userMessageHtml, true);
    } else {
      addUserMessage(text, false);
    }

    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;
    isProcessing = true;

    showTyping();

    try {
      const resp = await fetch(SERVER + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text, 
          logoFilename: logoToSend ? logoToSend.filename : null,
          sessionId: SESSION_ID,
          visitorContext: {
            name: visitor.name || null,
            company: visitor.company || null,
            businessType: visitor.businessType || null
          }
        })
      });
      const data = await resp.json();
      hideTyping();
      if (data.error) {
        showLeadForm(`I'm currently preparing your custom packaging estimate. To get your accurate finalized quote and connect with our specialists, please provide your details below:`);
      } else {
        if (data.showProductSelector && data.logoUrl) {
          addBotMessage(data.reply, { showProductSelector: true });
        } else {
          addBotMessage(data.reply);
        }
      }
    } catch (err) {
      hideTyping();
      showLeadForm(`I'm currently preparing your custom packaging estimate. To get your accurate finalized quote and connect with our specialists, please provide your details below:`);
    }

    isProcessing = false;
    updateSendButtonStatus();
  }

  inputEl.addEventListener('input', () => {
    updateSendButtonStatus();
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        handleLogoUpload(file);
        e.preventDefault();
        break;
      }
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleLogoUpload(file);
    }
    fileInput.value = '';
  });

  function clearUpload() {
    uploadedLogo = null;
    uploadArea.innerHTML = '';
    updateSendButtonStatus();
  }

  // Old function kept for backward compatibility
  async function generateMockup(productType, chipEl) {
    if (!uploadedLogo || isProcessing) return;
    chipEl.classList.add('cb-loading');
    chipEl.textContent = 'Generating...';
    // Redirect to wizard
    startMockupWizard();
    chipEl.classList.remove('cb-loading');
    chipEl.textContent = productType;
  }

  // ─── Wizard-Powered Mockup Generation (single API call) ─────────────────
  async function generateMockupFromWizard() {
    if (!uploadedLogo || isProcessing) return;

    isProcessing = true;
    showTyping();

    try {
      const resp = await fetch(SERVER + '/api/generate-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoFilename: uploadedLogo.filename,
          productType: mockupWizard.boxType,
          sessionId: SESSION_ID,
          specs: {
            width: mockupWizard.width,
            height: mockupWizard.height,
            depth: mockupWizard.depth,
            color: currentBoxSpecs.color,
            material: mockupWizard.materialLabel,
            printStyle: mockupWizard.printStyle,
            printLabel: mockupWizard.printLabel
          }
        })
      });
      const data = await resp.json();
      hideTyping();

      if (data.success && data.imageUrl) {
        addBotMessage(
          `**Here's your ${mockupWizard.boxType} mockup.**\n\n` +
          `- ${mockupWizard.materialLabel} | ${mockupWizard.printLabel}\n` +
          `- ${mockupWizard.dimensionLabel}\n\n` +
          `This is an AI-generated preview. Our packaging specialists will create the final production-ready design.\n\n` +
          `Would you like to **get a quote** for this box or **try a different style**?`,
          { 
            logoUrl: data.logoUrl, 
            productType: mockupWizard.boxType,
            imageUrl: data.imageUrl,
            showPostMockupActions: true
          }
        );
      } else {
        addBotMessage(data.error || `Sorry, I couldn't generate the mockup right now. Please try again.`);
      }
    } catch (err) {
      hideTyping();
      addBotMessage('Failed to generate mockup. Please try again.');
    }

    isProcessing = false;
    resetWizard();
  }

})();
