/** Controles de vinculações lembradas: os segredos nunca são recebidos pela interface web. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function listRememberedDevices(api){
 const result=await api('/rest/v1/rpc/hub_device_list',{method:'POST',auth:true,body:{}});
 if(!result||!Array.isArray(result.devices))throw Error('Resposta inválida ao carregar dispositivos.');
 return result.devices.filter(d=>d&&typeof d.id==='string'&&UUID.test(d.id)&&d.revoked!==true);
}
export async function revokeRememberedDevice(api,id){
 if(!UUID.test(String(id)))throw Error('Identificador de dispositivo inválido.');
 const response=await api('/rest/v1/rpc/hub_device_revoke',{method:'POST',auth:true,body:{p_device_id:id}});
 if(!response||response.revoked!==true)throw Error('Não foi possível confirmar o desligamento do dispositivo.');
 return response;
}
export function renderDeviceTools({host,api,confirmAction=globalThis.confirm}){
 const section=document.createElement('section');section.id='remembered-devices';
 const title=document.createElement('h2');title.textContent='Dispositivos lembrados';
 const explanation=document.createElement('p');explanation.className='hint';explanation.textContent='Após aprovar o carregador, ele pode guardar uma chave de acesso neste dispositivo para reconectar sem pedir um novo código. Quem tiver acesso ao arquivo dessa chave poderá usá-la. Revogue o dispositivo aqui caso não o reconheça ou perca o aparelho.';
 const list=document.createElement('div'),msg=document.createElement('div');msg.className='notice';msg.hidden=true;msg.setAttribute('role','status');
 const refreshButton=document.createElement('button');refreshButton.type='button';refreshButton.className='btn';refreshButton.textContent='Atualizar dispositivos';
 section.append(title,explanation,list,refreshButton,msg);host.append(section);
 const feedback=(message,bad=false)=>{if(!section.isConnected)return;msg.hidden=false;msg.className='notice '+(bad?'error':'success');msg.textContent=message;};
 let generation=0;
 const refresh=async()=>{const current=++generation;refreshButton.disabled=true;try{
   const devices=await listRememberedDevices(api);if(!section.isConnected||current!==generation)return;
   list.replaceChildren();if(!devices.length){const p=document.createElement('p');p.className='hint';p.textContent='Nenhum dispositivo lembrado nesta conta.';list.append(p);return;}
   for(const device of devices){
    const row=document.createElement('div');row.className='notice';
    const label=document.createElement('strong');label.textContent=String(device.label||'Dispositivo').slice(0,80);row.append(label);
    const info=document.createElement('p');info.className='hint';const raw=device.last_used_at||device.created_at;const date=raw?new Date(raw):null;info.textContent=date&&!Number.isNaN(date.getTime())?'Último uso: '+date.toLocaleString('pt-BR'):'Data de uso indisponível';row.append(info);
    const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Desvincular dispositivo';button.onclick=async()=>{
     if(!confirmAction('Desvincular este dispositivo? Ele precisará ser autorizado novamente.'))return;
     button.disabled=true;try{await revokeRememberedDevice(api,device.id);await refresh();feedback('Dispositivo desvinculado. A próxima execução precisará de uma nova autorização.');}catch(e){feedback(e.message||'Não foi possível desvincular.',true);button.disabled=false;}
    };row.append(button);list.append(row);
   }
  }catch(e){if(current===generation)feedback('Não foi possível carregar os dispositivos. '+(e.message||'Tente novamente.'),true);}finally{if(current===generation&&section.isConnected)refreshButton.disabled=false;}};
 refreshButton.onclick=()=>{msg.hidden=true;refresh();};refresh();return {refresh};
}
