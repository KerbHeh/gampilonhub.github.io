import {packRoute} from './kerebus.mjs';
export const RESOURCE_KINDS=Object.freeze(['route','settings','theme','forge','compat']);
const fail=message=>{const e=new Error(message);e.code='invalid_resource';throw e;};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function fields(v,required,optional=[]){if(!plain(v)||required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>!required.includes(k)&&!optional.includes(k)))fail('Campos desconhecidos ou ausentes.');}
function text(v,max=80){if(typeof v!=='string'||!v.trim()||[...v].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail('Texto inválido.');return v;}
function num(v,min,max,integer=false){if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))fail('Número fora do intervalo permitido.');return v;}
function list(v,max,min=0){if(!Array.isArray(v)||v.length<min||v.length>max||Object.keys(v).length!==v.length||!Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean))fail('Lista fora dos limites.');return v;}
const copy=v=>JSON.parse(JSON.stringify(v));
export function normalizeRouteId(v){if(typeof v!=='string'||!/^#?\d{1,15}$/.test(v)||Number(v.replace('#',''))<1||!Number.isSafeInteger(Number(v.replace('#',''))))fail('ID de rota inválido.');return '#'+String(Number(v.replace('#',''))).padStart(5,'0');}
export function validateTheme(v){
  fields(v,['version','name','palette']);if(v.version!==1)fail('Versão de tema não suportada.');text(v.name);
  fields(v.palette,['background','surface','text','accent','muted']);
  for(const c of Object.values(v.palette))if(typeof c!=='string'||!/^#[0-9A-Fa-f]{6}$/.test(c))fail('As cores devem usar #RRGGBB.');
  return copy(v);
}
const preferenceRules={
  playbackMode:v=>['ghost','character'].includes(v),speed:v=>Number.isFinite(v)&&v>=.5&&v<=2,
  ghostAlpha:v=>Number.isFinite(v)&&v>=0&&v<=1,activityFilter:v=>['Automático','Polichinelos','Flexões','Abdominais'].includes(v),
  delay:v=>Number.isFinite(v)&&v>=.1&&v<=2.5,jjLimit:v=>Number.isInteger(v)&&v>=0&&v<=1000000,
  reducedMotion:v=>typeof v==='boolean',language:v=>v==='pt-BR',uiScale:v=>Number.isFinite(v)&&v>=.5&&v<=2,
  themeId:v=>typeof v==='string'&&(v===''||/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)),showClone:v=>typeof v==='boolean',
};
function preferences(v){fields(v,[],Object.keys(preferenceRules));for(const [k,value] of Object.entries(v))if(!preferenceRules[k](value))fail(`Preferência inválida: ${k}.`);return copy(v);}
function rgb(v){list(v,3,3);for(const n of v)num(n,0,255,true);}
function stops(v,spatial=false){list(v,256,1);for(const stop of v){fields(stop,['p','rgb']);num(stop.p,0,spatial?100:1000000);rgb(stop.rgb);}}
function clone(v){
  fields(v,[],['show','alpha','showLabel','showDistance','showOrientation','outline','glow','tolerance','range','mode','interpolation','transition','gradientDirection','solid','outlineRGB','spatial','distance','favorites','presets']);
  for(const k of ['show','showLabel','showDistance','showOrientation','outline'])if(k in v&&typeof v[k]!=='boolean')fail(`Clone: ${k} inválido.`);
  for(const k of ['alpha','glow'])if(k in v)num(v[k],0,1);
  if('tolerance' in v)num(v.tolerance,0,100);if('range' in v)num(v.range,0,100000);
  const enums={mode:['Dinâmico padrão','Cor única','Degradê no corpo','Distância personalizada'],interpolation:['RGB','HSV'],transition:['Suave','Brusca'],gradientDirection:['Vertical','Vertical invertido','Horizontal','Horizontal invertido']};
  for(const [k,options] of Object.entries(enums))if(k in v&&!options.includes(v[k]))fail(`Clone: ${k} inválido.`);
  for(const k of ['solid','outlineRGB'])if(k in v)rgb(v[k]);if('spatial' in v)stops(v.spatial,true);if('distance' in v)stops(v.distance);
  if('favorites' in v){list(v.favorites,256);v.favorites.forEach(rgb);}
  if('presets' in v){if(!plain(v.presets)||Object.keys(v.presets).length>64)fail('Presets fora dos limites.');for(const [name,value] of Object.entries(v.presets)){if(!/^[\w-]{1,60}$/.test(name)||['__proto__','constructor','prototype'].includes(name))fail('Nome de preset inválido.');stops(value);}}
  return copy(v);
}
export function validateSettings(v){
  fields(v,['version','preferences','favorites'],['clone']);if(v.version!==1)fail('Versão de configuração não suportada.');
  const result={version:1,preferences:preferences(v.preferences),favorites:list(v.favorites,500).map(normalizeRouteId)};
  if(new Set(result.favorites).size!==result.favorites.length)fail('Favoritos repetidos.');if('clone' in v)result.clone=clone(v.clone);return result;
}
export function validateForge(v){
  fields(v,['version','name','steps']);if(v.version!==1)fail('Versão FORGE não suportada.');text(v.name);let wait=0,count=0;
  function checkSteps(steps,depth=0){list(steps,64,1);if(depth>3)fail('FORGE permite até três níveis de condições.');for(const s of steps){
    if(++count>64)fail('A rotina excede 64 etapas, incluindo condições.');
    if(!plain(s))fail('Etapa inválida.');
    switch(s.op){
      case 'wait':fields(s,['op','seconds']);wait+=num(s.seconds,0,60);break;
      case 'notify':fields(s,['op','text']);text(s.text,280);break;
      case 'theme':fields(s,['op','theme']);validateTheme(s.theme);break;
      case 'route':fields(s,['op','id']);normalizeRouteId(s.id);break;
      case 'replay':fields(s,['op','mode','speed']);if(s.mode!=='ghost')fail('FORGE aceita somente reprodução visual fantasma.');num(s.speed,.25,4);break;
      case 'stop':fields(s,['op']);break;
      case 'activity':fields(s,['op','name','duration']);if(!['Polichinelos','Flexões','Abdominais'].includes(s.name))fail('Atividade não reconhecida.');wait+=num(s.duration,.1,60);break;
      case 'when':fields(s,['op','field','equals','then']);if(s.field==='placeId'){if(typeof s.equals!=='string'||!/^[1-9]\d{0,19}$/.test(s.equals))fail('Condição PlaceId inválida.');}else if(s.field==='routeLoaded'){if(typeof s.equals!=='boolean')fail('Condição de rota inválida.');}else fail('Condição FORGE não permitida.');checkSteps(s.then,depth+1);break;
      default:fail('Operação FORGE não permitida.');
    }
  }}checkSteps(v.steps);
  if(wait>300)fail('A rotina excede 300 segundos de espera.');
  const result=copy(v);function normalize(steps){for(const s of steps){if(s.op==='route')s.id=normalizeRouteId(s.id);if(s.op==='when')normalize(s.then);}}normalize(result.steps);return result;
}
export function validateCompat(v){
  fields(v,['version','name','placeIds','executors','activities','formats','defaults']);if(v.version!==1)fail('Versão de pacote não suportada.');text(v.name);
  list(v.placeIds,64,1);for(const id of v.placeIds)if(typeof id!=='string'||!/^[1-9]\d{0,19}$/.test(id))fail('PlaceId inválido.');if(new Set(v.placeIds).size!==v.placeIds.length)fail('PlaceIds repetidos.');
  list(v.executors,3,1);if(new Set(v.executors).size!==v.executors.length||v.executors.some(x=>!['Delta','Solara','generic'].includes(x)))fail('Adaptador não suportado.');
  list(v.activities,32);const names=new Set();for(const a of v.activities){fields(a,['name','screen','prompts']);text(a.name);if(names.has(a.name))fail('Atividade repetida.');names.add(a.name);if(typeof a.screen!=='string'||a.screen.length>160||! /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*){0,7}$/.test(a.screen))fail('Caminho de interface inválido.');list(a.prompts,3,1);if(new Set(a.prompts).size!==a.prompts.length||a.prompts.some(p=>!['Q','E','TAP'].includes(p)))fail('Prompt de atividade inválido.');}
  list(v.formats,2,1);if(new Set(v.formats).size!==v.formats.length||v.formats.some(f=>!['KEREBUS_BINARY','GAMPILON_ROUTE_JSON'].includes(f)))fail('Formato não suportado.');preferences(v.defaults);return copy(v);
}
export function validateResource(kind,payload){
  if(!RESOURCE_KINDS.includes(kind))fail('Tipo de recurso não suportado.');
  if(kind==='route')return packRoute(payload);
  const check={settings:validateSettings,theme:validateTheme,forge:validateForge,compat:validateCompat}[kind];
  const result=check(payload);if(new TextEncoder().encode(JSON.stringify(result)).length>65536)fail('Recurso excede 64 KiB.');return result;
}
