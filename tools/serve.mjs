import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
createServer(async (req,res)=>{try{let path=decodeURIComponent((req.url||'/').split('?')[0]);if(path==='/')path='/index.html';let file=normalize(join(root,path));if(!file.startsWith(normalize(root)))throw Error('bad path');if(!(await stat(file)).isFile())throw Error('not file');res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
