import {inflateRawSync} from 'node:zlib';
import {validateFiles} from './integrations.mjs';
// Only bounded, single-disk, ordinary ZIP archives; never extract to disk.
export function readZip(data){
 const b=Buffer.from(data,'base64');if(b.length>5242880||b.length<22)throw Error('Invalid ZIP size');
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break}if(end<0)throw Error('Invalid ZIP directory');
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12),offset=b.readUInt32LE(end+16);if(b.readUInt16LE(end+4)||b.readUInt16LE(end+6)||b.readUInt16LE(end+8)!==count||count>1000||offset+size!==end)throw Error('Unsupported ZIP directory');
 let pos=offset,total=0;const files=[];for(let i=0;i<count;i++){
 if(pos+46>end||b.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid ZIP entry');
 const flags=b.readUInt16LE(pos+8),method=b.readUInt16LE(pos+10),compressed=b.readUInt32LE(pos+20),length=b.readUInt32LE(pos+24),nl=b.readUInt16LE(pos+28),extra=b.readUInt16LE(pos+30),comment=b.readUInt16LE(pos+32),mode=b.readUInt32LE(pos+38)>>>16,local=b.readUInt32LE(pos+42),next=pos+46+nl+extra+comment;if(next>end||flags&1||![0,8].includes(method)||(mode&0xf000)===0xa000)throw Error('Unsupported ZIP entry');const path=b.subarray(pos+46,pos+46+nl).toString('utf8');pos=next;
 if(path.startsWith('/')||path.includes('\\')||path.includes('\0')||path.split('/').includes('..')||/^[A-Za-z]:/.test(path))throw Error('Unsafe ZIP path');if(path.endsWith('/'))continue;
 if(path.split('/').some(x=>x.startsWith('.')||/^(node_modules|venv|__pycache__|credentials|secrets)$/i.test(x))||/(?:\.pem|\.key|\.p12|\.sqlite3?-wal|\.sqlite3?-shm|\.db-wal|\.db-shm|\.sqlite3?-journal|\.db-journal|\.env|\.exe|\.dll|\.zip)$/i.test(path)||/password|credential|secret|token/i.test(path.split('/').at(-1)))continue;
 total+=length;if(total>5242880||files.length>=200)throw Error('ZIP exceeds expanded limits');if(local+30>offset||b.readUInt32LE(local)!==0x04034b50)throw Error('Invalid ZIP local header');const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);if(start+compressed>offset)throw Error('Invalid ZIP data');const raw=b.subarray(start,start+compressed),out=method===0?raw:inflateRawSync(raw,{maxOutputLength:Math.max(1,length)});if(out.length!==length)throw Error('ZIP size mismatch');files.push({path,data:out.toString('base64')});}
 if(pos!==end)throw Error('Invalid ZIP directory length');return validateFiles(files);
}
