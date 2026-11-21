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
  await p.click('[data-ctab="연대기"]'); await p.waitForTimeout(100); const ch=await text(); ok('연대기: 세션 기록 + 기존 기록 합침',ch.includes('기존 서고 기록')&&ch.includes('세션 기록'));
  await p.click('[data-ctab="앨범"]'); await p.waitForTimeout(100); ok('앨범 그림 주소가 캐릭터 서고 쪽',(await p.$eval('.album img',e=>e.getAttribute('src'))).startsWith('/Character_Archive/'));
  const imgOk=await p.$eval('.album img',e=>e.complete&&e.naturalWidth>0); ok('앨범 그림이 실제로 열림',imgOk);
  await p.click('[data-ctab="인물"]');
  await p.click('[data-fav="coc-044"]'); ok('즐겨찾기가 캐릭터 서고와 같은 fav 칸',(await p.evaluate(()=>localStorage.getItem('fav'))).includes('coc-044'));
  await go('uw-030'); await p.click('[data-ctab="시트"]'); await p.waitForTimeout(100); ok('UW 시트: 판정·가방',(await text()).includes('판정')&&(await text()).includes('가방'));
  await go('sessions'); ok('세션 탐색기',(await p.$$eval('#slist .srow',e=>e.length))>5);
  await p.fill('#f-q','가면'); await p.waitForTimeout(100); ok('세션 검색',(await p.textContent('#slist')).includes('가면'));
  await p.click('[data-sqreset]'); await p.waitForTimeout(100);
  await go('s-130'); const s130=await text(); ok('세션 상세: 승인 안 된 요약·결말 없음',s130.includes('요약을 검토하고 있어요')||s130.includes('요약 없음')); ok('세션 상세: 날짜 추정 표시',s130.includes('추정'));
  await go('sc-masks'); ok('시나리오 상세 회차',(await text()).includes('1회차')&&(await text()).includes('2회차'));
  await go('scenarios'); ok('시나리오 서고',(await p.$$eval('.scard',e=>e.length))===15);
  await go('memory'); const mg=await p.$$eval('.gallery .ccard',e=>e.length); ok('추억관 앨범은 캐릭터별 '+mg+'명',mg>10);
  await p.click('.gallery [data-lbopen]'); await p.waitForTimeout(100); ok('앨범 넘겨 보기',await p.evaluate(()=>document.querySelector('#lb').open)); await p.keyboard.press('Escape');
  ok('추모관에 로스트 캐릭터',(await p.$$eval('.memoriam .pc',e=>e.length))>0);
  await go('journey'); ok('발자취',(await text()).includes('년의 모험'));
  await go('journey/2022'); ok('연도 주소',(await text()).includes('2022년의 모험'));
  await go('inbox'); ok('작업함은 방문객에게 닫힘',(await text()).includes('관리자 화면이에요'));
  await p.keyboard.press('Control+k'); await p.fill('#q','195'); await p.waitForTimeout(100); ok('통합 검색 번호',(await p.textContent('#sres')).includes('트라이앵글')); await p.keyboard.press('Escape');
  // Oracle Dice: 서고 → 주사위 → 다시 가져오기(합치기) → 서고로 돌아가기
  await go('uw-030'); await p.click('[data-dice="uw-030"]'); await p.waitForSelector('dialog[open] [data-m="add"]'); ok('주사위로 넘어감 · 못 가져온 판정 표시',(await p.textContent('dialog[open]')).includes('가져오지 못했어요'));
  await p.click('dialog[open] [data-m="add"]'); await p.waitForTimeout(150);
  ok('주사위 → 서고 돌아가기 링크',(await p.getAttribute('.pa-back','href')).endsWith('#uw-030'));
  await p.click('.pa-back'); await p.waitForSelector('main#view > *'); await p.click('[data-dice="uw-030"]'); await p.waitForSelector('dialog[open] [data-m="merge"]'); ok('같은 캐릭터 다시: 합치기 고르기',true);
  await p.click('dialog[open] [data-m="merge"]'); await p.waitForTimeout(150);
  ok('합쳐도 캐릭터 하나',await p.evaluate(()=>JSON.parse(localStorage.getItem('uw-dice-roller-v1')).characters.filter(c=>c.paId==='uw-030').length===1));
  // 휴대폰 폭
  for(const w of [390,360]){const m=await b.newContext({viewport:{width:w,height:800}});await serve(m);const mp=await m.newPage();mp.on('pageerror',e=>errs.push(w+':'+e.message));
    for(const h of ['','sessions','characters','coc-044','memory','journey','s-195-3']){await mp.goto(HOST+'/'+(h?'#'+h:''));await mp.waitForSelector('main#view > *');await mp.waitForTimeout(100);
      const ov=await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1); if(ov) ok(`${w}px 가로 넘침 ${h||'처음'}`,false);}
    ok(`${w}px 화면 7개 가로 넘침 없음`,true); if(process.env.SHOTS){await mp.goto(HOST+'/#characters');await mp.waitForTimeout(400);await mp.screenshot({path:process.env.SHOTS+`/m${w}-characters.png`})} await m.close();}
  if(process.env.SHOTS){for(const h of ['','characters','coc-044','memory']){await go(h);await p.waitForTimeout(400);await p.screenshot({path:process.env.SHOTS+`/pc-${h||'home'}.png`})}}
  ok('페이지 오류 없음 '+JSON.stringify(errs),errs.length===0);
  console.log(R.join('\n')); const f=R.filter(x=>x.startsWith('FAIL')).length; console.log(`${R.length-f}/${R.length} 통과`); await b.close(); process.exit(f?1:0);
})();
