const $=id=>document.getElementById(id),defaults=JSON.parse(JSON.stringify(CONFIG));let cfg={...CONFIG};try{Object.assign(cfg,JSON.parse(localStorage.getItem('division-editable')||'{}'))}catch{}if(!cfg.motionRevision){cfg.loadingStart=CONFIG.loadingStart;}if((cfg.motionRevision||0)<3){cfg.voiceWidth=154;cfg.motionRevision=3;}let t=+(CONFIG.startAt||0),playing=false,base=0,last=0,env=null,url=null,ctx=null,loadId=0;const audio=$('audio');
function arc(r,a,b){b=Math.min(b,a+359.99);const p=d=>[r*Math.cos(d*Math.PI/180),r*Math.sin(d*Math.PI/180)];return `M${p(a)}A${r},${r} 0 ${b-a>180?1:0} 1 ${p(b)}`}
function path(r,a,b,color,w){return `<path d="${arc(r,a,b)}" fill="none" stroke="${color}" stroke-width="${w}"/>`}
$('ticks').innerHTML=Array.from({length:180},(_,i)=>`<path d="M0 -${i%5?199:197}V-207" transform="rotate(${i*2})" stroke="${i%5?'#261d0b':'#49300e'}" stroke-width="${i%5?1.8:2.4}"/>`).join('');
$('outer').innerHTML=path(215,5,170,'#231b0a',1)+path(214,181,350,'#543707',1)+path(178,0,100,'#100e06',19)+path(178,116,220,'#161105',19)+path(178,235,345,'#100e06',19);
$('middle').innerHTML=[-87,33,153].map(a=>path(105,a,a+113,'#2d210d',23)+path(118,a,a+113,'#5c3a0e',1)).join('');
$('inner').innerHTML=path(79,3,245,'#6d4713',2)+path(75,255,358,'#39270b',2)+path(82,-90,-82,'#ded8bf',3)+path(84,20,48,'#b2711c',2);
$('markers').innerHTML=[0,120,240].map(a=>`<g transform="rotate(${a})"><path d="M-10 -165H10M-17 -172v-5h5M17 -172v-5h-5" fill="none" stroke="#77776d" stroke-width="2"/></g>`).join('')+'<path d="M-252 -3l-6 4 6 4M252 -3l6 4-6 4M-4 -235l4-6 4 6" fill="#555"/>';
$('pages').innerHTML=Array.from({length:5},(_,i)=>`<rect x="${1215+i*17}" y="320" width="12" height="13" fill="${i?'#444':'#c77917'}"/>`).join('');
function settings(){for(const [id,key] of [['username','username'],['heading','title'],['body','description']])$(id).value=cfg[key];$('title').textContent=cfg.title;$('description').textContent=cfg.description;$('gap').value=(cfg.voiceY||908)-853}
var tips=(Array.isArray(cfg.tips)&&cfg.tips.length)?cfg.tips:[{title:cfg.title,description:cfg.description}];
var tipIndex=0,lastLoaded=false;
function setTip(i){var it=tips[i]||tips[0]||{};try{$('title').textContent=it.title||'';$('description').textContent=it.description||''}catch(e){}}
function persist(){try{localStorage.setItem('division-editable',JSON.stringify(cfg))}catch{}}
for(const [id,key] of [['username','username'],['heading','title'],['body','description']])$(id).oninput=()=>{cfg[key]=$(id).value;persist();$('title').textContent=cfg.title;$('description').textContent=cfg.description;render()};
$('gap').oninput=()=>{cfg.voiceY=853+ +$('gap').value;persist();render()};
function progress(time){const a=cfg.progress;if(time<=a[0][0])return a[0][1];for(let i=1;i<a.length;i++)if(time<=a[i][0])return a[i-1][1]+(a[i][1]-a[i-1][1])*(time-a[i-1][0])/(a[i][0]-a[i-1][0]);return a.at(-1)[1]}
var __voiceMeasure=null;
function voiceTextWidth(text,fs,ls,weight){
  try{
    var g=$('voice');var svg=g&&g.ownerSVGElement;if(!svg)return String(text||'').length*fs*0.82;
    if(!__voiceMeasure){__voiceMeasure=document.createElementNS('http://www.w3.org/2000/svg','text');__voiceMeasure.setAttribute('opacity','0');__voiceMeasure.setAttribute('x','-4000');__voiceMeasure.setAttribute('y','-4000');svg.appendChild(__voiceMeasure);}
    var m=__voiceMeasure;
    m.setAttribute('font-family',"'DIN Alternate','Bahnschrift','Microsoft YaHei',sans-serif");
    m.setAttribute('font-weight',weight||'700');
    m.setAttribute('letter-spacing',String(ls||0));
    m.setAttribute('font-size',String(fs));
    m.textContent=text||'';
    return m.getComputedTextLength();
  }catch(e){return String(text||'').length*fs*0.82}
}
function renderVoiceRow(g,se,h,sub,visible){
  if(!g)return;
  var baseY=cfg.voiceY,s=(cfg.voiceWidth||520)/1920;
  var iconW=270*s,gap=34*s,dshFs=178*s,dshLs=18*s,barW=4.5*s,barGap=29.2*s,subFs=dshFs,subGap=subFs*2;
  var dshW=voiceTextWidth('DSH',dshFs,dshLs,'700');
  var waveW=19*barGap+barW;
  var subW=sub?voiceTextWidth(sub,subFs,0,'400'):0;
  var total=iconW+gap+dshW+gap+waveW+(subW?gap+subGap+subW:0);
  while(total>1860&&subW&&subFs>dshFs*0.7){subFs-=2*s;subW=voiceTextWidth(sub,subFs,0,'400');total=iconW+gap+dshW+gap+waveW+gap+subGap+subW}
  var x=960-total/2;
  var dshX=x+iconW+gap,waveX=dshX+dshW+gap,subX=waveX+waveW+subGap;
  var bars=h.map(function(v,i){return '<rect x="'+(i*barGap).toFixed(2)+'" y="'+(baseY-(v*s)/2).toFixed(1)+'" width="'+barW.toFixed(2)+'" height="'+(v*s).toFixed(1)+'" rx="'+(1.1*s).toFixed(2)+'" fill="#efeee5"/>'}).join('');
  g.innerHTML='<image href="assets/whale-badge-line.png" x="'+x+'" y="'+(baseY-iconW/2)+'" width="'+iconW+'" height="'+iconW+'" preserveAspectRatio="xMidYMid meet"/><text x="'+dshX+'" y="'+baseY+'" dominant-baseline="central" font-family="\'DIN Alternate\',\'Bahnschrift\',\'Microsoft YaHei\',sans-serif" font-size="'+dshFs+'" font-weight="700" letter-spacing="'+dshLs+'" fill="#e8e5d9">DSH</text><g transform="translate('+waveX+' 0)">'+bars+'</g>';
  g.setAttribute('transform','translate(0 0)');
  g.style.opacity=visible;
  if(se){if(se.textContent!==sub)se.textContent=sub||'';se.setAttribute('x',String(subX));se.setAttribute('y',String(baseY));se.setAttribute('text-anchor','start');se.setAttribute('dominant-baseline','central');se.setAttribute('font-size',String(subFs));se.style.opacity=(visible&&sub)?1:0}
}
var loginStart=+(cfg.loginStart!=null?cfg.loginStart:cfg.loadingStart),loginDur=Math.max(0,+(cfg.loginDur||0)),loginEnd=loginStart+loginDur;
function voiceVT(x){if(x<loginEnd)return Math.max(0,x-(+cfg.startAt||0));return 11.6+(x-cfg.loadingStart)/1.5}
/* ===== v2.16.0：登录 ID 动画（WELCOME TO DEEPSEEK HARNESS + 正在登录：用户名） ===== */
var LOGIN=(function(){
  var el=$('login'),l1=$('login-line1'),l2=$('login-line2'),track=$('login-l2-track'),head=$('login-l2-head'),scanText=$('login-scan-text'),scanWrap=scanText?scanText.parentNode:null,scanBar=$('login-scan-bar'),colon=$('login-colon'),nameEl=$('login-name'),caret=$('login-caret'),meta=$('login-name-meta');
  if(!el||!l1||!l2||!track||!head||!scanText||!nameEl)return null;
  var L1='WELCOME TO DEEPSEEK HARNESS';
  var POOL='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+-=/<>[]{}';
  /* 5s 版：第一行 0.18~1.2s、扫描 1.28~1.73s、冒号 1.76~1.88s、用户名 1.94~4.34s、停留到 5s */
  var L1_START=0.18,L1_SPAN=0.72,L1_FLICK=0.3;
  var L2_START=1.28,L2_SCAN=0.45,COLON_AT=1.76,COLON_DUR=0.12,NAME_AT=1.94,NAME_DUR=2.4,SLIDE_DUR=0.62;
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  /* 用户名安全化：去掉控制符/双向控制符与 \ / : * ? " < > |，合并空白，最多 20 个字符（按码点计）。 */
  function sanitize(raw){
    var s=String(raw==null?'':raw).replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\uFEFF]/g,'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim();
    var cp=Array.from(s);if(cp.length>20)cp=cp.slice(0,20);
    return cp.join('');
  }
  function esc(ch){return ch===' '?'&nbsp;':ch.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  var rnd=mulberry32(20261102),l1c=null,order=[],nameChars=[],nmc=null,settles=[],rates=[],builtName=null,HEAD_W=0,NAME_W=0,measuredKey='';
  function rebuild(name){
    var s=sanitize(name)||'AGENT';
    if(s===builtName)return;
    builtName=s;
    l1.innerHTML=L1.split('').map(function(ch){return '<span class="l1c">'+(ch===' '?'&nbsp;':ch)+'</span>'}).join('');
    l1c=l1.children;
    var idx=[];for(var i=0;i<L1.length;i++)idx.push(i);
    for(var j=idx.length-1;j>0;j--){var k=Math.floor(rnd()*(j+1));var tmp=idx[j];idx[j]=idx[k];idx[k]=tmp}
    order=new Array(L1.length);idx.forEach(function(v,rank){order[v]=rank});
    nameChars=Array.from(s);
    nameEl.innerHTML=nameChars.map(function(ch){return '<span class="nmc">'+esc(ch)+'</span>'}).join('');
    nmc=nameEl.children;
    settles=nameChars.map(function(){return rnd()});
    rates=nameChars.map(function(){return 12+rnd()*22});
    /* 按最终字符宽度定宽，乱码阶段不会因为字宽变化而抖动 */
    for(var m=0;m<nmc.length;m++){nmc[m].style.width=(nmc[m].getBoundingClientRect().width+0.6)+'px';}
    measuredKey='';measure();
    colon.style.opacity='0';caret.style.opacity='0';scanBar.style.opacity='0';if(scanWrap)scanWrap.style.setProperty('--p','0%');
    if(meta)meta.textContent='AUTH MODULE v2.16';
  }
  function measure(){
    var fs=parseFloat(getComputedStyle(l2).fontSize)||17;
    var key=fs.toFixed(2)+'|'+Math.round(l2.clientWidth);
    if(key===measuredKey)return;
    measuredKey=key;
    HEAD_W=head.getBoundingClientRect().width;
    NAME_W=nameEl.getBoundingClientRect().width;
  }
  /* 三次贝塞尔缓动（cubic-bezier(.22,1,.36,1)），用于「正在登录」平滑左移 */
  function bezier(p){
    p=Math.max(0,Math.min(1,p));
    var x1=.22,y1=1,x2=.36,y2=1;
    var t=p;
    for(var i=0;i<4;i++){
      var mt=1-t;
      var x=3*mt*mt*t*x1+3*mt*t*t*x2+t*t*t;
      var dx=3*mt*mt*x1+6*mt*t*(x2-x1)+3*t*t*(1-x2);
      if(Math.abs(dx)<1e-6)break;
      t=Math.max(0,Math.min(1,t-(x-p)/dx));
    }
    var m2=1-t;
    return 3*m2*m2*t*y1+3*m2*t*t*y2+t*t*t;
  }
  function render(lt,name){
    rebuild(name);measure();
    var n=l1c.length;
    for(var i=0;i<n;i++){
      var st=L1_START+(order[i]/Math.max(1,n-1))*L1_SPAN,en=st+L1_FLICK,c=l1c[i],final=L1[i];
      if(lt<st){c.textContent=POOL[(i*131+Math.floor(lt*26)*17)%POOL.length];c.style.opacity=String(0.05+0.22*Math.max(0,Math.sin(lt*11+i)));}
      else if(lt<en){c.textContent=POOL[(i*97+Math.floor(lt*30)*31)%POOL.length];c.style.opacity=String(0.25+0.75*((lt-st)/L1_FLICK));}
      else{c.textContent=final===' '?'\u00a0':final;c.style.opacity='1';}
    }
    l1.style.opacity=String(0.9+0.1*Math.abs(Math.sin(lt*13)));
    var p=Math.max(0,Math.min(1,(lt-L2_START)/L2_SCAN));
    if(scanWrap)scanWrap.style.setProperty('--p',(p*100).toFixed(2)+'%');
    scanBar.style.top=(p*100).toFixed(2)+'%';
    if(lt>=L2_START-0.03&&lt<=L2_START+L2_SCAN)scanBar.style.opacity='1';
    else if(lt>L2_START+L2_SCAN)scanBar.style.opacity=String(Math.max(0,1-(lt-(L2_START+L2_SCAN))/0.12));
    else scanBar.style.opacity='0';
    colon.style.opacity=String(Math.max(0,Math.min(1,(lt-COLON_AT)/COLON_DUR)));
    for(var j=0;j<nmc.length;j++){
      var cs=NAME_AT+0.04+settles[j]*NAME_DUR,e2=nmc[j];
      if(lt<NAME_AT){e2.style.opacity='0';continue;}
      if(lt<cs){e2.textContent=POOL[(j*73+Math.floor(lt*rates[j])*29)%POOL.length];e2.style.opacity=String(0.55+0.25*Math.abs(Math.sin(lt*rates[j])));e2.classList.remove('settled');}
      else{e2.textContent=nameChars[j]===' '?'\u00a0':nameChars[j];e2.style.opacity='1';e2.classList.add('settled');}
    }
    caret.style.opacity=(lt>=NAME_AT&&(Math.floor((lt-NAME_AT)*2.6)%2===0))?'1':'0';
    /* 用户名出现时整行按贝塞尔曲线平移，避免「正在登录」瞬移 */
    var W=l2.clientWidth||1;
    var xHead=Math.max(0,(W-HEAD_W)/2);
    var xFull=Math.max(0,(W-(HEAD_W+NAME_W))/2);
    var k=lt<NAME_AT?0:bezier((lt-NAME_AT)/SLIDE_DUR);
    track.style.transform='translateX('+(xHead+(xFull-xHead)*k).toFixed(2)+'px)';
  }
  return {render:render,sanitize:sanitize};
})();
function hideLogin(){var el=$('login'),sc=$('scene');if(el)el.classList.remove('on');if(sc)sc.style.opacity='1';}

