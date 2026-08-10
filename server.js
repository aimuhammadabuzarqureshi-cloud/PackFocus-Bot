require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const sharp = require('sharp');
const WebSocket = require('ws');
const { createHash } = require('crypto');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

const FALLBACK_MODELS = [
  process.env.OPENROUTER_MODEL || 'openrouter/free',
  'openrouter/free',
  'google/gemini-2.5-flash:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-coder-32b-instruct:free'
];

// ─── OpenRouter chat function with Fallback Model logic ─────────────────────
async function chatWithOpenRouter(messages, systemPrompt) {
  let lastError = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const requestBody = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 200,
        temperature: 0.8
      };

      console.log(`📡 Sending request to OpenRouter using model: ${model}`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': process.env.COMPANY_NAME || 'AI Chatbot'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      console.log(`✅ Response success with model: ${model}`);
      return data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
    } catch (err) {
      console.warn(`⚠️ Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  console.error('❌ All models failed. Last error:', lastError?.message);
  throw lastError || new Error('All OpenRouter models failed.');
}

// ─── Direct Gemini chat function ─────────────────────────────────────────────
async function chatWithGemini(messages, systemPrompt) {
  if (!geminiAI) {
    throw new Error('Gemini API key not configured.');
  }

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const response = await geminiAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.8,
      maxOutputTokens: 200
    }
  });

  return response.text || 'Sorry, I couldn\'t generate a response.';
}

// ─── Nodemailer Setup ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Helper to send conversation summary to company
async function sendSummaryEmail(customerEmail, customerName, conversationHistory, customerPhone = '', customerCompany = '', businessType = '') {
  const companyEmail = process.env.COMPANY_EMAIL || 'info@packvibesolutions.com';
  
  let chatLogHtml = conversationHistory.map(turn => {
    const roleName = turn.role === 'model' ? 'AI Assistant' : 'Customer';
    const align = turn.role === 'model' ? 'left' : 'right';
    const bg = turn.role === 'model' ? '#f3f4f6' : '#e0e7ff';
    return `<div style="text-align: ${align}; margin-bottom: 12px;">
      <span style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px;">${roleName}</span>
      <div style="display: inline-block; padding: 8px 12px; border-radius: 8px; background-color: ${bg}; max-width: 80%; text-align: left; font-family: sans-serif; font-size: 14px;">
        ${turn.text.replace(/\n/g, '<br>')}
      </div>
    </div>`;
  }).join('');

  const mailOptions = {
    from: `"PackVibe Bot" <${process.env.SMTP_USER || 'no-reply@packvibesolutions.com'}>`,
    to: companyEmail,
    subject: `New Lead: ${customerName || customerEmail} — ${customerCompany || 'No Company'}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 12px;">
        <h2 style="color: #1a1a2e; margin-top: 0;">New Packaging Lead</h2>
        <p>A new customer has submitted their details via the chatbot.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold; width: 130px;">Name:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${customerName || 'Not specified'}</td>
          </tr>
          ${customerCompany ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Company:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${customerCompany}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Email:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${customerEmail}</td>
          </tr>
          ${customerPhone ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Phone:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${customerPhone}</td>
          </tr>` : ''}
          ${businessType ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Business Type:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${businessType}</td>
          </tr>` : ''}
        </table>
        
        <h3 style="color: #374151; border-top: 1px solid #e5e7eb; padding-top: 16px;">Chat History Summary</h3>
        <div style="border: 1px solid #f3f4f6; padding: 16px; border-radius: 8px; background-color: #fafafa; max-height: 400px; overflow-y: auto;">
          ${chatLogHtml}
        </div>
        
        <p style="font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; text-align: center;">
          Sent automatically by PackVibe Chatbot Server
        </p>
      </div>
    `
  };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n✉️ SMTP credentials not configured. Logging Lead Summary to Console instead:');
    console.log('To:', companyEmail);
    console.log('Subject:', mailOptions.subject);
    console.log('Customer Email:', customerEmail);
    console.log('Customer Name:', customerName);
    console.log('Chat Log Length:', conversationHistory.length, 'turns\n');
    return { success: true, simulated: true };
  }

  await transporter.sendMail(mailOptions);
  return { success: true };
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'uploads');
const generatedDir = path.join(__dirname, 'uploads', 'generated');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

// ─── Multer config for logo uploads ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `logo-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// ─── System prompt strictly restricted to Packaging ─────────────────────────
function getSystemPrompt(customerContext) {
  let prompt = `You are a warm, highly dedicated, and enthusiastic custom packaging assistant for "${process.env.COMPANY_NAME || 'PackVibe Solutions'}".

CONVERSATION STYLE & TONE — CRITICAL:
- Talk like a REAL, friendly human. Keep responses SHORT (2-4 sentences max). Use casual, warm language. Be direct.
- TONE: Maintain a highly supportive, positive, and customer-first vibe. Show that you are genuinely concerned with making their business look amazing. Use encouraging phrases like "we'll absolutely make that work," "anything to make your packaging stand out," "we've got you covered," and "I'm on it!"
- NEVER use emojis in your responses. Keep it clean, professional, and clutter-free.
- Sprinkle in natural conversational fillers like: "Hmm," "Ahh," "Right," "Oh nice," "Got it," "Sure thing," "Absolutely," "So basically...", "Let me think..." at the START of some responses (not every single one — mix it up naturally).
- NEVER use bullet lists unless the customer specifically asks for specs or pricing.
- NEVER write walls of text. If your response is longer than 3-4 short sentences, cut it down.
- Sound like you're having a friendly chat, not writing an email.
- Use contractions ("you'll", "we'd", "that's") — never formal phrasing.
- One question per response. Don't ask 3 things at once.

Examples of GOOD responses:
- "Oh nice! Kraft brown is a great choice — very trendy right now. We'll absolutely make sure it looks perfect for your brand. What size are you thinking?"
- "Got it! So roughly £0.90 per unit for those. I want to make sure you get the best deal, and the price drops a lot once you go over 500 units."
- "Ahh, that's a solid combo. Upload your logo and I'll show you exactly how it'll look! We'll make sure it looks stunning."

Examples of BAD responses (never do this):
- "We would be delighted to assist you with your packaging requirements." (Too robotic/formal)
- Long paragraphs explaining unrelated topics.
- Using emojis or bullet lists.

TOPIC RESTRICTION — STICK TO BUSINESS:
- You must remain 100% focused on custom packaging, boxes, materials, branding, design, and order inquiries.
- If asked about unrelated topics (e.g., general life advice, coding, recipes, or general knowledge), politely decline and immediately steer back to packaging: "I'd love to help you with that, but I have to stick to what I do best — getting your custom packaging sorted! Let's make sure we get your boxes looking perfect. What box style are you thinking?"

PRICING:
- Never refuse pricing. Give rough estimates in GBP (£):
  * Small (4x4x4): £0.40-£1.20/unit
  * Medium (8x8x8): £0.90-£2.20/unit  
  * Large (12x12x12): £1.90-£3.50/unit
  * Logo setup: £39-£79 one-time (free over 500 units)
- Mention it's a rough estimate and final pricing comes from the team.
- After giving a price, casually suggest uploading their logo for a mockup preview.

LEAD CAPTURE:
- If they want a final quote or want to order, ask for their name and email (casually, one at a time).
- Once provided, confirm you've saved it and the team will reach out soon.`;

  // Inject customer context if available
  if (customerContext && customerContext.name) {
    prompt += `\n\nCUSTOMER CONTEXT:\n- The customer's name is "${customerContext.name}". Address them by their first name naturally in conversation (e.g., "Sure thing, ${customerContext.name.split(' ')[0]}" or "We've got you covered, ${customerContext.name.split(' ')[0]}"). Don't overuse it — use it once or twice per few messages, not every single reply.`;
    if (customerContext.company) {
      prompt += `\n- Their company is "${customerContext.company}".`;
    }
    if (customerContext.businessType) {
      prompt += `\n- Their business type is "${customerContext.businessType}". You may reference this to make relevant suggestions (e.g., recommend food-safe materials for food businesses), but ALWAYS let them choose from all available options. Never skip options or auto-select for them.`;
    }
  }

  return prompt;
}

// ─── In-memory session store (conversation history) ──────────────────────────
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      lastAccess: Date.now(),
      leadCaptured: false
    });
  }
  const session = sessions.get(sessionId);
  session.lastAccess = Date.now();
  return session;
}

