/**
 * Test ACTUAL image generation with models available on this API key
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function testImageGen() {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `A premium custom printed kraft brown mailer box with a minimalist black logo on the front face, 
professional product photography, isolated on clean white studio backdrop, 
high resolution, soft studio lighting, slight shadow underneath, luxury packaging aesthetic`;

  console.log('═══════════════════════════════════════════════');
  console.log('  🎨 Testing Image Generation');
  console.log('═══════════════════════════════════════════════\n');

  // ── Test 1: gemini-2.5-flash-image (Nano Banana) ──
  console.log('─── Test 1: gemini-2.5-flash-image ───');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
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
          const filename = `test_packaging_flash.${ext}`;
          const outputPath = path.join(__dirname, 'uploads', 'generated', filename);
          fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));
          const sizeKB = (Buffer.from(imageData, 'base64').length / 1024).toFixed(1);
          console.log(`✅ IMAGE GENERATED! Saved to: ${outputPath} (${sizeKB} KB)`);
        }
        if (part.text) {
          console.log(`   AI: "${part.text.substring(0, 120)}..."`);
        }
      }
    }
  } catch (err) {
    console.log(`❌ Failed: ${err.message?.substring(0, 200)}`);
  }
  console.log('');

  // ── Test 2: Imagen 4 Fast ──
  console.log('─── Test 2: Imagen 4 Fast ───');
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
      }
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const img = response.generatedImages[0];
      const imageData = img.image.imageBytes;
      const filename = 'test_packaging_imagen4.png';
      const outputPath = path.join(__dirname, 'uploads', 'generated', filename);
      fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));
      const sizeKB = (Buffer.from(imageData, 'base64').length / 1024).toFixed(1);
      console.log(`✅ IMAGE GENERATED! Saved to: ${outputPath} (${sizeKB} KB)`);
    }
  } catch (err) {
    console.log(`❌ Failed: ${err.message?.substring(0, 200)}`);
  }
  console.log('');

  console.log('Done! Check uploads/generated/ for output images.\n');
}

testImageGen();
