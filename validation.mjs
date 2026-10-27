export const ROUTE_FORMAT = 'GAMPILON_ROUTE_JSON';
export const ROUTE_VERSION = 2;
export const STATES = ['FallingDown','Ragdoll','GettingUp','Jumping','Swimming','Freefall','Flying','Landed','Running','RunningNoPhysics','StrafingNoPhysics','Climbing','Seated','PlatformStanding','Dead','Physics','None'];
export function validateRoute(data) {
  const fail = message => { throw new Error(message); };
  const keys = (v, allowed) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === allowed.length && allowed.every(k=>Object.hasOwn(v,k));
  if (!keys(data,['format','version','name','samples']) || data.format!==ROUTE_FORMAT || data.version!==ROUTE_VERSION) fail('Formato não reconhecido. Use GAMPILON_ROUTE_JSON, versão 2. Autoria não verificada.');
  if (typeof data.name!=='string' || data.name.trim().length<1 || data.name.length>80) fail('O nome interno da rota deve ter de 1 a 80 caracteres.');
  if (!Array.isArray(data.samples) || data.samples.length<2 || data.samples.length>10000) fail('A rota precisa ter entre 2 e 10.000 amostras.');
  let previous=-1;
  for (const [i,s] of data.samples.entries()) {
    if (!keys(s,['CF','Velocity','Time','State'])) fail(`Amostra ${i+1}: use somente CF, Velocity, Time e State.`);
    if (!Number.isFinite(s.Time) || s.Time<0 || s.Time>3600 || s.Time<=previous) fail(`Amostra ${i+1}: Time deve crescer, de 0 a 3600 segundos.`);
    if (!Array.isArray(s.CF) || s.CF.length!==12 || !s.CF.every((n,j)=>Number.isFinite(n)&&Math.abs(n)<=(j<3?1000000:1.001))) fail(`Amostra ${i+1}: CF deve ter 12 números, com posição e matriz de rotação válidas.`);
    if (!Array.isArray(s.Velocity) || s.Velocity.length!==3 || !s.Velocity.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000000)) fail(`Amostra ${i+1}: Velocity deve ter três números finitos.`);
    if (!STATES.includes(s.State)) fail(`Amostra ${i+1}: State não reconhecido.`);
    previous=s.Time;
  }
  if(new TextEncoder().encode(JSON.stringify(data)).length>2000000) fail('O JSON excede 2 MB.');
  return data;
}
export function parseRouteText(raw){
  if(typeof raw!=='string')throw new Error('Envie uma rota em JSON.');
  const text=raw.replace(/^\uFEFF/,'').trim();
  if(text.startsWith('mkv1'))throw new Error('Formato mkv1 não aceito. Conteúdo codificado não é executado nem convertido. Autoria não verificada.');
  if(new TextEncoder().encode(text).length>2000000)throw new Error('O arquivo excede 2 MB.');
  let data;try{data=JSON.parse(text);}catch{throw new Error('Formato não reconhecido. Envie o JSON original GAMPILON_ROUTE_JSON v2. Autoria não verificada.');}
  return validateRoute(data);
}
export function parseId(raw) {
  if (!/^#?\d{1,15}$/.test(raw.trim())) throw new Error('Digite um ID válido, como #00001.');
  const id = Number(raw.trim().replace('#',''));
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('O ID deve ser maior que zero.');
  return id;
}
export const formatId = id => '#' + String(id).padStart(5,'0');
