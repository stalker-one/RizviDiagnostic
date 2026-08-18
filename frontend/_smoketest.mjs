import http from 'node:http';
import handler from './api/index.js';

const server = http.createServer((req, res) => handler(req, res));

function call(method, pathName, body) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: '127.0.0.1', port, method, path: pathName, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

server.listen(0, async () => {
  try {
    const health = await call('GET', '/api/health');
    console.log('HEALTH', health.status, health.body);

    const login = await call('POST', '/api/auth/login', {
      email: 'admin@rizvidiagnostic.com',
      password: 'Admin@123',
    });
    console.log('LOGIN', login.status, login.body.slice(0, 200));

    const bad = await call('POST', '/api/auth/login', {
      email: 'admin@rizvidiagnostic.com',
      password: 'wrong',
    });
    console.log('BADLOGIN', bad.status, bad.body);
  } catch (e) {
    console.error('SMOKETEST ERROR', e);
  } finally {
    server.close();
    process.exit(0);
  }
});
