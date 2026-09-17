import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ControllerLeaseCoordinator} from '../static/retreat-prayer/assets/controller-lease.js';
const source = await readFile(new URL('../static/retreat-prayer/assets/admin.js',import.meta.url),'utf8');
function extract(name,next){return source.slice(source.indexOf(`async function ${name}`),source.indexOf(`\n${next}`,source.indexOf(`async function ${name}`)));}
for (const failure of [false,true]) test(`late tokenless ${failure?'error':'response'} cannot overwrite restored ownership`,async()=>{
 let resolve,reject;let applied=0;
 const state={service:{getControllerStatus:()=>new Promise((yes,no)=>{resolve=yes;reject=no})},snapshot:{},leaseCoordinator:null,leaseStatus:'idle'};
 const context=vm.createContext({state,applyControllerStatus:()=>{applied++},renderController:()=>{applied++}});
 vm.runInContext(extract('renewControllerLease','function openControllerReleaseConfirmation'),context);
 const pending=context.renewControllerLease();
 state.leaseCoordinator={hasToken:()=>true};state.leaseStatus='owned';
 if(failure) reject(new Error('old request failed')); else resolve({acquired:false});
 await pending;assert.equal(applied,0);assert.equal(state.leaseStatus,'owned');
});
test('restoring another token invalidates an outstanding ownership response',async()=>{
 let oldResponse;
 const c=new ControllerLeaseCoordinator({claim:async()=>{},check:t=>t==='old'?new Promise(r=>{oldResponse=r}):Promise.resolve({acquired:true,expires_at:'9999-12-31T00:00:00Z'}),createToken:()=>'',setTimer:()=>1,clearTimer:()=>{}});
 const old=c.restore('old');await Promise.resolve();
 await c.restore('new');oldResponse({acquired:false});await old;
 assert.equal(c.token,'new');assert.equal(c.ownsLease(),true);c.dispose();
});
test('next cannot be submitted twice while an action awaits the server',async()=>{
 let finish,calls=0;
 const state={liveActionPending:false,leaseToken:'t',snapshot:{liveSession:{version:1,status:'live'}},service:{applyLiveAction:()=>{calls++;return new Promise(r=>{finish=r})}}};
 const context=vm.createContext({state,ownsControllerLease:()=>true,renderLive:()=>{},toast:()=>{}});
 vm.runInContext(extract('applyLiveAction','async function saveDailyContent'),context);
 const button={dataset:{liveAction:'next'}};
 const first=context.applyLiveAction(button);await context.applyLiveAction(button);
 assert.equal(calls,1);
 state.snapshot.liveSession={version:3,status:'live'};
 finish({version:2,status:'live'});await first;
 assert.equal(state.liveActionPending,false);
 assert.equal(state.snapshot.liveSession.version,3);
});
