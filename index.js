const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Configuration
const CONFIG = {
  CX3_URL: process.env.CX3_URL,
  CX3_USERNAME: process.env.CX3_USERNAME,
  CX3_PASSWORD: process.env.CX3_PASSWORD,
  LOGIN_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  BROWSER_ARGS: [
    '--no-sandbox',
    '--disable-setuid-sandbox', 
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ]
};

// Global variables
let browserSession = null;
let lastLogin = null;
let loginInProgress = false;

// 3CX Login Function
async function login3CX() {
  if (loginInProgress) {
    console.log('Login already in progress, waiting...');
    while (loginInProgress) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return !!browserSession;
  }

  loginInProgress = true;
  
  try {
    console.log('Starting 3CX login process...');
    
    if (browserSession) {
      try {
        await browserSession.close();
      } catch (e) {
        console.log('Error closing existing browser:', e.message);
      }
      browserSession = null;
    }

    console.log('Launching browser...');
    browserSession = await puppeteer.launch({
      headless: true,
      args: CONFIG.BROWSER_ARGS
    });

    const page = await browserSession.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log(`Navigating to 3CX: ${CONFIG.CX3_URL}`);
    await page.goto(CONFIG.CX3_URL, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('Waiting for login form...');
    await page.waitForSelector([
      'input[name="username"]',
      'input[name="login"]', 
      '#username',
      '#user',
      '.username-input',
      'input[type="text"]'
    ].join(','), { timeout: 15000 });
    
    console.log('Login form found, entering credentials...');
    
    // Enter username
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="login"]',
      '#username', 
      '#user',
      '.username-input'
    ];
    
    let usernameEntered = false;
    for (const selector of usernameSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await page.type(selector, CONFIG.CX3_USERNAME);
          usernameEntered = true;
          console.log(`Username entered using selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!usernameEntered) {
      throw new Error('Could not find username field');
    }
    
    // Enter password
    const passwordSelectors = [
      'input[name="password"]',
      'input[name="pass"]',
      '#password',
      '#pass',
      '.password-input',
      'input[type="password"]'
    ];
    
    let passwordEntered = false;
    for (const selector of passwordSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await page.type(selector, CONFIG.CX3_PASSWORD);
          passwordEntered = true;
          console.log(`Password entered using selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!passwordEntered) {
      throw new Error('Could not find password field');
    }
    
    console.log('Clicking login button...');
    
    // Click login button
    const loginButtonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      '.login-button',
      '.submit-button',
      '#login-button',
      '#submit'
    ];
    
    let loginClicked = false;
    for (const selector of loginButtonSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await page.click(selector);
          loginClicked = true;
          console.log(`Login clicked using selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!loginClicked) {
      throw new Error('Could not find login button');
    }
    
    console.log('Waiting for dashboard to load...');
    await page.waitForSelector([
      '.extension-status',
      '.presence-indicator', 
      '.user-status',
      '.dashboard',
      '.extensions-list',
      '.main-content'
    ].join(','), { timeout: 20000 });
    
    console.log('Successfully logged into 3CX dashboard');
    await page.close();
    lastLogin = Date.now();
    loginInProgress = false;
    return true;
    
  } catch (error) {
    console.error('3CX login failed:', error.message);
    loginInProgress = false;
    
    if (browserSession) {
      try {
        await browserSession.close();
      } catch (e) {
        console.log('Error closing browser after login failure:', e.message);
      }
      browserSession = null;
    }
    return false;
  }
}

// Session Management
async function ensureLoggedIn() {
  const needsLogin = !browserSession || 
                    !lastLogin || 
                    (Date.now() - lastLogin) > CONFIG.LOGIN_TIMEOUT;
  
  if (needsLogin) {
    console.log('Login required, initiating 3CX login...');
    return await login3CX();
  }
  
  try {
    const pages = await browserSession.pages();
    return true;
  } catch (error) {
    console.log('Browser session appears dead, re-logging in...');
    return await login3CX();
  }
}

// Extension Status Checking
async function getExtensionStatus(extensionNumber) {
  console.log(`Checking status for extension: ${extensionNumber}`);
  
  const loggedIn = await ensureLoggedIn();
  if (!loggedIn) {
    throw new Error('Failed to login to 3CX');
  }

  const page = await browserSession.newPage();
  
  try {
    const extensionsUrl = `${CONFIG.CX3_URL}/webclient/#/extensions`;
    console.log(`Navigating to: ${extensionsUrl}`);
    
    await page.goto(extensionsUrl, { 
      waitUntil: 'networkidle0',
      timeout: 15000 
    });
    
    await page.waitForSelector([
      '.extension-list',
      '.extensions-table', 
      '.user-list',
      '.extensions-grid',
      'table'
    ].join(','), { timeout: 10000 });
    
    console.log('Extensions page loaded, searching for extension...');
    
    const statusInfo = await page.evaluate((extNumber) => {
      console.log('Searching for extension:', extNumber);
      
      const possibleContainers = [
        ...document.querySelectorAll('.extension-row'),
        ...document.querySelectorAll('.user-row'),
        ...document.querySelectorAll('tr'),
        ...document.querySelectorAll('.extension-item'),
        ...document.querySelectorAll('.user-item'),
        ...document.querySelectorAll('[data-extension]')
      ];
      
      console.log('Found', possibleContainers.length, 'potential containers');
      
      for (let container of possibleContainers) {
        const numberElements = [
          ...container.querySelectorAll('.extension-number'),
          ...container.querySelectorAll('.user-number'),
          ...container.querySelectorAll('.number'),
          ...container.querySelectorAll('[data-extension]'),
          ...container.querySelectorAll('td')
        ];
        
        const foundExtension = numberElements.some(el => {
          const text = el.textContent || el.getAttribute('data-extension') || '';
          return text.includes(extNumber);
        });
        
        if (foundExtension) {
          console.log('Found extension container');
          
          const statusElements = [
            ...container.querySelectorAll('.status'),
            ...container.querySelectorAll('.presence'),
            ...container.querySelectorAll('.state'),
            ...container.querySelectorAll('.extension-status'),
            ...container.querySelectorAll('.user-status'),
            ...container.querySelectorAll('[class*="status"]'),
            ...container.querySelectorAll('[class*="presence"]')
          ];
          
          for (let statusEl of statusElements) {
            const classes = statusEl.className.toLowerCase();
            const text = statusEl.textContent.toLowerCase().trim();
            
            console.log('Status element classes:', classes);
            console.log('Status element text:', text);
            
            if (classes.includes('available') || 
                classes.includes('online') || 
                text.includes('available') || 
                text.includes('online')) {
              return { 
                status: 'Available', 
                registered: true,
                details: `Classes: ${classes}, Text: ${text}`
              };
            }
            
            if (classes.includes('busy') || 
                classes.includes('on-call') || 
                text.includes('busy') || 
                text.includes('on call')) {
              return { 
                status: 'Busy', 
                registered: true,
                details: `Classes: ${classes}, Text: ${text}`
              };
            }
            
            if (classes.includes('away') || 
                classes.includes('absent') || 
                text.includes('away') || 
                text.includes('absent')) {
              return { 
                status: 'Away', 
                registered: true,
                details: `Classes: ${classes}, Text: ${text}`
              };
            }
            
            if (classes.includes('dnd') || 
                classes.includes('do-not-disturb') || 
                text.includes('do not disturb') || 
                text.includes('dnd')) {
              return { 
                status: 'DND', 
                registered: true,
                details: `Classes: ${classes}, Text: ${text}`
              };
            }
          }
          
          return { 
            status: 'Unknown', 
            registered: false,
            details: 'Extension found but status unclear'
          };
        }
      }
      
      return { 
        status: 'Not Found', 
        registered: false,
        details: 'Extension not found on page'
      };
      
    }, extensionNumber);

    console.log('Status check result:', statusInfo);
    return statusInfo;
    
  } finally {
    await page.close();
  }
}

// API Endpoints
app.post('/check-status', async (req, res) => {
  try {
    const { extension } = req.body;
    
    if (!extension) {
      return res.status(400).json({ 
        error: 'Extension number required',
        usage: 'POST /check-status with {"extension": "100"}'
      });
    }

    console.log(`Status check requested for extension: ${extension}`);
    const statusInfo = await getExtensionStatus(extension.toString());
    
    const response = {
      extension: extension,
      status: statusInfo.status,
      registered: statusInfo.registered,
      timestamp: new Date().toISOString(),
      details: statusInfo.details,
      service: 'harts-3cx-status-v1.0'
    };
    
    console.log('Returning status:', response);
    res.json(response);

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check extension status',
      message: error.message,
      extension: req.body.extension,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'ok',
    service: 'harts-3cx-status-v1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    browser: {
      connected: !!browserSession,
      lastLogin: lastLogin ? new Date(lastLogin).toISOString() : null,
      loginAge: lastLogin ? Math.floor((Date.now() - lastLogin) / 1000) : null
    },
    config: {
      cx3Url: CONFIG.CX3_URL,
      hasCredentials: !!(CONFIG.CX3_USERNAME && CONFIG.CX3_PASSWORD)
    }
  };
  
  res.json(healthInfo);
});

