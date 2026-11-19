"use strict";
const endpoint = "https://bxgqhdqseahujiadvhyk.supabase.co/rest/v1/rpc/";
const publicKey = "sb_publishable__ZIcITO_8TYjrJiy3E4IJA_6sELN9Z4";
const byId = id => document.getElementById(id);
const input = byId("dream"), form = document.querySelector("form"), button = form.querySelector("button");
let book, entryId, lastText;
async function rpc(action, params) {
  const response = await fetch(endpoint + action, {method:"POST", headers:{"Content-Type":"application/json", apikey:publicKey}, body:JSON.stringify(params), cache:"no-store"});
  if (!response.ok) throw new Error("request");
  return response.json();
}
async function refresh() {
  try {
    const rows = await rpc("yeobaek_read", {book_key:book});
    const notes = rows.map(row => {
      const note = document.createElement("div"), date = document.createElement("time"), p = document.createElement("p");
      note.className = "note"; date.dateTime = row.created_at;
      date.textContent = new Intl.DateTimeFormat("ko-KR",{dateStyle:"long"}).format(new Date(row.created_at));
      p.textContent = row.body; note.append(date,p); return note;
    });
    byId("entries").replaceChildren(...notes);
    byId("history-status").textContent = notes.length ? "최근 기록부터 최대 100개를 보여 드립니다." : "첫 꿈을 기다리고 있어요.";
  } catch { byId("history-status").textContent = "기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요."; }
}
input.oninput = () => { byId("count").textContent = input.value.length + " / 400"; };
try {
  book = localStorage.getItem("yeobaek-notebook-v1");
  if (!book) {
    book = Array.from(crypto.getRandomValues(new Uint8Array(32)), n=>n.toString(16).padStart(2,"0")).join("");
    localStorage.setItem("yeobaek-notebook-v1",book);
  }
  refresh();
} catch { button.disabled=true; byId("history-status").textContent="이 브라우저에서 사이트 저장 공간을 허용한 뒤 다시 열어 주세요."; }
form.onsubmit = async event => {
  event.preventDefault(); if(button.disabled)return;
  const dream=input.value.trim();
  if(dream.length<5){byId("status").textContent="다섯 글자 이상 적어 주세요.";return;}
  if(lastText!==dream){entryId=crypto.randomUUID();lastText=dream;}
  button.disabled=true;
  try {
    const result=await rpc("yeobaek_save",{book_key:book,entry_id:entryId,dream,website:byId("website").value});
    if(result==="saved"){
      input.value="";input.oninput();lastText=null;byId("status").textContent="내 꿈을 저장했습니다.";await refresh();
    }else{
      byId("status").textContent=({invalid:"링크나 반복 문자를 덜고 5~400자로 적어 주세요.",duplicate:"이미 노트에 있는 꿈입니다.",limited:"잠시 쉬어 주세요. 한 노트에는 하루 다섯 번까지 쓸 수 있습니다."})[result] || "저장하지 못했습니다.";
    }
  }catch{byId("status").textContent="저장 여부를 확인하지 못했습니다. 같은 내용으로 다시 눌러 주세요.";}
  finally{button.disabled=false;}
};
