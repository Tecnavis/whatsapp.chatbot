import qrcode from 'qrcode';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WAWebJS from 'whatsapp-web.js';
const { Client, LocalAuth } = WAWebJS;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const closeFileHandles = async (filePath) => {
  try {
    const fd = await fs.open(filePath, 'r');
    await fd.close();
    console.log(`File handle closed: ${filePath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log(`Error closing file handle: ${filePath}`, error);
    }
  }
};

const safeUnlinkSync = (filePath, retries = 5, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      fsSync.closeSync(fsSync.openSync(filePath, 'r'));
      fsSync.unlinkSync(filePath);
      console.log(`Successfully unlinked: ${filePath}`);
      return;
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EPERM') {
        console.log(`Retrying unlink: ${filePath} (attempt ${i + 1})`);
        const waitTill = new Date(new Date().getTime() + delay);
        while(waitTill > new Date()){} // simple delay
      } else if (error.code === 'ENOENT') {
        console.log(`File not found, skipping unlink: ${filePath}`);
        return;
      } else {
        throw error;
      }
    }
  }
  console.error(`Failed to unlink: ${filePath} after ${retries} attempts`);
};

class SafeLocalAuth extends LocalAuth {
  async logout() {
    const sessionPath = path.join(__dirname, '..', '.wwebjs_auth', `session-${this.clientId}`, 'Default');
    
    const filesToUnlink = [
      'chrome_debug.log',
      'Cookies',
      'Cookies-journal',
      'Preferences',
      'Secure Preferences'
    ].map(file => path.join(sessionPath, file));
    
    for (const filePath of filesToUnlink) {
      try {
        await closeFileHandles(filePath);
        safeUnlinkSync(filePath);
      } catch (error) {
        console.error(`Error during unlinking ${filePath}:`, error);
      }
    }

    try {
      return await super.logout();
    } catch (error) {
      console.error('Error during super logout:', error);
    }
  }
}

export const ChatBotStart = async (req, res) => {
  let responseSent = false;

  const clientId = 'new-session-' + Date.now();
  const client = new Client({
    puppeteer: { headless: true },
    authStrategy: new SafeLocalAuth({ clientId }),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
  });

  const sendResponse = (status, data) => {
    if (!responseSent) {
      res.status(status).json(data);
      responseSent = true;
    }
  };

  client.on('qr', qr => {
    if (responseSent) return;
    console.log('Generating QR Code...');
    qrcode.toDataURL(qr, (err, url) => {
      if (err) {
        console.error('Error generating QR code', err);
        sendResponse(500, { status: false, message: 'Error generating QR code' });
        return;
      }
      sendResponse(200, { qrCodeUrl: url, status: 'QR Code Generated' });
    });
  });

  client.on('ready', async () => {
    console.log('Client is ready!');
    try {
      const user = client.info;
      if (!user) throw new Error('User info is undefined or null');
      
      const userInfo = {
        id: user.wid._serialized,
        name: user.pushname || 'Unknown',
        phone: user.wid.user,
      };
      console.log(userInfo);
      
      sendResponse(200, { status: 'Client is ready', userInfo });
    } catch (err) {
      console.error('Error fetching user info:', err.message);
      sendResponse(500, { status: false, message: 'Failed to fetch user info' });
    }
  });

  client.on('auth_failure', message => {
    console.error('Authentication failure:', message);
    sendResponse(500, { status: false, message: 'Authentication failed' });
  });

  client.on('disconnected', reason => {
    console.log('Client was logged out:', reason);
    sendResponse(500, { status: false, message: 'Client was logged out' });
  });

  try {
    await client.initialize();
    console.log('Client initialized successfully.');
  } catch (err) {
    console.error('Error initializing client:', err);
    sendResponse(500, { status: false, message: 'Failed to initialize client' });
  }
};

export default ChatBotStart;
