// 방문객 화면 시험: 공개 데이터(data/*.json)와 캐릭터 서고 데이터만으로 모든 화면이 도는지 본다.
//   CA_DIR=<Character_Archive 체크아웃 경로> node tests/site.test.js
// 브라우저 요청을 가로채 https://praypeace.github.io/ 아래 주소를 이 저장소와 CA_DIR 파일로 돌려준다(서버 필요 없음).
const {chromium}=require('playwright');
const path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..'), CA=process.env.CA_DIR;
if(!CA){console.error('CA_DIR가 필요해요');process.exit(2)}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const HOST='https://praypeace.github.io';
async function serve(ctx){
  await ctx.route(HOST+'/**',route=>{
    let p=decodeURIComponent(new URL(route.request().url()).pathname);
    const file=p.startsWith('/Character_Archive/')?path.join(CA,p.slice('/Character_Archive/'.length)):path.join(ROOT,p==='/'?'index.html':p.slice(1));
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory()) return route.fulfill({status:404,body:'not found'});
    route.fulfill({status:200,contentType:TYPES[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,body:''}));
  await ctx.route(/script\.google\.com/,r=>webapp(r));
}
// 웹 앱 흉내: 실제 서버 대신 같은 모양의 답을 준다
const WA={rv:{'sum:s-130':{st:'ok',pub:'승인된 요약 시험'}},calls:[],cover:{},picks:[]};
function webapp(route){
  const u=new URL(route.request().url()), j=o=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
  if(route.request().method()==='GET'){const op=u.searchParams.get('op');
    if(op==='covers')return j({ok:true,cover:WA.cover,picks:WA.picks});
    if(op==='pa_pub')return j({ok:true,sum:{'s-130':'승인된 요약 시험'},end:{},pt:{'pt-angel-1':{status:'완주',endedAt:'2022-10-10'}},rev:{},sc:{'sc-angel':{owned:true,wish:false,prep:false}},rate:{'pt-angel-1':{work:4,play:5}},mem:{'m-001':{sessionId:'s-130',kind:'dice',who:'세켈 콜트레인',text:'공개 추억 시험'}}});
    return j({ok:false})}
  const q=JSON.parse(route.request().postData()||'{}');WA.calls.push(q.op);
  if(q.op==='login')return j(q.pw==='admin'?{ok:true,token:'T',exp:Date.now()+1e9,role:'admin'}:q.pw==='friend'?{ok:true,token:'F',exp:Date.now()+1e9,role:'friend'}:{ok:false});
  const role=q.token==='T'?'admin':q.token==='F'?'friend':null; if(!role)return j({ok:false,error:'auth'});
  if(q.op==='whoami')return j({ok:true,role});
  if(q.op==='sessions')return j({ok:true,sessions:[{'번호':'130','KP':'시험키퍼','PL':'시험플레이어','대장PC':'세켈','녹화':'있음','영상':'1부 https://youtu.be/x','링크':'https://drive.google.com/x'}]});
  if(q.op==='fav')return j({ok:true,fav:['coc-017']});
  if(q.op==='pa_view')return j({ok:true,sum:{'s-130':'승인된 요약 시험'},end:{'s-130':'친구 결말 시험'},pt:{},rev:{},mem:{'m-001':{sessionId:'s-130',kind:'dice',who:'',text:'공개 추억 시험'},'m-002':{sessionId:'s-130',kind:'laugh',who:'',text:'친구 추억 시험'}}});
  if(role!=='admin')return j({ok:false,error:'role'});
  if(q.op==='pa_get')return j({ok:true,rv:WA.rv,priv:{sessions:{'s-130':{summary:{text:'초안 요약 시험',status:'draft',by:'AI'},ending:{text:'비공개 결말 시험',status:'draft',vis:'비공개'},notes:'관리 메모 시험'}},playthroughs:{},memories:{'m-002':{sessionId:'s-130',kind:'laugh',who:'',text:'친구 추억 시험',friends:true},'m-003':{sessionId:'s-130',kind:'quote',who:'세켈 콜트레인',text:'대사 후보 시험',friends:false}}}});
  if(q.op==='pa_set'){WA.rv=q.rv;return j({ok:true})}
  if(q.op==='pickset'){WA.picks=q.ids;return j({ok:true,picks:q.ids})}
  if(q.op==='coverset'){WA.cover[q.id]=q.src;return j({ok:true,cover:WA.cover})}
  if(q.op==='favset'||q.op==='logout')return j({ok:true});
  return j({ok:false});
}
(async()=>{
  const b=await chromium.launch(), R=[], errs=[];
  const ok=(n,c)=>R.push((c?'PASS ':'FAIL ')+n);
  const ctx=await b.newContext({viewport:{width:1400,height:900}}); await serve(ctx);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});
  const go=async h=>{await p.goto(HOST+'/'+(h?'#'+h:''));await p.waitForSelector('main#view > *');await p.waitForTimeout(150)};
  const text=()=>p.textContent('main');
  await go('');
  ok('처음 화면 + 캐릭터 수',(await text()).includes('THE PRAYPEACE ARCHIVES')&&/1\d\d/.test(await p.textContent('.stats')));
  ok('관리자 메뉴 숨김',await p.$$eval('nav.menu a[data-admin]',a=>a.every(x=>x.hidden)));
  ok('시험판 보기 전환 없음',!(await p.$('#roleSel')));
  await go('characters');
  const n=await p.$$eval('#clist .ccard',e=>e.length); ok('캐릭터 전부 '+n+'명',n>=170);
  await p.selectOption('[data-cs="st"]','lost'); await p.waitForTimeout(100);
  const lost=await p.$$eval('#clist .ccard',e=>e.length); ok('로스트·사망 필터 '+lost+'명',lost>0&&lost<n);
  await p.selectOption('[data-cs="st"]',''); await p.selectOption('[data-cs="sort"]','name'); await p.waitForTimeout(100);
  const names=await p.$$eval('#clist .ccard b',e=>e.slice(0,5).map(x=>x.textContent)); ok('이름 순 정렬 '+names.join(','),[...names].sort((a,b)=>a.localeCompare(b,'ko')).join()===names.join());
  await p.click('[data-shelf="UW"]'); await p.waitForTimeout(100); const uw=await p.$$eval('#clist .ccard',e=>e.length); ok('UW 서가 '+uw+'명',uw>20&&uw<n);
  await p.click('[data-shelf=""]'); await p.fill('#cq','신은총'); await p.waitForTimeout(100); ok('캐릭터 찾기',(await p.$$eval('#clist .ccard',e=>e.length))>=1);
  await p.fill('#cq',''); await p.selectOption('[data-cs="sort"]','img');
  await go('coc-044');
  ok('캐릭터 상세 인물 탭',(await text()).includes('초등교사'));
  await p.click('[data-ctab="시트"]'); await p.waitForTimeout(100); const sh=await text(); ok('CoC 시트: 특성치 1/2·1/5',sh.includes('값 · 1/2 · 1/5')&&sh.includes('25 · 10'));
  ok('CoC 시트: 무기 표',(await p.$$('table.wp')).length>=1);
  await p.click('[data-ctab="연대기"]'); await p.waitForTimeout(100); const ch=await text(); ok('연대기: 세션 기록에서 나옴',ch.includes('세션 기록'));
  await p.click('[data-ctab="앨범"]'); await p.waitForTimeout(100); ok('앨범 그림 주소가 캐릭터 서고 쪽',(await p.$eval('.album img',e=>e.getAttribute('src'))).startsWith('/Character_Archive/'));
  const imgOk=await p.$eval('.album img',e=>e.complete&&e.naturalWidth>0); ok('앨범 그림이 실제로 열림',imgOk);
  await p.click('[data-ctab="인물"]');
  await p.click('[data-fav="coc-044"]'); ok('즐겨찾기가 캐릭터 서고와 같은 fav 칸',(await p.evaluate(()=>localStorage.getItem('fav'))).includes('coc-044'));
  await go('uw-030'); await p.click('[data-ctab="시트"]'); await p.waitForTimeout(100); ok('UW 시트: 판정·가방',(await text()).includes('판정')&&(await text()).includes('가방'));
  await go('sessions'); ok('세션 탐색기',(await p.$$eval('#slist .srow',e=>e.length))>5);
  await p.fill('#f-q','가면'); await p.waitForTimeout(100); ok('세션 검색',(await p.textContent('#slist')).includes('가면'));
  await p.click('[data-sqreset]'); await p.waitForTimeout(100);
  await go('s-130'); await p.waitForTimeout(300); const s130=await text(); ok('세션 상세: 서버가 승인한 요약은 보임',s130.includes('승인된 요약 시험')); ok('세션 상세: 초안·결말·메모 없음',!s130.includes('초안 요약')&&!s130.includes('결말 시험')&&!s130.includes('관리 메모')); ok('세션 상세: 날짜 추정 표시',s130.includes('추정'));
  ok('방문객: 함께한 사람 숨김',!s130.includes('시험키퍼')&&s130.includes('로그인하면'));
  await go('sc-angel'); const ang=await text(); ok('서버가 확정한 회차 완주',ang.includes('완주'));
  ok('방문객: 보유 표시·평점 보임',ang.includes('보유')&&ang.includes('★★★★☆')&&ang.includes('★★★★★')); ok('방문객: 관리자 입력 칸 없음',!(await p.$('[data-scmark]')));
  await go(''); ok('처음 화면 한 줄들(최근 추가)',(await p.textContent('ul.today')).includes('최근 추가'));
  await go('journey/2021'); const yb=await text(); ok('연감: 새로 만난 캐릭터',yb.includes('새로 만난 캐릭터')&&yb.includes('작별한 인물'));
  await go('sc-masks'); ok('시나리오 상세 회차',(await text()).includes('1회차')&&(await text()).includes('2회차'));
  await go('scenarios'); const nsc=await p.$$eval('#sclist .scard',e=>e.length); ok('시나리오 서고 전체 '+nsc+'곳',nsc>=200);
  await p.click('[data-scrule="UW"]'); await p.waitForTimeout(100); const nuw=await p.$$eval('#sclist .scard',e=>e.length); ok('시나리오 룰 고르기 UW '+nuw,nuw>10&&nuw<nsc);
  await p.click('[data-scrule=""]'); await p.click('[data-sctag="여러 번 한 판"]'); await p.waitForTimeout(100); ok('여러 번 한 판 조건',(await p.textContent('#sclist')).includes('경성'));
  await p.click('[data-sctag=""]'); await p.fill('#scq','신은총'); await p.waitForTimeout(100); ok('시나리오를 캐릭터 이름으로 찾기',(await p.$$eval('#sclist .scard',e=>e.length))>=2);
  await p.fill('#scq',''); await p.selectOption('[data-scs="sort"]','many'); await p.waitForTimeout(100); ok('세션 많은 순 첫 칸 트라이앵글',(await p.textContent('#sclist .scard b')).includes('트라이앵글'));
  await p.selectOption('[data-scs="sort"]','recent');
  await go('player'); const pt=await text(); ok('플레이어 서고',pt.includes('플레이어 서고')&&pt.includes('숫자로 본 특징')&&(await p.$$('ul.bars li')).length>20);
  ok('플레이어 서고에 키퍼 세션',pt.includes('암펠스크'));
  await go('memory'); const mg=await p.$$eval('.gallery .ccard',e=>e.length); ok('추억관 앨범은 캐릭터별 '+mg+'명',mg>10);
  await p.click('.gallery [data-lbopen]'); await p.waitForTimeout(100); ok('앨범 넘겨 보기',await p.evaluate(()=>document.querySelector('#lb').open)); await p.keyboard.press('Escape');
  ok('추모관에 로스트 캐릭터',(await p.$$eval('.memoriam .pc',e=>e.length))>0);
  await go('journey'); ok('발자취',(await text()).includes('년의 모험'));
  await go('journey/2022'); ok('연도 주소',(await text()).includes('2022년의 모험'));
  await go('memory'); {const t=await text(); ok('방문객: 승인한 추억만 추억관에',t.includes('공개 추억 시험')&&!t.includes('친구 추억 시험'))}
  await go('inbox'); ok('작업함은 방문객에게 닫힘',(await text()).includes('관리자 화면이에요'));
  await p.keyboard.press('Control+k'); await p.fill('#q','195'); await p.waitForTimeout(100); ok('통합 검색 번호',(await p.textContent('#sres')).includes('트라이앵글')); await p.keyboard.press('Escape');
  // Oracle Dice: 서고 → 주사위 → 다시 가져오기(합치기) → 서고로 돌아가기
  await go('uw-030'); await p.click('[data-dice="uw-030"]'); await p.waitForSelector('dialog[open] [data-m="add"]'); ok('주사위로 넘어감 · 못 가져온 판정 표시',(await p.textContent('dialog[open]')).includes('가져오지 못했어요'));
  await p.click('dialog[open] [data-m="add"]'); await p.waitForTimeout(150);
  ok('주사위 → 서고 돌아가기 링크',(await p.getAttribute('.pa-back','href')).endsWith('#uw-030'));
  await p.click('.pa-back'); await p.waitForSelector('main#view > *'); await p.click('[data-dice="uw-030"]'); await p.waitForSelector('dialog[open] [data-m="merge"]'); ok('같은 캐릭터 다시: 합치기 고르기',true);
  await p.click('dialog[open] [data-m="merge"]'); await p.waitForTimeout(150);
  ok('합쳐도 캐릭터 하나',await p.evaluate(()=>JSON.parse(localStorage.getItem('uw-dice-roller-v1')).characters.filter(c=>c.paId==='uw-030').length===1));
  // 캐릭터 서고에서 옮긴 것
  await go('coc-044'); await p.click('[data-ctab="인물"]'); await p.waitForTimeout(100); const c44=await text(); ok('이전/다음 단추',!!(await p.$('.cnav a.btn.sm'))); let relN=0; for(const id of ['coc-002','coc-003','coc-017','uw-030','coc-038','etc-007']){await go(id);if((await text()).includes('관련 인물'))relN++} ok('관련 인물 '+relN+'/6명',relN>=2); await go('coc-044');
  ok('소개 카드 단추',!!(await p.$('[data-card="coc-044"]'))); ok('방문객에겐 추천 단추 없음',!(await p.$('[data-pick]')));
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('[data-card="coc-044"]')]); const png=fs.readFileSync(await dl.path()); ok('소개 카드 PNG 내려받기 '+png.length+'바이트',png.slice(1,4).toString()==='PNG'&&png.length>20000);
  await go(''); ok('처음 화면 전시',(await p.$$('.picks .pick')).length>=3);
  ok('메뉴 PLAYER',!!(await p.$('nav.menu a[href="#player"]')));
  // 친구 로그인
  await p.click('#loginBtn'); await p.fill('#pw','friend'); await Promise.all([p.waitForNavigation(),p.click('#loginForm [type=submit]')]); await p.waitForSelector('main#view > *'); await p.waitForTimeout(400);
  ok('친구 로그인 표시',(await p.textContent('#loginBtn')).includes('친구'));
  await go('s-130'); await p.waitForTimeout(200); const f130=await text(); ok('친구: 함께한 사람·녹화 보임',f130.includes('시험키퍼')&&f130.includes('한글 파일 열기')); ok('친구: 친구 범위 결말 보임',f130.includes('친구 결말 시험')); ok('친구: 초안·메모 안 보임',!f130.includes('초안 요약')&&!f130.includes('관리 메모'));
  await go('memory'); ok('친구: 친구 범위 추억도 보임',(await text()).includes('친구 추억 시험'));
  await go('inbox'); ok('친구: 작업함 닫힘',(await text()).includes('관리자 화면이에요'));
  await p.click('#loginBtn'); await p.waitForNavigation(); await p.waitForSelector('main#view > *');
  ok('로그아웃',(await p.textContent('#loginBtn')).includes('로그인')&&!(await p.evaluate(()=>localStorage.getItem('tok'))));
  // 관리자 로그인
  await p.click('#loginBtn'); await p.fill('#pw','admin'); await Promise.all([p.waitForNavigation(),p.click('#loginForm [type=submit]')]); await p.waitForSelector('main#view > *'); await p.waitForTimeout(500);
  ok('관리자 메뉴 보임',await p.$$eval('nav.menu a[data-admin]',a=>a.every(x=>!x.hidden)));
  await go('s-130'); await p.waitForTimeout(200); const a130=await text(); ok('관리자: 초안·관리 메모 보임',a130.includes('초안 요약 시험')&&a130.includes('관리 메모 시험'));
  await go('inbox'); await p.waitForTimeout(300); ok('관리자: 작업함 열림',(await p.$$('[data-inbtab]')).length>0);
  await p.click('[data-inbtab="end"]'); await p.waitForTimeout(100); await p.click('[data-inbsel="end:s-130"]'); await p.selectOption('#inbVis','친구'); await p.click('[data-inbact="approve"]'); await p.waitForTimeout(1000);
  ok('관리자: 승인이 서버에 저장됨',WA.rv['end:s-130']&&WA.rv['end:s-130'].vis==='친구'&&WA.rv['sum:s-130']);
  await p.click('[data-inbtab="scene"]'); await p.waitForTimeout(100); await p.click('[data-inbsel="mem:m-002"]');
  ok('관리자: 친구 장면은 친구 범위만',(await p.$$eval('#inbVis option',o=>o.map(x=>x.value))).join()==='친구');
  await p.fill('#inbText','고친 추억 시험'); await p.click('[data-inbact="approve"]'); await p.waitForTimeout(900);
  ok('관리자: 추억 승인 저장',WA.rv['mem:m-002']&&WA.rv['mem:m-002'].st==='ok'&&WA.rv['mem:m-002'].vis==='친구'&&WA.rv['mem:m-002'].text==='고친 추억 시험');
  await go('memory'); await p.waitForTimeout(400); {const t=await text(); ok('관리자: 승인한 것만 추억관에',t.includes('고친 추억 시험')&&!t.includes('대사 후보 시험'))}
  await go('sc-yeolgae'); await p.check('[data-scmark="wish"]'); await p.waitForTimeout(900); ok('관리자: 하고 싶음 저장',WA.rv['sc:sc-yeolgae']&&WA.rv['sc:sc-yeolgae'].wish===true);
  await p.fill('#scmemo','개변 시험'); await p.click('[data-scmemo]'); await p.selectOption('[data-rate="pt-yeolgae-1"][data-k="work"]','3'); await p.waitForTimeout(900);
  ok('관리자: 개변 메모·평점 저장',WA.rv['sc:sc-yeolgae'].memo==='개변 시험'&&WA.rv['rate:pt-yeolgae-1'].work===3);
  await go('coc-044'); await p.click('[data-pick="coc-044"]'); await p.waitForTimeout(300); ok('관리자: 첫 화면 추천 저장',WA.picks.includes('coc-044'));
  await p.click('.cd img.portrait'); await p.waitForTimeout(150); await p.click('[data-lb="1"]'); await p.click('#lbCover'); await p.waitForTimeout(300); ok('관리자: 대표 그림 저장',!!WA.cover['coc-044']); await p.keyboard.press('Escape');
  await go(''); ok('추천이 처음 화면에',(await p.textContent('.picks')).includes('서고지기의 추천'));
  ok('관리자 즐겨찾기는 서버 것(ofav)',(await p.evaluate(()=>localStorage.getItem('ofav'))).includes('coc-017'));
  await p.evaluate(()=>localStorage.removeItem('tok'));
  // 휴대폰 폭
  for(const w of [390,360]){const m=await b.newContext({viewport:{width:w,height:800}});await serve(m);const mp=await m.newPage();mp.on('pageerror',e=>errs.push(w+':'+e.message));
    for(const h of ['','sessions','characters','coc-044','memory','journey','s-195-3','scenarios','player','sc-masks']){await mp.goto(HOST+'/'+(h?'#'+h:''));await mp.waitForSelector('main#view > *');await mp.waitForTimeout(100);
      const ov=await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1); if(ov) ok(`${w}px 가로 넘침 ${h||'처음'}`,false);}
    ok(`${w}px 화면 10개 가로 넘침 없음`,true); if(process.env.SHOTS){await mp.goto(HOST+'/#characters');await mp.waitForTimeout(400);await mp.screenshot({path:process.env.SHOTS+`/m${w}-characters.png`})} await m.close();}
  if(process.env.SHOTS){for(const h of ['','characters','coc-044','memory','scenarios','player','sc-masks']){await go(h);await p.waitForTimeout(400);await p.screenshot({path:process.env.SHOTS+`/pc-${h||'home'}.png`})}}
  ok('페이지 오류 없음 '+JSON.stringify(errs),errs.length===0);
  console.log(R.join('\n')); const f=R.filter(x=>x.startsWith('FAIL')).length; console.log(`${R.length-f}/${R.length} 통과`); await b.close(); process.exit(f?1:0);
})();