function voiceState(VT,rt){
 let vh=null,vOn=false,sub="";
 const cueOn=!!(window.__DSH_CUE__&&performance.now()<(window.__DSH_CUE_UNTIL__||0));
 if(cueOn){
   sub=window.__DSH_CUE__;
   vh=Array.from({length:20},(_,k)=>4+Math.min(360,Math.abs(Math.sin(rt*7+k*0.55))*300));
   vOn=true;
 }else{
   const vsched=(window.__VSCHED__&&window.__VSCHED__.length)?window.__VSCHED__:(window.VOICE_SCHED||[]).map(function(x){var atV=voiceVT(x.at);return{key:x.key,at:atV,dur:(x.at>=loginEnd?x.dur/1.5:x.dur)};});
   const audioOn=!!window.__DSH_AUDIO_ON__, avNow=window.__DSH_ACTIVE_VOICE__||'', aNow=+window.__DSH_AUDIO_T__||0, aPlaying=!!window.__DSH_AUDIO_PLAYING__;
   for(const x of vsched){
     let vt=null;
     if(audioOn){if(avNow===x.key&&aPlaying)vt=Math.max(0,aNow);}
     else if(VT>=x.at-0.02&&VT<x.at+x.dur)vt=VT-x.at;
     if(vt==null)continue;
     sub=(cfg.voice&&cfg.voice.subs&&cfg.voice.subs[x.key])||"";
     const e=(window.VOICE_ENV||{})[x.key];
     if(e&&e.length){vh=Array.from({length:20},(_,k)=>{const st=Math.max(0,vt-(19-k)*0.055);const fi=st/0.008;const ai=Math.min(e.length-1,Math.floor(fi));const af=fi-Math.floor(fi);const a=((e[ai]||0)*(1-af)+(e[Math.min(e.length-1,ai+1)]||0)*af);return 4+Math.min(360,Math.pow(Math.max(0,a),0.9)*360)});vOn=true;}
     else{vh=Array.from({length:20},(_,k)=>4+Math.min(360,Math.abs(Math.sin(vt*7+k*0.55))*300));vOn=true;}
     break;
   }
 }
 return {h:vh||Array(20).fill(4),sub:sub,on:vOn};
}
function render(){
 const waitSec=((window.__VTIME__==null)&&window.__WAIT_START__>0&&t>=cfg.duration-0.03)?(performance.now()-window.__WAIT_START__)/1000:0;
 const rt=t+waitSec;
 let VT=(window.__VTIME__!=null)?+window.__VTIME__:voiceVT(t);VT+=waitSec;
 const vs=voiceState(VT,rt);
 /* v2.16.0：登录动画期间只驱动登录层，主场景淡出；台词走同一套「图标+DSH+波形+字幕」行 */
 if(loginDur>0&&t>=loginStart&&t<loginEnd){
   var lg=$('login'),sc=$('scene');if(sc)sc.style.opacity='0';if(lg)lg.classList.add('on');
   if(LOGIN)LOGIN.render(t-loginStart,cfg.username);
   renderVoiceRow($('login-voice'),$('login-voice-sub'),vs.h,vs.sub,vs.on?1:0);
   lastLoaded=false;
   $('seek').value=t;$('time').textContent=(t-(+cfg.startAt||0)).toFixed(2)+' / '+(cfg.duration-(+cfg.startAt||0)).toFixed(2)+' s';
   return;
 }
 hideLogin();
 const m=HUDMotion.state(t,cfg.loadingStart),loading=m.load,p=progress(t);
 lastLoaded=m.load;
 $('rings').style.opacity=m.opacity;$('rings').removeAttribute('transform');
 $('outer').setAttribute('transform',`scale(${m.outerScale}) rotate(${rt*5})`);$('outer').style.opacity=m.outerOpacity;
 $('ticks').setAttribute('transform',`scale(${m.outerScale*m.outerPulse})`);$('ticks').style.opacity=m.outerOpacity;
 $('outerPulse').setAttribute('r',210*m.outerScale*m.outerPulse);$('outerPulse').style.opacity=m.outerOpacity*(.16+.2*Math.pow(Math.max(0,Math.sin(rt*6.54)),8));
 $('markers').setAttribute('transform',`scale(${.66+.34*m.expand})`);$('markers').style.opacity=m.opacity;
 $('inner').setAttribute('transform',`rotate(${-rt*12})`);$('middle').removeAttribute('transform');
 $('pulse').setAttribute('r',m.innerPulse);$('pulse').style.opacity=m.pulseOpacity;
 $('pulseTrail').setAttribute('r',Math.max(2,m.innerPulse-5));$('pulseTrail').style.opacity=m.pulseOpacity*.33;
 $('tip').style.opacity=m.tipOpacity*m.flicker;$('tip').setAttribute('transform',`translate(0 ${-7*(1-m.tipReveal)}) scale(1 ${.96+.04*m.tipReveal})`);
 $('percent').textContent=loading&&m.percentOpacity>0?Math.round(p)+'%':'';$('percent').style.opacity=m.percentOpacity;
 const sweep=m.solidRing*359+(1-m.solidRing)*(loading?Math.max(.01,p*3.6):265);
 $('progressArc').setAttribute('d',arc(98,-90,-90+sweep));$('progressArc').setAttribute('stroke',m.solidRing>.1?'#f99508':loading?'#f29420':'#9c5c10');
 $('progressArc').setAttribute('transform',`rotate(${loading||m.solidRing>.9?0:(rt*110)%360})`);
 $('status').textContent=loading?'加载中':'连接中：'+cfg.username;$('status').style.opacity=m.opacity*m.labelOpacity;
 $('statusArrow').style.opacity=m.opacity*m.labelOpacity;
 $('statusDots').style.opacity=m.opacity*m.labelOpacity*(.35+.65*Math.abs(Math.sin(rt*4)));
  renderVoiceRow($('voice'),$('subtitle'),vs.h,vs.sub,vs.on?1:0);$('seek').value=t;$('time').textContent=(t-(+cfg.startAt||0)).toFixed(2)+' / '+(cfg.duration-(+cfg.startAt||0)).toFixed(2)+' s';
}
function syncAudio(){if(!env)return;const at=t- +$('voiceStart').value;if(at<0||at>=env.duration){audio.pause();return}if(Math.abs(audio.currentTime-at)>.12)audio.currentTime=at;if(playing&&audio.paused)audio.play().catch(()=>{$('audioInfo').textContent='请点击播放以启用音频。'});if(!playing)audio.pause()}
function play(){if(t>=cfg.duration)t=+cfg.startAt||0;playing=true;last=performance.now();$('play').textContent='暂停';syncAudio()}
function pause(){playing=false;audio.pause();$('play').textContent='播放'}
function seek(v){t=Math.max(+cfg.startAt||0,Math.min(cfg.duration,v));last=performance.now();syncAudio();render()}
$('play').onclick=()=>playing?pause():play();$('restart').onclick=()=>{seek(+cfg.startAt||0);play()};$('seek').max=cfg.duration;$('seek').min=+cfg.startAt||0;$('seek').oninput=e=>seek(+e.target.value);$('connection').onclick=()=>{pause();seek(+cfg.startAt||0)};$('loading').onclick=()=>{pause();seek(14)};$('fullscreen').onclick=()=>$('stage').requestFullscreen();$('voiceStart').oninput=()=>{syncAudio();render()};
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;const id=++loadId;pause();try{ctx??=new AudioContext();const b=await ctx.decodeAudioData(await f.arrayBuffer());if(id!==loadId)return;const samples=new Float32Array(b.length);for(let c=0;c<b.numberOfChannels;c++){const a=b.getChannelData(c);for(let i=0;i<a.length;i++)samples[i]+=a[i]/b.numberOfChannels}env=VoiceAnimation.envelope(samples,b.sampleRate);if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);audio.src=url;$('audioInfo').textContent=f.name+' · '+b.duration.toFixed(1)+' 秒；点击播放试听。';render()}catch{$('audioInfo').textContent='音频无法解码，请使用 MP3、WAV 或 M4A。'}};
$('reset').onclick=()=>{cfg=JSON.parse(JSON.stringify(defaults));persist();settings();render()};$('save').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({...cfg,voiceStart:+$('voiceStart').value},null,2)],{type:'application/json'}));a.href=u;a.download='animation-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function tick(){if(playing){{const now=performance.now();const dt=(now-last)/1000;last=now;const sp=(t>=+cfg.speedStart&&t<+cfg.speedEnd)?(+cfg.speed||1):1;t=Math.min(cfg.duration,t+dt*sp);}if(t>=cfg.duration)pause();syncAudio();render()}if(!playing&&t>=cfg.duration-0.05)render();requestAnimationFrame(tick)}settings();render();tick();

