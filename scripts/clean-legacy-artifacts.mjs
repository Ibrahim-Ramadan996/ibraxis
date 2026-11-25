// Intentionally conservative: current deploy, project data, revision history and backups are never touched.
// Default is preview only. --apply removes only untracked root-level legacy release ZIP/PATCH files.
import {readdirSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(new URL('..',import.meta.url).pathname);
const apply=process.argv.includes('--apply');
const allowed=/^(?:IBRAXIS[-_](?:V|v|UI|Portfolio|v2)[\w.-]*|ibraxis[-_]v[\w.-]*|ibraxis-full)\.(?:patch|zip)$/i;
const candidates=readdirSync(root,{withFileTypes:true}).filter(x=>x.isFile()&&allowed.test(x.name)&&!/^IBRAXIS-V2\.5\.3\.9(?:[-_.]|$)/i.test(x.name)).map(x=>x.name);
const tracked=[],untracked=[];
try{execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,stdio:'ignore'});}catch{console.log('No Git repository detected. No files will be deleted.');process.exit(0)}
for(const filename of candidates){
 try{execFileSync('git',['ls-files','--error-unmatch','--',filename],{cwd:root,stdio:'ignore'});tracked.push(filename)}
 catch{untracked.push(filename)}
}
console.log(`Legacy root archives: ${untracked.length} untracked, ${tracked.length} tracked.`);
for(const f of untracked)console.log(`${apply?'REMOVE':'PREVIEW'}: ${f}`);
for(const f of tracked)console.log(`KEPT (tracked; review separately): ${f}`);
if(apply){for(const f of untracked)unlinkSync(resolve(root,f));console.log(`Removed ${untracked.length} untracked legacy archives. No published data, Git history or tracked files were deleted.`)}
else console.log('Preview only. Run: node scripts/clean-legacy-artifacts.mjs --apply to remove untracked archives.');