// Helper to extract email and name from user message using regex
function checkAndExtractContactInfo(text) {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
  const match = text.match(emailRegex);
  if (match) {
    const email = match[1];
    let name = '';
    const nameMatch = text.match(/(?:my name is|i am|name is|call me|name:?)\s+([a-zA-Z\s]+)/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }
    return { email, name };
  }
  return null;
}

// Helper to generate a flat cardboard SVG box mockup when Pollinations fails
async function createFallbackCardboardMockup(logoPath, productType, specs) {
  const width = 512;
  const height = 512;
  
  const boxW = specs && specs.width ? specs.width : 6;
  const boxH = specs && specs.height ? specs.height : 6;
  const boxD = specs && specs.depth ? specs.depth : 4;
  const boxColor = specs && specs.color ? specs.color : 'kraft';
  
  // Scale box dimensions relative to target bounds
  const maxDim = Math.max(boxW, boxH, boxD);
  const rectW = Math.round(320 * (boxW / maxDim));
  const rectH = Math.round(320 * (boxH / maxDim));
  const rx = 96 + Math.round((320 - rectW) / 2);
  const ry = 96 + Math.round((320 - rectH) / 2);
  
  let fillDef = '';
  let fillAttr = '';
  
  if (boxColor === 'kraft') {
    fillDef = `
      <linearGradient id="cardboard" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#E5C299" />
        <stop offset="50%" stop-color="#D4AE85" />
        <stop offset="100%" stop-color="#C29D74" />
      </linearGradient>
    `;
    fillAttr = 'url(#cardboard)';
  } else {
    // Shade color function
    const shade = (hex, pct) => {
      let c = hex.replace(/^\s*#|\s*$/g, '');
      if (c.length === 3) c = c.replace(/(.)/g, '$1$1');
      let r = Math.round(parseInt(c.substr(0, 2), 16) * pct);
      let g = Math.round(parseInt(c.substr(2, 2), 16) * pct);
      let b = Math.round(parseInt(c.substr(4, 2), 16) * pct);
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    };
    fillDef = `
      <linearGradient id="customColorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${boxColor}" />
        <stop offset="100%" stop-color="${shade(boxColor, 0.85)}" />
      </linearGradient>
    `;
    fillAttr = 'url(#customColorGrad)';
  }
  
  const strokeColor = boxColor === 'kraft' ? '#b08a60' : 'rgba(0,0,0,0.15)';
  const labelColor = boxColor === 'kraft' ? '#94714d' : 'rgba(0,0,0,0.5)';
  const scoreOffset = Math.min(25, Math.round(Math.min(rectW, rectH) * 0.15));
  
  const svgTemplate = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${fillDef}
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.15"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <g filter="url(#shadow)">
        <rect x="${rx}" y="${ry}" width="${rectW}" height="${rectH}" rx="12" fill="${fillAttr}"/>
      </g>
      <line x1="${rx}" y1="${ry + scoreOffset}" x2="${rx + rectW}" y2="${ry + scoreOffset}" stroke="${strokeColor}" stroke-width="1.2" stroke-dasharray="3 3"/>
      <line x1="${rx}" y1="${ry + rectH - scoreOffset}" x2="${rx + rectW}" y2="${ry + rectH - scoreOffset}" stroke="${strokeColor}" stroke-width="1.2" stroke-dasharray="3 3"/>
      <line x1="${rx + scoreOffset}" y1="${ry}" x2="${rx + scoreOffset}" y2="${ry + rectH}" stroke="${strokeColor}" stroke-width="1.2" stroke-dasharray="3 3"/>
      <line x1="${rx + rectW - scoreOffset}" y1="${ry}" x2="${rx + rectW - scoreOffset}" y2="${ry + rectH}" stroke="${strokeColor}" stroke-width="1.2" stroke-dasharray="3 3"/>
      <text x="256" y="${ry + rectH - 12}" font-family="sans-serif" font-size="10" font-weight="600" fill="${labelColor}" letter-spacing="1.5" text-anchor="middle">
        ${productType.toUpperCase()} - ${boxW}"x${boxH}"x${boxD}"
      </text>
    </svg>
  `;

  const fallbackBuffer = Buffer.from(svgTemplate);
  
  // Calculate relative logo resize size (approx 45% of min rectangle size)
  const maxLogoSize = Math.max(60, Math.round(Math.min(rectW, rectH) * 0.45));
  const logoBuffer = await sharp(logoPath)
    .resize(maxLogoSize, maxLogoSize, { fit: 'inside' })
    .toBuffer();
    
  const outputFilename = `mockup-${Date.now()}.png`;
  const outputPath = path.join(generatedDir, outputFilename);
  
  const blendMode = boxColor === 'kraft' || boxColor === '#ffffff' ? 'multiply' : 'over';

  await sharp(fallbackBuffer)
    .composite([{ input: logoBuffer, gravity: 'center', blend: blendMode }])
    .toFile(outputPath);
    
  return `/uploads/generated/${outputFilename}`;
}

// ─── Gemini AI Image Generation for Packaging Mockups ────────────────────────
// Uses Gemini 2.5 Flash Image → Imagen 4 Fast → SVG Fallback
const geminiAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) 
  : null;

async function addMockupOverlays(imageFilePath, boxW, boxH, boxD) {
  try {
    const metadata = await sharp(imageFilePath).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 800;

    const footerText = `AI Mockup Only - Our team will reach you out to verify official design specs`;

    // Calculate relative scaling parameters based on mockup resolution
    const fontSizeFooter = Math.max(10, Math.round(width * 0.015)); // ~15px for 1024px
    const footerHeight = Math.round(height * 0.05); // ~50px for 1024px

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .footer-bg { fill: rgba(26, 26, 46, 0.9); }
          .footer-text { fill: #ffffff; font-family: 'Inter', -apple-system, sans-serif; font-size: ${fontSizeFooter}px; font-weight: 500; text-anchor: middle; }
        </style>
        
        <!-- AutoCAD-style Blueprint Card in top-left corner -->
        <g transform="translate(16, 16)">
          <!-- Blueprint Card Background -->
          <rect x="0" y="0" width="240" height="190" fill="rgba(15, 23, 42, 0.92)" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1.5" rx="8" />
          
          <!-- Title -->
          <text x="120" y="24" fill="#38bdf8" font-family="'Inter', -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="1" text-anchor="middle">CAD BLUEPRINT SPEC</text>
          
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#38bdf8" />
            </marker>
          </defs>

          <!-- Isometric Box Wireframe -->
          <!-- Visible Box Edges -->
          <path d="M 120 135 L 70 112 L 70 72 L 120 95 L 120 135 Z" stroke="#38bdf8" stroke-width="1.2" fill="none" />
          <path d="M 120 135 L 170 112 L 170 72 L 120 95 Z" stroke="#38bdf8" stroke-width="1.2" fill="none" />
          <path d="M 70 72 L 120 52 L 170 72 L 120 95 Z" stroke="#38bdf8" stroke-width="1.2" fill="none" />

          <!-- AutoCAD Style Extension & Dimension Lines -->
          
          <!-- 1. Height (H) Dimension (along left vertical edge) -->
          <!-- Extension lines -->
          <line x1="68" y1="72" x2="48" y2="72" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1" />
          <line x1="68" y1="112" x2="48" y2="112" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1" />
          <!-- Dimension line with arrows -->
          <line x1="52" y1="75" x2="52" y2="109" stroke="#38bdf8" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)" />
          <!-- Label -->
          <text x="42" y="96" fill="#38bdf8" font-family="'Inter', -apple-system, sans-serif" font-size="10" font-weight="700" text-anchor="end">${boxH}" (H)</text>

          <!-- 2. Width (W) Dimension (along bottom-left edge) -->
          <!-- Extension lines -->
          <line x1="70" y1="114" x2="57" y2="131" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1" />
          <line x1="118" y1="137" x2="105" y2="154" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1" />
          <!-- Dimension line with arrows -->
          <line x1="61" y1="129" x2="101" y2="149" stroke="#38bdf8" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)" />
          <!-- Label -->
          <text x="76" y="147" fill="#38bdf8" font-family="'Inter', -apple-system, sans-serif" font-size="10" font-weight="700" text-anchor="middle" transform="rotate(25, 76, 147)">${boxW}" (W)</text>

          <!-- 3. Depth (D) Dimension (along bottom-right edge) -->
          <!-- Extension lines -->
          <line x1="170" y1="114" x2="183" y2="131" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1" />
          <line x1="122" y1="137" x2="135" y2="154" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1" />
          <!-- Dimension line with arrows -->
          <line x1="179" y1="129" x2="139" y2="149" stroke="#38bdf8" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)" />
          <!-- Label -->
          <text x="162" y="147" fill="#38bdf8" font-family="'Inter', -apple-system, sans-serif" font-size="10" font-weight="700" text-anchor="middle" transform="rotate(-25, 162, 147)">${boxD}" (D)</text>
        </g>

        <!-- Disclaimer Bottom Footer Banner -->
        <rect x="0" y="${height - footerHeight}" width="${width}" height="${footerHeight}" class="footer-bg" />
        <text x="${width / 2}" y="${height - footerHeight/2 + fontSizeFooter/3}" class="footer-text">${footerText}</text>
      </svg>
    `;

    let logoOverlay = null;
    const logoPath = path.join(__dirname, 'public', 'achivex_logo.png');
    if (fs.existsSync(logoPath)) {
      const logoHeight = Math.round(height * 0.08); // ~64px for 800px mockup
      const resizedLogo = await sharp(logoPath)
        .resize({ height: logoHeight })
        .toBuffer({ resolveWithObject: true });
      
      logoOverlay = {
        input: resizedLogo.data,
        top: 20,
        left: width - resizedLogo.info.width - 20
      };
    }

    const compositeLayers = [{ input: Buffer.from(svgOverlay), top: 0, left: 0 }];
    if (logoOverlay) {
      compositeLayers.push(logoOverlay);
    }

    const tempPath = imageFilePath + '.tmp.png';
    await sharp(imageFilePath)
      .composite(compositeLayers)
      .toFile(tempPath);

    fs.renameSync(tempPath, imageFilePath);
    console.log(`✅ Mockup overlays added to ${imageFilePath}`);
  } catch (err) {
    console.error('Failed to add mockup overlays:', err);
  }
}

async function generateMockupImage(logoPath, productType, specs, chatInstructions) {
  const boxW = specs && specs.width ? specs.width : 6;
  const boxH = specs && specs.height ? specs.height : 6;
  const boxD = specs && specs.depth ? specs.depth : 4;
  const boxColor = specs && specs.color && specs.color !== 'kraft' ? specs.color : 'kraft';
  const boxColorText = boxColor === 'kraft' ? 'natural kraft brown cardboard' : boxColor;
  const materialLabel = specs && specs.material ? specs.material : boxColorText;
  const printStyle = specs && specs.printStyle ? specs.printStyle : 'logo-front';
  const printLabel = specs && specs.printLabel ? specs.printLabel : 'Logo on Front';

  // Map print style to visual description
  const printDescriptions = {
    'logo-front': 'with the logo prominently printed on the front face of the box',
    'logo-top': 'with the logo printed centered on the top lid of the box',
    'logo-full-face': 'with the logo scaled up to fill the entire front face of the box edge to edge',
    'full-pattern': 'with the logo repeated as a small tiled pattern covering all visible sides of the box, like a luxury monogram pattern',
    'full-artwork': 'with a fully custom printed artistic design covering all visible sides of the box in a premium wrap-around print',
    'full-print': 'with a fully printed all-over pattern/design covering all visible sides of the box',
    'logo-text': 'with the logo and company name text printed on the front face of the box',
    'minimal': 'with a small, minimalist logo subtly placed in the lower-right corner of the front face'
  };
  let printDesc = printDescriptions[printStyle] || printDescriptions['logo-front'];

  const instructionsLower = (chatInstructions || '').toLowerCase();
  const isGold = instructionsLower.includes('gold foil') || instructionsLower.includes('gold logo') || instructionsLower.includes('golden logo') || instructionsLower.includes('gold print') || instructionsLower.includes('gold engraved');
  const isSilver = instructionsLower.includes('silver foil') || instructionsLower.includes('silver logo') || instructionsLower.includes('silvered logo') || instructionsLower.includes('silver print') || instructionsLower.includes('silver engraved');
  const isWhite = instructionsLower.includes('white logo') || instructionsLower.includes('white print');
  const isBlack = instructionsLower.includes('black logo') || instructionsLower.includes('black print');

  // Load and programmatically tint the logo if custom foil/color requested
  let logoBuffer;
  try {
    let tempChain = sharp(logoPath);
    if (isGold) {
      tempChain = tempChain.tint({ r: 218, g: 165, b: 32 }); // Gold tint (#DAA520)
      console.log('✨ Programmatic Gold Foil tint applied to logo buffer.');
      printDesc += ' rendered as a metallic gold foil stamp engraved/embossed onto the box surface';
    } else if (isSilver) {
      tempChain = tempChain.tint({ r: 192, g: 192, b: 192 }); // Silver tint (#C0C0C0)
      console.log('✨ Programmatic Silver Foil tint applied to logo buffer.');
      printDesc += ' rendered as a metallic silver foil stamp engraved/embossed onto the box surface';
    } else if (isWhite) {
      tempChain = tempChain.tint({ r: 255, g: 255, b: 255 }); // White
      console.log('✨ Programmatic White tint applied to logo buffer.');
    } else if (isBlack) {
      tempChain = tempChain.tint({ r: 0, g: 0, b: 0 }); // Black
      console.log('✨ Programmatic Black tint applied to logo buffer.');
    }
    logoBuffer = await tempChain.toBuffer();
  } catch (err) {
    console.warn('⚠️ Failed to process logo tint, using original:', err);
    logoBuffer = fs.readFileSync(logoPath);
  }

  const customStyleText = chatInstructions ? `following custom instructions: ${chatInstructions},` : '';
  const prompt = `A premium custom printed ${materialLabel} ${productType} packaging box, dimensions approximately ${boxW}x${boxH}x${boxD} inches, ${printDesc}, ${customStyleText} professional product photography, isolated on clean white studio backdrop, high resolution, soft studio lighting, subtle shadow underneath, luxury packaging aesthetic, no text overlay, photorealistic`;

  let resultUrl = '';

  // ── Method 1: Gemini 2.5 Flash Image (native image generation) ──
  if (geminiAI) {
    try {
      console.log(`🎨 [Gemini] Generating packaging mockup with gemini-2.5-flash-image...`);
      
      const logoBase64 = logoBuffer.toString('base64');
      const logoMime = logoPath.endsWith('.png') ? 'image/png' 
        : logoPath.endsWith('.svg') ? 'image/png' 
        : logoPath.endsWith('.webp') ? 'image/webp' 
        : 'image/jpeg';
      
      const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          {
            role: 'user',
            parts: [
              { 
                text: `Generate a photorealistic product image of a premium custom ${materialLabel} ${productType} packaging box. 
The box should be ${boxW}x${boxH}x${boxD} inches in size. 
Place the following logo (attached image) ${printDesc}. 
${chatInstructions ? `Ensure the box incorporates these specific customer styling requests: ${chatInstructions}.` : ''}
The logo should be clearly visible, properly scaled, and look professionally printed on the box surface.
${printStyle === 'full-pattern' ? 'Create a small repeating tiled pattern using the logo across all visible faces, like a luxury monogram.' : ''}
${printStyle === 'logo-full-face' ? 'Scale the logo to fill the entire front face of the box from edge to edge.' : ''}
${printStyle === 'full-artwork' ? 'Create a premium artistic wrap-around design inspired by the logo covering all sides.' : ''}
Style: Professional product photography, isolated on clean white studio backdrop, soft studio lighting, subtle shadow underneath.
Do NOT add any text overlays. Make it look like a real commercial product photo.`
              },
              {
                inlineData: {
                  mimeType: logoMime,
                  data: logoBase64
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      });

      if (response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
            const imageData = part.inlineData.data;
            const ext = part.inlineData.mimeType.split('/')[1] || 'png';
            const outputFilename = `mockup-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
            const outputPath = path.join(generatedDir, outputFilename);
            fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));
            const sizeKB = (Buffer.from(imageData, 'base64').length / 1024).toFixed(1);
            console.log(`✅ [Gemini] Mockup generated! ${outputFilename} (${sizeKB} KB)`);
            resultUrl = `/uploads/generated/${outputFilename}`;
            break;
          }
        }
      }
      if (!resultUrl) {
        console.warn('⚠️ [Gemini] No image in response, trying Imagen 4...');
      }
    } catch (err) {
      console.warn('⚠️ [Gemini] gemini-2.5-flash-image failed:', err.message?.substring(0, 150));
    }

    // ── Method 2: Imagen 4 Fast (dedicated image model) ──
    if (!resultUrl) {
      try {
        console.log(`🎨 [Imagen 4] Generating packaging mockup with imagen-4.0-fast...`);
        const response = await geminiAI.models.generateImages({
          model: 'imagen-4.0-fast-generate-001',
          prompt: prompt,
          config: {
            numberOfImages: 1,
          }
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          const img = response.generatedImages[0];
          const imageData = img.image.imageBytes;
          const outputFilename = `mockup-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`;
          const outputPath = path.join(generatedDir, outputFilename);
          
          // Imagen doesn't take image input, so composite the customer's logo onto the box
          const boxBuffer = Buffer.from(imageData, 'base64');
          const resizedLogoBuffer = await sharp(logoBuffer)
            .resize(160, 160, { fit: 'inside' })
            .toBuffer();
          
          const blendMode = boxColor === 'kraft' || boxColor === '#ffffff' ? 'multiply' : 'over';
          
          await sharp(boxBuffer)
            .composite([{ input: resizedLogoBuffer, gravity: 'center', blend: blendMode }])
            .toFile(outputPath);

          const finalSize = (fs.statSync(outputPath).size / 1024).toFixed(1);
          console.log(`✅ [Imagen 4] Mockup generated with logo composite! ${outputFilename} (${finalSize} KB)`);
          resultUrl = `/uploads/generated/${outputFilename}`;
        } else {
          console.warn('⚠️ [Imagen 4] No images returned, falling back to SVG...');
        }
      } catch (err) {
        console.warn('⚠️ [Imagen 4] Failed:', err.message?.substring(0, 150));
      }
    }
  } else {
    console.warn('⚠️ GEMINI_API_KEY not configured. Using SVG fallback.');
  }

  // ── Method 3: Local SVG fallback (no API needed) ──
  if (!resultUrl) {
    console.log('📐 [Fallback] Generating SVG cardboard mockup locally...');
    resultUrl = await createFallbackCardboardMockup(logoBuffer, productType, specs);
  }

  // Apply overlays (dimensions and disclaimer footer)
  if (resultUrl) {
    const localPath = path.join(generatedDir, path.basename(resultUrl));
    await addMockupOverlays(localPath, boxW, boxH, boxD);
  }

  return resultUrl;
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

app.get('/widget.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

app.get('/widget.css', (req, res) => {
  res.type('text/css').sendFile(path.join(__dirname, 'public', 'widget.css'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', provider: 'openrouter', company: process.env.COMPANY_NAME });
});

// ─── Chat endpoint ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, logoFilename } = req.body;
    if (!message && !logoFilename) {
      return res.status(400).json({ error: 'Message or logoFilename is required.' });
    }

    const session = getSession(sessionId);
    if (logoFilename) {
      session.uploadedLogo = { filename: logoFilename, url: `/uploads/${logoFilename}` };
    }

    // Build customer context from session lead data
    const customerContext = session.leadData || {};
    const systemPrompt = getSystemPrompt(customerContext);
    const contactInfo = checkAndExtractContactInfo(message || '');
    
    const messages = [];
    for (const turn of session.history) {
      messages.push({
        role: turn.role === 'model' ? 'assistant' : 'user',
        content: turn.text
      });
    }

    let userContent = message || '';
    if (logoFilename) {
      userContent += `\n[User uploaded their logo: ${logoFilename}. Suggest generating a mockup and prompt them to select the product box type they want to view]`;
    }

    messages.push({ role: 'user', content: userContent });

    let reply;
    if (geminiAI) {
      try {
        console.log('📡 Sending request to Gemini (gemini-2.5-flash)');
        reply = await chatWithGemini(messages, systemPrompt);
        console.log('✅ Response success with Gemini');
      } catch (geminiErr) {
        console.warn('⚠️ Gemini chat failed, falling back to OpenRouter:', geminiErr.message);
        reply = await chatWithOpenRouter(messages, systemPrompt);
      }
    } else {
      reply = await chatWithOpenRouter(messages, systemPrompt);
    }

    session.history.push({ role: 'user', text: message || '[Uploaded Logo]' });
    session.history.push({ role: 'model', text: reply });

    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }

    if (contactInfo && !session.leadCaptured) {
      session.leadCaptured = true;
      try {
        await sendSummaryEmail(contactInfo.email, contactInfo.name, session.history);
      } catch (err) {
        console.error('Failed to send summary email:', err);
      }
    }

    res.json({ 
      reply, 
      sessionId,
      showProductSelector: !!logoFilename,
      logoUrl: logoFilename ? `/uploads/${logoFilename}` : null
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process your message. Please try again.' });
  }
});

// ─── Lead capture endpoint ───────────────────────────────────────────────────
app.post('/api/submit-lead', async (req, res) => {
  try {
    const { email, name, phone, company, businessType, sessionId } = req.body;
    if (!email || !sessionId) {
      return res.status(400).json({ error: 'Email and sessionId are required.' });
    }

    const session = getSession(sessionId);
    session.leadCaptured = true;
    session.leadData = { name, email, phone, company, businessType };

    console.log('\n--- NEW LEAD ---');
    console.log(`Name: ${name}`);
    console.log(`Company: ${company}`);
    console.log(`Email: ${email}`);
    console.log(`Phone: ${phone}`);
    console.log(`Business: ${businessType}`);
    console.log('----------------\n');
    
    const result = await sendSummaryEmail(email, name, session.history, phone, company, businessType);
    res.json({ success: true, message: 'Lead captured successfully.', result });
  } catch (err) {
    console.error('Submit lead error:', err);
    res.status(500).json({ error: 'Failed to submit. Please try again.' });
  }
});

app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      filename: req.file.filename,
      url: fileUrl,
      message: 'Logo uploaded successfully!'
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload logo.' });
  }
});

async function extractStyleInstructionsFromHistory(history) {
  if (!history || history.length === 0) return '';
  
  // Filter for user messages and join them, omitting artificial widget logs/hints
  const userMessages = history
    .filter(turn => turn.role === 'user' && turn.text && !turn.text.includes('[User uploaded their logo') && !turn.text.includes('[Uploaded Logo]'))
    .map(turn => turn.text);
    
  if (userMessages.length === 0) return '';

  const historyText = userMessages.join('\n');
  
  const prompt = `You are a design requirements extractor. Analyze the following messages sent by a customer describing their custom packaging needs:
"${historyText}"

Identify any specific styling preferences they mentioned. Look for:
- Colors (e.g. "matte black", "kraft brown", "neon pink")
- Materials or textures (e.g. "corrugated cardboard", "smooth paperboard", "glossy finish")
- Style vibes (e.g. "minimalist", "luxury", "eco-friendly")
- Logo placement or treatment (e.g. "gold foil logo", "embossed", "centered logo")
- Any other specific print guidelines they wrote.

Return ONLY a short comma-separated list of these extracted style keywords (e.g., "matte black color, minimalist layout, glossy finish"). Do NOT write any introduction, explanation, or conversational text. If no specific style preferences are mentioned, return "none".`;

  try {
    let rawResult;
    if (geminiAI) {
      try {
        rawResult = await chatWithGemini(
          [{ role: 'user', content: prompt }],
          "You extract design preferences as short comma-separated lists."
        );
      } catch (geminiErr) {
        console.warn('⚠️ Gemini style extraction failed, falling back to OpenRouter:', geminiErr.message);
        rawResult = await chatWithOpenRouter(
          [{ role: 'user', content: prompt }],
          "You extract design preferences as short comma-separated lists."
        );
      }
    } else {
      rawResult = await chatWithOpenRouter(
        [{ role: 'user', content: prompt }],
        "You extract design preferences as short comma-separated lists."
      );
    }
    
    const cleanResult = rawResult ? rawResult.trim() : '';
    if (cleanResult.toLowerCase() === 'none' || cleanResult.length < 3) {
      return '';
    }
    return cleanResult;
  } catch (err) {
    console.error('Failed to extract styling preferences from history:', err);
    return '';
  }
}

// ─── Image generation endpoint (logo on product mockups) ─────────────────────
app.post('/api/generate-demo', async (req, res) => {
  try {
    const { logoFilename, productType, specs, sessionId } = req.body;

    if (!logoFilename || !productType) {
      return res.status(400).json({ error: 'Logo filename and product type are required.' });
    }

    const logoPath = path.join(uploadDir, logoFilename);
    if (!fs.existsSync(logoPath)) {
      return res.status(404).json({ error: 'Logo file not found.' });
    }

    // Pull box specs from session or request
    const session = sessionId ? getSession(sessionId) : null;
    const boxSpecs = specs || {};

    // Extract custom styling instructions from chat history
    let chatInstructions = '';
    if (session && session.history) {
      chatInstructions = await extractStyleInstructionsFromHistory(session.history);
      if (chatInstructions) {
        console.log(`🎨 Extracted custom styling guidelines from chat history: "${chatInstructions}"`);
      }
    }

    // Generate AI description (runs in parallel with image gen)
    const descPrompt = `Customer uploaded their logo for a ${productType} box mockup. Give a SHORT excited 1-2 sentence reaction like "Oh wow, this looks great on the ${productType}!" Mention it's an AI preview and our team will finalize the real design. Keep it super brief and casual.`;

    let descriptionPromise;
    if (geminiAI) {
      descriptionPromise = chatWithGemini([{ role: 'user', content: descPrompt }], getSystemPrompt())
        .catch(geminiErr => {
          console.warn('⚠️ Gemini mockup description failed, falling back to OpenRouter:', geminiErr.message);
          return chatWithOpenRouter([{ role: 'user', content: descPrompt }], getSystemPrompt());
        });
    } else {
      descriptionPromise = chatWithOpenRouter([{ role: 'user', content: descPrompt }], getSystemPrompt());
    }

    const [description, imageUrl] = await Promise.all([
      descriptionPromise,
      generateMockupImage(logoPath, productType, boxSpecs, chatInstructions)
    ]);

    res.json({
      success: true,
      description,
      productType,
      logoUrl: `/uploads/${logoFilename}`,
      imageUrl
    });

  } catch (err) {
    console.error('Image generation error:', err);
    res.status(500).json({
      error: 'Failed to generate mockup. Please try again.',
      details: err.message
    });
  }
});

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WINDOWS_FILE_TIME_EPOCH = 11644473600000n; // Offset in milliseconds

function generateSecMsGecToken() {
  const ticks = (BigInt(Date.now()) + WINDOWS_FILE_TIME_EPOCH) * 10000n;
  const roundedTicks = ticks - (ticks % 3000000000n);
  const strToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`;
  
  return createHash('sha256')
    .update(strToHash, 'ascii')
    .digest('hex')
    .toUpperCase();
}

const NEURAL_VOICES = {
  en: 'en-US-AriaNeural',
  es: 'es-ES-ElviraNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-AmalaNeural',
  it: 'it-IT-ElsaNeural',
  ur: 'ur-PK-UzmaNeural',
  hi: 'hi-IN-SwaraNeural',
  ar: 'ar-AE-FatimaNeural',
  zh: 'zh-CN-XiaoxiaoNeural'
};

// Humanize text for TTS — convert structured text to natural speech with pauses
function humanizeTTSText(text) {
  let t = text;
  
  // Convert dimensions: "4x4x4" → "4 by 4 by 4"
  t = t.replace(/(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/g, '$1 by $2 by $3');
  t = t.replace(/(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/g, '$1 by $2');

  // Convert prices: "£0.40" → "40 pence", "£1.20" → "1 pound 20"
  t = t.replace(/£0\.(\d{2})/g, (_, c) => `${parseInt(c)} pence`);
  t = t.replace(/£(\d+)\.(\d{2})/g, (_, p, c) => parseInt(c) > 0 ? `${p} pounds ${parseInt(c)}` : `${p} pounds`);
  t = t.replace(/£(\d+)/g, '$1 pounds');

  // Convert "/unit" → "per unit"
  t = t.replace(/\/unit/gi, ' per unit');

  // Convert dashes between numbers: "500-1000" → "500 to 1000"
  t = t.replace(/(\d+)\s*[-–]\s*(\d+)/g, '$1 to $2');

  // Remove colons after labels: "Material: Kraft" → "Material, Kraft"
  t = t.replace(/(\w)\s*:\s*/g, '$1, ');

  // Strip bullet points into natural flow
  t = t.replace(/^[\s]*[-•]\s*/gm, '. ');

  // Remove emoji
  t = t.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  // Clean double dots/spaces
  t = t.replace(/\.\s*\.\s*/g, '. ');
  t = t.replace(/\s{2,}/g, ' ');

  // Add micro-pauses after commas (natural breath points)
  t = t.replace(/,\s*/g, ', ... ');
  
  // Add slight pause after sentence-starting fillers
  t = t.replace(/^(Hmm|Ahh|Oh|Right|So|Well|Got it|Sure|Absolutely|Let me think)/i, '$1... ');
  
  // Add breathing pause after exclamation/question marks mid-text
  t = t.replace(/([!?])\s+/g, '$1 ... ');
  
  // Add natural pause before conjunctions (thinking pauses)
  t = t.replace(/\s+(but|and so|though|however)\s+/gi, ' ... $1 ');
  
  return t.trim();
}

function generateEdgeTTS(text, langCode = 'en') {
  return new Promise((resolve, reject) => {
    const token = generateSecMsGecToken();
    const connectionId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const cleanLang = langCode.split('-')[0].toLowerCase();
    const voice = NEURAL_VOICES[cleanLang] || NEURAL_VOICES['en'];

    const ws = new WebSocket(
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
          'Origin': 'chrome-extension://jdiccldimpdaibdgoocgdldidnmgeimb',
          'Sec-MS-GEC': token,
          'Sec-MS-GEC-Version': '1-130.0.2849.68',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      }
    );

    const audioChunks = [];
    const requestId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    // Humanize the text for more natural speech
    const humanText = humanizeTTSText(text);
    // Escape XML special chars for SSML
    const safeText = humanText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    ws.on('open', () => {
      const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"system":{"name":"SpeechSDK","version":"1.12.1-rc.1","build":"JavaScript","lang":"JavaScript","os":{"platform":"Browser/Linux","name":"Chrome","version":"130.0.0.0"}}}}`;
      ws.send(configMsg);

      // Enhanced SSML with natural prosody — slightly slower rate, warmer pitch, conversational style
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${voice}'><mstts:express-as style='chat'><prosody rate='-5%' pitch='+2%' volume='95'>${safeText}</prosody></mstts:express-as></voice></speak>`;
      const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const headerLength = data.readInt16BE(0);
        const audioChunk = data.slice(2 + headerLength);
        if (audioChunk.length > 0) {
          audioChunks.push(audioChunk);
        }
      } else {
        const textMsg = data.toString();
        if (textMsg.includes('Path:turn.end')) {
          ws.close();
          resolve(Buffer.concat(audioChunks));
        }
      }
    });

    ws.on('error', (err) => {
      ws.close();
      reject(err);
    });

    ws.on('close', () => {
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks));
      } else {
        reject(new Error('Connection closed with no audio data.'));
      }
    });
  });
}

