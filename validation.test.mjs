import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRoute,parseRouteText,parseId,formatId} from './validation.mjs';
import {robloxIdentity,createPkce} from './roblox-auth.mjs';
const sample=(Time=0)=>({CF:[0,0,0,1,0,0,0,1,0,0,0,1],Velocity:[1,0,0],Time,State:'Running'});
const valid=()=>({format:'GAMPILON_ROUTE_JSON',version:2,name:'Teste',samples:[sample(0),sample(1)]});
test('aceita JSON v2 e preserva os dados sem converter CF em Euler',()=>{const d=valid();assert.equal(validateRoute(d),d);assert.deepEqual(parseRouteText(JSON.stringify(d)),d);});
test('bloqueia mkv1, Luau, formato anterior e campos de autoria forjados',()=>{for(const input of ['mkv1\u0006binary','print(1)',JSON.stringify({version:1,fps:60,frames:[]}),JSON.stringify({...valid(),author:'eu'})])assert.throws(()=>parseRouteText(input));});
test('valida tamanho dos vetores, números finitos e matriz',()=>{for(const n of [NaN,Infinity,1000001]){const d=valid();d.samples[0].CF[0]=n;assert.throws(()=>validateRoute(d));}const d=valid();d.samples[0].CF[3]=2;assert.throws(()=>validateRoute(d));d.samples[0].CF=[0,0,0];assert.throws(()=>validateRoute(d));});
test('valida tempo crescente, estados e campos extras nas amostras',()=>{for(const change of [s=>s.Time=0,s=>s.Time=3601,s=>s.State='loadstring',s=>s.script='print(1)']){const d=valid();change(d.samples[1]);assert.throws(()=>validateRoute(d));}});
test('rejeita quantidade e nome inválidos',()=>{for(const d of [{...valid(),samples:[]},{...valid(),samples:Array(10001).fill(sample())},{...valid(),name:''}])assert.throws(()=>validateRoute(d));});
test('ID estrito e formatado sem truncamento',()=>{assert.equal(parseId('#00001'),1);assert.equal(formatId(100000),'#100000');for(const id of ['0','-1','1x','1.5','1e3','#','9999999999999999'])assert.throws(()=>parseId(id));});
test('identidade Roblox não vem de e-mail nem metadados editáveis',()=>{assert.equal(robloxIdentity({id:'x',email:'a@b.c',user_metadata:{sub:'123',provider:'custom:roblox'}}),null);assert.deepEqual(robloxIdentity({identities:[{provider:'custom:roblox',provider_id:'123',identity_data:{preferred_username:'Pessoa'}}]}),{id:'123',name:'Pessoa'});});
test('PKCE usa valores únicos e desafio SHA-256 base64url',async()=>{const a=await createPkce(),b=await createPkce();assert.notEqual(a.verifier,b.verifier);assert.match(a.verifier,/^[A-Za-z0-9_-]{64}$/);assert.match(a.challenge,/^[A-Za-z0-9_-]{43}$/);});

