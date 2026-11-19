import Fuse from 'fuse.js';
const dialog = document.querySelector('#find-dialog');
const input = dialog.querySelector('input');
const status = dialog.querySelector('[role=status]');
const results = dialog.querySelector('ul');
const archive = dialog.querySelector('#find-archive');
let entries, engine, loading;
async function loadIndex() {
  const response = await fetch(dialog.dataset.index);
  if (!response.ok) throw Error('index');
  entries = await response.json();
  engine = new Fuse(entries, {keys:[{name:'title',weight:3},'tags','intro'],ignoreLocation:true,threshold:0.32});
}
function display() {
  const q = input.value.trim().normalize('NFC');
  archive.href = q ? '/posts/?q='+encodeURIComponent(q) : '/posts/';
  if (!engine) return;
  const matches = q ? engine.search(q,{limit:8}).map(hit=>hit.item) : entries.slice(0,5);
  status.textContent = q ? (matches.length ? '관련 글' : '일치하는 글이 없습니다.') : '최근 글';
  results.replaceChildren(...matches.map(item=>{
    const li=document.createElement('li'), link=document.createElement('a');
    link.textContent=item.title;
    link.href=item.href;
    li.append(link);
    return li;
  }));
}
async function openSearch() {
  if (dialog.open) return;
  dialog.showModal();
  input.focus();
  if (!engine) {
    status.textContent='글 목록을 불러오는 중입니다.';
    try { await (loading ??= loadIndex()); }
    catch { loading=null; status.textContent='목록을 불러오지 못했습니다. 전체 글에서 검색해 주세요.'; }
  }
  display();
}
document.querySelector('#find-open').onclick=openSearch;
document.addEventListener('keydown',e=>{
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k') {e.preventDefault();openSearch();}
});
dialog.querySelector('[data-close]').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target.closest('a')) dialog.close();});
input.addEventListener('input',display);
dialog.addEventListener('keydown',e=>{
  if (e.isComposing) return;
  const links=[...results.querySelectorAll('a')];
  const i=links.indexOf(document.activeElement);
  if (e.key==='Enter' && document.activeElement===input && links.length) {e.preventDefault();links[0].click();}
  if (e.key==='ArrowDown' && links.length) {e.preventDefault();links[Math.min(i+1,links.length-1)].focus();}
  if (e.key==='ArrowUp' && i>=0) {e.preventDefault();(links[i-1]||input).focus();}
});
