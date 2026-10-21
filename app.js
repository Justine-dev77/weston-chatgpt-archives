(() => {
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const STORAGE = "weston-chatgpt-reader-v1";
const STRONG = [
  "weston","neko","alex lilburry","lilburry","quentin","ichiro","tommy","melvin","kyle",
  "julian","jaxon","eurynome","jillan","ravenhill","winston","cody","nikolai","viktor",
  "gareth","jeffrey","alistair","amelia","amélia","joshua","vincent ashford","logan o'sullivan",
  "keith hayden","miller","dane","snow","ferrari"
];
let db = loadDB();
let currentId = null, currentFilter = "all", currentFolder = null, pendingImport = null;
let search = "";

function freshDB(){return {version:1,conversations:[],meta:{},folders:[],settings:{hideUntitled:false}}}
function loadDB(){try{return {...freshDB(),...JSON.parse(localStorage.getItem(STORAGE)||"{}")}}catch{return freshDB()}}
function saveDB(){localStorage.setItem(STORAGE, JSON.stringify(db))}
function meta(id){return db.meta[id] ||= {favorite:false,hidden:false,folder:null,scroll:0,highlights:[]}}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
function fmtDate(ts){if(!ts)return ""; return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium"}).format(new Date(ts*1000))}
function cleanTitle(t){return (t||"Sans titre").trim()||"Sans titre"}

function extractText(content){
  if(!content) return "";
  const parts = content.parts || [];
  const out = [];
  for(const p of parts){
    if(typeof p === "string") out.push(p);
    else if(p && typeof p === "object"){
      if(typeof p.text === "string") out.push(p.text);
      else if(p.content_type === "image_asset_pointer" || p.asset_pointer) out.push("[Image]");
      else if(p.content_type === "audio_transcription" && p.text) out.push(p.text);
    }
  }
  return out.join("\n");
}
function flattenConversation(c){
  const mapping = c.mapping || {};
  let nodeId = c.current_node;
  let chain = [];
  const seen = new Set();
  if(nodeId && mapping[nodeId]){
    while(nodeId && mapping[nodeId] && !seen.has(nodeId)){
      seen.add(nodeId); chain.push(mapping[nodeId]); nodeId = mapping[nodeId].parent;
    }
    chain.reverse();
  } else {
    chain = Object.values(mapping).sort((a,b)=>((a.message?.create_time)||0)-((b.message?.create_time)||0));
  }
  const messages=[];
  for(const n of chain){
    const m=n.message;if(!m)continue;
    const role=m.author?.role;
    if(!["user","assistant"].includes(role)) continue;
    if(m.metadata?.is_visually_hidden_from_conversation) continue;
    const text=extractText(m.content).trim();
    if(!text) continue;
    messages.push({role,text,time:m.create_time||null});
  }
  return {
    id:c.conversation_id||c.id||crypto.randomUUID(),
    title:cleanTitle(c.title),
    create_time:c.create_time||null,
    update_time:c.update_time||null,
    messages
  };
}
function classify(conv){
  const title=conv.title.toLowerCase();
  const body=conv.messages.map(m=>m.text).join("\n").toLowerCase();
  let score=0, hits=new Set();
  for(const k of STRONG){
    if(title.includes(k)){score+=4;hits.add(k)}
    else if(body.includes(k)){score+=1;hits.add(k)}
  }
  if(title.includes("scène") && hits.size) score+=1;
  if(hits.size>=3) score+=2;
  return score>=4 ? "weston" : score>=1 ? "review" : "excluded";
}
async function parseRawFile(file){
  const raw=JSON.parse(await file.text());
  if(!Array.isArray(raw)) throw new Error("Format inattendu : liste de conversations introuvable.");
  const buckets={weston:[],review:[],excluded:[]};
  for(let i=0;i<raw.length;i++){
    const conv=flattenConversation(raw[i]);
    const kind=classify(conv); buckets[kind].push(conv);
    if(i%30===0) await new Promise(r=>setTimeout(r,0));
  }
  return buckets;
}

function renderFolders(){
  const host=$("#folderList");host.innerHTML="";
  for(const f of db.folders){
    const row=document.createElement("div");row.className="folder-item"+(currentFolder===f.id?" active":"");
    const b=document.createElement("button");b.textContent="▸ "+f.name;b.onclick=()=>{currentFolder=f.id;currentFilter="folder";setActiveFilter();render()};
    const d=document.createElement("button");d.className="folder-delete";d.textContent="×";d.title="Supprimer le dossier";
    d.onclick=()=>{if(confirm(`Supprimer le dossier « ${f.name} » ? Les conversations resteront disponibles.`)){db.folders=db.folders.filter(x=>x.id!==f.id);for(const id in db.meta)if(db.meta[id].folder===f.id)db.meta[id].folder=null;if(currentFolder===f.id){currentFolder=null;currentFilter="all"}saveDB();render()}};
    row.append(b,d);host.append(row);
  }
}
function counts(){
  $("#countAll").textContent=db.conversations.filter(c=>!meta(c.id).hidden).length;
  $("#countFav").textContent=db.conversations.filter(c=>meta(c.id).favorite&&!meta(c.id).hidden).length;
  $("#countUnfiled").textContent=db.conversations.filter(c=>!meta(c.id).folder&&!meta(c.id).hidden).length;
  $("#countHidden").textContent=db.conversations.filter(c=>meta(c.id).hidden).length;
}
function setActiveFilter(){
  $$(".filter").forEach(b=>b.classList.toggle("active", b.dataset.filter===currentFilter));
  renderFolders();
}
function filtered(){
  let arr=db.conversations.filter(c=>{
    const m=meta(c.id);
    if(db.settings.hideUntitled && /^(sans titre|untitled)$/i.test(c.title)) return false;
    if(currentFilter==="all" && m.hidden)return false;
    if(currentFilter==="favorites" && (!m.favorite||m.hidden))return false;
    if(currentFilter==="unfiled" && (m.folder||m.hidden))return false;
    if(currentFilter==="hidden" && !m.hidden)return false;
    if(currentFilter==="folder" && (m.folder!==currentFolder||m.hidden))return false;
    if(search){
      const hay=(c.title+"\n"+c.messages.map(x=>x.text).join("\n")).toLowerCase();
      if(!hay.includes(search.toLowerCase()))return false;
    }
    return true;
  });
  const sort=$("#sortSelect").value;
  arr.sort((a,b)=> sort==="date_asc"?(a.create_time||0)-(b.create_time||0):
    sort==="title_asc"?a.title.localeCompare(b.title,"fr"):
    (b.create_time||0)-(a.create_time||0));
  return arr;
}
function makeSnippet(c){
  const q=search.toLowerCase(); const text=c.messages.map(x=>x.text).join(" ").replace(/\s+/g," ");
  if(q){const i=text.toLowerCase().indexOf(q);if(i>=0)return "…"+text.slice(Math.max(0,i-55),i+145)+"…"}
  return text.slice(0,190)+(text.length>190?"…":"");
}
function renderList(){
  const host=$("#conversationList"), arr=filtered();host.innerHTML="";
  $("#searchCount").textContent=search?`${arr.length} résultat${arr.length>1?"s":""}`:"";
  $("#listSubtitle").textContent=`${arr.length} conversation${arr.length>1?"s":""}`;
  if(!arr.length){host.innerHTML='<div class="empty-state"><div class="empty-icon">🕯️</div><h2>Rien ici</h2><p>Essaie un autre filtre ou une autre recherche.</p></div>';return}
  for(const c of arr){
    const m=meta(c.id), card=document.createElement("div");card.className="conv-card"+(c.id===currentId?" active":"");
    card.innerHTML=`<div class="conv-title"></div>${m.favorite?'<div class="star">★</div>':""}<div class="conv-meta"><span>${fmtDate(c.create_time)}</span><span>${c.messages.length} messages</span></div><div class="conv-snippet"></div>`;
    card.querySelector(".conv-title").textContent=c.title; card.querySelector(".conv-snippet").textContent=makeSnippet(c);
    card.onclick=()=>openConversation(c.id);host.append(card);
  }
}
function escapeHTML(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function applyHighlights(text, highlights){
  let html=escapeHTML(text);
  for(const h of highlights||[]){
    const safe=escapeHTML(h.text); if(!safe)continue;
    html=html.split(safe).join(`<mark class="hl-${h.color}">${safe}</mark>`);
  }
  return html;
}
function openConversation(id){
  if(currentId && $("#reader")) meta(currentId).scroll=$("#reader").scrollTop;
  currentId=id; saveDB(); renderList(); renderReader();
  if(innerWidth<=700)$("#reader").classList.add("open");
}
function renderReader(){
  const host=$("#reader"), c=db.conversations.find(x=>x.id===currentId);
  if(!c){host.classList.remove("open");host.innerHTML='<div class="reader-empty"><div class="empty-icon">📖</div><h2>Choisis une conversation</h2><p>La reprise de lecture est enregistrée automatiquement.</p></div>';return}
  const m=meta(c.id);
  const folders=db.folders.map(f=>`<option value="${f.id}" ${m.folder===f.id?"selected":""}>${escapeHTML(f.name)}</option>`).join("");
  host.innerHTML=`<div class="reader-head">
    <button id="backMobile" class="secondary mobile-only">← Conversations</button>
    <h2>${escapeHTML(c.title)}</h2><div class="meta">${fmtDate(c.create_time)} · ${c.messages.length} messages</div>
    <div class="reader-actions">
      <button id="favBtn">${m.favorite?"★ Retirer des favoris":"☆ Ajouter aux favoris"}</button>
      <select id="folderSelect"><option value="">— Sans dossier —</option>${folders}</select>
      <button id="hideBtn">${m.hidden?"Réafficher":"Masquer"}</button>
      <button id="highlightBtn">Surligner la sélection</button>
    </div></div><div class="messages"></div>`;
  const messages=host.querySelector(".messages");
  for(const msg of c.messages){
    const div=document.createElement("section");div.className=`message ${msg.role}`;
    div.innerHTML=`<div class="message-role">${msg.role==="user"?"Toi":"ChatGPT"}</div><div class="message-body">${applyHighlights(msg.text,m.highlights)}</div>`;
    messages.append(div);
  }
  $("#favBtn").onclick=()=>{m.favorite=!m.favorite;saveDB();render()};
  $("#folderSelect").onchange=e=>{m.folder=e.target.value||null;saveDB();renderFolders();counts();toast("Classement enregistré")};
  $("#hideBtn").onclick=()=>{m.hidden=!m.hidden;saveDB();render();toast(m.hidden?"Conversation masquée":"Conversation réaffichée")};
  $("#backMobile").onclick=()=>host.classList.remove("open");
  $("#highlightBtn").onclick=()=>highlightSelection(c.id);
  requestAnimationFrame(()=>host.scrollTop=m.scroll||0);
}
function highlightSelection(id){
  const sel=window.getSelection();const text=(sel?.toString()||"").trim();
  if(text.length<2){toast("Sélectionne d’abord un passage dans la conversation");return}
  if(text.length>500){toast("Sélection trop longue (500 caractères max)");return}
  const color=prompt("Couleur : pink, purple, gold ou green","pink");
  if(!["pink","purple","gold","green"].includes(color||""))return;
  meta(id).highlights.push({text,color});saveDB();renderReader();toast("Passage surligné")
}
function render(){counts();renderFolders();renderList();renderReader();$("#hideUntitled").checked=!!db.settings.hideUntitled}
function importSelected(){
  const include=$("#includeReview").checked;
  const selected=[...pendingImport.weston,...(include?pendingImport.review:[])];
  const existing=new Map(db.conversations.map(c=>[c.id,c]));
  selected.forEach(c=>existing.set(c.id,c));
  db.conversations=[...existing.values()];
  saveDB(); pendingImport=null; $("#importDialog").close(); render();toast("Import Weston terminé")
}
function download(name,obj){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)
}

$("#importBtn").onclick=()=>$("#fileInput").click();
$("#fileInput").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    $("#importDialog").showModal();$("#importSummary").textContent=`Analyse de ${file.name}…`;
    pendingImport=await parseRawFile(file);
    $("#detectedCount").textContent=pendingImport.weston.length;$("#reviewCount").textContent=pendingImport.review.length;$("#excludedCount").textContent=pendingImport.excluded.length;
    $("#importSummary").textContent="J’ai séparé les conversations probablement liées à Weston Academy du reste de l’export.";
  }catch(err){$("#importDialog").close();alert(err.message)}
  e.target.value="";
};
$("#confirmImportBtn").onclick=importSelected;
$("#backupBtn").onclick=()=>download("weston-chatgpt-backup.json",{app:"Weston ChatGPT Archives",exportedAt:new Date().toISOString(),data:db});
$("#restoreBtn").onclick=()=>$("#backupInput").click();
$("#backupInput").onchange=async e=>{try{const obj=JSON.parse(await e.target.files[0].text());if(!obj.data?.conversations)throw new Error("Sauvegarde Weston invalide.");db={...freshDB(),...obj.data};saveDB();render();toast("Sauvegarde restaurée")}catch(err){alert(err.message)}e.target.value=""};
$("#addFolderBtn").onclick=()=>{$("#folderNameInput").value="";$("#folderDialog").showModal()};
$("#createFolderBtn").onclick=()=>{const name=$("#folderNameInput").value.trim();if(!name)return;db.folders.push({id:crypto.randomUUID(),name});saveDB();$("#folderDialog").close();renderFolders()};
$$(".filter").forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;currentFolder=null;setActiveFilter();render()});
$("#searchInput").oninput=e=>{search=e.target.value;renderList()};
$("#clearSearchBtn").onclick=()=>{$("#searchInput").value="";search="";renderList()};
$("#sortSelect").onchange=renderList;
$("#hideUntitled").onchange=e=>{db.settings.hideUntitled=e.target.checked;saveDB();renderList()};
$("#sidebarToggle").onclick=()=>$("#sidebar").classList.toggle("collapsed");
$("#mobileMenuBtn").onclick=()=>$("#sidebar").classList.add("mobile-open");
document.addEventListener("click",e=>{if(innerWidth<=900 && $("#sidebar").classList.contains("mobile-open")&&!$("#sidebar").contains(e.target)&&e.target!==$("#mobileMenuBtn"))$("#sidebar").classList.remove("mobile-open")});
$("#reader").addEventListener("scroll",()=>{if(!currentId)return;clearTimeout(window.__scrollSave);window.__scrollSave=setTimeout(()=>{meta(currentId).scroll=$("#reader").scrollTop;saveDB()},250)});

if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(()=>{});
render();
})();