<div align="center">

![PackFocus Bot Banner](assets/banner.png)

# 📦 PackFocus-Bot

### *Domain-Locked AI Assistant for Custom Packaging & Box Engineering*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-brightgreen.svg?logo=nodedotjs)](https://nodejs.org)
[![Domain Locked](https://img.shields.io/badge/Domain-Packaging_Only-ff69b4.svg?style=flat&logo=shield)](https://github.com/aimuhammadabuzarqureshi-cloud/PackFocus-Bot)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-4285F4.svg?logo=googleai)](https://ai.google.dev)
[![OpenRouter](https://img.shields.io/badge/API-OpenRouter-6528F7.svg)](https://openrouter.ai)
[![Security](https://img.shields.io/badge/Security-Zero_Key_Leak-success.svg?logo=gitbook)](.gitignore)

<p align="center">
  <b>PackFocus-Bot</b> is an enterprise-grade, domain-restricted AI chatbot designed specifically for custom packaging companies, box manufacturers, and e-commerce shipping advisors. Unlike general-purpose AI bots, PackFocus-Bot is strictly locked to packaging materials, custom mailers, box dimensions, unboxing aesthetics, and quote assistance.
</p>

[Key Features](#-key-features) • [System Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [Environment Setup](#-environment-setup) • [API Reference](#-api-reference) • [Security](#-security-and-secret-protection)

</div>

---

## ⚡ Key Features

* **🛡️ Strict Domain Boundary Guard**: Built-in guardrails ensure responses stay strictly within packaging, box sizing, mailers, and shipping materials—politely filtering off-topic general queries.
* **🧠 Multi-Engine AI Pipeline**: Seamless fallback orchestration between **Google Gemini 2.5** and **OpenRouter AI Models** for zero-downtime conversational response generation.
* **🎙️ Neural Text-to-Speech (TTS)**: Native integration with **Edge-TTS** (free zero-key neural voices) alongside support for **Smallest.ai**, **ElevenLabs**, and **OpenAI Voice**.
* **🎨 Style Keyword Extractor**: Automatically parses user design preferences into structural style keywords for custom packaging rendering.
* **🔒 Enterprise Secret Protection**: Hardened configuration preventing any API key or secret leak in public or private repositories.
* **⚡ Modern Glassmorphic Widget**: Lightweight embeddable floating web chat widget with audio playback controls and responsive layout.

---

## 📐 System Architecture

```mermaid
flowchart TD
    subgraph Client ["🌐 Client Layer"]
        A[User Input / Web Widget] --> B{Message Classifier}
    end

    subgraph Security ["🛡️ Security & Boundary Guard"]
        B -->|Off-Topic Query| C[Restricted Domain Response]
        B -->|Packaging Query| D[Context Injector & System Prompt]
    end

    subgraph AI_Engine ["🧠 AI Orchestration Engine"]
        D --> E{Primary API: Gemini 2.5}
        E -->|Success| H[Generated Answer]
        E -->|Fallback| F{Secondary API: OpenRouter}
        F -->|Success| H
        F -->|Fallback| G[SVG / Rule Fallback Response]
        G --> H
    end

    subgraph TTS ["🎙️ Neural Audio Synthesis"]
        H --> I{Audio Requested?}
        I -->|Yes| J[Edge-TTS / Smallest.ai / ElevenLabs]
        J --> K[Base64 Audio Stream]
        I -->|No| L[JSON Text Response]
    end

    K --> M[Web Widget Render & Audio Playback]
    L --> M

    style Client fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#fff
    style Security fill:#313244,stroke:#f38ba8,stroke-width:2px,color:#fff
    style AI_Engine fill:#181825,stroke:#a6e3a1,stroke-width:2px,color:#fff
    style TTS fill:#11111b,stroke:#cba6f7,stroke-width:2px,color:#fff
```

---

## 📊 Conversation Flow & Decision Graph

```mermaid
sequenceDiagram
    autonumber
    actor User as E-Commerce Client
    participant Widget as PackFocus Widget
    participant Server as Express Backend
    participant Gemini as Google Gemini AI
    participant TTS as Edge-TTS Synth

    User->>Widget: "What box size do I need for a 10x6x4 item?"
    Widget->>Server: POST /api/chat { message }
    Server->>Server: Enforce Domain Rules & System Prompt
    Server->>Gemini: Generate Packaging Advice
    Gemini-->>Server: Response (Dimensions + Kraft/Mailer recommendations)
    
    opt Voice Response Enabled
        Server->>TTS: Synthesize Neural Audio
        TTS-->>Server: Audio Buffer
    end

    Server-->>Widget: HTTP 200 { text, audioUrl }
    Widget-->>User: Display Text + Play Audio Stream
```

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v18+) & Express | Event-driven server engine |
| **Primary AI** | `@google/genai` | Google Gemini 2.5 Flash / Pro |
| **Secondary AI** | OpenRouter API | Fallback open-source LLMs |
| **Speech Engine** | Edge-TTS / WebSocket | Real-time neural voice synthesis |
| **Styling** | Vanilla CSS & Modern Glassmorphism | Custom design tokens & zero dependencies |
| **Security** | Dotenv & Hardened `.gitignore` | Zero credential exposure |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** v18.0.0 or higher
* **npm** v9.0.0 or higher

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/aimuhammadabuzarqureshi-cloud/PackFocus-Bot.git
   cd PackFocus-Bot
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the `.env.example` template and add your API keys:
   ```bash
   cp .env.example .env
   ```

4. **Launch Development Server**:
   ```bash
   npm start
   ```
   Open `http://localhost:3000` in your browser to interact with the widget.

---

## 🔐 Environment Setup

Create a `.env` file in the root directory. PackFocus-Bot supports multiple provider fallbacks:

```env
# ─── Gemini API Config ──
GEMINI_API_KEY=your_gemini_api_key_here

# ─── OpenRouter Config (Fallback) ──
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openrouter/free

# ─── Server Config ──
PORT=3000
HOST=0.0.0.0

# ─── Company & Catalog Context ──
COMPANY_NAME=PackVibe Solutions
COMPANY_DESCRIPTION=Custom mailer boxes, shipping boxes, product gift boxes, kraft packaging.

# ─── Optional Premium Voice Engines ──
SMALLEST_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_API_KEY=
```

---

## 📡 API Reference

### `POST /api/chat`
Sends a message to PackFocus-Bot.

**Request Body**:
```json
{
  "message": "Which custom box material is best for heavy shipping?",
  "history": []
}
```

**Response**:
```json
{
  "reply": "For heavy shipping items, Corrugated Kraft Cardboard (E-flute or B-flute) is recommended due to its high burst strength...",
  "audio": "data:audio/mp3;base64,..."
}
```

---

## 🔒 Security and Secret Protection

PackFocus-Bot incorporates strict security policies:
* **Zero Key Leak Guarantee**: Strict `.gitignore` rules prevent `.env`, OAuth `client_secret*.json`, certificates (`*.pem`), and `debug_*.json` files from ever touching source control.
* **Environment Isolation**: All keys are retrieved dynamically at runtime via `process.env`.
* **Sanitized Logs**: Debug logging strips and redacts token headers before file output.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

<div align="center">

---
**Made with ❤️ by [PackVibe Solutions / Muhammad Abuzar Qureshi](https://github.com/aimuhammadabuzarqureshi-cloud)**

</div>

<!-- Co-authored contribution badge patch -->
