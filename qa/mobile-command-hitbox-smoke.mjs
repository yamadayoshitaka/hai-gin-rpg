import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const cssFromHtml=path=>{
 const html=readFileSync(path,'utf8');
 const match=html.match(/<style>([\s\S]*?)<\/style>/);
 assert.ok(match,path+' lacks inline styles');
 return match[1];
};
const innCss=cssFromHtml('town-hub.html');
const battleCss=cssFromHtml('tactics-wireframe.html');
const common=readFileSync('src/tactical-command-ui.css','utf8')+'\n'+
 readFileSync('src/battle-ui-refinement.css','utf8');
const viewportCases=[{width:360,height:640},{width:412,height:915}];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
try{
 for(const viewport of viewportCases){
  const page=await browser.newPage({viewport,isMobile:true,hasTouch:true});
  try{
   const innCells=Array.from({length:12},(_,i)=>
    '<button data-slot="'+i+'" class="innDeploymentCell"><strong>第'+(i+1)+'隊</strong><small>隊配置を変更</small></button>').join('');
   const innMarkup=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${innCss}</style><style>${common}</style></head>
    <body><section id="panel" class="formation-command-ui" role="dialog">
    <div class="toprow"><h2>宿屋・隊列設定</h2><button id="panelClose">閉じる</button></div>
    <div class="stats"><div>軍師</div><div>隊列</div></div>
    <div id="panelContent">
    <div class="innCommandHeading"><strong>戦場の勝利条件と作戦</strong><small>隊列を見渡して編集</small></div>
    <nav class="innPageNav">${['軍議','配置','作戦','部隊','雇用'].map(t=>'<button>'+t+'</button>').join('')}</nav>
    <section class="innPage" data-inn-page="deployment">
    <div class="innDeploymentGuide"><strong>部隊配置</strong><small>前衛・中衛・後衛・本陣</small></div>
    <div class="innDeploymentBoard">${innCells}</div>
    <div class="innDeploymentFoot">中央の橋　前衛・後衛・本陣　全軍を選択
      <small>画面の低い端末でもマスをタップして配置を変更できます。</small></div>
    </section></div><div id="toast">利用可能</div></section>
    <script>document.addEventListener('click',e=>{if(e.target.closest('[data-slot]'))window.clickedSlot=e.target.closest('[data-slot]').dataset.slot});</script></body></html>`;
   await page.setContent(innMarkup,{waitUntil:'domcontentloaded'});
   await page.locator('[data-slot="11"]').click({timeout:5000});
   const slot=await page.evaluate(()=>({
    clicked:window.clickedSlot,
    viewport:window.innerHeight,
    panelScroll:document.querySelector('#panelContent').scrollTop,
    buttonTop:document.querySelector('[data-slot="11"]').getBoundingClientRect().top,
    buttonBottom:document.querySelector('[data-slot="11"]').getBoundingClientRect().bottom
   }));
   assert.equal(slot.clicked,'11','last formation slot must remain operable on '+viewport.height+'px');
   assert.ok(slot.buttonTop>=0&&slot.buttonBottom<=viewport.height,
    'inn last-slot hitbox must be reachable in phone viewport');
   await page.close();

   const battlePage=await browser.newPage({viewport,isMobile:true,hasTouch:true});
   try{
    const battleMarkup=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${battleCss}</style><style>${common}</style></head>
      <body class="compact-command-dock compact-orders-open">
      <div id="battleTopDock"><strong>戦闘中　隊列を選択</strong></div>
      <div id="squadTactics" data-panel="main">
       <div id="squadOneClickOrders">
        <div class="quickSelectionHeader"><b>指揮中：忍者隊（第3隊）</b><small>8人｜作戦：全滅</small></div>
        <div class="quickTabs"><button>選択</button><button>号令</button><button>道具</button><button>戻る</button></div>
        <div class="quickActions" id="actions">${Array.from({length:8},(_,i)=>
          '<button class="quickDescribedOrder" data-command-index="'+i+'"><b>号令'+(i+1)+'</b><small class="quickCommandEffect">戦術効果の説明</small></button>').join('')}</div>
        <div class="quickPager"><button id="prev">◀ 前</button><span id="state">1 / 2</span><button id="next">次 ▶</button></div>
       </div></div>
       <script>
        let current=0;
        function show(){
         document.querySelectorAll('[data-command-index]').forEach((node,i)=>node.hidden=Math.floor(i/4)!==current);
         document.querySelector('#state').textContent=(current+1)+' / 2';
        }
        document.querySelector('#next').onclick=()=>{current=1;show()};
        document.querySelector('#prev').onclick=()=>{current=0;show()};
        document.querySelectorAll('[data-command-index]').forEach(btn=>btn.onclick=()=>window.clickedOrder=btn.dataset.commandIndex);
        show();
       </script></body></html>`;
    await battlePage.setContent(battleMarkup,{waitUntil:'domcontentloaded'});
    await battlePage.locator('#next').click({timeout:5000});
    await battlePage.locator('[data-command-index="7"]').click({timeout:5000});
    const result=await battlePage.evaluate(()=>({
     clicked:window.clickedOrder,
     label:document.querySelector('.quickSelectionHeader')?.textContent,
     scroll:document.querySelector('#squadTactics')?.scrollTop,
     rect:document.querySelector('[data-command-index="7"]')?.getBoundingClientRect().toJSON(),
     viewport:window.innerHeight
    }));
    assert.equal(result.clicked,'7','last command must be clickable, not clipped');
    assert.ok(result.label.includes('忍者隊（第3隊）'),'selected squad visible in the command dock');
    assert.ok(result.rect.top>=0&&result.rect.bottom<=viewport.height,'last command hitbox within phone viewport');
    console.log('touch layout',viewport,'inn last-slot',slot,'battle last-command',result.clicked);
   }finally{await battlePage.close();}
  }finally{if(!page.isClosed())await page.close();}
 }
}finally{await browser.close()}
console.log('Mobile CSS E2E: formation and all paged orders clickable (360x640 / 412x915)');