$('prevFrame').onclick=()=>{pause();seek(t-1/60)};$('nextFrame').onclick=()=>{pause();seek(t+1/60)};
/* ===== 跳过按钮（Lead 增加） ===== */
(function(){var b=document.createElement('div');b.id='skip';b.innerHTML='跳过<span class="arr">▸</span>';b.title='跳过启动动画';b.style.opacity='1';b.style.zIndex='9999';b.style.fontSize='18px';(document.body||document.documentElement).appendChild(b);setTimeout(function(){b.classList.add('show');},500);function skip(){try{document.dispatchEvent(new CustomEvent('dsh-startup-skip'));}catch(e){}try{if(parent&&parent!==window)parent.postMessage({type:'dsh-startup-skip'},'*');}catch(e){}try{if(typeof window.__DSH_SKIP__==='function')window.__DSH_SKIP__();}catch(e){}}b.addEventListener('click',function(e){e.preventDefault();skip();});document.addEventListener('keydown',function(e){if(e.key==='Escape')skip();});})();

/* ===== 掉线彩蛋 + 五句配音（Lead v11） ===== */
(function(){
  var q=new URLSearchParams(location.search), EGG_CHANCE=0.28;
  var eggEl=document.getElementById('egg'), btn=document.getElementById('egg-retry');
  var eggCfg=(cfg.egg||{}), eggFrom=+(eggCfg.min!=null?eggCfg.min:cfg.loadingStart), eggTo=Math.max(eggFrom+1, +(eggCfg.max!=null?eggCfg.max:cfg.duration-0.35));
  /* v2.15.10：掉线时机从「固定 9.2s」改为「进度 0–100%」随机；按百分比反查时间，保证 0%~100% 都可能掉线 */
  function eggTimeForPct(pct){
    var a=cfg.progress||[];
    for(var i=1;i<a.length;i++){
      if(pct<=a[i][1]){
        var p0=a[i-1][1],p1=a[i][1],t0=a[i-1][0],t1=a[i][0];
        return p1===p0?t0:(t0+(t1-t0)*(pct-p0)/(p1-p0));
      }
    }
    return +cfg.speedEnd||eggTo;
  }
  var eggAt=(q.get('egg')==='1')?eggFrom:Math.max(eggFrom,Math.min(eggTo,eggTimeForPct(Math.random()*100)));
  var vc=(cfg.voice||{}), mute=q.get('mute')==='1';
  var voiceVol=Number(cfg&&cfg.voiceVolume!=null?cfg.voiceVolume:0.5);if(!isFinite(voiceVol))voiceVol=0.5;voiceVol=Math.max(0,Math.min(1,voiceVol));
  function voiceDuck(on){try{if(parent&&parent!==window)parent.postMessage({type:'dsh-startup-voice',on:!!on},'*')}catch(e){}}
  /* v2.15.10：彩蛋弹出时请宿主截断 BGM；重连后请宿主重新播 */
  function bgmSig(on){try{if(parent&&parent!==window)parent.postMessage({type:'dsh-startup-bgm',on:!!on},'*')}catch(e){}}
  var sched=vc.sched||[[4.6,'orig1',2.65],[9.8,'login',1.79],[14.5,'line1',3.375],[18.4,'line2',3.232],[25.0,'line3',3.300],[30.45,'orig3',2.77]];
  var eggLineAt=+(vc.eggLineAt!=null?vc.eggLineAt:2.0), eggReplayWait=+(vc.eggReplayWait!=null?vc.eggReplayWait:2.0), line4Dur=+(vc.line4Dur||1.911);
  var aud={},played={},activeVoice=null,cueGate=false,cueFailTimer=null;window.__DSH_AUDIO_ON__=!mute;window.__DSH_ACTIVE_VOICE__='';window.__DSH_AUDIO_T__=-1;window.__DSH_AUDIO_PLAYING__=false;
  sched.forEach(function(e){var k=e[1];if(!mute&&vc[k]){var a=new Audio(vc[k]);a.preload='auto';a.volume=voiceVol;a.addEventListener('ended',function(){if(activeVoice===k){activeVoice=null;window.__DSH_ACTIVE_VOICE__='';}window.__DSH_AUDIO_PLAYING__=false;window.__DSH_AUDIO_T__=-1;voiceDuck(false)});aud[k]=a;played[k]=false;}});
  if(!mute&&vc.reconnect){var rc=new Audio(vc.reconnect);rc.preload='auto';rc.volume=voiceVol;rc.addEventListener('ended',function(){if(activeVoice==='reconnect'){activeVoice=null;window.__DSH_ACTIVE_VOICE__=''}window.__DSH_CUE__='';window.__DSH_CUE_UNTIL__=0;cueGate=false;voiceDuck(false)});aud.reconnect=rc;played.reconnect=true;}
  /* v2.15.14：重连接提示音独占一整行；重连提示音只播自己这一行；播完（ended）才解除 cueGate，后续 line2/line3/orig3 才允许开始 */
  function playReconnectCue(){if(mute||!aud.reconnect)return;cueGate=true;setTimeout(function(){try{attachVoiceFx('reconnect');aud.reconnect.currentTime=0;aud.reconnect.play().catch(function(){})}catch(e){}activeVoice='reconnect';window.__DSH_ACTIVE_VOICE__='';var txt=(cfg.voice&&cfg.voice.subs&&cfg.voice.subs.reconnect)||'';var d=isFinite(aud.reconnect.duration)&&aud.reconnect.duration>0?aud.reconnect.duration:2.82;window.__DSH_CUE__=txt;window.__DSH_CUE_UNTIL__=performance.now()+d*1000+150;voiceDuck(true);if(cueFailTimer)clearTimeout(cueFailTimer);
    /* 兜底：音频若因自动播放策略被拒，ended 不会触发；到时强制解除门控，避免后续配音全被卡住 */
    cueFailTimer=setTimeout(function(){if(activeVoice==='reconnect'){activeVoice=null;window.__DSH_ACTIVE_VOICE__='';window.__DSH_CUE__='';window.__DSH_CUE_UNTIL__=0;cueGate=false;voiceDuck(false)}},d*1000+1500)},500)}
  if(!mute&&vc.line4){var l4=new Audio(vc.line4);l4.preload='auto';l4.volume=voiceVol;l4.addEventListener('ended',function(){if(activeVoice==='line4'){activeVoice=null;window.__DSH_ACTIVE_VOICE__='';}window.__DSH_AUDIO_PLAYING__=false;window.__DSH_AUDIO_T__=-1;voiceDuck(false)});aud.line4=l4;played.line4=false;}
  /* v2.15.5：模板内配音效果（与全局 5 个声音效果同参数）；只在宿主注入 voiceFx 时生效。 */
  var VOICE_FX_PRESETS={'ai-mech':{hp:130,lp:4200,peak:{f:260,g:4,q:1.0},drive:0.15,ring:0},'robot':{hp:180,lp:3200,peak:{f:1500,g:3,q:0.9},drive:0.35,ring:42},'radio':{hp:420,lp:2800,peak:{f:1800,g:5,q:1.2},drive:0.6,ring:0},'oldtv':{hp:220,lp:2200,peak:null,drive:0.45,ring:0},'dark':{hp:90,lp:1200,peak:{f:180,g:5,q:0.8},drive:0.1,ring:0}};
  var voiceFxMode=String((cfg&&cfg.voiceFx)||'none');
  var fxAC=null,fxDone={};
  function voiceDriveCurve(amount){var k=Math.max(0,Math.min(1,Number(amount)||0))*60,n=1024,curve=new Float32Array(n);for(var i=0;i<n;i++){var x=(i*2)/n-1;curve[i]=((3+k)*x*20*Math.PI/180)/(Math.PI+k*Math.abs(x))}return curve}
  function attachVoiceFx(k){
    if(voiceFxMode==='none'||fxDone[k])return;
    var a=aud[k];if(!a)return;
    var P=VOICE_FX_PRESETS[voiceFxMode];if(!P)return;
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    function build(){
      if(fxDone[k])return;
      try{
        var c=fxAC||(fxAC=new AC());var src=c.createMediaElementSource(a);var node=src;
        if(P.hp){var hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=P.hp;node.connect(hp);node=hp}
        if(P.lp){var lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=P.lp;node.connect(lp);node=lp}
        if(P.peak){var pk=c.createBiquadFilter();pk.type='peaking';pk.frequency.value=P.peak.f;pk.gain.value=P.peak.g;pk.Q.value=P.peak.q;node.connect(pk);node=pk}
        if(P.drive){var ws=c.createWaveShaper();ws.curve=voiceDriveCurve(P.drive);ws.oversample='2x';node.connect(ws);node=ws}
        if(P.ring){var rg=c.createGain();rg.gain.value=0.55;var osc=c.createOscillator();osc.frequency.value=P.ring;osc.type='sine';var mg=c.createGain();mg.gain.value=0.45;osc.connect(mg);mg.connect(rg.gain);node.connect(rg);node=rg;osc.start()}
        node.connect(c.destination);fxDone[k]=true;
      }catch(e){}
    }
    try{
      if(!fxAC)fxAC=new AC();
      if(fxAC.state==='running')build();
      else fxAC.resume().then(function(){if(fxAC.state==='running')build()}).catch(function(){});
    }catch(e){}
  }
  window.VOICE_SCHED=sched.map(function(e){return{key:e[1],at:e[0],dur:e[2]};});
  var scale=cfg.voiceWidth/1920, eggSvg=null, eggRow=null, eggSub=null;
  function ensureEggVoice(){
    if(eggSvg)return;
    eggSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    eggSvg.setAttribute('viewBox','0 0 1920 1080');eggSvg.setAttribute('width','100%');eggSvg.setAttribute('height','100%');
    eggSvg.style.cssText='position:absolute;left:0;top:0;pointer-events:none;z-index:3';
    eggRow=document.createElementNS('http://www.w3.org/2000/svg','g');
    eggSub=document.createElementNS('http://www.w3.org/2000/svg','text');
    eggSub.setAttribute('fill','#e9d6b8');
    eggSub.setAttribute('font-family',"'DIN Alternate','Bahnschrift','Microsoft YaHei',sans-serif");
    eggSvg.appendChild(eggRow);eggSvg.appendChild(eggSub);eggEl.appendChild(eggSvg);
}
  /* v2.15.17：彩蛋里的中文台词改为跟随 voice-line4 的真实播放时钟，不再用墙钟推算。
     这样即使彩蛋的 setTimeout 被主线程拖慢，字幕也会和语音同时出现、同时结束。 */
  function eggVoice(){
    ensureEggVoice();
    var a=aud.line4, live=!!(window.__DSH_AUDIO_ON__&&a&&!a.paused&&!a.ended&&window.__DSH_ACTIVE_VOICE__==='line4');
    var vt=live?Math.max(0,+a.currentTime||0):-1;
    var e=(window.VOICE_ENV||{}).line4||[], vh=Array(20).fill(4);
    if(live&&vt<line4Dur+0.25&&e.length){
      var fi=vt/0.008, ai=Math.min(e.length-1,Math.floor(fi)), af=fi-Math.floor(fi);
      var amp=((e[ai]||0)*(1-af)+(e[Math.min(e.length-1,ai+1)]||0)*af);
      vh=[];for(var k=0;k<20;k++){var tv2=vt-(19-k)*0.06;var f2=tv2/0.008,i2=Math.min(e.length-1,Math.floor(f2));var a2=((e[i2]||0)*(1-(f2-Math.floor(f2)))+(e[Math.min(e.length-1,i2+1)]||0)*(f2-Math.floor(f2)));vh.push(4+Math.min(440,Math.pow(Math.max(0,a2),0.85)*440))}
    }
    var show=live?1:0;
    var st=show?((cfg.voice&&cfg.voice.subs&&cfg.voice.subs.line4)||''):'';
    renderVoiceRow(eggRow,eggSub,vh,st,show);
  }
  var shown=false,done=false,rolled=false,v3Ended=false,waitStart=0,v4Timer=null,replayTimer=null,eggShownAt=0,eggWait=false,eggWaitTimer=null;
  var hit=q.get('egg')==='1'||Math.random()<EGG_CHANCE;
  function stopVoice(){voiceDuck(false);activeVoice=null;window.__DSH_ACTIVE_VOICE__='';window.__DSH_AUDIO_PLAYING__=false;window.__DSH_AUDIO_T__=-1;window.__DSH_CUE__='';window.__DSH_CUE_UNTIL__=0;cueGate=false;if(cueFailTimer){clearTimeout(cueFailTimer);cueFailTimer=null}Object.keys(aud).forEach(function(k){var a=aud[k];try{a.pause();a.currentTime=0}catch(e){}});if(v4Timer){clearTimeout(v4Timer);v4Timer=null}if(replayTimer){clearTimeout(replayTimer);replayTimer=null}}
  function playKey(k,offset){var a=aud[k];if(a&&!played[k]){played[k]=true;attachVoiceFx(k);try{a.currentTime=Math.max(0,offset||0);a.play().catch(function(){});activeVoice=k;window.__DSH_ACTIVE_VOICE__=k}catch(e){}voiceDuck(true);}}
  function resetPlayedAfter(t0){
    Object.keys(played).forEach(function(k){played[k]=false});v3Ended=false;
    /* v2.15.10：重连回到 loadingStart 时，已播完的语音标记为已播、正在播的从断点续播，避免多句同时响起 */
    sched.forEach(function(e){
      var k=e[1],s=e[0],end=e[0]+(e[2]||0);
      if(end<=t0){played[k]=true}
      else if(s<t0){played[k]=true;playKey(k,t0-s)}
    });
  }
  function showEgg(){
    if(shown||done)return; shown=true; rolled=true; playing=false;eggWait=false;if(eggWaitTimer){clearTimeout(eggWaitTimer);eggWaitTimer=null}
    stopVoice();
    bgmSig(false);
    eggEl.classList.add('on'); eggEl.setAttribute('aria-hidden','false'); try{document.body.classList.add('egg-on')}catch(e){}
    eggShownAt=performance.now(); eggVoice();
    v4Timer=setTimeout(function(){playKey('line4')},eggLineAt*1000);
    /* v2.15.6：不再自动 reconnect——彩蛋必须等用户点【重新连接】，否则动画会自己往下走、声音叠在一起。 */
    render();
  }
  function eggFrame(sec){showEgg();stopVoice();window.__EGG_T=Math.max(0,sec);eggShownAt=performance.now()-window.__EGG_T*1000;if(sec>=eggLineAt)playKey('line4');eggVoice();}
  function hideEgg(){eggEl.classList.remove('on');eggEl.setAttribute('aria-hidden','true');try{document.body.classList.remove('egg-on')}catch(e){}shown=false;}
  /* v2.15.14：重连后不再续播断句（原来会把 line1 从半句接着放，和 reconnect 叠在一起）。
     顺序：等待 0.5s → 只播 reconnect（独占一行）→ 播完解除 cueGate → line2/line3/orig3 按时间线继续。 */
  function reconnect(){if(done)return;hideEgg();stopVoice();bgmSig(true);
    Object.keys(played).forEach(function(k){played[k]=true});
    played.line2=false;played.line3=false;played.orig3=false;played.reconnect=true;
    v3Ended=false;
    cueGate=!!(!mute&&aud.reconnect);
    playReconnectCue();
    waitStart=0;window.__WAIT_START__=0;seek(cfg.loadingStart);playing=true;last=performance.now();var pb=document.getElementById('play');if(pb)pb.textContent='暂停';render();}
  function doneEmit(){if(done)return;done=true;try{document.dispatchEvent(new CustomEvent('dsh-startup-done'))}catch(e){}try{if(parent&&parent!==window)parent.postMessage({type:'dsh-startup-done'},'*')}catch(e){}try{if(typeof window.__DSH_DONE__==='function')window.__DSH_DONE__()}catch(e){}}
  /* v2.15.12：不清 __WAIT_START__，让圆环/波形一直转到 iframe 被移除（转场期间不跳帧） */
  function flashDone(){hideEgg();doneEmit();}
  if(btn)btn.addEventListener('click',function(e){e.preventDefault();reconnect();});
  if(aud.orig3)aud.orig3.addEventListener('ended',function(){v3Ended=true});
  (function watch(){
    if(!done){
      /* v2.15.17：把当前配音的真实播放状态镜像到 window，供 render()/eggVoice() 使用，
         让字幕与波形以音频时钟为准，而不是按时间轴推算。 */
      var __av=activeVoice?aud[activeVoice]:null;
      if(__av){window.__DSH_AUDIO_T__=+__av.currentTime||0;window.__DSH_AUDIO_DUR__=+__av.duration||0;window.__DSH_AUDIO_PLAYING__=!__av.paused&&!__av.ended;}
      if(playing&&!cueGate){
        /* v2.16.0：配音串行播放——上一句没播完（ended/pause）不启动下一句。
           原因：第三节是 1.5x 加速段，时间轴会比真实音频快，按时间轴 forEach 会让 line1 尾巴和 line2 叠在一起。 */
        var __busy=!!(activeVoice&&aud[activeVoice]&&!aud[activeVoice].paused&&!aud[activeVoice].ended);
        if(!__busy){var __next=null;sched.forEach(function(e){if(!__next&&t>=e[0]&&!played[e[1]])__next=e;});if(__next)playKey(__next[1]);}
      }
      /* v2.15.16：掉线彩蛋若正好赶上某句配音，先等这句播完再弹出，避免语音和字幕被硬切断（有兜底超时）。 */
      if(!rolled&&playing&&!shown&&t>=eggAt){
        if(!hit){rolled=true;}
        else if(!eggWait&&activeVoice&&aud[activeVoice]&&!aud[activeVoice].paused&&!aud[activeVoice].ended){
          var eggA=aud[activeVoice], eggLeft=(+eggA.duration||0)-(+eggA.currentTime||0);
          if(isFinite(eggLeft)&&eggLeft>0.05&&eggLeft<=6){
            eggWait=true;
            (function(a){
              var fired=false,fin=function(){if(fired)return;fired=true;eggWait=false;eggWaitTimer=null;rolled=true;showEgg();};
              a.addEventListener('ended',fin,{once:true});
              eggWaitTimer=setTimeout(fin,eggLeft*1000+900);
            })(eggA);
          } else {rolled=true;showEgg();}
        } else if(!eggWait){rolled=true;showEgg();}
      }
      if(shown){eggVoice();}
      if(!shown&&!eggWait&&t>=cfg.duration-0.02){if(!waitStart){waitStart=performance.now();window.__WAIT_START__=waitStart;}var waitVoice=(!mute&&aud.orig3&&!v3Ended&&(performance.now()-waitStart<4000));if(!waitVoice)flashDone();}
    }
    requestAnimationFrame(watch);
  })();
  window.__DSH_APP__={play:play,pause:pause,seek:seek,showEgg:showEgg,eggFrame:eggFrame,flashDone:flashDone};
})();


/* v2.15.3：加载阶段按空格 / 宿主转发 切换下一条 tips；彩蛋卡片打开时不拦截。
   宿主转发用于 iframe 失焦（DSH 聊天输入框把焦点抢走后，模板内收不到空格）。 */
function nextTip(){
  if(!lastLoaded)return false;
  var card=document.getElementById('egg-card');
  if(card){
    var st=getComputedStyle(card);
    if(st.display!=='none'&&st.visibility!=='hidden'&&card.getBoundingClientRect().width>0)return false;
  }
  tipIndex=(tipIndex+1)%tips.length;
  setTip(tipIndex);
  return true;
}
document.addEventListener('keydown',function(e){
  if(e.code!=='Space'&&e.key!==' ')return;
  if(nextTip()){e.preventDefault();e.stopPropagation();}
});
window.addEventListener('message',function(e){
  if(e.source!==parent)return;
  var d=e&&e.data;
  if(d&&typeof d==='object'&&d.type==='dsh-tip-next')nextTip();
});
setTip(0);
