"use strict";
// Partition a convex polygon by area. Every cut preserves both area and topic order.
function polygonArea(points) {
  let twice = 0;
  points.forEach(([x,y],i) => {
    const next = points[(i+1)%points.length];
    twice += x*next[1] - y*next[0];
  });
  return Math.abs(twice)/2;
}
function clipTerritory(points, normal, limit) {
  const result = [];
  const distance = p => p[0]*normal[0] + p[1]*normal[1] - limit;
  points.forEach((p,i) => {
    const q = points[(i+1)%points.length];
    const a = distance(p), b = distance(q);
    if (a<=0) result.push(p);
    if ((a<0 && b>0) || (a>0 && b<0)) {
      const t=a/(a-b);
      result.push([p[0]+t*(q[0]-p[0]), p[1]+t*(q[1]-p[1])]);
    }
  });
  return result;
}
function territories(items, polygon, depth=0) {
  if (items.length===1) return [{...items[0], polygon}];
  const total = items.reduce((sum,item)=>sum+item.count,0);
  let split=1, weight=items[0].count;
  while (split<items.length-1 && Math.abs(weight+items[split].count-total/2)<Math.abs(weight-total/2)) {
    weight+=items[split++].count;
  }
  const xs=polygon.map(p=>p[0]), ys=polygon.map(p=>p[1]);
  const tilt=depth%2 ? -.28 : .34;
  const normal=Math.max(...xs)-Math.min(...xs)>Math.max(...ys)-Math.min(...ys) ? [1,tilt] : [tilt,1];
  const projections=polygon.map(p=>p[0]*normal[0]+p[1]*normal[1]);
  let lo=Math.min(...projections), hi=Math.max(...projections);
  const target=polygonArea(polygon)*weight/total;
  for(let i=0;i<48;i++) {
    const mid=(lo+hi)/2;
    if(polygonArea(clipTerritory(polygon,normal,mid))<target) lo=mid; else hi=mid;
  }
  const boundary=(lo+hi)/2;
  const left=clipTerritory(polygon,normal,boundary);
  const right=clipTerritory(polygon,normal.map(n=>-n),-boundary);
  return [...territories(items.slice(0,split),left,depth+1),...territories(items.slice(split),right,depth+1)];
}
const mapPalette=["#62c6b4","#8aaef2","#d7a1cc","#ebbb78","#aabf83","#afa2de"];
function svgNode(tag,attrs) {
  const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  return node;
}
function renderTerritories(host, items, selected, choose) {
  host.replaceChildren();
  const total=items.reduce((sum,item)=>sum+item.count,0);
  if (!total) {
    host.textContent="첫 꿈이 공개되면 이곳에 주제의 영역이 생깁니다.";
    return;
  }
  const width=host.clientWidth<500 ? 400 : 800, height=width===400 ? 380 : 370;
  const svg=svgNode("svg",{viewBox:"0 0 "+width+" "+height,role:"group","aria-label":"공개 꿈의 비중을 면적으로 나타낸 꿈 지도"});
  const cells=territories(items.filter(item=>item.count>0),[[0,0],[width,0],[width,height],[0,height]]);
  for (const cell of cells) {
    const vertices=cell.polygon;
    const center=[0,1].map(axis=>vertices.reduce((s,p)=>s+p[axis],0)/vertices.length);
    const [cx,cy]=center;
    const group=svgNode("g",{role:"button",tabindex:0,"aria-label":cell.topic+" · "+cell.count+"개","aria-pressed":String(cell.topic===selected),"data-topic":cell.topic});
    const title=svgNode("title",{});title.textContent=cell.topic+" · "+cell.count+"개";
    group.append(title,svgNode("polygon",{class:"territory",points:vertices.map(p=>p.join(",")).join(" "),fill:cell.color}));
    // Place a bounded constellation inside the convex cell, with deterministic positions.
    const stars=[];
    const count=Math.min(cell.count,40);
    for (let i=0;i<count;i++) {
      const edge=i%vertices.length, a=vertices[edge], b=vertices[(edge+1)%vertices.length];
      const t=(.42+i*.618034)%1, r=.55+.34*((i*.754878+.37)%1);
      const x=cx+r*(a[0]+t*(b[0]-a[0])-cx), y=cy+r*(a[1]+t*(b[1]-a[1])-cy);
      stars.push([x,y]);
      let nearest=center, distance=Math.hypot(x-cx,y-cy);
      for (const p of stars.slice(0,-1)) {
        const d=Math.hypot(x-p[0],y-p[1]);
        if (d<distance) {nearest=p;distance=d;}
      }
      group.append(svgNode("line",{x1:nearest[0],y1:nearest[1],x2:x,y2:y,stroke:cell.color}),
        svgNode("circle",{cx:x,cy:y,r:2.8,fill:cell.color}));
    }
    const inset=Math.min(...vertices.map((p,i)=>{
      const q=vertices[(i+1)%vertices.length],dx=q[0]-p[0],dy=q[1]-p[1];
      return Math.abs(dx*(cy-p[1])-dy*(cx-p[0]))/(Math.hypot(dx,dy)||1);
    }));
    if(inset>Math.max(24,cell.topic.length*6)) {
      const label=svgNode("text",{x:cx,y:cy,"text-anchor":"middle"});
      label.textContent=cell.topic;
      const amount=svgNode("text",{x:cx,y:cy+19,"text-anchor":"middle",class:"portion"});
      amount.textContent=cell.count+"개 · "+new Intl.NumberFormat("ko",{style:"percent",maximumFractionDigits:1}).format(cell.count/total);
      group.append(label,amount);
    }
    group.onclick=()=>choose(cell.topic);
    group.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose(cell.topic);}};
    svg.append(group);
  }
  host.append(svg);
}
