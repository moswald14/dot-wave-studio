'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'dist');
const port = process.argv[3] ? Number(process.argv[3]) : 17862;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a preview port from 1024 to 65535.');
const types = {'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.zip':'application/zip','.png':'image/png','.wav':'audio/wav'};
const server = http.createServer((req,res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405);res.end();return;}
  let url; try {url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);} catch {res.writeHead(400);res.end();return;}
  const relative = url === '/' ? 'Dot-Wave-Studio-2.0.0.html' : url.slice(1);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || !types[path.extname(target)] || !fs.existsSync(target) || !fs.statSync(target).isFile()) {res.writeHead(404);res.end('File not found.');return;}
  res.writeHead(200, {'Content-Type':types[path.extname(target)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(target).pipe(res);
});
server.listen(port, '127.0.0.1', () => console.log('Dot Wave Studio 2 is at http://127.0.0.1:'+port+'/'));
