// Isolated browser integration: actual UI + PreviewService, no production writes.
import {chromium} from 'file:///C:/Users/wwht1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('static/retreat-prayer');
const backend=await readFile(path.join(root,'assets/backend.js'),'utf8');
const daily={prayer_date:'2026-09-17',scripture_reference:'잠언 16:3',scripture_text:'너의 행사를 여호와께 맡기라 그리하면 네가 경영하는 것이 이루어지리라',prayer_topic:'수련회 준비와 리더십\n\n• 수련회 전체 일정과 프로그램이 하나님의 은혜 가운데 순조롭게 준비되도록\n• 준비하는 이들이 기쁨과 감사로 주어진 일을 감당하며 지치지 않기를\n• 필요한 재정이 목적대로 쓰일 수 있도록',published:true};
const fixture=backend.slice(0,backend.indexOf('export async function createPrayerService('))+`export async function createPrayerService(config){const service=new PreviewService(config);service.state.dailyPrayer=${JSON.stringify(daily)};return service;}`;
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    let relative=pathname.replace(/^\/retreat-prayer\/?/,'');if(!relative||relative.endsWith('/'))relative+='index.html';
    const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error('outside root');
    const body=relative==='assets/backend.js'?fixture:await readFile(file);
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
let browser;const report={sizes:[],errors:[]};
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}/retreat-prayer/`;
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const width of [360,390,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(origin+'#today');await page.locator('#today-topic').filter({hasText:'수련회 준비와 리더십'}).waitFor();
    const sizes=await page.evaluate(()=>({heading:parseFloat(getComputedStyle(document.querySelector('#today-title')).fontSize),body:parseFloat(getComputedStyle(document.querySelector('#today-topic')).fontSize),overflow:document.documentElement.scrollWidth>innerWidth}));
    assert.ok(sizes.heading<=44&&sizes.body<=26&&!sizes.overflow);report.sizes.push({width,...sizes});
    await page.screenshot({path:`.omx/artifacts/today-readable-${width}.png`,fullPage:true});await page.close();
  }
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(origin+'admin/');await page.locator('#admin-preview-button').click();await page.locator('[data-admin-route="program"]').click();
  await page.locator('#program-title').fill('구성 A');
  await page.locator('[data-action="save-program-template"]').click();
  await page.locator('#program-save-status').filter({hasText:'구성을 보관했습니다'}).waitFor();
  const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('retreat-prayer-demo-state')).liveSession);
  await page.locator('#program-title').fill('구성 B');await page.locator('.program-step [name="label"]').first().fill('다른 기도');
  await page.locator('[data-action="save-program-template"]').click();
  await page.waitForFunction(()=>document.querySelector('#program-library-select').options.length===3);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('retreat-prayer-demo-state')));
  assert.deepEqual(saved.liveSession,initial);assert.equal(saved.programs.filter(p=>p.status==='draft').length,2);
  const a=saved.programs.find(p=>p.title==='구성 A');
  await page.locator('#program-library-select').selectOption(a.id);await page.locator('[data-action="load-program-template"]').click();
  await page.locator('#admin-confirm-button').click();
  assert.equal(await page.locator('#program-title').inputValue(),'구성 A');assert.equal(await page.locator('#program-schedule').inputValue(),'');
  assert.equal(await page.locator('.program-step [name="label"]').first().inputValue(),a.steps[0].label);
  await page.reload();await page.locator('#admin-preview-button').click();await page.locator('[data-admin-route="program"]').click();
  assert.equal(await page.locator('#program-library-select option').count(),3);
  await page.screenshot({path:'.omx/artifacts/program-library-desktop.png',fullPage:true});
  report.savedCopies=2;report.reloadPersistence=true;report.liveUnchanged=true;report.pass=report.errors.length===0;
}catch(error){report.pass=false;report.failure=error.stack;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
