// Esta função só monta a apresentação. O banco confere a identidade no servidor.
export function robloxIdentity(user){
  const identity=user?.identities?.find(i=>i.provider==='custom:roblox');
  const data=identity?.identity_data;
  const id=String(data?.sub || identity?.provider_id || '');
  if(!/^[1-9]\d{0,19}$/.test(id))return null;
  return {id,name:String(data?.preferred_username || data?.name || `Roblox ${id}`).slice(0,80)};
}
export const toBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function createPkce(cryptoApi=crypto){
  const verifier=toBase64Url(cryptoApi.getRandomValues(new Uint8Array(48)));
  const challenge=toBase64Url(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  return {verifier,challenge};
}
