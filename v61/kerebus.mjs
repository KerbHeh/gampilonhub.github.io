/** KEREBUS Binary v1. CRC32 detects corruption; it is not encryption or proof of authorship. */
export const MAGIC = 'kerebus\\Az()';
export const MAX_SAMPLES = 18000;
export const MAX_BINARY_BYTES = 3000000;
export const STATES = Object.freeze(['FallingDown','Ragdoll','GettingUp','Jumping','Swimming','Freefall','Flying','Landed','Running','RunningNoPhysics','StrafingNoPhysics','Climbing','Seated','PlatformStanding','Dead','Physics','None']);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal:true});
const magic = encoder.encode(MAGIC);
const HEADER = 28;
const fail = message => { const e = new Error(message); e.code = 'invalid_route'; throw e; };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const fields = (v, required, optional=[]) => {
  if (!object(v) || required.some(k=>!Object.hasOwn(v,k)) || Object.keys(v).some(k=>!required.includes(k)&&!optional.includes(k))) fail('Campos desconhecidos ou ausentes na rota.');
};
function stringBytes(value, max, label) {
  if (typeof value !== 'string' || [...value].length<1 || [...value].length>max) fail(`${label} inválido.`);
  const bytes=encoder.encode(value);
  if (decoder.decode(bytes)!==value) fail(`${label}: Unicode inválido.`);
  return bytes;
}
function numericArray(value, count, limit) {
  return Array.isArray(value)&&value.length===count&&Object.keys(value).length===count&&Array.from({length:count},(_,i)=>Object.hasOwn(value,i)&&Number.isFinite(value[i])&&Math.abs(value[i])<=limit(i)).every(Boolean);
}
export function validateLegacyRoute(route) {
  fields(route,['format','version','name','samples']);
  if(route.format!=='GAMPILON_ROUTE_JSON'||route.version!==2)fail('Use GAMPILON_ROUTE_JSON v2 ou KEREBUS Binary v1.');
  stringBytes(route.name,80,'Nome');
  if(!route.name.trim())fail('O nome da rota está vazio.');
  if(!Array.isArray(route.samples)||route.samples.length<2||route.samples.length>MAX_SAMPLES||Object.keys(route.samples).length!==route.samples.length)fail(`Use 2 a ${MAX_SAMPLES} amostras.`);
  let previous=-1;
  for(const [i,s] of route.samples.entries()){
    fields(s,['Time','CF'],['Velocity','State']);
    if(!Number.isFinite(s.Time)||s.Time<0||s.Time>3600||s.Time<=previous)fail(`Amostra ${i+1}: tempo fora de ordem ou inválido.`);
    previous=s.Time;
    if(!numericArray(s.CF,12,j=>j<3?1000000:1.001))fail(`Amostra ${i+1}: CFrame inválido.`);
    if(Object.hasOwn(s,'Velocity')&&!numericArray(s.Velocity,3,()=>1000000))fail(`Amostra ${i+1}: velocidade inválida.`);
    if(Object.hasOwn(s,'State')&&!STATES.includes(s.State))fail(`Amostra ${i+1}: estado inválido.`);
  }
  return route;
}
const CRC_TABLE=Uint32Array.from({length:256},(_,i)=>{let x=i;for(let j=0;j<8;j++)x=(x>>>1)^((x&1)?0xedb88320:0);return x>>>0;});
export function crc32(bytes) {let crc=0xffffffff;for(const b of bytes)crc=(crc>>>8)^CRC_TABLE[(crc^b)&255];return (crc^0xffffffff)>>>0;}
export function encodeKerebus(route) {
  validateLegacyRoute(route);
  const name=encoder.encode(route.name);
  let length=HEADER+name.length+4;
  for(const sample of route.samples)length+=105+(Object.hasOwn(sample,'Velocity')?24:0)+(Object.hasOwn(sample,'State')?1+encoder.encode(sample.State).length:0);
  if(length>MAX_BINARY_BYTES)fail('Arquivo KEREBUS grande demais.');
  const bytes=new Uint8Array(length), view=new DataView(bytes.buffer);bytes.set(magic);
  view.setUint8(12,1);view.setUint8(13,0);view.setUint16(14,0,true);view.setUint32(16,length,true);view.setUint32(20,route.samples.length,true);view.setUint16(24,name.length,true);view.setUint16(26,0,true);
  let p=HEADER;bytes.set(name,p);p+=name.length;
  const double=n=>{view.setFloat64(p,n,true);p+=8;};
  for(const s of route.samples){
    const velocity=Object.hasOwn(s,'Velocity'),state=Object.hasOwn(s,'State');
    bytes[p++]=(velocity?1:0)|(state?2:0);double(s.Time);s.CF.forEach(double);
    if(velocity)s.Velocity.forEach(double);
    if(state){const value=encoder.encode(s.State);bytes[p++]=value.length;bytes.set(value,p);p+=value.length;}
  }
  view.setUint32(p,crc32(bytes.subarray(0,p)),true);return bytes;
}
export function decodeKerebus(input) {
  const bytes=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
  if(!bytes||bytes.length<HEADER+4||bytes.length>MAX_BINARY_BYTES)fail('Tamanho KEREBUS inválido.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(!magic.every((b,i)=>bytes[i]===b))fail('Assinatura KEREBUS não reconhecida.');
  if(bytes[12]!==1||bytes[13]!==0)fail('Versão KEREBUS não suportada.');
  if(view.getUint16(14,true)!==0||view.getUint16(26,true)!==0)fail('Cabeçalho KEREBUS não suportado.');
  if(view.getUint32(16,true)!==bytes.length)fail('Arquivo KEREBUS incompleto ou com dados extras.');
  const end=bytes.length-4;
  if(view.getUint32(end,true)!==crc32(bytes.subarray(0,end)))fail('Arquivo KEREBUS corrompido: integridade CRC32 inválida.');
  const count=view.getUint32(20,true),nameSize=view.getUint16(24,true);
  if(count<2||count>MAX_SAMPLES||nameSize<1||nameSize>320||HEADER+nameSize+count*105>end)fail('Contagens KEREBUS inválidas.');
  let p=HEADER;
  const take=n=>{if(p+n>end)fail('Arquivo KEREBUS truncado.');const at=p;p+=n;return at;};
  const readString=n=>{try{return decoder.decode(bytes.subarray(take(n),p));}catch{fail('Texto UTF-8 corrompido.');}};
  const double=()=>view.getFloat64(take(8),true);
  const route={format:'GAMPILON_ROUTE_JSON',version:2,name:readString(nameSize),samples:[]};
  for(let i=0;i<count;i++){
    const flags=bytes[take(1)];if(flags>3)fail('Propriedades KEREBUS não suportadas.');
    const row={Time:double(),CF:Array.from({length:12},double)};
    if(flags&1)row.Velocity=Array.from({length:3},double);
    if(flags&2){const n=bytes[take(1)];if(n<1||n>32)fail('Estado KEREBUS inválido.');row.State=readString(n);}
    route.samples.push(row);
  }
  if(p!==end)fail('Dados extras no arquivo KEREBUS.');
  return validateLegacyRoute(route);
}
export function toBase64(input) {
  if(!(input instanceof Uint8Array)||input.length>MAX_BINARY_BYTES)fail('Dados binários inválidos.');
  let text='';for(let p=0;p<input.length;p+=8192)text+=String.fromCharCode(...input.subarray(p,p+8192));
  return btoa(text);
}
export function fromBase64(text) {
  if(typeof text!=='string'||text.length<4||text.length>4*Math.ceil(MAX_BINARY_BYTES/3)||text.length%4!==0||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))fail('Base64 inválido.');
  let binary;try{binary=atob(text);}catch{fail('Base64 inválido.');}
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  if(toBase64(bytes)!==text)fail('Base64 não canônico.');return bytes;
}
export function packRoute(value) {
  if(value?.format==='KEREBUS_BINARY'){
    fields(value,['format','version','base64']);if(value.version!==1)fail('Versão KEREBUS não suportada.');decodeKerebus(fromBase64(value.base64));
    return {format:'KEREBUS_BINARY',version:1,base64:value.base64};
  }
  return {format:'KEREBUS_BINARY',version:1,base64:toBase64(encodeKerebus(value))};
}
export function unpackRoute(value) {return value?.format==='KEREBUS_BINARY'?decodeKerebus(fromBase64(packRoute(value).base64)):validateLegacyRoute(value);}
export function parseRouteInput(input) {
  if(input instanceof Uint8Array||input instanceof ArrayBuffer)return packRoute(decodeKerebus(input));
  if(typeof input!=='string')return packRoute(input);
  const text=input.replace(/^\uFEFF/,'').trim();
  if(text.startsWith('mkv1'))fail('mkv1 não é KEREBUS; o conteúdo não será executado.');
  if(text.length>4200000)fail('Entrada grande demais.');
  if(text.startsWith('{')){let object;try{object=JSON.parse(text);}catch{fail('JSON inválido.');}return packRoute(object);}
  return packRoute(decodeKerebus(fromBase64(text.startsWith('KEREBUS64:')?text.slice(10):text)));
}
