const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const SESSION_TOKEN = '9qf7n7iu7hq984r1p1ossq7ho1yxmb5z';
const CSRF_TOKEN = 'u3dny7Go64ifDqxjho7sNQL0mXqWEQ5U9drRv8RMeYLwyoUJNiqDVErxhHR5u9mx';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.writeHead(200) && res.end();

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (req.method === 'POST' && req.url === '/api/proxy') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { endpoint, body: requestBody } = JSON.parse(body);

        let options;
        if (endpoint === 'stats') {
          const year = requestBody?.year || new Date().getFullYear();
          options = {
            hostname: 'learnnatively.com',
            path: `/profile-activity-api/GolyBidoof/?time_filter=${year}&stats_type=books`,
            method: 'GET',
            headers: {
              'Cookie': `sessionid=${SESSION_TOKEN}; csrftoken=${CSRF_TOKEN}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://learnnatively.com/'
            }
          };
        } else {
          options = {
            hostname: 'learnnatively.com',
            path: '/api/item-library-search-api/GolyBidoof/',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': CSRF_TOKEN,
              'Cookie': `sessionid=${SESSION_TOKEN}; csrftoken=${CSRF_TOKEN}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://learnnatively.com/',
              'Origin': 'https://learnnatively.com'
            }
          };
        }

        const proxyReq = https.request(options, (proxyRes) => {
          let data = '';

          proxyRes.on('data', chunk => {
            data += chunk;
          });

          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, {
              'Content-Type': 'application/json'
            });
            res.end(data);
          });
        });

        proxyReq.on('error', () => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'failed' }));
        });

        if (options.method === 'POST') {
          proxyReq.write(JSON.stringify(requestBody));
        }
        proxyReq.end();
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'error' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
