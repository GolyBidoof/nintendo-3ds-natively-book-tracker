const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PORT = process.env.PORT || 3000;

let sessionToken = null;
let csrfToken = null;
let lastFetchTime = null;
const CACHE_DURATION = 1000 * 60 * 60 * 24;

const getBrowserTokens = async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
    });
    
    const page = await browser.newPage();
    await page.goto('https://learnnatively.com/search/jpn/books/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    const cookies = await page.cookies();
    
    let session = null;
    let csrf = null;
    
    cookies.forEach(cookie => {
      if (cookie.name === 'sessionid') session = cookie.value;
      if (cookie.name === 'csrftoken') csrf = cookie.value;
    });
    
    if (csrf) {
      sessionToken = session || '';
      csrfToken = csrf;
      lastFetchTime = Date.now();
      return { session: sessionToken, csrf: csrfToken };
    }
    
    throw new Error('Failed to get tokens');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const getValidTokens = async () => {
  const now = Date.now();
  const needsRefresh = !csrfToken || !lastFetchTime || (now - lastFetchTime > CACHE_DURATION);

  if (needsRefresh) {
    await getBrowserTokens();
  }

  return { session: sessionToken, csrf: csrfToken };
};

const serveFile = (res, filePath, contentType) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
    return;
  }

  if (req.method === 'GET' && req.url === '/styles.css') {
    serveFile(res, path.join(__dirname, 'styles.css'), 'text/css');
    return;
  }

  if (req.method === 'GET' && req.url === '/app.js') {
    serveFile(res, path.join(__dirname, 'app.js'), 'application/javascript');
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/proxy') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const tokens = await getValidTokens();
        const { endpoint, body: requestBody } = JSON.parse(body);

        let options;
        if (endpoint === 'stats') {
          const year = requestBody?.year || new Date().getFullYear();
          
          options = {
            hostname: 'learnnatively.com',
            path: `/profile-activity-api/GolyBidoof/?time_filter=${year}&stats_type=books`,
            method: 'GET',
            headers: {
              'Cookie': `sessionid=${tokens.session}; csrftoken=${tokens.csrf}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          };
        } else {
          options = {
            hostname: 'learnnatively.com',
            path: '/api/item-library-search-api/GolyBidoof/',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': tokens.csrf,
              'Cookie': `sessionid=${tokens.session}; csrftoken=${tokens.csrf}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          };
        }

        const proxyReq = https.request(options, (proxyRes) => {
          let data = '';

          proxyRes.on('data', chunk => {
            data += chunk;
          });

          proxyRes.on('end', () => {
            if (proxyRes.statusCode === 403) {
              lastFetchTime = 0;
            }
            
            res.writeHead(proxyRes.statusCode, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(data);
          });
        });

        proxyReq.on('error', () => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request failed' }));
        });

        if (options.method === 'POST') {
          proxyReq.write(JSON.stringify(requestBody));
        }
        proxyReq.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, async () => {
  try {
    await getBrowserTokens();
  } catch (error) {
    
  }
});
