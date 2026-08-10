const fs = require('fs');
require('dotenv').config();

async function run() {
  const systemPrompt = "You are a custom packaging assistant.";
  const messages = [
    { role: 'user', content: 'Hi, what products do you offer?' },
    { role: 'assistant', content: 'We offer Custom Mailer Boxes and Shipping Boxes.' },
    { role: 'user', content: 'can you make a sample box with this logo?' }
  ];
  
  const log = {
    time: new Date().toISOString(),
    key_starts: process.env.OPENROUTER_API_KEY?.substring(0, 15),
    model: process.env.OPENROUTER_MODEL,
    response: null,
    error: null
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Chatbot Multi-Turn Debug'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 100
      })
    });

    const status = response.status;
    log.status = status;
    const data = await response.json();
    log.response = data;
  } catch (err) {
    log.error = err.message;
  }

  fs.writeFileSync('/home/ghostshadow/Desktop/chatbot/debug_error_multiturn.json', JSON.stringify(log, null, 2));
  console.log('debug_error_multiturn.json has been written!');
}

run();
