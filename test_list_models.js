/**
 * List all available Gemini models for this API key
 */
require('dotenv').config();

async function listModels() {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  console.log('═══════════════════════════════════════════════');
  console.log('  📋 Available Models for your API Key');
  console.log('═══════════════════════════════════════════════\n');

  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    
    const imageModels = [];
    const textModels = [];
    
    for await (const model of pager) {
      const name = model.name || '';
      const methods = model.supportedActions || model.supportedGenerationMethods || [];
      const desc = model.displayName || model.description || '';
      
      const entry = {
        name,
        displayName: desc,
        methods: methods.join(', ')
      };

      // Check if model name suggests image capability
      if (name.includes('imagen') || name.includes('image') || desc.toLowerCase().includes('image')) {
        imageModels.push(entry);
      } else {
        textModels.push(entry);
      }
    }

    if (imageModels.length > 0) {
      console.log('🎨 IMAGE-CAPABLE MODELS:');
      for (const m of imageModels) {
        console.log(`   ✅ ${m.name} (${m.displayName})`);
        if (m.methods) console.log(`      Methods: ${m.methods}`);
      }
      console.log('');
    } else {
      console.log('❌ No image generation models found for this API key.\n');
    }

    console.log(`📝 TEXT MODELS (${textModels.length} total):`);
    for (const m of textModels) {
      console.log(`   • ${m.name} (${m.displayName})`);
    }
    console.log('');

  } catch (err) {
    console.error('❌ Failed to list models:', err.message);
  }
}

listModels();
