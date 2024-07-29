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

  client.on("message", async (msg) => {
    try {
      console.log("Received a message:", msg.body);
      const chat = await msg.getChat();
      console.log("Chat details:", chat);

      const message = msg.body.toLowerCase();
      const responses = {
        hi: '👋 **Welcome to Aurify!** 🌟\n\nWe’re thrilled to have you here! How can we assist you today?\n1️⃣ **Explore Our Products**\n2️⃣ **Get Sales Support**\nJust reply with the number of your choice or type *"Menu"* to see the options again.',
        1: '🔍 **Product Enquiry** 🛍️\n\nChoose from our exciting options below:\n• **Bullion View** 💹 - Get real-time insights into the bullion market.\n• **Scratch & Win** 🎟️ - Try our scratch cards and win amazing prizes!\n• **KYC System** 🛡️ - Ensure secure and compliant customer verification.\nReply with the name of the option or type *"Menu"* to return to the main menu.',
        2: "📞 **Sales Support** 🤝\n\nNeed assistance? Contact our dedicated support team:\n📞 **Phone:** *123-456-7890*\n✉️ **Email:** *sales@aurify.com*\nWe’re here to help you with anything you need!",
        "bullion view":
          '📊 **Bullion View** 🌟\n\nGet exclusive real-time insights into the bullion market! 📈\nWould you like to book a demo to see it in action?\nReply with *"Book Demo"* to schedule a demo or *"More Info"* for additional details. Type *"Menu"* to return to the main menu.',
        "book demo":
          '📅 **Book a Demo** 🗓️\n\nWe’d love to show you our Bullion View live! To schedule your demo, please provide us with your preferred date and time.\nAlternatively, you can reach out to us directly:\n📞 **Phone:** *123-456-7890*\n✉️ **Email:** *demo@aurify.com*\nType *"Menu"* to return to the main menu.',
        "scratch & win":
          '🎉 **Scratch & Win** 🎁\n\nFeeling lucky? Try out our scratch cards and reveal exciting prizes! 🎊\nReply with *"Participate"* to join the fun or type *"Menu"* to return to the main menu.',
        "kyc system":
          '🔒 **KYC System** ✅\n\nOur KYC system ensures secure and compliant customer verification. 🔍\nFor more information or to get started, reply with *"Get Started"* or type *"Menu"* to return to the main menu.',
        menu: '📋 **Main Menu** 🔄\n\nPlease select an option to proceed:\n1️⃣ **Explore Our Products**\n2️⃣ **Get Sales Support**\nReply with the number of your choice or type *"Hi"* or *"Hello"* to start over.',
      };

      const response =
        responses[message] ||
        '❓ **Invalid Option** 🚫\n\nIt looks like there was a mistake. Please type *"Hi"* or *"Hello"* to start again or choose an option from the menu.';
      await chat.sendMessage(response);
    } catch (err) {
      console.error("Error handling message:", err);
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
