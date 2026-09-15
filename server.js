import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.setHeader('Content-Type',({'html':'text/html','css':'text/css','js':'text/javascript','json':'application/json'})[path.extname(file).slice(1)]||'text/plain');res.end(data);});}).listen(4173,'127.0.0.1',()=>console.log('ETH Ledger: http://127.0.0.1:4173'));