// Test endpoint
app.get('/test-login', async (req, res) => {
  try {
    const result = await login3CX();
    res.json({
      success: result,
      message: result ? 'Login successful' : 'Login failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(port, async () => {
  console.log('=================================');
  console.log('🚀 Harts 3CX Status Service');
  console.log('=================================');
  console.log(`📡 Server running on port ${port}`);
  console.log(`🌐 3CX URL: ${CONFIG.CX3_URL}`);
  console.log(`👤 Username: ${CONFIG.CX3_USERNAME}`);
  console.log(`🔑 Password: ${CONFIG.CX3_PASSWORD ? '[SET]' : '[NOT SET]'}`);
  console.log('=================================');
  
  if (CONFIG.CX3_URL && CONFIG.CX3_USERNAME && CONFIG.CX3_PASSWORD) {
    console.log('🔄 Performing initial 3CX login...');
    const loginSuccess = await login3CX();
    console.log(`✅ Initial login: ${loginSuccess ? 'SUCCESS' : 'FAILED'}`);
  } else {
    console.log('⚠️ Missing 3CX credentials - login skipped');
  }
  
  console.log('=================================');
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  if (browserSession) {
    try {
      await browserSession.close();
      console.log('✅ Browser session closed');
    } catch (error) {
      console.log('❌ Error closing browser:', error.message);
    }
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
