(()=>{
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
// 정식판: 공개 데이터(data/*.json)만 받는다. 친구·관리자 화면은 로그인 뒤 서버(웹 앱)가 권한을 확인하고 보내는 데이터로 연다(다음 단계).
let D=null, role='visitor';
// 검토 기록: 정식판에서는 서버에 저장한다. 공개 데이터에는 이미 승인된 것만 들어 있어 방문객 화면은 이것을 쓰지 않는다.
let RV={};
// 추억 후보(세션 기록에서 뽑은 명대사·주사위·웃긴 장면·감동 장면). 관리자는 비공개 묶음 전체, 그 밖은 서버가 승인·범위로 거른 것만 받는다
let MEM={};
const MEM_KIND={quote:'명대사',dice:'전설적인 주사위',laugh:'웃겼던 순간',moment:'감동적인 장면'};
const memRV=m=>RV['mem:'+m.id]||{};
const memState=m=>memRV(m).st||(m.status==='approved'?'ok':'draft'), memText=m=>memRV(m).text||m.text, memVis=m=>memRV(m).vis||m.vis||(m.friends?'친구':'공개');
const shownMems=kind=>Object.values(MEM).filter(m=>m.kind===kind&&(!isAdmin()||memState(m)==='ok')).sort((a,b)=>String(a.sessionId).localeCompare(String(b.sessionId))||String(a.id).localeCompare(String(b.id)));
let saveRV=()=>{};
// 즐겨찾기: 지금 캐릭터 서고(/Character_Archive/)와 같은 주소라 같은 'fav' 칸을 함께 쓴다
let FAV=new Set(store.get('fav',[]));
let saveFav=()=>store.set('fav',[...FAV]);
let still=store.get('pa-still',false);
function applyMotion(){document.documentElement.classList.toggle('still',still);$('#motionBtn').textContent=still?'배경 움직임 켜기':'배경 움직임 끄기'}
applyMotion();
$('#motionBtn').addEventListener('click',()=>{still=!still;store.set('pa-still',still);applyMotion()});
function toast(t){document.querySelectorAll('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast';d.role='status';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}

const EMBLEM='<svg viewBox="0 0 80 64" aria-hidden="true" fill="none" stroke="#e2b14a" stroke-width="1.4"><path d="M40 6l11 19H29z"/><path d="M40 37L29 18h22z"/><path d="M14 22c-2 12 4 24 18 30M66 22c2 12-4 24-18 30"/><path d="M15 28l-5-2M15 34l-6 0M17 40l-6 2M21 45l-5 4M65 28l5-2M65 34l6 0M63 40l6 2M59 45l5 4"/><rect x="30" y="50" width="8" height="6"/><rect x="42" y="50" width="8" height="6"/></svg>';

// ---------- 데이터 색인 ----------
let byId={}, chars={}, scen={}, camp={}, PT={};
function idx(){
  byId={};chars={};scen={};camp={};PT={};
  D.sessions.forEach(s=>byId[s.id]=s); D.characters.forEach(c=>chars[c.id]=c); D.scenarios.forEach(s=>scen[s.id]=s); D.campaigns.forEach(c=>camp[c.id]=c); D.playthroughs.forEach(p=>PT[p.id]=p);
}
const isAdmin=()=>role==='admin';
// 요약 · 결말 · 회차 상태는 각각 따로 승인한다
const sumState=s=>!s.summary?'none':(RV['sum:'+s.id]?.st||(s.summary.status==='approved'?'ok':'draft'));
const sumText=s=>RV['sum:'+s.id]?.text??s.summary?.text??'';
const sumPub=s=>{const r=RV['sum:'+s.id];if(r)return r.pub??null;return s.summary?.status==='approved'?s.summary.text:null};
const canSeeSummary=s=>!!s.summary&&(isAdmin()||sumPub(s)!=null);
const shownSum=s=>isAdmin()?sumText(s):sumPub(s);
const endState=s=>!s.ending?'none':(RV['end:'+s.id]?.st||(s.ending.status==='approved'?'ok':'draft'));
const endVis=s=>RV['end:'+s.id]?.vis||s.ending?.vis||'비공개';
const canSeeEnding=s=>!!s.ending&&(isAdmin()||(endState(s)==='ok'&&(endVis(s)==='공개'||(endVis(s)==='친구'&&role==='friend'))));
function ptInfo(id){
  const p=PT[id]||{status:'미확인',by:'AI 추정'}, r=RV['pt:'+id];
  const status=r?.status||p.status, sure=!!r||p.by==='대장 확인';
  return {status, sure, note:p.note, shown: sure?status:'미확인', endedAt:r?.endedAt||p.endedAt||null};   // 방문객·친구는 확인된 상태만
}
const ptLabel=pi=>isAdmin()&&!pi.sure&&pi.status!=='미확인'?`<span class="tag warn" title="AI가 기록을 보고 짐작한 상태예요. 작업함에서 확정해요">AI 추정 · ${esc(pi.status)}</span>`:`<span class="tag ${pi.shown==='완주'?'ok':pi.shown==='중단'?'bad':pi.shown==='진행 중'?'gold':''}">${esc(pi.shown)}</span>`;

// 날짜: 값·정밀도·출처. 기록 본문·대장 확인만 '확정', 파일 날짜는 '추정'
const dateSure=d=>!!d&&(d.sure!=null?!!d.sure:/기록 본문|대장 확인|실제/.test(d.src||''));
function dateText(d,plain){
  if(!d||d.prec==='unknown'||!d.v) return '일자 미상';
  let t;
  if(d.prec==='day'){const [y,m,dd]=d.v.split('-');t=`${y}.${m}.${dd}`}
  else if(d.prec==='month'){const [y,m]=d.v.split('-');t=`${y}년 ${+m}월`}
  else t=`${d.v}년`;
  if(plain) return t+(dateSure(d)?'':' 추정');
  return `<span class="dt" title="${esc(d.src||'')}${dateSure(d)?'':' 기준 추정'}">${t}${dateSure(d)?'':'<i>추정</i>'}</span>`;
}
const yearOf=s=>s.date&&s.date.v?+s.date.v.slice(0,4):null;
const padDate=v=>v.length===4?v+'-00-00':v.length===7?v+'-00':v;
const sortKey=s=>(s.date&&s.date.v?padDate(s.date.v):'9999')+String(s.no??0).padStart(4,'0')+(s.part?String(s.part).padStart(2,'0'):'');
const cmpAsc=(a,b)=>sortKey(a)<sortKey(b)?-1:sortKey(a)>sortKey(b)?1:0;
const sessionsOfChar=id=>D.sessions.filter(s=>(s.pcs||[]).includes(id)).sort(cmpAsc);
const ptSessions=id=>D.sessions.filter(s=>s.playthroughId===id).sort((a,b)=>(a.part||0)-(b.part||0)||cmpAsc(a,b));
const pcName=p=>typeof p==='string'?(chars[p]?.['이름']||p):p.name;
// 대장이 사이트에서 넣는 시나리오 표시·평점: 서버 검토 기록(RV)의 sc:<시나리오id>, rate:<회차id>. 개변 메모는 관리자만
const scMark=sc=>({owned:!!sc.owned,wish:!!sc.wish,prep:!!sc.prep,...(RV['sc:'+sc.id]||{})});
const rateOf=ptid=>RV['rate:'+ptid]||null;
const stars=n=>n?'★'.repeat(n)+'☆'.repeat(5-n):'';
function scenStatus(sc){
  const ss=D.sessions.filter(s=>s.scenarioId===sc.id), st=[];
  if(ss.some(s=>s.role==='PL')) st.push('해 봄');
  if(ss.some(s=>s.role==='KP')) st.push('키퍼링');
  const m=scMark(sc); if(m.owned) st.push('보유'); if(m.wish) st.push('하고 싶음'); if(m.prep) st.push('준비 중');
  if(sc.source==='자작'&&sc.sourceSure!==false) st.push('자작');
  return st;
}
function playthroughs(sc){
  const ids=[...new Set(D.sessions.filter(s=>s.scenarioId===sc.id).map(s=>s.playthroughId))];
  return ids.map(id=>({id,ss:ptSessions(id),info:ptInfo(id)}));
}
function pcChip(p){
  if(typeof p==='string'){const c=chars[p];if(!c)return `<span class="pc none">${esc(p)} · 서고에 없음</span>`;return `<a class="pc" href="#${c.id}"><img src="${esc(c.img)}" alt="">${esc(c['이름'])}</a>`}
  return `<span class="pc none">${esc(p.name)}${isAdmin()&&p.note?` · ${esc(p.note)}`:''}</span>`;
}
// 주사위 판정: 이름 자리에 식이 들어간 줄은 빼고, 왜 뺐는지 함께 넘김
function diceRows(c){
  const rows=c['판정']||c['시트']?.['판정']||[], ok=[], skipped=[];
  const good=/^[+\-]?((\d*d\d+)|\d+)([+\-]((\d*d\d+)|\d+))*$/i;
  rows.forEach(([l,e])=>{
    if(/^\s*[\dd+\-\s]+$/i.test(l)) skipped.push([l,e,'이름 자리에 식이 들어가 있음(원본 확인 필요)']);
    else if(!good.test(String(e).replace(/\s+/g,''))) skipped.push([l,e,'주사위 식으로 읽을 수 없음']);
    else ok.push([l,e]);
  });
  return {ok,skipped};
}

// ---------- 처음: 전시실 ----------
function yearsAll(){
  const ys=D.sessions.map(yearOf).filter(Boolean);
  const lo=Math.min(...ys), hi=Math.max(new Date().getFullYear(),...ys);
  return Array.from({length:hi-lo+1},(_,i)=>lo+i);
}
function todayLines(){
  const dated=D.sessions.filter(s=>s.date&&s.date.v).sort(cmpAsc), recent=dated.slice(-3).reverse();
  const going=D.playthroughs.map(p=>({p,i:ptInfo(p.id)})).filter(x=>x.i.shown==='진행 중').map(x=>scen[x.p.scenarioId]).filter(Boolean);
  const d=new Date(), md=String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'), y=d.getFullYear();
  const ago=D.sessions.filter(s=>s.date&&s.date.prec==='day'&&s.date.v.slice(5)===md&&+s.date.v.slice(0,4)<y);
  const row=(k,html)=>html?`<li><b>${k}</b><span>${html}</span></li>`:'';
  const L=[row('최근 추가',recent.map(s=>`<a href="#${s.id}">${esc(s.title)}</a> <small>${dateText(s.date,true)}</small>`).join(' · ')),
    row('진행 중인 모험',going.slice(0,3).map(sc=>`<a href="#${sc.id}">${esc(sc.title)}</a>`).join(' · ')),
    row('몇 년 전 오늘',ago.slice(0,3).map(s=>`<a href="#${s.id}">${y-(+s.date.v.slice(0,4))}년 전 · ${esc(s.title)}</a>${dateSure(s.date)?'':' <small>추정</small>'}`).join(' · '))].join('');
  return L?`<ul class="today">${L}</ul>`:'';
}
function exhibit(){
  const C=D.characters, rich=c=>sessionsOfChar(c.id).length*3+(c['연대기']||[]).length*2+(c['앨범']||[]).length+(c['이야기']?2:0);
  let picks=PICKS.map(id=>chars[id]).filter(Boolean); const auto=!picks.length; if(auto)picks=[...C].sort((a,b)=>rich(b)-rich(a)).slice(0,3);
  const d=new Date(), md=String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const onDay=D.sessions.filter(s=>s.date&&s.date.prec==='day'&&s.date.v.slice(5)===md&&(s.pcs||[]).some(p=>chars[p]));
  const seed=Math.floor(Date.now()/864e5), withImg=C.filter(c=>c.img);
  const todS=onDay.length?onDay[seed%onDay.length]:null, tod=todS?chars[todS.pcs.find(p=>chars[p])]:withImg[seed%withImg.length];
  const short=c=>c['한마디']||(c['이야기']||'').split(/(?<=[.!?。])\s/)[0];
  const card=(c,why)=>`<a class="pick" href="#${c.id}"><span class="pp">${c.img?`<img src="${esc(c.img)}" alt="" loading="lazy">`:`<span class="ini">${esc(c['이름'][0])}</span>`}</span><span class="ptx"><small>${esc(why)}</small><b>${esc(c['이름'])}</b>${short(c)?`<q>${esc(short(c))}</q>`:''}</span></a>`;
  return `<div class="sect-t">${auto?'LONG STORIES · 오래 이어진 이야기':'CURATOR\'S PICK · 서고지기의 추천'}</div>
  <section class="picks">${picks.map(c=>card(c,auto?`${Math.max(sessionsOfChar(c.id).length,playsOf(c))}번의 모험`:'서고지기의 추천')).join('')}${tod?card(tod,todS?`오늘의 캐릭터 · ${todS.date.v.slice(0,4)}년 오늘 플레이`:'오늘의 캐릭터'):''}</section>`;
}
function home(){
  const real=D.meta.totalsReal.characters, nS=D.sessions.length, nSc=D.scenarios.length;
  const pool=D.sessions.filter(s=>s.summary&&sumPub(s)!=null); const pick=pool.length?pool[Math.floor(Date.now()/864e5)%pool.length]:null;
  const pc=pick&&(pick.pcs||[]).map(p=>chars[p]).find(Boolean);
  return `
  <section class="hero">${EMBLEM}
    <div class="eyebrow">EX LIBRIS · EST. 2021</div>
    <h1>THE PRAYPEACE ARCHIVES</h1>
    <div class="sub">수많은 세계, 수많은 삶, 그리고 우리가 만든 이야기.</div>
  </section>
  <section class="stats">
    <div class="stat"><b>${real}</b><small>CHARACTERS</small><span>살아 보았던 삶</span><em>캐릭터 서고 전체</em></div>
    <div class="stat"><b>${nS}</b><small>SESSIONS</small><span>함께한 시간</span><em>정리된 세션 기록</em></div>
    <div class="stat"><b>${nSc}</b><small>SCENARIOS</small><span>모험했던 세계</span><em>정리된 시나리오</em></div>
  </section>
  <div class="sect-t">THE COLLECTIONS</div>
  <section class="cols">
    ${[['sessions','session','01','SESSION','세션 기록','함께 만들어 온 이야기'],['characters','character','02','CHARACTER','캐릭터 서고','우리가 살아 보았던 삶'],['scenarios','scenario','03','SCENARIO','시나리오 서고','모험이 기다리는 세계'],['memory','memory','04','MEMORY','추억관','잊고 싶지 않은 순간들'],['player','player','05','PLAYER','플레이어 서고','이 서고의 주인은 어떤 플레이어일까']].map(([h,i,n,t,k,p])=>`
    <a class="coll" href="#${h}"><div class="ph"><img src="img/coll-${i}.svg" alt="" loading="lazy"></div><div class="meta"><div class="no">${n}</div><h3>${t}</h3><p><b>${k}</b>${p}</p></div></a>`).join('')}
  </section>
  ${todayLines()}
  ${exhibit()}
  <section class="duo">
    <div class="panel"><div class="k">FROM THE ARCHIVES</div><h2>서고에서 꺼낸 오래된 기억</h2>
    ${pick?`<a class="memory" href="#${pick.id}">${pc?`<img src="${esc(pc.img)}" alt="">`:'<span class="noimg"></span>'}<div><b>${esc(pick.title)}</b><div style="color:var(--dust);font-size:13px">${dateText(pick.date)}${pc?' · '+esc(pc['이름']):''}</div><div style="font-size:13.5px;margin-top:4px">${esc(sumPub(pick))}</div><div style="color:var(--gilt);font-size:12.5px;margin-top:4px">다시 만나기 →</div></div></a>`
      :`<p class="locked" style="margin:0">승인된 기록이 아직 없어요. ${isAdmin()?'<a href="#inbox">작업함</a>에서 요약을 승인하면':'관리자가 요약을 승인하면'} 하루에 하나씩 여기에 나타나요.</p>`}
    </div>
    <div class="panel"><div class="k">THE JOURNEY</div><h2>나의 TRPG 발자취</h2>
      <div class="journey">${yearsAll().map(y=>{const n=D.sessions.filter(s=>yearOf(s)===y).length;return `<a class="yr" href="#journey/${y}"><i></i><span>${y}</span><small>${n}회</small></a>`}).join('')}</div>
    </div>
  </section>
  <section class="toolrow">
    <a href="https://praypeace.github.io/TRPG_Archive/" target="_blank" rel="noopener"><b>TRPG Archive ↗</b><span>새로운 이야기를 시작하는 곳</span></a>
    <a href="dice.html"><b>ORACLE DICE ↗</b><span>AI 마스터와 노는 날의 주사위</span></a>
  </section>`;
}

// ---------- SESSION: 세션 탐색기 ----------
const SQ0={q:'',year:'',rule:'',role:'',st:'',camp:'',pc:'',src:'',sort:'new',group:true,page:1};
let SQ={...SQ0,...store.get('pa-sq',{})};
const PAGE=12;
function sessionMatches(s){
  const q=SQ.q.trim().toLowerCase();
  if(q){const hay=[s.no,s.title,s.rule,dateText(s.date,true),camp[s.campaignId]?.title,...(s.pcs||[]).map(pcName),canSeeSummary(s)?shownSum(s):''].join(' ').toLowerCase();if(!hay.includes(q))return false}
  if(SQ.year){if(SQ.year==='미상'?yearOf(s):String(yearOf(s))!==SQ.year)return false}
  if(SQ.rule&&s.rule!==SQ.rule)return false;
  if(SQ.role&&s.role!==SQ.role)return false;
  if(SQ.st&&ptInfo(s.playthroughId)[isAdmin()?'status':'shown']!==SQ.st)return false;
  if(SQ.camp&&(SQ.camp==='없음'?s.campaignId:s.campaignId!==SQ.camp))return false;
  if(SQ.pc&&!(s.pcs||[]).some(p=>(typeof p==='string'?p:'#'+p.name)===SQ.pc))return false;
  if(SQ.src&&(SQ.src==='있음')!==!!(s.hasSource||s.source?.file))return false;
  return true;
}
function sessionsView(){
  const opt=(k,label,vals)=>`<label for="f-${k}">${label}</label><select class="inp" id="f-${k}" data-sq="${k}"><option value="">전체</option>${vals.map(([v,t])=>`<option value="${esc(v)}"${SQ[k]===String(v)?' selected':''}>${esc(t)}</option>`).join('')}</select>`;
  const years=[...new Set(D.sessions.map(yearOf).filter(Boolean))].sort((a,b)=>b-a).map(y=>[String(y),y+'년']);
  if(D.sessions.some(s=>!yearOf(s))) years.push(['미상','일자 미상']);
  const pcs=new Map(); D.sessions.forEach(s=>(s.pcs||[]).forEach(p=>pcs.set(typeof p==='string'?p:'#'+p.name,pcName(p))));
  const wide=matchMedia('(min-width:900px)').matches;
  return `<div class="pagehead"><h2>SESSION<span>세션 기록</span></h2><p>시나리오, 날짜, 캐릭터로 지난 모험을 찾아보세요. 날짜 옆 <span class="dt"><i>추정</i></span>은 파일 날짜로 짐작한 것이에요.</p></div>
  <div class="explorer">
    <details class="fbox" ${wide||Object.keys(SQ0).some(k=>!['sort','group','page'].includes(k)&&SQ[k])?'open':''}><summary>검색 및 필터</summary>
      <label for="f-q">이름 · 제목 · 번호</label><input class="inp" id="f-q" data-sq="q" type="search" value="${esc(SQ.q)}" placeholder="예: 195, 가면, 신은총">
      ${opt('year','연도',years)}
      ${opt('rule','룰',[...new Set(D.sessions.map(s=>s.rule))].map(r=>[r,r]))}
      ${opt('role','참가 역할',[['PL','플레이어(PL)'],['KP','키퍼·마스터(KP)']])}
      ${opt('st','회차 상태',['예정','진행 중','완주','중단','미확인'].map(v=>[v,v]))}
      ${opt('camp','캠페인',[...D.campaigns.map(c=>[c.id,c.title]),['없음','캠페인 아님']])}
      ${opt('pc','캐릭터',[...pcs.entries()].sort((a,b)=>a[1]<b[1]?-1:1))}
      ${opt('src','기록 원문',[['있음','원문 있음'],['없음','원문 없음']])}
      <div style="margin-top:12px"><button class="btn sm" data-sqreset>조건 모두 지우기</button></div>
    </details>
    <section><div class="listbar"><b id="scount"></b>
      <label for="f-sort" style="position:absolute;left:-9999px">정렬</label>
      <select class="inp" id="f-sort" data-sq="sort"><option value="new"${SQ.sort==='new'?' selected':''}>최신순</option><option value="old"${SQ.sort==='old'?' selected':''}>오래된순</option><option value="no"${SQ.sort==='no'?' selected':''}>세션 번호순</option></select>
      <button class="btn" data-sqgroup aria-pressed="${SQ.group}" title="같은 회차의 여러 세션을 한 줄로 접어요">회차 묶음</button>
    </div><div id="slist"></div></section>
  </div>`;
}
function srow(s,inGroup){
  const pi=ptInfo(s.playthroughId), multi=ptSessions(s.playthroughId).length>1;
  return `<a class="srow" href="#${s.id}"><span class="n">${s.no??'—'}${multi&&s.part?`<small>·${s.part}</small>`:''}</span>
    <span class="t"><b>${esc(s.title)}${multi&&s.part&&!inGroup?` <small style="display:inline">${s.part}번째</small>`:''}</b><small>${esc(s.rule)} · ${(s.pcs||[]).map(p=>esc(pcName(p))).join(', ')||'대장 PC 미기록'}${s.role==='KP'?' · 대장 키퍼':''}${s.aborted?' · <span class="tag bad">중단</span>':''}${!inGroup&&s.campaignId?` · ${esc(camp[s.campaignId]?.title||'')}`:''}</small></span>
    <span class="d">${dateText(s.date)}</span><span class="go" aria-hidden="true">›</span></a>`;
}
function renderSessionList(){
  const el=$('#slist'); if(!el) return;
  let list=D.sessions.filter(sessionMatches);
  const key=s=>SQ.sort==='no'?String(s.no??99999).padStart(5,'0')+String(s.part||0).padStart(2,'0'):sortKey(s);
  const unknownLast=(a,b,dir)=>{const ua=!yearOf(a),ub=!yearOf(b);if(SQ.sort!=='no'&&ua!==ub)return ua?1:-1;return (key(a)<key(b)?-1:key(a)>key(b)?1:0)*dir};
  const dir=SQ.sort==='new'?-1:1;
  // 회차 묶음: 같은 회차 세션이 2개 이상이면 한 줄로
  let items=[];
  if(SQ.group){
    const seen=new Map();
    list.forEach(s=>{const n=ptSessions(s.playthroughId).length;if(n>1){if(!seen.has(s.playthroughId)){const g={grp:true,id:s.playthroughId,ss:[]};seen.set(s.playthroughId,g);items.push(g)}seen.get(s.playthroughId).ss.push(s)}else items.push(s)});
    items.forEach(g=>{if(g.grp){g.ss.sort((a,b)=>unknownLast(a,b,1));g.rep=SQ.sort==='new'?g.ss[g.ss.length-1]:g.ss[0]}});
    items.sort((a,b)=>unknownLast(a.grp?a.rep:a,b.grp?b.rep:b,dir));
  } else { items=list.sort((a,b)=>unknownLast(a,b,dir)); }
  const pages=Math.max(1,Math.ceil(items.length/PAGE)); if(SQ.page>pages)SQ.page=pages;
  const shown=items.slice((SQ.page-1)*PAGE,SQ.page*PAGE);
  $('#scount').textContent=`세션 기록 · ${list.length}개${SQ.group&&items.length!==list.length?` (${items.length}줄)`:''}`;
  const openG=new Set(store.get('pa-open',[]));
  el.innerHTML=(shown.length?shown.map(it=>{
    if(!it.grp) return srow(it);
    const sc=scen[it.ss[0].scenarioId], pi=ptInfo(it.id), all=ptSessions(it.id), c=it.ss[0].campaignId;
    const ds=all.map(s=>s.date).filter(d=>d&&d.v), range=ds.length?[...new Set([dateText(ds[0],true),dateText(ds[ds.length-1],true)])].join(' ~ '):'일자 미상';
    return `<details class="grp" data-g="${esc(it.id)}"${openG.has(it.id)?' open':''}><summary><div class="srow" role="presentation"><span class="n">${esc(it.ss[0].no??'—')}${it.ss.some(s=>s.no!==it.ss[0].no)?'<small>~</small>':''}</span>
      <span class="t"><b>${esc(sc?.title||it.ss[0].title)}</b><small>${esc(it.ss[0].rule)} · ${c?esc(camp[c]?.title)+' · ':''}세션 ${all.length}회${it.ss.length<all.length?` 중 ${it.ss.length}회 일치`:''} ${ptLabel(pi)}</small></span>
      <span class="d">${esc(range)}</span><span class="go" aria-hidden="true">▾</span></div></summary><div class="inner">${it.ss.map(s=>srow(s,true)).join('')}</div></details>`;
  }).join(''):'<p class="empty">조건에 맞는 세션이 없어요.</p>')
  +(pages>1||items.length?`<nav class="pager" aria-label="쪽 넘기기"><button class="btn sm" data-pg="${SQ.page-1}" ${SQ.page<=1?'disabled':''}>이전</button>${Array.from({length:pages},(_,i)=>`<button class="btn sm" data-pg="${i+1}" aria-pressed="${i+1===SQ.page}">${i+1}</button>`).join('')}<button class="btn sm" data-pg="${SQ.page+1}" ${SQ.page>=pages?'disabled':''}>다음</button><span class="hint">검색 조건 유지 · 상세에서 뒤로 가도 그대로</span></nav>`:'');
}
function sessionDetail(s){
  const sc=scen[s.scenarioId], pts=playthroughs(sc), pi=pts.findIndex(p=>p.id===s.playthroughId), pt=pts[pi], k=pt.ss.indexOf(s);
  const prev=pt.ss[k-1], next=pt.ss[k+1];
  const campSS=s.campaignId?D.sessions.filter(x=>x.campaignId===s.campaignId&&x.playthroughId!==s.playthroughId).sort(cmpAsc):[];
  const sum=s.summary?(canSeeSummary(s)?`<p style="margin:0">${esc(shownSum(s))}</p>${isAdmin()?`<p style="margin:6px 0 0"><span class="tag ${sumState(s)==='ok'?'ok':sumState(s)==='no'?'bad':'warn'}">${({draft:'AI 초안 · 검토 대기',fix:'수정 필요',ok:'승인됨',no:'거절됨',hold:'보류'})[sumState(s)]}</span>${sumPub(s)!=null&&sumPub(s)!==sumText(s)?' <span class="tag gold">방문객은 예전 승인본을 봐요</span>':''} <a href="#inbox" style="font-size:12.5px;color:var(--gilt)">작업함에서 검토</a></p>`:''}`:'<p class="locked" style="margin:0">요약을 검토하고 있어요.</p>'):`<p class="locked" style="margin:0">요약 없음${isAdmin()?' · 원본을 읽어 초안을 만들 차례':''}</p>`;
  const ending=s.aborted?'<span class="tag bad">세션 중단</span>':!s.ending?'<span class="locked">결말 미기록</span>':canSeeEnding(s)?`<details class="spoil"${isAdmin()?' open':''}><summary style="cursor:pointer">스포일러 · 결말 펼치기</summary><p style="margin:6px 0 0">${esc(s.ending.text)}</p>${isAdmin()?`<p style="margin:4px 0 0">${endState(s)==='ok'?`<span class="tag ok">승인 · ${esc(endVis(s))}</span>`:'<span class="tag warn">AI 초안 · 비공개</span>'}</p>`:''}</details>`:'<span class="locked">결말은 공개하지 않았어요.</span>';
  return `<div class="detail" style="padding:6px 0 20px"><a href="#sessions" class="btn back">← 세션 목록</a>
  <div class="pagehead" style="padding-top:14px"><h2 style="font-family:var(--f-head);font-size:24px">${esc(s.title)}</h2></div>
  <div>${s.no!=null?`<span class="tag gold">${s.no}번</span>`:'<span class="tag warn">목차 번호 없음</span>'}<span class="tag">${esc(s.rule)}</span>${s.role==='KP'?'<span class="tag gold">대장 키퍼</span>':''}${s.campaignId?`<span class="tag">${esc(camp[s.campaignId].title)}</span>`:''}</div>
  <dl class="kv">
    <dt>날짜</dt><dd>${dateText(s.date)}${s.date?.src&&!dateSure(s.date)?` <small class="locked">(${esc(s.date.src)} 기준)</small>`:''}</dd>
    <dt>시나리오</dt><dd><a href="#${sc.id}">${esc(sc.title)}</a>${pts.length>1?` · ${pi+1}회차`:''}</dd>
    <dt>이 회차</dt><dd>${ptLabel(pt.info)} 기록된 세션 ${pt.ss.length}회${pt.ss.length>1?` 중 ${k+1}번째`:''}${pt.info.status!=='완주'&&pt.ss.length===1?' <small class="locked">(다른 세션 기록이 빠졌을 수도 있어요)</small>':''}</dd>
    <dt>대장 PC</dt><dd>${(s.pcs||[]).length?(s.pcs||[]).map(pcChip).join(''):'<span class="locked">기록 없음</span>'}</dd>
    <dt>결말</dt><dd>${ending}</dd>
  </dl>
  <div class="box"><h4>스포일러 없는 요약</h4>${sum}</div>
  ${pt.ss.length>1?`<div class="box"><h4>같은 회차의 세션</h4>${pt.ss.map((x,i)=>x===s?`<div><b>${i+1}번째 · 지금 보는 세션</b></div>`:`<div><a href="#${x.id}">${i+1}번째 · ${esc(x.title)}</a> <small class="locked">${dateText(x.date)}</small></div>`).join('')}<div class="row-actions">${prev?`<a class="btn sm" href="#${prev.id}">‹ 이전 세션</a>`:''}${next?`<a class="btn sm" href="#${next.id}">다음 세션 ›</a>`:''}</div></div>`:''}
  ${campSS.length?`<div class="box"><h4>같은 캠페인 · ${esc(camp[s.campaignId].title)}</h4>${campSS.map(x=>`<div><a href="#${x.id}">${esc(x.title)}</a> <small class="locked">${dateText(x.date)}</small></div>`).join('')}</div>`:''}
  <div class="box"><h4>함께한 사람 · 녹화 · 기록 원문</h4>${logBox(s)}</div>
  ${isAdmin()&&s.notes?`<div class="box"><h4>관리 메모 (관리자만)</h4><p style="margin:0;font-size:13.5px">${esc(s.notes)}</p></div>`:''}
  </div>`;
}

// ---------- SCENARIO ----------
// 시나리오 서고: 찾기 · 룰 · 조건 · 정렬. 해 봄·키퍼링·여러 번은 세션에서 자동으로 붙는다.
const RULE_LABEL={CoC:'CoC',UW:'언리미티드 월드','트라이앵글 에이전시':'트라이앵글 에이전시',던전월드:'던전 월드',조선아곤:'조선 아곤',아곤:'아곤',에모크로아:'에모크로아',저녁노을어스름:'저녁노을 어스름',머더미스터리:'머더 미스터리',시노비가미:'시노비가미','둘이서 수사':'둘이서 수사',인세인:'인세인','너냐?!':'너냐?!',DnD:'D&D',아리안로드:'아리안로드',카미가카리:'카미가카리',피아스코:'피아스코',크라임씬:'크라임씬',리얼월드:'리얼 월드','1시간히어로':'1시간 히어로',탐공사:'탐공사',기타:'기타'};
const ruleLabel=r=>RULE_LABEL[r]||r;
let SCS={rule:'',q:'',on:[],sort:'recent',...store.get('pa-scs',{})};
const saveSCS=()=>store.set('pa-scs',SCS);
const scSessions=sc=>D.sessions.filter(s=>s.scenarioId===sc.id).sort(cmpAsc);
function scenInfo(sc){
  const ss=scSessions(sc), dated=ss.filter(s=>s.date&&s.date.v);
  const pcs=[...new Set(ss.flatMap(s=>(s.pcs||[]).filter(p=>typeof p==='string'&&chars[p])))];
  return {ss,n:ss.length,pts:new Set(ss.map(s=>s.playthroughId)).size,first:dated[0]?.date,last:dated[dated.length-1]?.date,pcs};
}
const SC_TAGS=['해 봄','키퍼링','여러 번 한 판','여러 세션','캠페인','자작','보유','하고 싶음','준비 중'];
function scenTags(sc,I){const t=scenStatus(sc);if(I.pts>1)t.push('여러 번 한 판');if(I.n>1)t.push('여러 세션');if(sc.campaignId)t.push('캠페인');return t}
function scenList(){
  const q=SCS.q.trim().toLowerCase();
  const L=D.scenarios.map(sc=>({sc,I:scenInfo(sc)})).map(x=>({...x,tags:scenTags(x.sc,x.I)}))
    .filter(({sc,I,tags})=>(!SCS.rule||sc.rule===SCS.rule)&&SCS.on.every(t=>tags.includes(t))
      &&(!q||[sc.title,ruleLabel(sc.rule),sc.era,camp[sc.campaignId]?.title,...I.ss.map(s=>s.title+' '+(s.no??'')),...I.pcs.map(p=>chars[p]['이름'])].join(' ').toLowerCase().includes(q)));
  const dk=d=>d&&d.v?padDate(d.v):'';
  const cmp={recent:(a,b)=>dk(b.I.last).localeCompare(dk(a.I.last)),old:(a,b)=>(dk(a.I.first)||'9999').localeCompare(dk(b.I.first)||'9999'),name:(a,b)=>a.sc.title.localeCompare(b.sc.title,'ko'),many:(a,b)=>b.I.n-a.I.n||b.I.pts-a.I.pts||dk(b.I.last).localeCompare(dk(a.I.last))}[SCS.sort];
  return L.sort(cmp);
}
function scenariosView(){
  const rules=[...new Set(D.scenarios.map(s=>s.rule))].sort((a,b)=>D.scenarios.filter(s=>s.rule===b).length-D.scenarios.filter(s=>s.rule===a).length);
  const again=D.scenarios.filter(sc=>scenInfo(sc).pts>1).length;
  return `<div class="pagehead"><h2>SCENARIO<span>시나리오 서고</span></h2><p>모험했던 세계 ${D.scenarios.length}곳 · 룰 ${rules.length}가지 · 두 번 이상 한 시나리오 ${again}개. 해 봄·키퍼링·여러 번은 세션 기록에서 자동으로 붙고, 완주는 대장이 확인한 회차만 세요.</p></div>
  <div class="chips"><button class="chip" data-scrule="" aria-pressed="${!SCS.rule}">전체 ${D.scenarios.length}</button>${rules.map(r=>`<button class="chip" data-scrule="${esc(r)}" aria-pressed="${SCS.rule===r}">${esc(ruleLabel(r))} ${D.scenarios.filter(s=>s.rule===r).length}</button>`).join('')}</div>
  <div class="listbar">
    <input class="inp" id="scq" data-scs="q" type="search" value="${esc(SCS.q)}" placeholder="시나리오 · 세션 번호 · 캐릭터 이름" style="flex:1;min-width:180px" aria-label="시나리오 찾기">
    <select class="inp" data-scs="sort" aria-label="정렬" style="width:auto">${[['recent','최근에 한 순'],['old','처음 한 순'],['name','이름 순'],['many','세션 많은 순']].map(([v,l])=>`<option value="${v}"${SCS.sort===v?' selected':''}>${l}</option>`).join('')}</select>
  </div>
  <div class="chips sm" aria-label="조건">${SC_TAGS.map(t=>`<button class="chip" data-sctag="${t}" aria-pressed="${SCS.on.includes(t)}">${t}</button>`).join('')}${SCS.on.length?'<button class="chip" data-sctag="">조건 지우기</button>':''}</div>
  <div id="sclist"></div>`;
}
function renderScenList(){
  const el=$('#sclist'); if(!el) return; const L=scenList();
  const span=I=>!I.first?'일자 미상':I.first===I.last||I.first.v===I.last.v?dateText(I.first,true):`${dateText(I.first,true)} ~ ${dateText(I.last,true)}`;
  el.innerHTML=`<p class="locked" style="margin:0 0 8px">${L.length}곳</p>`+(L.length?`<div class="cards">${L.map(({sc,I,tags})=>{const pts=playthroughs(sc),done=pts.filter(p=>p.info.shown==='완주').length;
    return `<a class="scard" href="#${sc.id}"><small class="rl">${esc(ruleLabel(sc.rule))}${sc.era?' · '+esc(sc.era):''}${sc.campaignId?' · '+esc(camp[sc.campaignId].title):''}</small><b>${esc(sc.title)}</b>
    <small>${span(I)}</small>
    <div>${tags.filter(t=>t!=='여러 세션').map(t=>`<span class="tag ${t==='키퍼링'||t==='자작'||t==='여러 번 한 판'?'gold':''}">${t}</span>`).join('')}${sc.source==='자작'&&sc.sourceSure===false?'<span class="tag warn">자작 추정</span>':''}</div>
    ${I.pcs.length?`<div class="mini">${I.pcs.slice(0,4).map(p=>{const c=chars[p];return c.img?`<img src="${esc(c.img)}" alt="${esc(c['이름'])}" title="${esc(c['이름'])}" loading="lazy">`:`<span class="ini" title="${esc(c['이름'])}">${esc(c['이름'][0])}</span>`}).join('')}<small>${esc(I.pcs.map(p=>chars[p]['이름']).slice(0,2).join(', '))}${I.pcs.length>2?' 외 '+(I.pcs.length-2):''}</small></div>`:''}
    <small>${I.pts}회차 · 세션 ${I.n}회${done?' · 완주 '+done:''}</small></a>`}).join('')}</div>`
    :`<p class="empty">조건에 맞는 시나리오가 없어요.${SCS.on.some(t=>t==='보유'||t==='하고 싶음')?' 보유·하고 싶음은 아직 아무것도 체크하지 않았어요.':''}</p>`);
}
function scenarioDetail(sc){
  const pts=playthroughs(sc);
  const field=(k,label)=>sc[k]?`<dt>${label}</dt><dd>${esc(sc[k])}</dd>`:(isAdmin()?`<dt>${label}</dt><dd class="locked">비어 있음</dd>`:'');
  return `<div class="detail" style="padding:6px 0 20px"><a href="#scenarios" class="btn back">← 시나리오 서고</a>
  <div class="pagehead" style="padding-top:14px"><h2 style="font-family:var(--f-head);font-size:24px">${esc(sc.title)}</h2></div>
  <div>${scenStatus(sc).map(t=>`<span class="tag gold">${t}</span>`).join('')}<span class="tag">${esc(sc.source)}</span>${sc.sourceSure===false?'<span class="tag warn">자작인지 확인 필요</span>':''}</div>
  <dl class="kv"><dt>룰</dt><dd>${esc(ruleLabel(sc.rule))}</dd>${(()=>{const I=scenInfo(sc);return (I.first?`<dt>플레이한 때</dt><dd>${dateText(I.first)}${I.last&&I.last.v!==I.first.v?' ~ '+dateText(I.last):''}</dd>`:'')+(I.pcs.length?`<dt>대장 캐릭터</dt><dd>${I.pcs.map(p=>pcChip(p)).join(' ')}</dd>`:'')})()}<dt>시대·배경</dt><dd>${esc(sc.era||'미기록')}</dd>${sc.campaignId?`<dt>캠페인</dt><dd>${esc(camp[sc.campaignId].title)}</dd>`:''}${sc.note?`<dt>메모</dt><dd>${esc(sc.note)}</dd>`:''}
  ${field('author','작가')}${field('players','권장 인원')}${field('time','예상 시간')}${field('genre','장르')}
  ${(()=>{const R=pts.map(p=>rateOf(p.id)).filter(Boolean),avg=k=>{const v=R.map(r=>+r[k]).filter(Boolean);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0};return R.length?`<dt>대장 평점</dt><dd>작품 <span class="stars">${stars(avg('work'))}</span> · 플레이 경험 <span class="stars">${stars(avg('play'))}</span>${R.length>1?` <small class="locked">${R.length}회차 평균</small>`:''}</dd>`:''})()}</dl>
  ${isAdmin()?(()=>{const m=scMark(sc);return `<div class="box adminbox"><h4>관리자 · 이 시나리오 표시</h4><div class="row-actions">${[['owned','보유'],['wish','하고 싶음'],['prep','준비 중']].map(([k,l])=>`<label class="chk"><input type="checkbox" data-scmark="${k}" data-sc="${esc(sc.id)}"${m[k]?' checked':''}> ${l}</label>`).join('')}</div>
    <label class="locked" for="scmemo">개변 메모 · 키퍼링 준비 (관리자만 보여요)</label><textarea class="inp" id="scmemo" placeholder="바꾼 점, 준비할 것">${esc(m.memo||'')}</textarea><div class="row-actions"><button class="btn sm gilt" data-scmemo="${esc(sc.id)}">메모 저장</button></div></div>`})():''}
  ${pts.map((p,i)=>{const rv=RV['rev:'+p.id];return `<div class="pt"><h5>${pts.length>1?`${i+1}회차`:'플레이 기록'} · 세션 ${p.ss.length}회 ${ptLabel(p.info)}</h5>${isAdmin()&&p.info.note?`<div class="locked">${esc(p.info.note)}</div>`:''}${p.ss.map(s=>`<div><a href="#${s.id}">${p.ss.length>1&&s.part?s.part+'번째 · ':''}${esc(s.title)}</a> <small style="color:var(--dust)">${dateText(s.date)}</small> ${(s.pcs||[]).map(x=>`<span class="tag">${esc(pcName(x))}</span>`).join('')}</div>`).join('')}
    ${rv&&rv.text&&(isAdmin()||rv.vis==='공개'||(rv.vis==='친구'&&role==='friend'))?`<div class="box" style="margin-top:8px"><h4>대장 후기${isAdmin()?` · ${esc(rv.vis)}`:''}</h4><p style="margin:0;white-space:pre-line">${esc(rv.text)}</p></div>`:''}
    ${rateOf(p.id)?`<div class="locked" style="margin-top:4px">평점 · 작품 <span class="stars">${stars(+rateOf(p.id).work)}</span> · 플레이 경험 <span class="stars">${stars(+rateOf(p.id).play)}</span></div>`:''}
    ${isAdmin()?`<div class="row-actions" style="margin-top:6px"><label class="locked">작품 <select class="inp" data-rate="${esc(p.id)}" data-k="work" style="width:auto">${[0,1,2,3,4,5].map(n=>`<option value="${n}"${+(rateOf(p.id)?.work||0)===n?' selected':''}>${n?stars(n):'없음'}</option>`).join('')}</select></label><label class="locked">플레이 경험 <select class="inp" data-rate="${esc(p.id)}" data-k="play" style="width:auto">${[0,1,2,3,4,5].map(n=>`<option value="${n}"${+(rateOf(p.id)?.play||0)===n?' selected':''}>${n?stars(n):'없음'}</option>`).join('')}</select></label></div>`:''}
    ${isAdmin()?`<details style="margin-top:6px"><summary class="locked" style="cursor:pointer">이 회차 후기 쓰기</summary><textarea class="inp" id="rev-${esc(p.id)}" placeholder="스포일러가 있으면 공개 범위를 비공개나 친구로">${esc(rv?.text||'')}</textarea><div class="row-actions"><select class="inp" id="revv-${esc(p.id)}">${['비공개','친구','공개'].map(v=>`<option${(rv?.vis||'비공개')===v?' selected':''}>${v}</option>`).join('')}</select><button class="btn sm gilt" data-rev="${esc(p.id)}">후기 저장</button></div></details>`:''}
  </div>`}).join('')}
  </div>`;
}

// ---------- CHARACTER: 그림 중심 회랑 (지금 캐릭터 서고와 같은 서가·상태·정렬) ----------
const RULES={CoC1920:'CoC 1920년대',CoC현대:'CoC 현대',UW:'언리미티드 월드',SG:'시노비가미',저녁노을:'저녁노을 어스름',에모크로아:'에모크로아',던전월드:'던전 월드',아곤:'아곤·조선 아곤',둘수사:'둘이서 수사',너냐:'너냐?!',인세인:'인세인',델타그린:'델타 그린',무협:'무협',탐공사:'탐공사',피아스코:'피아스코',TA:'트라이앵글 에이전시','1시간히어로':'1시간 히어로',미분류:'미분류'};
const RULE_ORDER=Object.keys(RULES);
const shelfOf=c=>c['서가']||c['룰']||'미분류';
const isLost=c=>/로스트|사망|격리|모험불가/.test(c['상태']||'');
const playsOf=c=>+c['시나리오횟수']||(c['시나리오']||[]).length||0;
const CS0={shelf:'',st:'',sort:'img',q:'',fav:false};
let CS={...CS0,...store.get('pa-cs',{})};
function charList(){
  const q=CS.q.trim().toLowerCase();
  const list=D.characters.filter(c=>(!CS.shelf||shelfOf(c)===CS.shelf)&&(!CS.fav||FAV.has(c.id))
    &&(!CS.st||(CS.st==='생존'?/생존/.test(c['상태']||''):CS.st==='lost'?isLost(c):!/생존/.test(c['상태']||'')&&!isLost(c)))
    &&(!q||[c['이름'],c['원어/별명'],c['직업'],c['시대'],c['종족'],c['시스템'],...(c['시나리오']||[]),...(c['태그']||[])].join(' ').toLowerCase().includes(q)));
  const ro=c=>{const i=RULE_ORDER.indexOf(shelfOf(c));return i<0?99:i};
  const byRule=(a,b)=>ro(a)-ro(b)||String(a['시대']||'').localeCompare(String(b['시대']||''))||a.id.localeCompare(b.id);
  const cmp={img:(a,b)=>(!!b.img-!!a.img)||byRule(a,b),id:byRule,name:(a,b)=>a['이름'].localeCompare(b['이름'],'ko'),plays:(a,b)=>playsOf(b)-playsOf(a)||byRule(a,b)}[CS.sort]||byRule;
  return list.sort(cmp);
}
function charactersView(){
  const shelves=RULE_ORDER.filter(k=>D.characters.some(c=>shelfOf(c)===k)).concat([...new Set(D.characters.map(shelfOf))].filter(k=>!RULE_ORDER.includes(k)));
  return `<div class="pagehead"><h2>CHARACTER<span>캐릭터 서고</span></h2><p>살아 보았던 ${D.characters.length}개의 삶. 서가를 고르거나 이름·직업·시나리오로 찾아요. 그림을 누르면 인물 기록이 열려요.</p></div>
  <div class="chips"><button class="chip" data-shelf="" aria-pressed="${!CS.shelf}">전체 ${D.characters.length}</button>${shelves.map(s=>`<button class="chip" data-shelf="${esc(s)}" aria-pressed="${CS.shelf===s}">${esc(RULES[s]||s)} ${D.characters.filter(c=>shelfOf(c)===s).length}</button>`).join('')}</div>
  <div class="listbar">
    <input class="inp" id="cq" data-cs="q" type="search" value="${esc(CS.q)}" placeholder="이름 · 직업 · 시나리오 · 시대" style="flex:1;min-width:180px" aria-label="캐릭터 찾기">
    <select class="inp" data-cs="st" aria-label="상태" style="width:auto"><option value="">모든 상태</option><option value="생존"${CS.st==='생존'?' selected':''}>생존</option><option value="lost"${CS.st==='lost'?' selected':''}>로스트·사망</option><option value="etc"${CS.st==='etc'?' selected':''}>그 밖</option></select>
    <select class="inp" data-cs="sort" aria-label="정렬" style="width:auto"><option value="img"${CS.sort==='img'?' selected':''}>그림 있는 인물 먼저</option><option value="id"${CS.sort==='id'?' selected':''}>룰·시대 순</option><option value="name"${CS.sort==='name'?' selected':''}>이름 순</option><option value="plays"${CS.sort==='plays'?' selected':''}>시나리오 많은 순</option></select>
    <button class="btn" data-favonly aria-pressed="${CS.fav}">★ 즐겨찾기</button><button class="btn" data-rnd>🎲 아무나 한 명</button>
  </div><div id="clist"></div>`;
}
function renderCharList(){
  const el=$('#clist'); if(!el) return; const list=charList();
  el.innerHTML=`<p class="locked" style="margin:0 0 8px">${list.length}명</p>`+(list.length?`<div class="gallery">${list.map(c=>`<a class="ccard" href="#${c.id}"><div class="pic">${c.img?`<img src="${esc(c.img)}" alt="" loading="lazy">`:`<span class="ini">${esc(c['이름'][0])}</span>`}${FAV.has(c.id)?'<span class="fav" aria-label="즐겨찾기">★</span>':''}${isLost(c)?'<span class="lost" aria-label="추모">🕯</span>':''}</div><div class="cap"><b>${esc(c['이름'])}</b><small>${esc(RULES[shelfOf(c)]||shelfOf(c))}${c['직업']?' · '+esc(c['직업']):''}</small><br><small>${esc(c['상태']||'')}${playsOf(c)?` · 시나리오 ${playsOf(c)}`:''}</small></div></a>`).join('')}</div>`:'<p class="empty">조건에 맞는 캐릭터가 없어요.</p>');
}
function sheetHTML(sh){
  if(!sh) return '<p class="locked">시트가 없어요.</p>';
  const o=[];
  if(sh['특성치'])o.push(`<div class="sheet-sec"><h4>특성치 <small class="locked">값 · 1/2 · 1/5</small></h4><div class="statg">${sh['특성치'].map(([k,v])=>`<div class="st8"><small>${esc(k)}</small><b>${esc(v)}</b><i>${Math.floor(v/2)} · ${Math.floor(v/5)}</i></div>`).join('')}</div></div>`);
  if(sh['파생'])o.push(`<div class="sheet-sec"><h4>체력 · 마력 · 그 밖</h4><div class="statg">${sh['파생'].map(([k,v])=>`<div class="st8"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div></div>`);
  if(sh['기능']){const sk=sh['기능'],top=sk.filter(x=>x[1]>=50).slice(0,16),li=x=>`<li class="${x[1]>=50?'hi':''}">${esc(x[0])}<b>${esc(x[1])}</b><i>${Math.floor(x[1]/2)}·${Math.floor(x[1]/5)}</i></li>`;
    o.push(`<div class="sheet-sec"><h4>주요 기능</h4><ul class="skills">${(top.length?top:sk.slice(0,8)).map(li).join('')}</ul><details class="more"><summary>모든 기능 ${sk.length}개 보기</summary><ul class="skills">${sk.map(li).join('')}</ul></details></div>`)}
  if(sh['무기'])o.push(`<div class="sheet-sec"><h4>무기</h4><div class="tblwrap"><table class="wp"><thead><tr><th>무기</th><th>성공</th><th>피해</th><th>사거리</th></tr></thead><tbody>${sh['무기'].map(w=>`<tr><td>${esc(w[0])}</td><td class="n">${esc(w[1])}</td><td class="n">${esc(w[2])}</td><td>${esc(w[3]??'')}</td></tr>`).join('')}</tbody></table></div></div>`);
  if(sh['소지품'])o.push(`<div class="sheet-sec"><h4>소지품</h4><ul class="skills">${sh['소지품'].map(x=>`<li>${esc(Array.isArray(x)?x.join(' '):x)}</li>`).join('')}</ul></div>`);
  if(sh['기본'])o.push(`<div class="sheet-sec"><h4>기본 수치</h4><div class="statg">${sh['기본'].map(([k,v])=>`<div class="st8"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div></div>`);
  if(sh['판정']){const P=sh['판정'],dmg=P.filter(x=>/^피해/.test(x[0])),chk=P.filter(x=>!/^피해/.test(x[0])),mod=f=>{const m=String(f).match(/([+-]\d+)$/);return m?m[1]:f};
    if(chk.length)o.push(`<div class="sheet-sec"><h4>판정</h4><ul class="skills">${chk.map(x=>{const md=mod(x[1]);return `<li class="${parseInt(md)>=3?'hi':''}" title="${esc(x[1])}">${esc(x[0])}<b>${esc(md)}</b></li>`}).join('')}</ul></div>`);
    if(dmg.length)o.push(`<div class="sheet-sec"><h4>피해</h4><ul class="skills">${dmg.map(x=>`<li>${esc(x[0].replace(/^피해\(?|\)$/g,''))}<b>${esc(x[1])}</b></li>`).join('')}</ul></div>`)}
  if(sh['가방'])o.push(`<div class="sheet-sec"><h4>가방</h4><div class="tblwrap"><table class="wp"><thead><tr><th>물품</th><th>개수</th><th>태그·효과</th></tr></thead><tbody>${sh['가방'].map(w=>`<tr><td>${esc(w[0])}</td><td class="n">${esc(w[1])}</td><td>${esc(w[2]??'')}</td></tr>`).join('')}</tbody></table></div></div>`);
  if(sh['내용'])o.push(`<div class="sheet-sec"><h4>시트 내용</h4><div class="slines">${sh['내용'].slice(0,2).map(b=>`<p>${(Array.isArray(b)?b:[b]).map(esc).join('<br>')}</p>`).join('')}</div>${sh['내용'].length>2?`<details class="more"><summary>시트 전체 보기</summary><div class="slines">${sh['내용'].slice(2).map(b=>`<p>${(Array.isArray(b)?b:[b]).map(esc).join('<br>')}</p>`).join('')}</div></details>`:''}</div>`);
  return o.join('')||'<p class="locked">시트가 없어요.</p>';
}
// 연대기 합치기: 세션 번호만으로 같다고 보지 않는다. 번호가 같고 날짜가 맞거나(한쪽이 비었거나) 새 날짜가 추정일 때만 같은 기록.
// 지금 서고에 확인된 날짜가 있으면 새 추정 날짜로 덮지 않는다. 남는 기존 기록은 지우지 않고 함께 보인다.
function chronicle(c){
  const ss=sessionsOfChar(c.id), old=(c['연대기']||[]).map(r=>({no:String(r[0]),title:String(r[1]||'').replace(/_/g,' '),date:r[2]||'',used:false}));
  const rows=ss.map(s=>{
    const nd=s.date&&s.date.v?s.date.v:'';
    const m=old.find(o=>!o.used&&o.no===String(s.no)&&(!o.date||!nd||o.date.startsWith(nd.slice(0,7))||nd.startsWith(o.date.slice(0,7))||!dateSure(s.date)));
    if(m) m.used=true;
    const keepOld=m&&m.date&&!dateSure(s.date);
    return {s,no:s.no,date:keepOld?m.date:nd,dateHTML:keepOld?`<span class="dt" title="지금 캐릭터 서고에 적힌 날짜">${esc(m.date.replace(/-/g,'.'))}</span>`:dateText(s.date),conflict:m&&m.date&&nd&&!m.date.startsWith(nd)&&dateSure(s.date)?m.date:null,matched:!!m};
  });
  old.filter(o=>!o.used).forEach(o=>rows.push({old:o,no:o.no,date:o.date,dateHTML:esc(o.date?o.date.replace(/-/g,'.'):'일자 미상')}));
  rows.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||String(a.no).localeCompare(String(b.no),undefined,{numeric:true}));
  return {rows,fromSessions:ss.length,fromOld:old.filter(o=>!o.used).length};
}
function charDetail(c){
  const ss=sessionsOfChar(c.id), CH=chronicle(c);
  const dice=diceRows(c), album=c['앨범']||[];
  const tab=store.get('pa-ctab','인물');
  const story=c['이야기']||'';
  const first=story.split(/(?<=[.!?。])\s/)[0];
  const tabs=['인물','시트','연대기','앨범'];
  const prose=[['외견','외견'],['성격','성격'],['배경','배경']].filter(([k])=>c[k]).map(([k,l])=>`<h4>${l}</h4><p>${esc(String(c[k]).replace(/ \/ /g,'\n'))}</p>`).join('');
  const kv=[['원어/별명','원어·별명'],['성별','성별'],['나이','나이'],['국적','국적'],['종족','종족'],['직업','직업'],['시대','시대'],['이성','이성'],['시스템','룰']].filter(([k])=>c[k]).map(([k,l])=>`<dt>${l}</dt><dd>${esc(c[k])}</dd>`).join('');
  const tagList=[c['시대'],c['직업'],...(c['시나리오']||[])].filter(Boolean);
  const panes={
    '인물':`${memHTML(c)}${c['한마디']?`<blockquote class="quote">“${esc(c['한마디'])}”</blockquote>`:''}
      <dl class="kv">${kv}</dl>
      ${story?`<div class="prose"><h4>이야기</h4>${role==='admin'||store.get('pa-spoil-'+c.id,false)||first===story?`<p>${esc(story)}</p>`:`<p>${esc(first)}</p><button class="btn sm" data-spoil="${c.id}">스포일러 포함 · 이어서 읽기</button>`}</div>`:''}
      <div class="prose">${prose||'<p class="locked">인물 소개가 아직 없어요.</p>'}${c['비고']?`<h4>비고</h4><p>${esc(String(c['비고']).replace(/ \/ /g,'\n'))}</p>`:''}</div>
      ${tagList.length?`<div style="margin-top:12px">${tagList.map(t=>`<button class="tag" style="background:none;cursor:pointer" data-searchfor="${esc(t)}">#${esc(t)}</button>`).join('')}</div>`:''}
      <div class="prose">${relHTML(c)}</div>`,
    '시트':sheetHTML(c['시트'])+histHTML(c),
    '연대기':`<p class="locked" style="margin:0 0 8px">세션 기록 ${CH.fromSessions}줄과 지금 캐릭터 서고의 연대기 ${CH.fromOld}줄을 합쳐 시간순으로 보여요. 기존 기록은 지우지 않아요.</p><ol class="chron">${CH.rows.map(r=>r.s?`<li><span class="n">${r.no??'—'}</span><a href="#${r.s.id}">${esc(r.s.title)}${r.s.part&&ptSessions(r.s.playthroughId).length>1?` · ${r.s.part}번째`:''}</a><span class="d">${r.dateHTML}</span></li>`:`<li><span class="n">${esc(r.no)}</span><span>${esc(r.old.title)} <span class="tag">기존 서고 기록</span></span><span class="d">${r.dateHTML}</span></li>`).join('')}</ol>${!CH.rows.length?'<p class="locked">기록이 없어요.</p>':''}`,
    '앨범':album.length?`<div class="album">${album.map(([p,cap],i)=>`<figure><button data-lbopen="${c.id}" data-i="${i}" aria-label="${esc(cap||'그림')} 크게 보기"><img src="${esc(p)}" alt="${esc(cap||'')}" loading="lazy"></button>${cap?`<figcaption>${esc(cap)}</figcaption>`:''}</figure>`).join('')}</div>`:'<p class="locked">앨범 그림이 아직 없어요.</p>'
  };
  const t=tabs.includes(tab)?tab:'인물';
  const {prev,next}=prevNext(c);
  return `<div class="cnav"><a href="#characters" class="btn back">← 캐릭터 서고</a><span>${prev?`<a class="btn sm" href="#${prev.id}" title="${esc(prev['이름'])}">‹ 이전</a>`:''}${next?`<a class="btn sm" href="#${next.id}" title="${esc(next['이름'])}">다음 ›</a>`:''}</span></div>
  <div class="cd ${enterClass(c)}"><aside>${c.img?'':'<div class="portrait ini">'+esc(c['이름'][0])+'</div>'}<img class="portrait"${c.img?'':' hidden'} src="${esc(c.img)}" alt="${esc(c['이름'])}" data-lbopen="${c.id}" data-i="-1"><div>
    <h2>${esc(c['이름'])}</h2><div><span class="tag gold">${esc(RULES[shelfOf(c)]||shelfOf(c))}</span><span class="tag">${esc(c['상태']||'')}</span><span class="tag" title="세션 기록에 연결된 수">세션 기록 ${ss.length}</span>${playsOf(c)?`<span class="tag" title="캐릭터 시트에 적힌 시나리오 수">시나리오 ${playsOf(c)}</span>`:''}</div>
    <div class="locked" style="margin-top:6px">${esc([c['시스템']||c['룰'],c['직업']].filter(Boolean).join(' · '))}</div>
    <div class="actions"><button class="btn" data-fav="${c.id}" aria-pressed="${FAV.has(c.id)}">${FAV.has(c.id)?'★ 즐겨찾기됨':'☆ 즐겨찾기'}</button><button class="btn" data-share="${c.id}">링크 복사</button><button class="btn" data-card="${c.id}">소개 카드 PNG</button>${isAdmin()?`<button class="btn" data-pick="${c.id}" aria-pressed="${PICKS.includes(c.id)}">${PICKS.includes(c.id)?'★ 첫 화면 추천됨':'첫 화면에 추천'}</button>`:''}${dice.ok.length?`<button class="btn gilt" data-dice="${c.id}">🎲 판정 굴리기</button>`:''}</div>
    ${album.length?`<div class="locked" style="margin-top:8px">그림을 누르면 크게 보여요 · 앨범 ${album.length}장</div>`:''}
  </div></aside>
  <section><div class="tabs" role="tablist">${tabs.map(x=>`<button role="tab" aria-selected="${x===t}" data-ctab="${x}">${x}${x==='앨범'&&album.length?` ${album.length}`:''}${x==='연대기'?` ${CH.rows.length}`:''}</button>`).join('')}</div>
  <div role="tabpanel">${panes[t]}</div></section></div>`;
}

// ---------- MEMORY: 감상 중심 ----------
function memoryView(){
  const lost=D.characters.filter(isLost);
  const albums=D.characters.filter(c=>(c['앨범']||[]).length).sort((a,b)=>b['앨범'].length-a['앨범'].length);
  const halls=[['명대사','세션 속 대사와 캐릭터 대표 대사','quote'],['전설적인 주사위','믿기 힘든 판정의 순간','dice'],['웃겼던 순간','다시 읽어도 웃긴 장면','laugh'],['감동적인 장면','오래 남은 장면','moment']];
  const memLine=m=>{const s=byId[m.sessionId];return `<p style="margin-top:12px;color:var(--ivory)">${m.kind==='quote'?`<span style="font-family:var(--f-head);font-size:16px">“${esc(memText(m))}”</span>`:esc(memText(m))}${isAdmin()&&memVis(m)!=='공개'?' <span class="tag warn">친구에게만</span>':''}<br><small class="locked">${m.who?esc(m.who)+' · ':''}${s?`<a href="#${s.id}" style="color:var(--gilt)">${esc(s.title)}</a>`:''}</small></p>`};
  const quotes=D.characters.filter(c=>c['한마디']);
  const day=Math.floor(Date.now()/864e5), qs=quotes.length?Array.from({length:Math.min(4,quotes.length)},(_,i)=>quotes[(day*7+i*13)%quotes.length]).filter((c,i,a)=>a.indexOf(c)===i):[];
  return `<section class="mhead"><div class="eyebrow">THE PRAYPEACE ARCHIVES</div><h2>MEMORY</h2><p>모험은 끝났지만, 이야기는 남아 있다.</p></section>
  <div class="sect-t">HALL OF MEMORIES</div>
  <section class="halls">${halls.map(([h,p],i)=>`<div class="hall"><div class="k">${['QUOTES','LEGENDARY DICE','LAUGHTER','MOMENTS'][i]}</div><h3>${h}</h3><p>${p}</p>
    ${shownMems(halls[i][2]).map(memLine).join('')}
    ${i===0&&qs.length?qs.map(c=>`<p style="margin-top:12px;color:var(--ivory);font-family:var(--f-head);font-size:16px">“${esc(c['한마디'])}” <a href="#${c.id}" style="font-size:13px;color:var(--gilt);font-family:var(--f-kr)">— ${esc(c['이름'])}</a></p>`).join('')+`<p class="locked" style="margin-top:8px">대표 대사 ${quotes.length}개 중 오늘의 ${qs.length}개</p>`:shownMems(halls[i][2]).length?'':`<p style="margin-top:12px" class="locked">아직 승인된 기록이 없어요. 세션 기록에서 후보를 뽑아 대장이 승인한 것만 여기에 걸려요.${role==='visitor'?' 친구가 나오는 장면은 로그인하면 보여요.':''}</p>`}</div>`).join('')}</section>
  <div class="sect-t">GALLERY</div>
  <p class="locked" style="text-align:center;margin:-4px 0 14px">캐릭터마다 대표 그림 하나만 보여요. 누르면 그 캐릭터의 앨범 ${albums.reduce((n,c)=>n+c['앨범'].length,0)}장을 넘겨 볼 수 있어요.</p>
  ${albums.length?`<div class="gallery">${albums.map(c=>`<button class="ccard" style="padding:0;text-align:left;font:inherit;color:inherit;cursor:zoom-in" data-lbopen="${c.id}" data-i="0"><div class="pic"><img src="${esc(c['앨범'][0][0])}" alt="" loading="lazy"><span class="fav">${c['앨범'].length}장</span></div><div class="cap"><b>${esc(c['이름'])}</b><small>${esc(RULES[shelfOf(c)]||shelfOf(c))}</small></div></button>`).join('')}</div>`:'<p class="empty">앨범 그림이 아직 없어요.</p>'}
  <section class="memoriam"><div class="k">IN MEMORIAM</div><h3>돌아오지 못한 이들에게</h3><p class="locked" style="font-size:14px">그들이 남긴 마지막 이야기. 최후와 마지막 말은 대장이 직접 쓴 것만 걸어요.</p>
  ${lost.length?`<div style="margin-top:12px">${lost.map(c=>`<a class="pc" href="#${c.id}">${c.img?`<img src="${esc(c.img)}" alt="">`:''}${esc(c['이름'])} <small class="locked">${esc(c['상태'])}</small></a>`).join('')}</div>`:'<p style="margin:10px 0 0">아직 돌아오지 못한 이가 없어요.</p>'}</section>`;
}
// ---------- 발자취 ----------
function journeyView(y){
  const ys=yearsAll(); y=y&&ys.includes(y)?y:ys[ys.length-1];
  const ss=D.sessions.filter(s=>yearOf(s)===y).sort(cmpAsc), sure=ss.filter(s=>dateSure(s.date)).length;
  const pcs=new Map(); ss.forEach(s=>(s.pcs||[]).forEach(p=>{if(typeof p==='string')pcs.set(p,(pcs.get(p)||0)+1)}));
  const top=[...pcs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
  const pts=[...new Set(ss.map(s=>s.playthroughId))].map(id=>ptInfo(id));
  const doneY=D.playthroughs.map(p=>ptInfo(p.id)).filter(i=>i.shown==='완주'&&i.endedAt&&+i.endedAt.slice(0,4)===y).length, doneNoDate=D.playthroughs.map(p=>ptInfo(p.id)).filter(i=>i.shown==='완주'&&!i.endedAt).length;
  const unknown=D.sessions.filter(s=>!yearOf(s)).length;
  const firstY=c=>{const s=sessionsOfChar(c.id).find(x=>yearOf(x));return s?yearOf(s):null}, lastS=c=>{const L=sessionsOfChar(c.id).filter(x=>yearOf(x));return L[L.length-1]};
  const newChars=D.characters.filter(c=>firstY(c)===y), bye=D.characters.filter(c=>isLost(c)&&lastS(c)&&yearOf(lastS(c))===y);
  const lostNoDate=D.characters.filter(c=>isLost(c)&&!lastS(c)).length;
  const face=c=>`<a class="pc" href="#${c.id}">${c.img?`<img src="${esc(c.img)}" alt="">`:''}${esc(c['이름'])}</a>`;
  return `<div class="pagehead"><h2>THE JOURNEY<span>나의 TRPG 발자취</span></h2><p>연도를 누르면 그해의 연감이 열려요. 세션 수·회차 수·완주 수는 따로 세요. 날짜를 모르는 세션 ${unknown}회는 어느 해에도 들어가지 않아요.</p></div>
  <div class="journey">${ys.map(v=>`<a class="yr" href="#journey/${v}" aria-current="${v===y}"><i></i><span>${v}</span><small>${D.sessions.filter(s=>yearOf(s)===v).length}회</small></a>`).join('')}</div>
  <div class="yearbook"><div class="k">YEARBOOK</div><h3 style="font-family:var(--f-head);margin:4px 0 6px;font-size:20px">${y}년의 모험</h3>
  <div class="ybgrid">
    <div><b>${ss.length}</b><small>세션 · 날짜 확정 ${sure} · 추정 ${ss.length-sure}</small></div>
    <div><b>${pts.length}</b><small>시나리오 회차</small></div>
    <div><b>${doneY}</b><small>이 해에 완주 (대장 확인, 끝난 날 기준)${doneNoDate?` · 끝난 날 모름 ${doneNoDate}`:''}</small></div>
    <div><b>${ss.filter(s=>s.role==='KP').length}</b><small>키퍼링</small></div>
    <div><b>${newChars.length}</b><small>처음 세션에 나온 캐릭터</small></div>
    <div><b>${bye.length}</b><small>작별한 인물 · 마지막 세션이 이 해인 로스트·사망${lostNoDate?` · 세션 기록 없는 ${lostNoDate}명은 빠짐`:''}</small></div>
  </div>
  ${top.length?`<p style="margin:6px 0">가장 많이 함께한 캐릭터: ${top.map(([id,n])=>`<a href="#${id}">${esc(chars[id]['이름'])}</a> ${n}회`).join(' · ')}</p>`:''}
  ${newChars.length?`<h4 class="ybh">새로 만난 캐릭터</h4><div class="pcs">${newChars.map(face).join('')}</div>`:''}
  ${bye.length?`<h4 class="ybh">🕯 작별한 인물</h4><div class="pcs">${bye.map(c=>`<span>${face(c)}<small class="locked"> 마지막 세션 ${esc(lastS(c).title)}</small></span>`).join('')}</div>`:''}
  <ol class="chron" style="margin-top:8px">${ss.map(s=>`<li><span class="n">${s.no??'—'}</span><a href="#${s.id}">${esc(s.title)}</a><span class="d">${dateText(s.date)}</span></li>`).join('')||'<li class="locked">이 해의 세션이 없어요.</li>'}</ol>
  ${ss.length&&sure<ss.length?`<p class="locked" style="margin:8px 0 0">이 해의 세션 ${ss.length-sure}회는 파일 날짜로 짐작한 것이라 실제 해와 다를 수 있어요.</p>`:''}</div>`;
}

// ---------- 작업함(관리자): 한 번에 한 기록. 왼쪽 목록 + 오른쪽 편집기 ----------
// 쓰던 글은 항목별로 바로 임시 저장(pa-draft)하고, 버튼을 눌러도 편집기와 목록만 다시 그린다.
let INB={tab:'sum',f:'wait',q:'',sel:null,...store.get('pa-inb',{})};
let DR=store.get('pa-draft',{});
const saveINB=()=>store.set('pa-inb',INB), saveDR=()=>store.set('pa-draft',DR);
const ST_LABEL={draft:'검토 대기',fix:'수정 필요',ok:'승인',no:'거절',hold:'보류'};
function inbItems(tab){
  if(tab==='sum') return D.sessions.filter(s=>s.summary).map(s=>({key:'sum:'+s.id,s,title:s.title,sub:`${s.no??'번호 없음'}${s.part?'·'+s.part:''} · ${s.rule} · ${dateText(s.date,true)}`,st:sumState(s),pubNow:sumPub(s)!=null}));
  if(tab==='end') return D.sessions.filter(s=>s.ending).map(s=>({key:'end:'+s.id,s,title:s.title,sub:`${s.no??''} · ${s.rule} · ${endVis(s)}`,st:endState(s)}));
  if(tab==='pt') return D.playthroughs.map(p=>{const i=ptInfo(p.id);return {key:'pt:'+p.id,p,title:scen[p.scenarioId]?.title||p.id,sub:`${p.id} · 세션 ${ptSessions(p.id).length}회 · ${i.sure?'확정 '+i.status:'AI 추정 '+i.status}`,st:i.sure?'ok':'draft'}});
  if(tab==='rev') return D.playthroughs.filter(p=>RV['rev:'+p.id]?.text).map(p=>({key:'rev:'+p.id,p,title:scen[p.scenarioId]?.title||p.id,sub:RV['rev:'+p.id].vis,st:'ok'}));
  if(tab==='scene') return Object.values(MEM).map(m=>{const s=byId[m.sessionId];return {key:'mem:'+m.id,m,s,title:`${MEM_KIND[m.kind]||m.kind} · ${s?s.title:m.sessionId}`,sub:`${s?.no??'번호 없음'} · ${m.who||'여럿'} · ${m.friends?'친구 PC 나옴':'대장 PC만'} · ${memVis(m)}`,st:memState(m)}});
  return [];
}
const inbWait=x=>['draft','fix','hold'].includes(x.st);
function inbFiltered(){
  const q=INB.q.trim().toLowerCase();
  return inbItems(INB.tab).filter(x=>(INB.f==='all'||(INB.f==='wait'?inbWait(x):x.st===INB.f))&&(!q||(x.title+' '+x.sub).toLowerCase().includes(q)))
    .sort((a,b)=>(inbWait(a)?0:1)-(inbWait(b)?0:1)||(a.s&&b.s?cmpAsc(a.s,b.s):0));
}
function inboxView(){
  const tabs=[['sum','스포일러 없는 요약'],['end','결말·진상'],['pt','회차 상태'],['rev','개인 후기'],['scene','명장면 후보']];
  return `<div class="pagehead"><h2>INBOX<span>관리자 작업함</span></h2><p>왼쪽에서 고르고 오른쪽에서 고쳐요. 쓰던 글은 바로 임시 저장돼서 다른 항목을 승인해도 사라지지 않아요. 승인한 글을 고치면 다시 승인해야 하고, 그동안 방문객은 예전에 승인한 글을 봐요.</p></div>
  <div class="tabs" role="tablist">${tabs.map(([k,l])=>{const it=inbItems(k),w=it.filter(inbWait).length;return `<button role="tab" aria-selected="${INB.tab===k}" data-inbtab="${k}">${l}${w?` <span class="tag warn">${w}</span>`:''}</button>`}).join('')}</div>
  <div class="inb"><section class="inb-list">
    <div class="row-actions" style="margin:0 0 8px"><select class="inp" data-inbf aria-label="상태 필터">${[['wait','검토할 것'],['draft','검토 대기'],['fix','수정 필요'],['hold','보류'],['ok','승인'],['no','거절'],['all','전체']].map(([v,l])=>`<option value="${v}"${INB.f===v?' selected':''}>${l}</option>`).join('')}</select>
    <input class="inp" data-inbq type="search" value="${esc(INB.q)}" placeholder="번호 · 이름 · 룰 · 날짜" style="flex:1;min-width:120px"></div>
    <div id="inbProg"></div><div id="inbList"></div></section>
  <section class="inb-edit" id="inbEdit"></section></div>`;
}
function renderInbox(){
  if(!$('#inbList')) return;
  const all=inbItems(INB.tab), list=inbFiltered(), done=all.filter(x=>!inbWait(x)).length;
  if(!INB.sel||!all.some(x=>x.key===INB.sel)) INB.sel=list[0]?.key||null;
  $('#inbProg').innerHTML=all.length?`<div class="prog" title="검토 끝난 비율"><i style="width:${Math.round(done/all.length*100)}%"></i></div><small class="locked">${done} / ${all.length} 검토 끝</small>`:'';
  $('#inbList').innerHTML=list.length?list.map(x=>`<button class="inb-row" data-inbsel="${esc(x.key)}" aria-current="${x.key===INB.sel}"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small><span>${DR[x.key]!=null?'<i class="tag gold">임시 저장</i>':''}<i class="tag ${x.st==='ok'?'ok':x.st==='no'?'bad':'warn'}">${ST_LABEL[x.st]||x.st}</i></span></button>`).join(''):`<p class="locked">${INB.tab==='scene'?'아직 후보가 없어요. AI가 세션 기록에서 명대사·주사위·웃긴 장면 후보를 뽑아 비공개 묶음에 넣으면 여기에 떠요.':INB.tab==='rev'?'아직 쓴 후기가 없어요. 시나리오 상세의 각 회차에서 써요.':'이 조건에 맞는 항목이 없어요.'}</p>`;
  renderInbEditor();
}
function renderInbEditor(){
  const el=$('#inbEdit'); if(!el) return;
  const x=inbItems(INB.tab).find(i=>i.key===INB.sel);
  if(!x){el.innerHTML='<p class="empty">왼쪽에서 검토할 항목을 골라요.</p>';return}
  const list=inbFiltered(), at=list.findIndex(i=>i.key===x.key);
  const nav=`<div class="row-actions" style="margin-top:12px;border-top:1px solid var(--rule);padding-top:10px"><button class="btn sm" data-inbnav="-1" ${at<=0?'disabled':''}>‹ 이전</button><button class="btn sm" data-inbnav="1" ${at<0||at>=list.length-1?'disabled':''}>다음 ›</button><small class="locked" style="margin-left:auto">${at>=0?`${at+1} / ${list.length}`:'필터 밖 항목'}</small></div>`;
  const head=`<header style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><h3 style="font-family:var(--f-head);margin:0;font-size:18px">${esc(x.title)}</h3><small class="locked">${esc(x.sub)}</small><span class="tag ${x.st==='ok'?'ok':x.st==='no'?'bad':'warn'}">${ST_LABEL[x.st]||x.st}</span>${x.s?`<a href="#${x.s.id}" style="font-size:12.5px;color:var(--gilt);margin-left:auto">세션 열기 ↗</a>`:''}</header>`;
  if(INB.tab==='sum'){
    const s=x.s, saved=sumText(s), cur=DR[x.key]??saved, pub=sumPub(s), orig=s.summary.text, dirty=DR[x.key]!=null&&DR[x.key]!==saved;
    el.innerHTML=`${head}
    <div class="cmp"><div><h4>AI가 뽑은 원래 초안</h4><p>${esc(orig)}</p></div><div><h4>지금 공개된 글</h4><p>${pub!=null?esc(pub):'<span class="locked">공개된 글 없음</span>'}</p></div></div>
    <label for="inbText" class="k" style="display:block;margin:12px 0 4px">고칠 글 ${dirty?'<span class="tag gold" id="inbDirty">저장 안 한 변경</span>':'<span id="inbDirty"></span>'}</label>
    <textarea class="inp" id="inbText" data-draft="${esc(x.key)}" rows="5">${esc(cur)}</textarea>
    <small class="locked" id="inbSaved">${DR[x.key]!=null?'임시 저장됨 · 다른 항목을 승인하거나 페이지를 옮겨도 남아요':'고치기 시작하면 바로 임시 저장돼요'}</small>
    <div class="row-actions"><button class="btn gilt" data-inbact="approve">승인하고 다음 ›</button><button class="btn" data-inbact="save">저장(수정 필요로)</button><button class="btn" data-inbact="hold">보류</button><button class="btn" data-inbact="reject">거절</button>
    ${pub!=null?'<button class="btn" data-inbact="unpublish">승인 취소(공개 내리기)</button>':''}${saved!==orig||DR[x.key]!=null?'<button class="btn" data-inbact="restore">원래 초안으로 되돌리기</button>':''}</div>${nav}`;
  } else if(INB.tab==='end'){
    const s=x.s;
    el.innerHTML=`${head}<div class="cmp"><div><h4>결말·진상 (스포일러)</h4><p>${esc(s.ending.text)}</p></div><div><h4>요약 상태와는 따로예요</h4><p class="locked">요약을 승인해도 결말은 이 화면에서 따로 승인해야 공개돼요.</p></div></div>
    <div class="row-actions"><label class="locked" for="inbVis">공개 범위</label><select class="inp" id="inbVis">${['비공개','친구','공개'].map(v=>`<option${endVis(s)===v?' selected':''}>${v}</option>`).join('')}</select><button class="btn gilt" data-inbact="approve">이 범위로 승인하고 다음 ›</button><button class="btn" data-inbact="hold">보류</button><button class="btn" data-inbact="reject">거절</button>${RV[x.key]?'<button class="btn" data-inbact="restore">처음 상태로</button>':''}</div>${nav}`;
  } else if(INB.tab==='pt'){
    const p=x.p, i=ptInfo(p.id), ss=ptSessions(p.id);
    el.innerHTML=`${head}${p.note?`<p class="locked">${esc(p.note)}</p>`:''}<ol class="chron">${ss.map(s=>`<li><span class="n">${s.no??'—'}</span><a href="#${s.id}">${esc(s.title)}${s.part?` · ${s.part}번째`:''}</a><span class="d">${dateText(s.date)}</span></li>`).join('')}</ol>
    <div class="row-actions"><label class="locked" for="inbPt">회차 상태</label><select class="inp" id="inbPt">${['예정','진행 중','완주','중단','미확인'].map(v=>`<option${i.status===v?' selected':''}>${v}</option>`).join('')}</select>
    <label class="locked" for="inbEndAt">완주·중단한 날</label><input class="inp" id="inbEndAt" type="date" value="${esc(RV[x.key]?.endedAt||'')}" style="width:auto">
    <button class="btn gilt" data-inbact="approve">확정하고 다음 ›</button>${RV[x.key]?'<button class="btn" data-inbact="restore">확정 되돌리기</button>':''}</div>
    <small class="locked">완주 수는 이 날짜가 있는 해에만 세요. 날짜가 없으면 "연도 모름"으로 따로 세요.</small>${nav}`;
  } else if(INB.tab==='rev'){
    const rv=RV[x.key];
    el.innerHTML=`${head}<p style="white-space:pre-line">${esc(rv.text)}</p><p class="locked">후기는 <a href="#${x.p.scenarioId}">시나리오 상세</a>의 회차에서 고쳐요.</p>${nav}`;
  } else if(INB.tab==='scene'){
    const m=x.m, cur=DR[x.key]??memText(m), vis=memVis(m);
    el.innerHTML=`${head}<div class="cmp"><div><h4>AI가 뽑은 원래 후보 · ${esc(MEM_KIND[m.kind]||m.kind)}</h4><p>${esc(m.text)}</p></div><div><h4>누가 나오나</h4><p>${m.friends?'친구 PC가 나오는 장면이라 <b>로그인한 사람에게만</b> 걸 수 있어요.':'대장 PC나 NPC만 나와요. 공개로 걸어도 돼요.'}</p></div></div>
    <label for="inbText" class="k" style="display:block;margin:12px 0 4px">걸릴 글 <span id="inbDirty"></span></label>
    <textarea class="inp" id="inbText" data-draft="${esc(x.key)}" rows="3">${esc(cur)}</textarea>
    <small class="locked" id="inbSaved">닉네임은 쓰지 말고 캐릭터 이름만 써요. 고치기 시작하면 바로 임시 저장돼요</small>
    <div class="row-actions"><label class="locked" for="inbVis">공개 범위</label><select class="inp" id="inbVis">${(m.friends?['친구']:['공개','친구']).map(v=>`<option${vis===v?' selected':''}>${v}</option>`).join('')}</select>
    <button class="btn gilt" data-inbact="approve">추억관에 걸고 다음 ›</button><button class="btn" data-inbact="hold">보류</button><button class="btn" data-inbact="reject">거절</button>${RV[x.key]||DR[x.key]!=null?'<button class="btn" data-inbact="restore">처음 상태로</button>':''}</div>${nav}`;
  }
}
function inbAct(a){
  const k=INB.sel; if(!k) return;
  const [type,id]=[k.slice(0,k.indexOf(':')),k.slice(k.indexOf(':')+1)];
  const list=inbFiltered(), at=list.findIndex(i=>i.key===k);
  const goNext=()=>{const nl=inbFiltered(),stay=nl.findIndex(i=>i.key===k);INB.sel=(stay>=0?nl[stay+1]:nl[at]||nl[at-1])?.key||null};
  if(type==='sum'){
    const s=byId[id], cur=(DR[k]??sumText(s)).trim(), r={...(RV[k]||{})};
    if(['approve','save'].includes(a)&&!cur){toast('빈 요약은 저장하거나 승인할 수 없어요');return}
    if(a==='approve'){r.text=cur;r.pub=cur;r.st='ok';}
    else if(a==='save'){r.text=cur;r.st=(r.pub!=null&&cur===r.pub)?'ok':'fix';}
    else if(a==='hold'){if(DR[k]!=null)r.text=cur;r.st='hold'}
    else if(a==='reject'){r.st='no';delete r.pub}
    else if(a==='unpublish'){delete r.pub;r.st='draft'}
    else if(a==='restore'){delete r.text;r.st=r.pub!=null?'fix':'draft'}
    if(r.text===s.summary.text)delete r.text;
    RV[k]=r; delete DR[k]; saveDR();
    toast({approve:'승인했어요. 결말은 따로예요',save:r.st==='ok'?'승인한 글과 같아서 그대로 둬요':'저장했어요. 다시 승인해야 공개돼요',hold:'보류했어요',reject:'거절했어요',unpublish:'공개를 내렸어요',restore:'원래 초안으로 되돌렸어요'}[a]);
  } else if(type==='end'){
    if(a==='restore')delete RV[k]; else RV[k]={st:a==='approve'?'ok':a==='hold'?'hold':'no',vis:$('#inbVis').value};
    toast(a==='approve'?`결말을 "${RV[k].vis}" 범위로 승인했어요`:'처리했어요');
  } else if(type==='mem'){
    const m=MEM[id], cur=(DR[k]??memText(m)).trim();
    if(a==='approve'&&!cur){toast('빈 글은 걸 수 없어요');return}
    if(a==='restore')delete RV[k];
    else{const r={st:a==='approve'?'ok':a==='hold'?'hold':'no',vis:m.friends?'친구':($('#inbVis')?.value||'공개')};if(cur&&cur!==m.text)r.text=cur;RV[k]=r}
    delete DR[k]; saveDR();
    toast(a==='approve'?`추억관에 "${RV[k].vis}" 범위로 걸었어요`:a==='restore'?'처음 상태로 되돌렸어요':'처리했어요');
  } else if(type==='pt'){
    if(a==='restore')delete RV[k]; else RV[k]={status:$('#inbPt').value,endedAt:$('#inbEndAt').value||null};
    toast(a==='restore'?'AI 추정으로 되돌렸어요':'회차 상태를 확정했어요');
  }
  saveRV();
  if(a==='approve') goNext();
  saveINB(); refreshInboxTabs(); renderInbox();
}
function refreshInboxTabs(){document.querySelectorAll('[data-inbtab]').forEach(b=>{const w=inbItems(b.dataset.inbtab).filter(inbWait).length;const t=b.querySelector('.tag');if(t)t.remove();if(w)b.insertAdjacentHTML('beforeend',` <span class="tag warn">${w}</span>`)})}
// ---------- 공개용 데이터 만들기(방문객이 받을 것) ----------
function publicData(){
  const r0=role; role='visitor';
  const out={sessions:D.sessions.map(s=>{const o={id:s.id,no:s.no,part:s.part,title:s.title,scenarioId:s.scenarioId,playthroughId:s.playthroughId,campaignId:s.campaignId,rule:s.rule,role:s.role,pcs:(s.pcs||[]).map(p=>typeof p==='string'?p:{name:p.name}),date:s.date?{v:s.date.v,prec:s.date.prec,sure:dateSure(s.date)}:null,aborted:s.aborted};
    if(canSeeSummary(s))o.summary=sumPub(s); if(canSeeEnding(s))o.ending=s.ending.text; return o}),
    playthroughs:D.playthroughs.map(p=>({id:p.id,scenarioId:p.scenarioId,status:ptInfo(p.id).shown}))};
  role=r0; return out;
}

// ---------- 점검 ----------
function checkView(){
  const items=[];
  const L=(ids)=>`<div class="links">${ids.slice(0,24).map(id=>`<a href="#${esc(id)}">${esc(byId[id]?(byId[id].no??'번호 없음')+(byId[id].part?'·'+byId[id].part:''):chars[id]?.['이름']||scen[id]?.title||id)}</a>`).join('')}</div>`;
  const add=(st,t,d,ids)=>items.push(`<li><span class="st ${st}">${st==='ok'?'통과':st==='warn'?'확인 필요':'문제'}</span><b>${t}</b><div style="color:var(--dust);font-size:13px">${d}</div>${ids&&ids.length?L(ids):''}</li>`);
  // 참조 무결성
  const allIds=[...D.sessions,...D.characters,...D.scenarios,...D.campaigns,...D.playthroughs].map(x=>x.id);
  const dup=allIds.filter((x,i)=>allIds.indexOf(x)!==i); add(dup.length?'bad':'ok','ID가 겹치지 않는가',dup.length?'겹치는 ID: '+[...new Set(dup)].join(', '):`${allIds.length}개 모두 하나뿐`);
  const badSc=D.sessions.filter(s=>!scen[s.scenarioId]); add(badSc.length?'bad':'ok','세션 → 시나리오 연결',badSc.length?'없는 시나리오를 가리킴':`${D.sessions.length}개 모두 통과`,badSc.map(s=>s.id));
  const badPc=D.sessions.filter(s=>(s.pcs||[]).some(p=>typeof p==='string'&&!chars[p])); add(badPc.length?'bad':'ok','세션 → 캐릭터 ID 연결',badPc.length?'없는 캐릭터 ID를 가리킴: '+[...new Set(badPc.flatMap(s=>s.pcs.filter(p=>typeof p==='string'&&!chars[p])))].join(', '):'문자열 ID는 모두 서고에 있음',badPc.map(s=>s.id));
  const badCp=D.sessions.filter(s=>s.campaignId&&!camp[s.campaignId]); const mis=D.sessions.filter(s=>scen[s.scenarioId]?.campaignId&&s.campaignId!==scen[s.scenarioId].campaignId);
  add(badCp.length||mis.length?'bad':'ok','캠페인 연결',badCp.length?'없는 캠페인 ID':mis.length?'시나리오와 세션의 캠페인이 다름':'모두 맞음',[...badCp,...mis].map(s=>s.id));
  const noPt=[...new Set(D.sessions.map(s=>s.playthroughId))].filter(id=>!PT[id]); add(noPt.length?'bad':'ok','모든 회차에 상태 기록이 있는가',noPt.length?noPt.join(', '):`${D.playthroughs.length}개 회차 모두 있음`);
  const fmt={day:/^\d{4}-\d{2}-\d{2}$/,month:/^\d{4}-\d{2}$/,year:/^\d{4}$/};
  const badDate=D.sessions.filter(s=>s.date&&s.date.prec!=='unknown'&&!(fmt[s.date.prec]&&fmt[s.date.prec].test(s.date.v||'')&&!isNaN(new Date(s.date.v))));
  add(badDate.length?'bad':'ok','날짜 형식',badDate.length?'정밀도와 값이 맞지 않음':'모두 올바름',badDate.map(s=>s.id));
  // 확인할 것
  const notIn=D.sessions.filter(s=>(s.pcs||[]).some(p=>typeof p!=='string')); add(notIn.length?'warn':'ok','대장 PC가 캐릭터 서고에 없음',[...new Set(notIn.flatMap(s=>s.pcs.filter(p=>typeof p!=='string').map(p=>p.name)))].join(', ')+' → 등록할지 정해야 해요',notIn.map(s=>s.id));
  const unk=D.sessions.filter(s=>!s.date||s.date.prec==='unknown'); add('warn','날짜를 모르는 세션','"일자 미상"으로 표시하고 지어내지 않아요',unk.map(s=>s.id));
  const est=D.sessions.filter(s=>s.date&&s.date.prec!=='unknown'&&!dateSure(s.date)); add('warn','파일 날짜로 짐작한 세션',`${est.length}회. 화면에 "추정"으로 표시. 기록 본문이나 대장 확인으로 확정하면 사라져요`,est.map(s=>s.id));
  const multi=D.sessions.filter(s=>s.notes&&/한 파일/.test(s.notes)); add('warn','한 파일에 여러 세션','트라이앵글 에이전시는 "N번째 세션" 표시로 9회로 나눴어요',multi.map(s=>s.id));
  const ai=D.playthroughs.filter(p=>!ptInfo(p.id).sure); add(ai.length?'warn':'ok','확정하지 않은 회차 상태',`${ai.length}개. 방문객에게는 "미확인"으로 보여요 · <a href="#inbox" style="color:var(--gilt)">작업함</a>`);
  const one=D.playthroughs.filter(p=>ptSessions(p.id).length===1&&ptInfo(p.id).status!=='완주'); add('warn','세션이 하나뿐인 회차',`${one.length}개. "한 번에 끝남"으로 단정하지 않고 "기록된 세션 1회"로만 써요`);
  const diffs=D.characters.map(c=>{const old=(c['연대기']||[]).map(r=>String(r[0])),now=sessionsOfChar(c.id).map(s=>String(s.no));const p=[...new Set(now.filter(n=>!old.includes(n)))];return p.length?`${c['이름']} +${p.join('·')}`:null}).filter(Boolean);
  add(diffs.length?'warn':'ok','지금 서고 연대기에 빠진 세션',diffs.join(' / ')+'. 기존 연대기는 지우지 않고 합쳐 보여요');
  const uw=D.characters.filter(c=>diceRows(c).skipped.length); add(uw.length?'warn':'ok','주사위 판정 데이터',uw.map(c=>{const d=diceRows(c);return `${c['이름']}: ${d.ok.length+d.skipped.length}줄 중 ${d.ok.length}줄 사용, ${d.skipped.length}줄은 Oracle Dice에서 이유와 함께 보여 줌`}).join(' / ')||'모두 읽힘',uw.map(c=>c.id));
  const ss=D.scenarios.filter(s=>s.sourceSure===false); add(ss.length?'warn':'ok','자작인지 확실하지 않은 시나리오','"자작" 분류에서 빼고 "자작 추정"으로만 표시',ss.map(s=>s.id));
  // 공개 데이터 검사
  const pub=JSON.stringify(publicData());
  const leak=[];
  D.sessions.forEach(s=>{if(s.notes&&pub.includes(s.notes))leak.push(s.id+' 메모');if(s.source?.file&&pub.includes(s.source.file))leak.push(s.id+' 원본 경로');if(s.summary&&sumText(s)!==sumPub(s)&&pub.includes(sumText(s)))leak.push(s.id+' 미승인 요약');if(s.ending&&!canSeeEnding({...s})&&pub.includes(s.ending.text)&&endVis(s)!=='공개')leak.push(s.id+' 결말')});
  const nSum=D.sessions.filter(s=>s.summary&&sumPub(s)==null).length, nEnd=D.sessions.filter(s=>s.ending&&!(endState(s)==='ok'&&endVis(s)==='공개')).length;
  add(leak.length?'bad':'ok','방문객용 공개 데이터에 비공개 정보가 섞이는가',leak.length?leak.join(', '):`섞이지 않음 · 빠진 것: 미승인 요약 ${nSum}개, 비공개 결말 ${nEnd}개, 원본 경로·관리 메모·회차 메모 전부, 친구 닉네임·녹화 링크(처음부터 없음). 공개 파일 크기 ${Math.round(pub.length/1024)}KB`);
  add('warn','실제 로그인','시험판의 보기 전환은 화면만 바꿔요. 정식판은 친구·관리자 데이터를 로그인 뒤 서버(웹 앱)가 권한을 확인하고 보내요');
  return `<div class="pagehead"><h2>CHECK<span>점검</span></h2><p>시험 데이터로 돌린 자동 검사예요. 링크를 누르면 해당 기록으로 바로 가요. 실제 사이트에서는 "문제"가 하나라도 있으면 반영하지 않아요.</p></div><ul class="checks">${items.join('')}</ul>`;
}

// ---------- PLAYER: 플레이어 서고 (대장 프레이피스의 플레이 특징). 공개 데이터와 캐릭터 서고에서 셈만 한다. 지어낸 글은 넣지 않는다.
const normGender=g=>/^(남|男|m)/i.test(g||'')?'남':/^(여|女|f)/i.test(g||'')?'여':'';
const normNation=n=>{n=String(n||'').split(/[\/(]/)[0].trim();return /^(한국|대한민국|서울|조선)/.test(n)?'한국':n};
const ageNum=a=>{const m=String(a||'').match(/\d+/);return m?+m[0]:null};
const JOBS=[['학생','학생|고등|대학생|중학'],['의료','의사|간호|약사|약리|외과|의학|수의'],['탐정·수사','탐정|형사|수사|경찰|경사|경위|FBI|요원'],['학자·교수','교수|학자|연구|박사|고고|신비학'],['군인·용병','군|소령|대위|병사|용병|저격'],['예술·연예','배우|가수|작가|화가|음악|아이돌|기자|사진'],['범죄·뒷골목','밀주|갱|마피아|도둑|사기|킬러|암살|현상금'],['종교·오컬트','신부|목사|수녀|무당|도사|퇴마|사제|수도'],['부유층','딜레탕트|귀족|부호|사업가|회장|상속'],['직장인','회사|사원|직원|공무원|교사|변호사|기술|엔지니어|운전']];
const jobCat=j=>{for(const [k,re] of JOBS)if(new RegExp(re).test(j||''))return k;return j?'그 밖':''};
function bars(rows,opt={}){const max=Math.max(1,...rows.map(r=>r[1]));const tot=rows.reduce((a,r)=>a+r[1],0);
  return `<ul class="bars">${rows.map(([k,v,href])=>`<li>${href?`<a href="${href}">${esc(k)}</a>`:`<span>${esc(k)}</span>`}<i style="--w:${(v/max*100).toFixed(1)}%"></i><b>${v}${opt.pct&&tot?` <small>${Math.round(v/tot*100)}%</small>`:''}</b></li>`).join('')}</ul>`}
const countBy=(xs,f)=>{const m=new Map();xs.forEach(x=>{const k=f(x);if(k)m.set(k,(m.get(k)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1])};
function playerView(){
  const S=D.sessions, C=D.characters, dated=S.filter(s=>s.date&&s.date.v).sort(cmpAsc);
  const first=dated[0], years=yearsAll(), nKP=S.filter(s=>s.role==='KP').length;
  const byRule=countBy(S,s=>s.rule), top=byRule[0]||['',0];
  const ruleFirst=r=>{const x=dated.find(s=>s.rule===r);return x?yearOf(x):null};
  const perYear=years.map(y=>{const ys=S.filter(s=>yearOf(s)===y);const tr=countBy(ys,s=>s.rule)[0];return [y+'년',ys.length,'#journey/'+y,tr]});
  const days=S.filter(s=>s.date&&s.date.prec==='day');
  const wd=['일','월','화','수','목','금','토'].map((d,i)=>[d+'요일',days.filter(s=>new Date(s.date.v+'T12:00:00').getDay()===i).length]);
  const months=Array.from({length:12},(_,i)=>[(i+1)+'월',days.filter(s=>+s.date.v.slice(5,7)===i+1).length]);
  const gender=countBy(C,c=>normGender(c['성별'])), ages=C.map(c=>ageNum(c['나이'])).filter(a=>a&&a<200);
  const band=countBy(ages,a=>a<20?'10대 이하':a<30?'20대':a<40?'30대':a<50?'40대':'50대 이상').sort((a,b)=>a[0].localeCompare(b[0],'ko'));
  const avg=ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length):null;
  const nation=countBy(C,c=>normNation(c['국적'])).slice(0,6), jobs=countBy(C,c=>jobCat(c['직업'])).filter(r=>r[0]!=='그 밖').slice(0,8);
  const lost=C.filter(isLost).length, shelf=countBy(C,shelfOf);
  const mostPlayed=C.map(c=>({c,n:Math.max(sessionsOfChar(c.id).length,playsOf(c))})).filter(x=>x.n>1).sort((a,b)=>b.n-a.n).slice(0,6);
  const longest=C.map(c=>{const ss=sessionsOfChar(c.id).filter(s=>s.date&&s.date.v);return ss.length>1?{c,a:ss[0],b:ss[ss.length-1],d:(new Date(padDate(ss[ss.length-1].date.v).replace(/-00/g,'-01'))-new Date(padDate(ss[0].date.v).replace(/-00/g,'-01')))/864e5}:null}).filter(Boolean).sort((x,y)=>y.d-x.d).slice(0,3);
  const again=D.scenarios.map(sc=>({sc,I:scenInfo(sc)})).filter(x=>x.I.pts>1||x.I.n>2).sort((a,b)=>b.I.n-a.I.n).slice(0,6);
  const kpList=S.filter(s=>s.role==='KP');
  const facts=[
    first&&`${dateText(first.date,true).replace(' 추정','')}에 첫 기록을 남긴 뒤 ${years.length}해 동안 세션 ${S.length}번을 기록했어요.`,
    top[0]&&`가장 많이 한 룰은 ${ruleLabel(top[0])}로, 전체 세션의 ${Math.round(top[1]/S.length*100)}%예요.`,
    byRule.length>1&&`룰은 모두 ${byRule.length}가지를 해 봤어요.`,
    (()=>{const r=byRule.find(([k])=>k!==top[0]);const y=r&&ruleFirst(r[0]);return r&&y?`두 번째로 많은 ${ruleLabel(r[0])}는 ${y}년부터 시작했어요.`:''})(),
    perYear.length&&(()=>{const m=[...perYear].sort((a,b)=>b[1]-a[1])[0];return `가장 바빴던 해는 ${m[0]}, 세션 ${m[1]}번이에요.`})(),
    gender.length&&`캐릭터 ${C.length}명 가운데 성별이 적힌 ${gender.reduce((a,g)=>a+g[1],0)}명 중 ${gender[0][0]==='남'?'남성':'여성'}이 ${gender[0][1]}명이에요.`,
    avg&&`나이가 적힌 캐릭터의 평균 나이는 ${avg}살이에요.`,
    `잃어버린 캐릭터(로스트·사망·격리 등)는 ${lost}명이에요.`,
    nKP?`대부분은 플레이어로 참여했고, 키퍼·마스터로 연 세션은 ${nKP}번이에요.`:'',
  ].filter(Boolean);
  const card=(c,sub)=>`<a class="ccard" href="#${c.id}"><div class="pic">${c.img?`<img src="${esc(c.img)}" alt="" loading="lazy">`:`<span class="ini">${esc(c['이름'][0])}</span>`}</div><div class="cap"><b>${esc(c['이름'])}</b><small>${sub}</small></div></a>`;
  return `<div class="pagehead"><h2>PLAYER<span>플레이어 서고</span></h2><p>서고의 주인 프레이피스는 어떤 플레이어일까요? 세션 기록과 캐릭터 서고에서 센 숫자로 보는 플레이 특징이에요. 날짜는 대부분 파일 날짜로 추정한 값이에요.</p></div>
  <section class="stats pstats">
    <div class="stat"><b>${S.length}</b><small>SESSIONS</small><span>기록한 세션</span></div>
    <div class="stat"><b>${C.length}</b><small>CHARACTERS</small><span>만든 캐릭터</span></div>
    <div class="stat"><b>${D.scenarios.length}</b><small>SCENARIOS</small><span>다녀온 세계</span></div>
    <div class="stat"><b>${byRule.length}</b><small>SYSTEMS</small><span>해 본 룰</span></div>
  </section>
  <div class="box ptraits"><h4>숫자로 본 특징</h4><ul>${facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div>
  <div class="pgrid">
    <div class="box"><h4>룰 취향 <small class="locked">세션 수</small></h4>${bars(byRule.slice(0,10).map(([k,v])=>[ruleLabel(k),v]),{pct:true})}${byRule.length>10?`<p class="locked">그 밖 ${byRule.length-10}가지 룰 ${byRule.slice(10).reduce((a,r)=>a+r[1],0)}번</p>`:''}</div>
    <div class="box"><h4>해마다 <small class="locked">세션 수 · 그해 가장 많이 한 룰</small></h4>${bars(perYear.map(([k,v,h])=>[k,v,h]))}<p class="locked">${perYear.map(r=>`${r[0]} ${r[3]?ruleLabel(r[3][0]):''}`).join(' · ')}</p></div>
    <div class="box"><h4>세션 요일 <small class="locked">날짜가 날 단위로 남은 ${days.length}번</small></h4>${bars(wd)}</div>
    <div class="box"><h4>세션 달 <small class="locked">같은 ${days.length}번</small></h4>${bars(months)}</div>
    <div class="box"><h4>캐릭터 서가 <small class="locked">캐릭터 수</small></h4>${bars(shelf.slice(0,8).map(([k,v])=>[RULES[k]||k,v,'#characters']),{pct:true})}</div>
    <div class="box"><h4>자주 맡는 직업 <small class="locked">직업 칸을 묶어서</small></h4>${jobs.length?bars(jobs):'<p class="locked">직업이 적힌 캐릭터가 없어요.</p>'}</div>
    <div class="box"><h4>캐릭터 나이</h4>${bars(band)}${avg?`<p class="locked">평균 ${avg}살 · 나이가 적힌 ${ages.length}명</p>`:''}</div>
    <div class="box"><h4>캐릭터 국적 <small class="locked">많은 순 6</small></h4>${bars(nation)}</div>
  </div>
  ${mostPlayed.length?`<div class="sect-t">MOST PLAYED</div><p class="locked">가장 여러 번 함께 모험한 캐릭터</p><div class="gallery">${mostPlayed.map(({c,n})=>card(c,`${n}번의 모험`)).join('')}</div>`:''}
  ${longest.length?`<div class="sect-t">LONGEST JOURNEY</div><p class="locked">첫 세션과 마지막 세션 사이가 가장 긴 캐릭터</p><div class="gallery">${longest.map(({c,a,b})=>card(c,`${dateText(a.date,true)} ~ ${dateText(b.date,true)}`)).join('')}</div>`:''}
  ${again.length?`<div class="sect-t">FAVORITE WORLDS</div><p class="locked">여러 세션이나 여러 회차를 한 시나리오</p><div class="cards">${again.map(({sc,I})=>`<a class="scard" href="#${sc.id}"><small class="rl">${esc(ruleLabel(sc.rule))}</small><b>${esc(sc.title)}</b><small>${I.pts}회차 · 세션 ${I.n}회</small></a>`).join('')}</div>`:''}
  ${kpList.length?`<div class="sect-t">AS KEEPER</div><p class="locked">대장이 키퍼·마스터로 연 세션</p><div class="cards">${kpList.map(s=>`<a class="scard" href="#${s.id}"><small class="rl">${esc(ruleLabel(s.rule))}</small><b>${esc(s.title)}</b><small>${dateText(s.date,true)}</small></a>`).join('')}</div>`:''}`;
}

// ---------- 로그인 · 서버 (캐릭터 서고와 같은 앱 스크립트 웹 앱) ----------
// 비밀번호는 로그인 때 한 번만 보내고, 웹 앱이 준 표(14일)만 이 기기에 둔다. 캐릭터 서고와 같은 주소라 같은 'tok' 칸을 함께 쓴다.
// 권한은 서버가 정한다: 관리자(쓰기) · 친구(읽기). 방문객은 공개 데이터 + 승인·공개된 것(pa_pub)만 본다.
const LOG_URL='https://script.google.com/macros/s/AKfycbzDq0ROuPIsXvQ1wV1X5ilVRuhm6m3iM3-RxQpgiFIQVtbbSNO2tcJ4tidr4UPk9CDU3g/exec';
const lsDel=k=>{try{localStorage.removeItem(k)}catch{}};
function tokObj(){try{const t=JSON.parse(localStorage.getItem('tok')||'null');if(t&&t.exp>Date.now())return t;lsDel('tok')}catch{}return null}
const tok=()=>tokObj()?.t||'';
async function api(op,data){const r=await fetch(LOG_URL,{method:'POST',body:JSON.stringify({op,token:tok(),...(data||{})})});const j=await r.json();if(!j.ok&&j.error==='auth'){lsDel('tok');setRole('visitor')}return j}
let LOGS=null, PICKS=[], SERVER={pub:false,priv:false};
function setRole(r){role=r;document.body.dataset.role=r;const b=$('#loginBtn');if(b){b.textContent=r==='visitor'?'로그인':r==='admin'?'관리자 · 로그아웃':'친구 · 로그아웃';b.setAttribute('aria-label',r==='visitor'?'로그인':'로그아웃')}
  // 즐겨찾기: 관리자는 서버(어느 기기에서나 같음, 'ofav'), 그 밖은 이 브라우저('fav'). 캐릭터 서고와 같은 규칙
  FAV=new Set(store.get(r==='admin'?'ofav':'fav',[]))}
saveFav=()=>{store.set(role==='admin'?'ofav':'fav',[...FAV]);if(role==='admin')api('favset',{ids:[...FAV]}).catch(()=>{})};
// 작업함 검토 기록은 서버에 저장 (잠깐 모아서 한 번에)
let rvTimer=null;
saveRV=()=>{if(role!=='admin'||!SERVER.priv){toast('서버 자료를 아직 못 받아서 저장하지 않았어요');return}clearTimeout(rvTimer);rvTimer=setTimeout(()=>api('pa_set',{rv:RV}).then(j=>{if(!j.ok)toast('작업함을 서버에 저장하지 못했어요. 다시 로그인해 주세요')}).catch(()=>toast('작업함을 서버에 저장하지 못했어요. 인터넷 연결을 확인해 주세요')),600)};
// 공개 겹치기: 승인한 요약, 범위 안의 결말, 확정한 회차
function overlayPub(o){if(!o)return;
  Object.entries(o.sum||{}).forEach(([id,t])=>{const s=byId[id];if(s&&!isAdmin())s.summary={text:t,status:'approved'}});
  Object.entries(o.end||{}).forEach(([id,t])=>{const s=byId[id];if(s&&!isAdmin())s.ending={text:t,status:'approved',vis:role==='friend'?'친구':'공개'}});
  Object.entries(o.pt||{}).forEach(([id,p])=>{if(PT[id]){PT[id].status=p.status;PT[id].by='대장 확인';if(p.endedAt)PT[id].endedAt=p.endedAt}});
  Object.entries(o.rev||{}).forEach(([id,r])=>{if(!isAdmin())RV['rev:'+id]=r});
  Object.entries(o.sc||{}).forEach(([id,m])=>{if(!isAdmin())RV['sc:'+id]={owned:!!m.owned,wish:!!m.wish,prep:!!m.prep}});
  Object.entries(o.rate||{}).forEach(([id,r])=>{if(!isAdmin())RV['rate:'+id]=r});
  if(!isAdmin()){MEM={};Object.entries(o.mem||{}).forEach(([id,m])=>{MEM[id]={id,...m}})}
}
// 관리자: 비공개 원본(초안·메모)을 공개 데이터 위에 겹친다
function overlayPriv(pv){if(!pv)return;
  Object.entries(pv.sessions||{}).forEach(([id,x])=>{const s=byId[id];if(!s)return;if(x.summary)s.summary=x.summary;if(x.ending)s.ending=x.ending;if(x.notes)s.notes=x.notes;
    if(x.pcNotes)s.pcs=s.pcs.map(p=>typeof p==='object'?(x.pcNotes.find(n=>n.name===p.name)||p):p)});
  Object.entries(pv.playthroughs||{}).forEach(([id,p])=>{if(PT[id])Object.assign(PT[id],p)});
  MEM={};Object.entries(pv.memories||{}).forEach(([id,m])=>{MEM[id]={id,...m}});
}
async function syncServer(){
  try{const j=await(await fetch(LOG_URL+'?op=covers')).json();if(j.ok){applyCovers(j.cover);PICKS=j.picks||[]}}catch{}
  if(!tok()){try{const j=await(await fetch(LOG_URL+'?op=pa_pub')).json();if(j.ok){overlayPub(j);SERVER.pub=true}}catch{}render();return}
  try{
    const w=await api('whoami'); if(!w.ok){setRole('visitor');return syncServer()}
    setRole(w.role==='admin'?'admin':'friend');
    if(role==='admin'){const g=await api('pa_get');if(g.ok){RV=g.rv||{};overlayPriv(g.priv);SERVER.priv=true}
      const f=await api('fav');if(f.ok){FAV=new Set(f.fav||[]);store.set('ofav',[...FAV])}}
    else{const v=await api('pa_view');if(v.ok){overlayPub(v);SERVER.pub=true}}
    const l=await api('sessions');if(l.ok)LOGS=l.sessions||[];
  }catch{toast('서버에 닿지 못했어요. 공개 자료로 보여 드려요')}
  render();
}
// 대표 그림: 웹 앱 COVER (경로는 캐릭터 서고 기준 img/...)
function applyCovers(m){if(!m)return;const base=D.meta.charImgBase||'';D.characters.forEach(c=>{if(!c.img0)c.img0=c.img;const v=m[c.id];if(v){const full=base+v;if([c.img0,...(c['앨범']||[]).map(a=>a[0])].includes(full))c.img=full}})}
async function setCover(c,src){const base=D.meta.charImgBase||'';const rel=src===c.img0?'':src.slice(base.length);
  const j=await api('coverset',{id:c.id,src:rel});if(!j.ok)throw 0;c.img=src}
// 로그인 창
function loginOpen(){if(role!=='visitor'){logout();return}$('#pwmsg').textContent='';$('#loginDlg').showModal();$('#pw').focus()}
async function login(pw){$('#pwmsg').textContent='확인 중…';
  try{const j=await(await fetch(LOG_URL,{method:'POST',body:JSON.stringify({op:'login',pw})})).json();
    if(!j.ok){$('#pwmsg').textContent=j.error==='locked'?'여러 번 틀려서 15분 동안 잠겼어요.':'비밀번호가 맞지 않아요.';return}
    store.set('tok',{t:j.token,exp:j.exp,role:j.role});$('#pw').value='';$('#loginDlg').close();toast(j.role==='admin'?'관리자로 들어왔어요':'친구로 들어왔어요');
    location.reload();
  }catch{$('#pwmsg').textContent='서버에 닿지 못했어요. 잠시 뒤 다시 해 보세요.'}}
async function logout(){try{await api('logout')}catch{}lsDel('tok');lsDel('ofav');toast('로그아웃했어요. 이 기기에서 표를 지웠어요');setTimeout(()=>location.reload(),400)}
// 세션 로그(비공개 시트) 한 줄 찾기: 번호가 같은 줄
const logFor=s=>LOGS&&s.no!=null?LOGS.filter(x=>String(x['번호'])===String(s.no)):[];
function vids(v){return String(v||'').split(/\n+/).map(t=>{const m=t.match(/https?:\/\/\S+/);return m?`<a href="${esc(m[0])}" target="_blank" rel="noopener">▶ ${esc(t.replace(m[0],'').trim()||'영상')}</a>`:''}).filter(Boolean).join(' ')}
function logBox(s){
  if(role==='visitor')return '<p class="locked" style="margin:0">친구·관리자 비밀번호로 로그인하면 함께한 사람, 녹화, 한글 기록이 보여요.</p>';
  if(!LOGS)return '<p class="locked" style="margin:0">세션 로그를 불러오는 중이에요…</p>';
  const L=logFor(s);
  return (L.length?L.map(x=>`<dl class="kv" style="margin:0"><dt>키퍼</dt><dd>${esc(x['KP']||'—')}</dd><dt>플레이어</dt><dd>${esc(x['PL']||'—')}</dd>${x['대장PC']?`<dt>내 캐릭터</dt><dd>${esc(x['대장PC'])}</dd>`:''}<dt>녹화</dt><dd>${esc(x['녹화']||'모름')} ${vids(x['영상'])}</dd>${x['링크']?`<dt>기록 원문</dt><dd><a href="${esc(x['링크'])}" target="_blank" rel="noopener">한글 파일 열기</a></dd>`:''}</dl>`).join(''):'<p class="locked" style="margin:0">세션 로그에 이 번호 줄이 없어요.</p>')
    +(isAdmin()&&s.source?.file?`<p class="locked" style="margin:6px 0 0">원본 파일: <code>${esc(s.source.file)}</code></p>`:'');
}

// ---------- 캐릭터 서고에서 옮긴 것: 관련 인물 · 기억 · 성장 기록 · 소개 카드 · 이전/다음 · 입장 연출 ----------
/* 관련 인물: 같은 세션·시나리오 > 같은 분류 > 같은 직업 > 같은 서가·시대 */
function related(c){
  const k=x=>String(x).replace(/\[[^\]]*\]|CoC|UW|[\s_\-·.,:!?~'"()]/gi,'');
  const mySess=new Set(sessionsOfChar(c.id).map(s=>s.scenarioId));
  const mine=new Set([...(c['시나리오']||[]),...(c['연대기']||[]).map(x=>x[1])].map(k).filter(x=>x.length>1));
  const jw=o=>new Set(String(o['직업']||'').match(/[가-힣A-Za-z]{2,}/g)||[]), my=jw(c);
  return D.characters.filter(o=>o.id!==c.id).map(o=>{let v=0,why='';
    if(sessionsOfChar(o.id).some(s=>mySess.has(s.scenarioId))||[...(o['시나리오']||[]),...(o['연대기']||[]).map(x=>x[1])].map(k).some(x=>mine.has(x))){v+=10;why='같은 시나리오'}
    else if(c['분류']&&o['분류']===c['분류']){v+=10;why=c['분류']}
    const jj=[...jw(o)].filter(w=>my.has(w));if(jj.length){v+=4;why=why||'같은 직업 · '+jj[0]}
    if(shelfOf(o)===shelfOf(c))v+=1;if(o['시대']&&o['시대']===c['시대'])v+=1;return {o,v,why}})
    .filter(x=>x.v>=5).sort((a,b)=>b.v-a.v).slice(0,6);
}
function relHTML(c){const L=related(c);return L.length?`<h4>관련 인물</h4><div class="rel">${L.map(({o,why})=>`<a href="#${o.id}">${o.img?`<img src="${esc(o.img)}" alt="" loading="lazy">`:`<span class="ini">${esc(o['이름'][0])}</span>`}<span>${esc(o['이름'])}<small>${esc(why)}</small></span></a>`).join('')}</div>`:''}
/* 추모 기록: 시트·손으로 적은 칸만(지어내지 않음) */
function memHTML(c){if(!isLost(c)&&!c['최후'])return '';
  const C=c['연대기']||[],L=C[C.length-1],ss=sessionsOfChar(c.id),last=ss.length?ss[ss.length-1].title+' ('+dateText(ss[ss.length-1].date,true)+')':L?L[1]+(L[2]?' ('+L[2]+')':''):'';
  const rows=[['최후',c['최후']],['마지막 말',c['마지막말']],['마지막 세션',last],['복귀 가능성',c['복귀']],['추모글',c['추모글']]].filter(x=>x[1]);
  return `<div class="box memo-box"><h4>🕯 기억</h4>${rows.length?`<dl class="kv" style="margin:0">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:''}${c['최후']||c['마지막말']?'':'<p class="locked" style="margin:6px 0 0">최후와 마지막 말은 아직 적혀 있지 않아요.</p>'}</div>`}
/* 시트 성장 기록: 자동 반영 때 바뀐 예전 시트(시트이력) */
function histHTML(c){const H=c['시트이력']||[];if(!H.length)return '';
  const num=s=>{const m={};['특성치','기능','기본'].forEach(k=>(s&&s[k]||[]).forEach(([n,v])=>{const x=parseFloat(v);if(!isNaN(x))m[n]=x}));return m};
  const st=[...H.map(h=>({d:h['날짜'],s:h['시트']})),{d:'지금',s:c['시트']}],li=[];
  for(let i=1;i<st.length;i++){const a=num(st[i-1].s),b=num(st[i].s),ch=Object.keys(b).filter(k=>k in a&&a[k]!==b[k]).map(k=>`<span class="${b[k]>a[k]?'up':'down'}">${esc(k)} ${a[k]}→${b[k]}</span>`);
    li.push(`<li><b>${esc(st[i-1].d)} → ${esc(st[i].d)}</b> ${ch.length?ch.join(', '):'숫자 변화 없음(글 내용만 바뀜)'}</li>`)}
  return `<div class="sheet-sec"><h4>성장 기록</h4><ol class="hist">${li.join('')}</ol></div>`}
/* 소개 카드 PNG: 그림 · 이름 · 서가 · 직업 · 한마디 (서고 색) */
async function shareCard(c){const W=1080,H=600,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
  g.fillStyle='#1a1918';g.fillRect(0,0,W,H);g.fillStyle='#22201d';g.fillRect(24,24,W-48,H-48);g.strokeStyle='#e2b14a';g.lineWidth=2;g.strokeRect(24,24,W-48,H-48);
  if(c.img)await new Promise(r=>{const im=new Image();im.onload=()=>{const w=380,h=H-48,sc=Math.max(w/im.width,h/im.height),sw=w/sc,sh=h/sc;g.drawImage(im,(im.width-sw)/2,0,sw,sh,24,24,w,h);r()};im.onerror=r;im.src=c.img});
  const x=440;try{await document.fonts.ready}catch{}
  g.fillStyle='#e2b14a';g.font='500 22px Georgia,serif';g.fillText((RULES[shelfOf(c)]||shelfOf(c))+' · '+c.id,x,96);
  g.fillStyle='#efe6d2';g.font='700 60px serif';g.fillText(c['이름'],x,176);
  g.fillStyle='#a69c8a';g.font='26px sans-serif';g.fillText([c['직업'],c['나이']&&c['나이']+(/\d$/.test(c['나이'])?'세':''),c['시대']].filter(Boolean).join(' · ').slice(0,34),x,224);g.fillText(c['상태']||'',x,262);
  const q=c['한마디']||'';if(q){g.fillStyle='#efe6d2';g.font='700 30px serif';let line='',y=340;for(const ch of '“'+q+'”'){if(g.measureText(line+ch).width>W-x-60){g.fillText(line,x,y);line='';y+=44;if(y>480)break}line+=ch}g.fillText(line,x,y)}
  g.fillStyle='#a69c8a';g.font='20px Georgia,serif';g.fillText('THE PRAYPEACE ARCHIVES · 프레이피스 서고',x,H-60);
  const a=document.createElement('a');a.download=c['이름']+'_소개카드.png';a.href=cv.toDataURL('image/png');document.body.appendChild(a);a.click();a.remove()}
/* 이전/다음: 지금 캐릭터 목록(서가·필터·정렬) 순서 */
function prevNext(c){const L=charList(),i=L.findIndex(x=>x.id===c.id);if(i<0)return {};return {prev:L[i-1],next:L[i+1]}}
/* 입장 연출: 룰마다 한 번, 천천히, 깜빡임·원 모양 없음. 설정: 처음 한 번(기본) · 매번 · 끄기 */
const ENTER={CoC1920:'e-coc1920',CoC현대:'e-coc',델타그린:'e-coc',SG:'e-sg',인세인:'e-insane',UW:'e-uw'};
let LASTC='';
function enterClass(c){const again=LASTC===c.id;LASTC=c.id;if(again)return '';   // 탭만 바꿀 때는 다시 안 함
  const fx=store.get('fx','first');if(fx==='off'||still||matchMedia('(prefers-reduced-motion:reduce)').matches)return '';
  if(fx==='first'){const s=store.get('pa-seen',[]);if(s.includes(c.id))return '';store.set('pa-seen',[...s,c.id].slice(-400))}
  return 'enter '+(ENTER[shelfOf(c)]||'')}

// ---------- 화면 고르기 ----------
const listPages=new Set(['sessions','characters','scenarios']);
function render(){
  const h=decodeURIComponent(location.hash.slice(1));
  const base=h.split('/')[0].split('-')[0]==='inbox'?'inbox':h.split('/')[0];
  document.querySelectorAll('[data-admin]').forEach(a=>a.hidden=!isAdmin());
  document.querySelectorAll('nav.menu a').forEach(a=>a.setAttribute('aria-current',(a.getAttribute('href')==='#'+base||(!h&&a.getAttribute('href')==='#'))?'page':'false'));
  let html, page='home';
  if(!h) html=home();
  else if(h==='sessions'){html=sessionsView();page='list'}
  else if(h==='scenarios'){html=scenariosView();page='list'}
  else if(h==='characters'){html=charactersView();page='list'}
  else if(h==='memory'){html=memoryView();page='memory'}
  else if(h==='player'){html=playerView();page='list'}
  else if(base==='journey'){html=journeyView(+h.split('/')[1]||null);page='journey'}
  else if(base==='inbox'||base==='check') {html=isAdmin()?(base==='inbox'?inboxView():checkView()):`<p class="empty" style="margin-top:20px">관리자 화면이에요. 관리자 로그인은 다음 단계에서 열려요.</p>`;page='detail'}
  else if(byId[h]){html=sessionDetail(byId[h]);page='read'}
  else if(scen[h]){html=scenarioDetail(scen[h]);page='read'}
  else if(chars[h]){html=charDetail(chars[h]);page='detail'}
  else html=`<p class="empty" style="margin-top:20px">찾는 페이지가 없어요. <a href="#">처음으로</a></p>`;
  if(!chars[h])LASTC='';
  document.body.dataset.page=page;
  $('#view').innerHTML=html;
  if(h==='sessions') renderSessionList();
  if(h==='characters') renderCharList();
  if(h==='scenarios') renderScenList();
  if(base==='inbox'&&isAdmin()) renderInbox();
  const t={'':'프레이피스 서고',sessions:'세션 기록',characters:'캐릭터 서고',scenarios:'시나리오 서고',memory:'추억관',player:'플레이어 서고',journey:'발자취',inbox:'작업함',check:'점검'}[base];
  document.title=(t||(byId[h]?.title||scen[h]?.title||chars[h]?.['이름']||'프레이피스 서고'))+' · THE PRAYPEACE ARCHIVES';
}
const saveSQ=()=>store.set('pa-sq',SQ);
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.draft){const k=t.dataset.draft,base=k.startsWith('mem:')?memText(MEM[k.slice(4)]):sumText(byId[k.slice(4)]);if(t.value===base)delete DR[k];else DR[k]=t.value;saveDR();const dd=$('#inbDirty');if(dd)dd.innerHTML=DR[k]!=null?'<span class="tag gold">저장 안 한 변경</span>':'';const sv=$('#inbSaved');if(sv)sv.textContent=DR[k]!=null?'임시 저장됨 · 다른 항목을 승인하거나 페이지를 옮겨도 남아요':'바뀐 것 없음';const row=document.querySelector(`[data-inbsel="${k}"] span`);if(row&&DR[k]!=null&&!row.querySelector('.gold'))row.insertAdjacentHTML('afterbegin','<i class="tag gold">임시 저장</i>')}
  else if(t.dataset.inbq!==undefined){INB.q=t.value;saveINB();renderInbox()}
  else if(t.dataset.sq){SQ[t.dataset.sq]=t.value;SQ.page=1;saveSQ();renderSessionList()}
  else if(t.dataset.scs){SCS[t.dataset.scs]=t.value;saveSCS();renderScenList()}
  else if(t.dataset.cs){CS[t.dataset.cs]=t.value;store.set('pa-cs',CS);renderCharList()}
});
document.addEventListener('change',e=>{
  const d=e.target.dataset;
  if(d.scmark&&isAdmin()){const k='sc:'+d.sc,r={...(RV[k]||{})};r[d.scmark]=e.target.checked;RV[k]=r;saveRV();toast('저장했어요');return}
  if(d.rate&&isAdmin()){const k='rate:'+d.rate,r={...(RV[k]||{})};r[d.k]=+e.target.value;if(!r.work&&!r.play)delete RV[k];else RV[k]=r;saveRV();render();toast('평점을 저장했어요');return}
if(e.target.dataset.inbf!==undefined){INB.f=e.target.value;INB.sel=null;saveINB();renderInbox()}});
document.addEventListener('toggle',e=>{const g=e.target.dataset?.g;if(!g)return;const s=new Set(store.get('pa-open',[]));e.target.open?s.add(g):s.delete(g);store.set('pa-open',[...s])},true);
document.addEventListener('click',e=>{
  const t=e.target.closest('button,[data-lbopen]'); if(!t) return;
  const d=t.dataset;
  if(d.hideNotice!==undefined){$('#notice').hidden=true;store.set('pa-notice-off',true)}
  else if(d.sqreset!==undefined){SQ={...SQ0,sort:SQ.sort,group:SQ.group};saveSQ();render()}
  else if(d.sqgroup!==undefined){SQ.group=!SQ.group;SQ.page=1;saveSQ();t.setAttribute('aria-pressed',SQ.group);renderSessionList()}
  else if(d.pg){SQ.page=+d.pg;saveSQ();renderSessionList();$('#slist').scrollIntoView({block:'start'});window.scrollBy(0,-90)}
  else if(d.scrule!==undefined){SCS.rule=d.scrule;saveSCS();document.querySelectorAll('[data-scrule]').forEach(b=>b.setAttribute('aria-pressed',b===t));renderScenList()}
  else if(d.sctag!==undefined){const v=d.sctag;SCS.on=!v?[]:SCS.on.includes(v)?SCS.on.filter(x=>x!==v):[...SCS.on,v];saveSCS();render()}
  else if(d.shelf!==undefined){CS.shelf=d.shelf;store.set('pa-cs',CS);document.querySelectorAll('[data-shelf]').forEach(b=>b.setAttribute('aria-pressed',b===t));renderCharList()}
  else if(d.favonly!==undefined){CS.fav=!CS.fav;store.set('pa-cs',CS);t.setAttribute('aria-pressed',CS.fav);renderCharList()}
  else if(d.rnd!==undefined){const l=charList();if(l.length)location.hash=l[Math.floor(Math.random()*l.length)].id}
  else if(d.ctab){store.set('pa-ctab',d.ctab);render()}
  else if(d.spoil){store.set('pa-spoil-'+d.spoil,true);render()}
  else if(d.fav){FAV.has(d.fav)?FAV.delete(d.fav):FAV.add(d.fav);saveFav();render()}
  else if(d.scmemo){const k='sc:'+d.scmemo;RV[k]={...(RV[k]||{}),memo:$('#scmemo').value.trim()};saveRV();toast('메모를 저장했어요')}
  else if(d.card){shareCard(chars[d.card]).catch(()=>toast('카드를 만들지 못했어요'))}
  else if(d.pick){const id=d.pick;const L=PICKS.includes(id)?PICKS.filter(x=>x!==id):[...PICKS,id].slice(-6);t.disabled=true;api('pickset',{ids:L}).then(j=>{if(!j.ok)throw 0;PICKS=j.picks;toast(PICKS.includes(id)?'첫 화면 추천에 넣었어요':'추천에서 뺐어요');render()}).catch(()=>{t.disabled=false;toast('저장하지 못했어요')})}
  else if(d.cover!==undefined){const L=lbList(LB.c),src=L[LB.i+1][0];t.disabled=true;setCover(LB.c,src).then(()=>{toast('대표 그림으로 정했어요');lbShow();render()}).catch(()=>{t.disabled=false;toast('저장하지 못했어요. 관리자로 다시 로그인해 주세요')})}
  else if(d.login!==undefined){loginOpen()}
  else if(d.share){const u=location.href.split('#')[0]+'#'+d.share;(navigator.clipboard?.writeText(u)||Promise.reject()).then(()=>toast('링크를 복사했어요'),()=>toast(u))}
  else if(d.searchfor){openSearch(d.searchfor)}
  else if(d.dice){const c=chars[d.dice],r=diceRows(c);try{localStorage.setItem('pa-dice-import',JSON.stringify({id:c.id,name:c['이름'],checks:r.ok,skipped:r.skipped}))}catch{} location.href='dice.html'}
  else if(d.inbtab){INB.tab=d.inbtab;INB.sel=null;saveINB();document.querySelectorAll('[data-inbtab]').forEach(x=>x.setAttribute('aria-selected',x===t));renderInbox()}
  else if(d.inbsel){INB.sel=d.inbsel;saveINB();document.querySelectorAll('.inb-row').forEach(x=>x.setAttribute('aria-current',x===t));renderInbEditor();if(!matchMedia('(min-width:900px)').matches)$('#inbEdit').scrollIntoView({block:'start'})}
  else if(d.inbnav){const l=inbFiltered(),i=l.findIndex(x=>x.key===INB.sel),n=l[i+(+d.inbnav)];if(n){INB.sel=n.key;saveINB();renderInbox()}}
  else if(d.inbact){inbAct(d.inbact)}
  else if(d.rev){RV['rev:'+d.rev]={text:$('#rev-'+d.rev).value.trim(),vis:$('#revv-'+d.rev).value};saveRV();render();toast('후기를 저장했어요')}
  else if(d.lbopen){lbOpen(d.lbopen,+d.i)}
  else if(d.lb){if(d.lb==='x')$('#lb').close();else lbStep(+d.lb)}
});
// 그림 크게 보기: 대표 그림(-1) + 앨범을 넘겨 가며
let LB={c:null,i:-1};
function lbList(c){const L=[[c.img0||c.img,'원래 대표 그림']];(c['앨범']||[]).forEach(a=>{if(!L.some(x=>x[0]===a[0]))L.push(a)});return L.filter(x=>x[0])}
function lbShow(){const L=lbList(LB.c),x=L[LB.i+1];$('#lbImg').src=x[0];$('#lbImg').alt=x[1]||'';$('#lbCap').textContent=`${LB.c['이름']} · ${x[1]||''} (${LB.i+2}/${L.length})`;const cb=$('#lbCover');cb.hidden=!isAdmin();const on=x[0]===LB.c.img;cb.disabled=on;cb.textContent=on?'★ 대표 그림':'대표로 정하기'}
function lbOpen(id,i){const c=chars[id];if(i===-1){const k=lbList(c).findIndex(x=>x[0]===c.img);i=k>0?k-1:-1}LB={c,i};lbShow();$('#lb').showModal()}
function lbStep(k){const n=lbList(LB.c).length;LB.i=((LB.i+1+k+n)%n)-1;lbShow()}
$('#lb').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')lbStep(-1);if(e.key==='ArrowRight')lbStep(1)});
$('#lb').addEventListener('click',e=>{if(e.target.id==='lb')$('#lb').close()});
// 목록 ↔ 상세: 검색 조건과 스크롤 자리를 기억
const SCROLL={};let curHash=location.hash;
window.addEventListener('hashchange',()=>{
  SCROLL[curHash]=window.scrollY; curHash=location.hash;
  ['#searchDlg','#lb'].forEach(x=>{const d=$(x);if(d&&d.open)d.close()});
  const h=location.hash.slice(1);
  render();
  const y=listPages.has(h)?SCROLL[location.hash]:0;
  window.scrollTo(0,y||0);
});
// 통합 검색: 이름·번호·날짜·시나리오·태그·캠페인·추억(앨범 설명)
const dlg=$('#searchDlg'), q=$('#q'), sres=$('#sres');
function search(){
  const v=q.value.trim().toLowerCase(); if(!v){sres.innerHTML='<p class="locked" style="padding:8px 16px">이름, 세션 번호, 날짜(2022, 2022.10), 시나리오, 직업, 시대, 캠페인으로 찾아요.</p>';return}
  const hit=(...xs)=>xs.some(s=>String(s??'').toLowerCase().includes(v));
  const cs=D.characters.filter(c=>hit(c['이름'],c['직업'],c['시대'],c['서가'],c['원어/별명'],...(c['시나리오']||[])));
  const ss=D.sessions.filter(s=>hit(s.title,s.no,dateText(s.date,true),s.date?.v,camp[s.campaignId]?.title,...(s.pcs||[]).map(pcName))||(canSeeSummary(s)&&hit(shownSum(s))));
  const scs=D.scenarios.filter(s=>hit(s.title,s.rule,s.era,camp[s.campaignId]?.title));
  const mem=D.characters.flatMap(c=>(c['앨범']||[]).filter(([,cap])=>hit(cap)).map(([,cap])=>({c,cap})));
  sres.innerHTML=(cs.length?`<h6>CHARACTER</h6>${cs.map(c=>`<a href="#${c.id}">${esc(c['이름'])}<small>${esc(c['서가']||'')} · ${esc(c['직업']||'')}</small></a>`).join('')}`:'')
   +(ss.length?`<h6>SESSION</h6>${ss.slice(0,30).map(s=>`<a href="#${s.id}">${s.no!=null?s.no+'. ':''}${esc(s.title)}<small>${dateText(s.date,true)}</small></a>`).join('')}`:'')
   +(scs.length?`<h6>SCENARIO</h6>${scs.map(s=>`<a href="#${s.id}">${esc(s.title)}<small>${esc(s.rule)}</small></a>`).join('')}`:'')
   +(mem.length?`<h6>MEMORY</h6>${mem.map(m=>`<a href="#${m.c.id}">${esc(m.cap)}<small>${esc(m.c['이름'])} 앨범</small></a>`).join('')}`:'')
   ||'<p class="locked" style="padding:8px 16px">찾는 것이 없어요.</p>';
}
function openSearch(v){dlg.showModal();q.value=v||'';search();q.focus()}
$('#searchBtn').addEventListener('click',()=>openSearch(''));
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch(q.value)}});
q.addEventListener('input',search);
sres.addEventListener('click',e=>{if(e.target.closest('a'))dlg.close()});
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});

const NAMES=['sessions','scenarios','campaigns','meta','playthroughs'];
// 공개 데이터 스키마(schema 2): summary·ending은 승인된 글(문자열)만, playthrough.status는 대장이 확인한 것만 들어 있다.
function normalize(D){
  D.sessions.forEach(s=>{
    if(typeof s.summary==='string') s.summary={text:s.summary,status:'approved'};
    if(typeof s.ending==='string') s.ending={text:s.ending,status:'approved',vis:'공개'};
    s.pcs=s.pcs||[];
  });
  D.playthroughs.forEach(p=>{if(!p.by)p.by=p.status&&p.status!=='미확인'?'대장 확인':'AI 추정'});
  D.scenarios.forEach(sc=>{if(sc.sourceSure==null&&sc.source==='자작')sc.sourceSure=true});
  const base=D.meta.charImgBase||'';
  D.characters=(D.characters||[]).filter(c=>c&&c.id&&c['이름']).map(c=>({...c,img:c.img?base+c.img:'',['앨범']:(c['앨범']||[]).map(([p,cap])=>[base+p,cap])}));
  D.meta.totalsReal={characters:D.characters.length};
  return D;
}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();login($('#pw').value)});
document.querySelector('[data-logindlg-close]').addEventListener('click',()=>$('#loginDlg').close());
$('#fxSel').value=store.get('fx','first');$('#fxSel').addEventListener('change',e=>store.set('fx',e.target.value));
function fail(err){$('#view').innerHTML=`<p class="empty" style="margin-top:20px">서고 자료를 읽지 못했어요 (${esc(err.message||err)}). 잠시 뒤 새로고침해 보세요.</p>`}
Promise.all(NAMES.map(n=>fetch(`data/${n}.json`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(n+'.json');return r.json()})))
 .then(a=>{const d=Object.fromEntries(NAMES.map((n,i)=>[n,a[i]]));
   return fetch(d.meta.charactersUrl,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('캐릭터 서고');return r.json()}).then(c=>{d.characters=c;return d})})
 .then(d=>{D=normalize(d);idx();const to=tokObj();setRole(to?(to.role==='friend'?'friend':'admin'):'visitor');render();syncServer()})
 .catch(fail);
})();