app.post('/api/tts', async (req, res) => {
  const { text, lang } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  // 0. Try Smallest AI (Lightning TTS)
  if (process.env.SMALLEST_API_KEY) {
    try {
      const voiceId = process.env.SMALLEST_VOICE_ID || 'meher';
      const response = await fetch('https://api.smallest.ai/waves/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SMALLEST_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          voice_id: voiceId,
          model: 'lightning_v3.1_pro',
          sample_rate: 24000,
          output_format: 'mp3'
        })
      });
      if (response.ok) {
        res.set({ 'Content-Type': 'audio/mpeg' });
        const buffer = await response.arrayBuffer();
        return res.send(Buffer.from(buffer));
      } else {
        const errorText = await response.text();
        console.error('Smallest AI TTS API returned error:', response.status, errorText);
      }
    } catch (e) {
      console.error('Smallest AI TTS failed:', e);
    }
  }

  // 1. Try ElevenLabs (Optional Paid API)
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // "Bella" (natural human female voice)
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });
      if (response.ok) {
        res.set({ 'Content-Type': 'audio/mpeg' });
        const buffer = await response.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }
    } catch (e) {
      console.error('ElevenLabs TTS failed:', e);
    }
  }

  // 2. Try OpenAI TTS (Optional Paid API)
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: process.env.OPENAI_VOICE || 'nova' // "nova" is a warm female voice
        })
      });
      if (response.ok) {
        res.set({ 'Content-Type': 'audio/mpeg' });
        const buffer = await response.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }
    } catch (e) {
      console.error('OpenAI TTS failed:', e);
    }
  }

  // 3. Try Microsoft Edge Free Neural TTS (Ultra-realistic, 100% free!)
  try {
    const langCode = lang || 'en';
    const buffer = await generateEdgeTTS(text, langCode);
    if (buffer && buffer.length > 0) {
      res.set({ 'Content-Type': 'audio/mpeg' });
      return res.send(buffer);
    }
  } catch (e) {
    console.error('Edge Neural TTS failed, falling back to Google Translate proxy:', e);
  }

  // 4. Fallback: Google Translate TTS stream proxy (free)
  try {
    const langCode = lang || 'en';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (response.ok) {
      res.set({ 'Content-Type': 'audio/mpeg' });
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }
  } catch (e) {
    console.error('Fallback TTS failed:', e);
  }

  res.status(500).json({ error: 'TTS generation failed' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`\n🤖 Chatbot server running at http://localhost:${PORT}`);
  console.log(`🔌 AI Provider: OPENROUTER`);
  console.log(`📦 Company: ${process.env.COMPANY_NAME || 'Not configured'}`);
  console.log(`\n📋 WordPress Embed Code:`);
  console.log(`   <script src="http://localhost:${PORT}/widget.js" data-chatbot-server="http://localhost:${PORT}"></script>\n`);
});
