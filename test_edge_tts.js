const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

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

function generateEdgeTTS(text, voice = 'en-US-AriaNeural') {
  return new Promise((resolve, reject) => {
    const token = generateSecMsGecToken();
    const connectionId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

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

    ws.on('open', () => {
      // 1. Send Config
      const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"system":{"name":"SpeechSDK","version":"1.12.1-rc.1","build":"JavaScript","lang":"JavaScript","os":{"platform":"Browser/Linux","name":"Chrome","version":"130.0.0.0"}}}}`;
      ws.send(configMsg);

      // 2. Send SSML request
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><rate speed='0%' pitch='0%'>${text}</rate></voice></speak>`;
      const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Binary packet: first 2 bytes are the header length (16-bit Big Endian)
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

// Quick self test
generateEdgeTTS('Hello, this is a highly realistic neural voice generated from scratch without any paid API keys!')
  .then(buffer => {
    console.log('Success! Generated audio size:', buffer.length, 'bytes');
    fs.writeFileSync(path.join(__dirname, 'test.mp3'), buffer);
    console.log('Saved to test.mp3');
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
