/**
 * Quick Gemini API connectivity test
 * 
 * The client_secret JSON file is an OAuth 2.0 credential — it's used for
 * user authentication flows, NOT for direct API calls to Gemini.
 * 
 * To call Gemini directly, you need a Gemini API Key from:
 *   https://aistudio.google.com/apikey
 * 
 * This script tests both:
 *   1. Direct Gemini API key (if GEMINI_API_KEY is set in .env)
 *   2. Falls back to checking if the OAuth client secret can be used
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function testGeminiWithApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ No GEMINI_API_KEY found in .env');
    console.log('');
    console.log('👉 To get a Gemini API key:');
    console.log('   1. Go to https://aistudio.google.com/apikey');
    console.log('   2. Click "Create API key"');
    console.log('   3. Select your project "stalwart-fx-496316-d1"');
    console.log('   4. Copy the key and add to .env as: GEMINI_API_KEY=your-key-here');
    console.log('');
    return false;
  }

  console.log(`🔑 Using API key: ${apiKey.substring(0, 10)}...`);

  try {
    // Test with the @google/genai SDK
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    console.log('📡 Sending test message to Gemini (gemini-2.5-flash)...');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Say hello in one short sentence. Just reply with the greeting, nothing else.'
    });

    const text = response.text;
    console.log('');
    console.log('✅ SUCCESS! Gemini responded:');
    console.log(`   "${text}"`);
    console.log('');
    console.log('🎉 Gemini API is working! Ready to integrate into the chatbot.');
    return true;
  } catch (err) {
    console.error('');
    console.error('❌ Gemini API call failed:', err.message);
    
    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('401')) {
      console.error('   → The API key is invalid. Generate a new one at https://aistudio.google.com/apikey');
    } else if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('403')) {
      console.error('   → API key lacks permission. Make sure the Generative Language API is enabled in your Google Cloud project.');
      console.error('   → Enable it at: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
    } else if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
      console.error('   → Rate limit hit. The API is reachable but you need to wait or upgrade quota.');
    }
    return false;
  }
}

function inspectClientSecret() {
  const secretFiles = fs.readdirSync(__dirname).filter(f => f.startsWith('client_secret'));
  
  if (secretFiles.length === 0) {
    console.log('ℹ️  No client_secret file found.');
    return;
  }

  for (const file of secretFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf-8'));
    console.log(`\n📋 Found OAuth client secret: ${file}`);
    console.log(`   Project ID: ${data.web?.project_id || 'unknown'}`);
    console.log(`   Client ID:  ${data.web?.client_id || 'unknown'}`);
    console.log('');
    console.log('   ⚠️  This is an OAuth 2.0 credential (for user login flows).');
    console.log('   ⚠️  It CANNOT be used directly to call the Gemini API.');
    console.log('   ⚠️  You need a separate API key from Google AI Studio.');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🧪 Gemini API Connectivity Test');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  inspectClientSecret();
  console.log('');
  
  const success = await testGeminiWithApiKey();
  
  if (!success) {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  📝 NEXT STEPS:');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('  1. Go to https://aistudio.google.com/apikey');
    console.log('  2. Create an API key for project "stalwart-fx-496316-d1"');
    console.log('  3. Add to your .env file:');
    console.log('     GEMINI_API_KEY=AIzaSy...(your key)');
    console.log('  4. Run this script again: node test_gemini.js');
    console.log('');
  }
}

main();
