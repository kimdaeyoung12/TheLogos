"use strict";
const topics = ["관계", "배움", "창작", "일상", "일과 진로", "기타"];
let selectedTopic = null;
let cursor = null;
let revision = 0;
const gallery = byId("gallery");
const more = byId("more-dreams");
const atlasStatus = byId("atlas-status");
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
async function readGallery(append = false) {
  const version = ++revision;
  if (!append) { cursor = null; gallery.replaceChildren(); }
  more.hidden = true;
  atlasStatus.textContent = "꿈을 불러오는 중입니다.";
  try {
    const rows = await rpc("yeobaek_gallery", {chosen:selectedTopic, before_date:cursor?.created_at ?? null, before_id:cursor?.id ?? null});
    if (version !== revision) return;
    for (const row of rows.slice(0,12)) {
      const card = element("li", "");
      const label = element("small", row.topic);
      const message = element("p", row.body);
      card.style.setProperty("--swatch",mapPalette[topics.indexOf(row.topic)]);
      card.append(label, message);
      gallery.append(card);
    }
    cursor = rows[11];
    more.hidden = rows.length <= 12;
    atlasStatus.textContent = gallery.children.length
      ? (selectedTopic || "전체") + " · 최근에 작성한 꿈부터 " + gallery.children.length + "개 표시"
      : "이곳에 공개된 꿈이 아직 없습니다.";
  } catch {
    if (version !== revision) return;
    atlasStatus.textContent = "꿈을 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.";
    more.hidden = !append;
  }
}
let chartRevision = 0;
let mapItems = null;
const mapHost = byId("atlas-map");
const chart = byId("topic-chart");
function selectTopic(topic) {
  selectedTopic = topic;
  for (const control of [...chart.children,...mapHost.querySelectorAll("[data-topic]")]) {
    control.setAttribute("aria-pressed", String(control.dataset.topic === (topic || "")));
  }
  readGallery();
}
function drawMap() {
  if (mapItems) renderTerritories(mapHost,mapItems,selectedTopic,selectTopic);
}
let narrowMap = mapHost.clientWidth < 500;
new ResizeObserver(() => {
  const narrow = mapHost.clientWidth < 500;
  if (narrow !== narrowMap) { narrowMap = narrow; drawMap(); }
}).observe(mapHost);
async function refreshAtlas() {
  const version = ++chartRevision;
  readGallery();
  try {
    const rows = await rpc("yeobaek_topics", {});
    if (version !== chartRevision) return;
    const counts = new Map(rows.map(row => [row.topic, Number(row.total)]));
    mapItems = topics.map((topic,index)=>({topic,count:counts.get(topic)||0,color:mapPalette[index]}));
    const total = mapItems.reduce((sum,item)=>sum+item.count,0);
    const filters = [{topic:null,count:total},...mapItems].map(({topic,count,color}) => {
      const control = element("button",(topic || "전체")+" "+count+"개");
      control.type = "button";
      control.dataset.topic = topic || "";
      if (color) control.style.setProperty("--swatch", color);
      control.setAttribute("aria-pressed", String(topic === selectedTopic));
      control.onclick = () => selectTopic(topic);
      return control;
    });
    chart.replaceChildren(...filters);
    drawMap();
  } catch {
    if (version !== chartRevision) return;
    mapItems = null;
    mapHost.textContent = "주제별 지도를 불러오지 못했습니다.";
    chart.replaceChildren();
  }
}
async function sharingControls(notes) {
  const saved = await rpc("yeobaek_my_shares", {book_key:book});
  const shared = new Map(saved.map(row => [row.body,row.topic]));
  const renderControl = (note, body) => {
    const wrap = element("details", "");
    wrap.append(element("summary", shared.has(body) ? "공개 중 · " + shared.get(body) : "이 꿈을 나누기"));
    const label = element("label", "꿈의 주제 ");
    const select = element("select", "");
    for (const topic of topics) select.add(new Option(topic,topic));
    if (shared.has(body)) select.value = shared.get(body);
    label.append(select);
    const publish = element("button", "모두에게 공개");
    const withdraw = element("button", "공개 취소");
    withdraw.hidden = !shared.has(body);
    const status = element("p", "");
    status.setAttribute("role","status");
    const update = async topic => {
      publish.disabled = withdraw.disabled = true;
      try {
        const ok = await rpc("yeobaek_share", {book_key:book,dream:body,topic});
        if (!ok) throw new Error("unsaved");
        wrap.querySelector("summary").textContent = topic ? "공개 중 · " + topic : "이 꿈을 나누기";
        withdraw.hidden = !topic;
        status.textContent = topic ? "함께 나눈 꿈에 공개했습니다." : "공개를 취소했습니다.";
        refreshAtlas();
      } catch { status.textContent = "변경 여부를 확인하지 못했습니다. 다시 시도해 주세요."; }
      finally { publish.disabled = withdraw.disabled = false; }
    };
    publish.onclick = () => update(select.value);
    withdraw.onclick = () => update(null);
    wrap.append(element("p","공개하면 누구나 이 문장 전체를 읽을 수 있습니다. 같은 브라우저에서 공개를 취소할 수 있어요."),label,publish,withdraw,status);
    note.append(wrap);
  };
  const visible = new Set();
  for (const note of notes) {
    const body = note.querySelector("p").textContent;
    visible.add(body);
    renderControl(note,body);
  }
  for (const {body} of saved) {
    if (visible.has(body)) continue;
    const note = element("div","");
    note.className = "note";
    note.append(element("p",body));
    renderControl(note,body);
    byId("entries").append(note);
  }
}
more.onclick = () => readGallery(true);
byId("atlas-refresh").onclick = refreshAtlas;
refreshAtlas();
