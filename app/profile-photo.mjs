// Owner-only image drafts, with a separately approved public WebP.
// Image bytes are kept in the PRIVATE data repository (a settings row), never in the public site JSON.
import {createHash} from 'node:crypto';
export const PROFILE_KEY='ix_profile_photo';
export const MAX_PROFILE_BYTES=480000;
const b64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
export function validatePortraitData(data){
 if(typeof data!=='string'||data.length>Math.ceil(MAX_PROFILE_BYTES/3)*4+8||!b64.test(data))throw Error('Invalid image encoding');
 const bytes=Buffer.from(data,'base64');
 if(bytes.length<32||bytes.length>MAX_PROFILE_BYTES||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)!==bytes.length-8)throw Error('Upload an optimized WebP image (max 480 KB)');
 const chunk=bytes.toString('ascii',12,16);
 if(!['VP8 ','VP8L','VP8X'].includes(chunk)||bytes.readUInt32LE(16)>bytes.length-20)throw Error('Unsupported WebP image');
 let width=0,height=0;
 if(chunk==='VP8X'){
  if(bytes[20]&0x02)throw Error('Animated images are not supported');
  width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);
 }else if(chunk==='VP8 '){
  if(bytes.toString('hex',23,26)!=='9d012a')throw Error('Invalid WebP frame');
  width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff;
 }else{
  if(bytes[20]!==0x2f)throw Error('Invalid lossless WebP frame');
  width=1+bytes[21]+((bytes[22]&0x3f)<<8);
  height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0x0f)<<10);
 }
 if(width<1||height<1||width>1600||height>1600)throw Error('Image dimensions are too large');
 return {data:bytes.toString('base64'),bytes};
}
export function parsePortrait(raw){try{const o=typeof raw==='string'?JSON.parse(raw):raw;return o&&typeof o==='object'&&!Array.isArray(o)?{draft:typeof o.draft==='string'?o.draft:'',approved:typeof o.approved==='string'?o.approved:''}:{draft:'',approved:''}}catch{return {draft:'',approved:''}}}
export function publicPortrait(o){try{if(!o.approved)return null;const {bytes}=validatePortraitData(o.approved);return {bytes,revision:createHash('sha256').update(bytes).digest('hex').slice(0,12)}}catch{return null}}
export function portraitDisplay(site={},src=''){
 if(!src||site.portrait_placement==='off')return null;
 const style=['soft','circle','editorial'].includes(site.portrait_style)?site.portrait_style:'editorial';
 const size=['compact','balanced','large'].includes(site.portrait_size)?site.portrait_size:'balanced';
 const placement=['both','hero','about'].includes(site.portrait_placement)?site.portrait_placement:'both';
 const x=Number.isInteger(Number(site.portrait_focus_x))&&Number(site.portrait_focus_x)>=0&&Number(site.portrait_focus_x)<=100?Number(site.portrait_focus_x):50;
 const y=Number.isInteger(Number(site.portrait_focus_y))&&Number(site.portrait_focus_y)>=0&&Number(site.portrait_focus_y)<=100?Number(site.portrait_focus_y):35;
 return {style,size,placement,focusX:x,focusY:y,src};
}
