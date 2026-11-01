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
function render(){
 const m=HUDMotion.state(t,cfg.loadingStart),loading=m.load,p=progress(t);
 lastLoaded=m.load;
 $('rings').style.opacity=m.opacity;$('rings').removeAttribute('transform');
 $('outer').setAttribute('transform',`scale(${m.outerScale}) rotate(${t*5})`);$('outer').style.opacity=m.outerOpacity;
 $('ticks').setAttribute('transform',`scale(${m.outerScale*m.outerPulse})`);$('ticks').style.opacity=m.outerOpacity;
 $('outerPulse').setAttribute('r',210*m.outerScale*m.outerPulse);$('outerPulse').style.opacity=m.outerOpacity*(.16+.2*Math.pow(Math.max(0,Math.sin(t*6.54)),8));
 $('markers').setAttribute('transform',`scale(${.66+.34*m.expand})`);$('markers').style.opacity=m.opacity;
 $('inner').setAttribute('transform',`rotate(${-t*12})`);$('middle').removeAttribute('transform');
 $('pulse').setAttribute('r',m.innerPulse);$('pulse').style.opacity=m.pulseOpacity;
 $('pulseTrail').setAttribute('r',Math.max(2,m.innerPulse-5));$('pulseTrail').style.opacity=m.pulseOpacity*.33;
 $('tip').style.opacity=m.tipOpacity*m.flicker;$('tip').setAttribute('transform',`translate(0 ${-7*(1-m.tipReveal)}) scale(1 ${.96+.04*m.tipReveal})`);
 $('percent').textContent=loading&&m.percentOpacity>0?Math.round(p)+'%':'';$('percent').style.opacity=m.percentOpacity;
 const sweep=m.solidRing*359+(1-m.solidRing)*(loading?Math.max(.01,p*3.6):265);
 $('progressArc').setAttribute('d',arc(98,-90,-90+sweep));$('progressArc').setAttribute('stroke',m.solidRing>.1?'#f99508':loading?'#f29420':'#9c5c10');
 $('progressArc').setAttribute('transform',`rotate(${loading||m.solidRing>.9?0:(t*110)%360})`);
 $('status').textContent=loading?'加载中':'连接中：'+cfg.username;$('status').style.opacity=m.opacity*m.labelOpacity;
 $('statusArrow').style.opacity=m.opacity*m.labelOpacity;
 $('statusDots').style.opacity=m.opacity*m.labelOpacity*(.35+.65*Math.abs(Math.sin(t*4)));
 const VT=(window.__VTIME__!=null)?+window.__VTIME__:(t<=9.2?t-3.4:5.8+(t-9.2)/1.5);let vh=null,vOn=false;const vsched=(window.__VSCHED__&&window.__VSCHED__.length)?window.__VSCHED__:(window.VOICE_SCHED||[]).map(function(s){var atV=(s.at<=9.2)?s.at-3.4:5.8+(s.at-9.2)/1.5;return{key:s.key,at:atV,dur:s.dur};});
 for(const s of vsched){if(VT>=s.at-0.02&&VT<s.at+s.dur){const e=(window.VOICE_ENV||{})[s.key];if(e&&e.length){const vt=VT-s.at;vh=Array.from({length:20},(_,k)=>{const st=Math.max(0,vt-(19-k)*0.055);const fi=st/0.008;const ai=Math.min(e.length-1,Math.floor(fi));const af=fi-Math.floor(fi);const a=((e[ai]||0)*(1-af)+(e[Math.min(e.length-1,ai+1)]||0)*af);return 4+Math.min(360,Math.pow(Math.max(0,a),0.9)*360)});vOn=true;}break;}}
 const h=vh||Array(20).fill(4);const voiceVisible=vOn?1:0;const scale=cfg.voiceWidth/1920;
 $('voice').style.opacity=voiceVisible;
 $('voice').setAttribute('transform',`translate(${960-cfg.voiceWidth/2} ${cfg.voiceY-303*scale}) scale(${scale})`);
 $('voice').innerHTML=VoiceAnimation.foreground(0.85,h);$('seek').value=t;$('time').textContent=(t-(+cfg.startAt||0)).toFixed(2)+' / '+(cfg.duration-(+cfg.startAt||0)).toFixed(2)+' s';
}
function syncAudio(){if(!env)return;const at=t- +$('voiceStart').value;if(at<0||at>=env.duration){audio.pause();return}if(Math.abs(audio.currentTime-at)>.12)audio.currentTime=at;if(playing&&audio.paused)audio.play().catch(()=>{$('audioInfo').textContent='请点击播放以启用音频。'});if(!playing)audio.pause()}
function play(){if(t>=cfg.duration)t=+cfg.startAt||0;playing=true;last=performance.now();$('play').textContent='暂停';syncAudio()}
function pause(){playing=false;audio.pause();$('play').textContent='播放'}
function seek(v){t=Math.max(+cfg.startAt||0,Math.min(cfg.duration,v));last=performance.now();syncAudio();render()}
$('play').onclick=()=>playing?pause():play();$('restart').onclick=()=>{seek(+cfg.startAt||0);play()};$('seek').max=cfg.duration;$('seek').min=+cfg.startAt||0;$('seek').oninput=e=>seek(+e.target.value);$('connection').onclick=()=>{pause();seek(+cfg.startAt||0)};$('loading').onclick=()=>{pause();seek(14)};$('fullscreen').onclick=()=>$('stage').requestFullscreen();$('voiceStart').oninput=()=>{syncAudio();render()};
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;const id=++loadId;pause();try{ctx??=new AudioContext();const b=await ctx.decodeAudioData(await f.arrayBuffer());if(id!==loadId)return;const samples=new Float32Array(b.length);for(let c=0;c<b.numberOfChannels;c++){const a=b.getChannelData(c);for(let i=0;i<a.length;i++)samples[i]+=a[i]/b.numberOfChannels}env=VoiceAnimation.envelope(samples,b.sampleRate);if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);audio.src=url;$('audioInfo').textContent=f.name+' · '+b.duration.toFixed(1)+' 秒；点击播放试听。';render()}catch{$('audioInfo').textContent='音频无法解码，请使用 MP3、WAV 或 M4A。'}};
$('reset').onclick=()=>{cfg=JSON.parse(JSON.stringify(defaults));persist();settings();render()};$('save').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({...cfg,voiceStart:+$('voiceStart').value},null,2)],{type:'application/json'}));a.href=u;a.download='animation-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function tick(){if(playing){{const now=performance.now();const dt=(now-last)/1000;last=now;const sp=(t>=+cfg.speedStart&&t<+cfg.speedEnd)?(+cfg.speed||1):1;t=Math.min(cfg.duration,t+dt*sp);}if(t>=cfg.duration)pause();syncAudio();render()}requestAnimationFrame(tick)}settings();render();tick();

$('prevFrame').onclick=()=>{pause();seek(t-1/60)};$('nextFrame').onclick=()=>{pause();seek(t+1/60)};
/* ===== 跳过按钮（Lead 增加） ===== */
(function(){var b=document.createElement('div');b.id='skip';b.innerHTML='跳过<span class="arr">▸</span>';b.title='跳过启动动画';b.style.opacity='1';b.style.zIndex='9999';b.style.fontSize='18px';(document.body||document.documentElement).appendChild(b);setTimeout(function(){b.classList.add('show');},500);function skip(){try{document.dispatchEvent(new CustomEvent('dsh-startup-skip'));}catch(e){}try{if(parent&&parent!==window)parent.postMessage({type:'dsh-startup-skip'},'*');}catch(e){}try{if(typeof window.__DSH_SKIP__==='function')window.__DSH_SKIP__();}catch(e){}}b.addEventListener('click',function(e){e.preventDefault();skip();});document.addEventListener('keydown',function(e){if(e.key==='Escape')skip();});})();

/* ===== 掉线彩蛋 + 五句配音（Lead v11） ===== */
(function(){
  var q=new URLSearchParams(location.search), EGG_CHANCE=0.28;
  var eggEl=document.getElementById('egg'), flashEl=document.getElementById('flash'), btn=document.getElementById('egg-retry');
  var eggCfg=(cfg.egg||{}), eggAt=+(eggCfg.at!=null?eggCfg.at:cfg.loadingStart);
  var vc=(cfg.voice||{}), mute=q.get('mute')==='1';
  var sched=vc.sched||[[4.6,'orig1',2.65],[8.0,'line1',3.375],[12.8,'line2',3.232],[17.9,'line3',3.300],[25.45,'orig3',2.77]];
  var eggLineAt=+(vc.eggLineAt!=null?vc.eggLineAt:2.0), eggReplayWait=+(vc.eggReplayWait!=null?vc.eggReplayWait:2.0), line4Dur=+(vc.line4Dur||1.911);
  var aud={},played={};
  sched.forEach(function(e){var k=e[1];if(!mute&&vc[k]){var a=new Audio(vc[k]);a.preload='auto';aud[k]=a;played[k]=false;}});
  if(!mute&&vc.line4){var l4=new Audio(vc.line4);l4.preload='auto';aud.line4=l4;played.line4=false;}
  window.VOICE_SCHED=sched.map(function(e){return{key:e[1],at:e[0],dur:e[2]};});
  var scale=cfg.voiceWidth/1920, eggSvg=null, eggG=null;
  function ensureEggVoice(){
    if(eggSvg)return;
    eggSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    eggSvg.setAttribute('viewBox','0 0 1920 1080');eggSvg.setAttribute('width','100%');eggSvg.setAttribute('height','100%');
    eggSvg.style.cssText='position:absolute;left:0;top:0;pointer-events:none;z-index:3';
    eggG=document.createElementNS('http://www.w3.org/2000/svg','g');
    eggG.setAttribute('transform','translate('+(960-cfg.voiceWidth/2)+' '+(cfg.voiceY-303*scale)+') scale('+scale+')');
    eggSvg.appendChild(eggG);eggEl.appendChild(eggSvg);
  }
  function eggVoice(vt){
    ensureEggVoice();
    var e=(window.VOICE_ENV||{}).line4||[], vh=Array(20).fill(4);
    if(vt>=0&&vt<line4Dur&&e.length){
      var fi=vt/0.008, ai=Math.min(e.length-1,Math.floor(fi)), af=fi-Math.floor(fi);
      var amp=((e[ai]||0)*(1-af)+(e[Math.min(e.length-1,ai+1)]||0)*af);
      vh=[];for(var k=0;k<20;k++){var tv2=vt-(19-k)*0.06;var f2=tv2/0.008,i2=Math.min(e.length-1,Math.floor(f2));var a2=((e[i2]||0)*(1-(f2-Math.floor(f2)))+(e[Math.min(e.length-1,i2+1)]||0)*(f2-Math.floor(f2)));vh.push(4+Math.min(440,Math.pow(Math.max(0,a2),0.8)*440));}
    }
    eggG.style.display=(vt>=0&&vt<line4Dur)?'':'none';eggG.innerHTML=VoiceAnimation.foreground(0.85,vh);
  }
  var shown=false,done=false,rolled=false,v3Ended=false,waitStart=0,v4Timer=null,replayTimer=null,eggShownAt=0;
  var hit=q.get('egg')==='1'||Math.random()<EGG_CHANCE;
  function stopVoice(){Object.keys(aud).forEach(function(k){var a=aud[k];try{a.pause();a.currentTime=0}catch(e){}});if(v4Timer){clearTimeout(v4Timer);v4Timer=null}if(replayTimer){clearTimeout(replayTimer);replayTimer=null}}
  function playKey(k){var a=aud[k];if(a&&!played[k]){played[k]=true;try{a.currentTime=0;a.play().catch(function(){})}catch(e){}}}
  function resetPlayed(){Object.keys(played).forEach(function(k){played[k]=false});v3Ended=false}
  function showEgg(){
    if(shown||done)return; shown=true; rolled=true; playing=false;
    stopVoice();
    eggEl.classList.add('on'); eggEl.setAttribute('aria-hidden','false'); try{document.body.classList.add('egg-on')}catch(e){}
    eggShownAt=performance.now(); eggVoice(-1);
    v4Timer=setTimeout(function(){playKey('line4')},eggLineAt*1000);
    replayTimer=setTimeout(reconnect,(eggLineAt+line4Dur+eggReplayWait)*1000);
    render();
  }
  function eggFrame(sec){showEgg();stopVoice();window.__EGG_T=Math.max(0,sec);eggShownAt=performance.now()-window.__EGG_T*1000;if(sec>=eggLineAt)playKey('line4');eggVoice(window.__EGG_T-eggLineAt);}
  function hideEgg(){eggEl.classList.remove('on');eggEl.setAttribute('aria-hidden','true');try{document.body.classList.remove('egg-on')}catch(e){}shown=false;}
  function reconnect(){if(done)return;hideEgg();stopVoice();resetPlayed();waitStart=0;seek(cfg.loadingStart);playing=true;last=performance.now();var pb=document.getElementById('play');if(pb)pb.textContent='暂停';render();}
  function doneEmit(){if(done)return;done=true;try{document.dispatchEvent(new CustomEvent('dsh-startup-done'))}catch(e){}try{if(parent&&parent!==window)parent.postMessage({type:'dsh-startup-done'},'*')}catch(e){}try{if(typeof window.__DSH_DONE__==='function')window.__DSH_DONE__()}catch(e){}}
  function flashDone(){hideEgg();if(flashEl)flashEl.classList.add('on');setTimeout(function(){if(flashEl)flashEl.classList.remove('on');doneEmit()},260);}
  if(btn)btn.addEventListener('click',function(e){e.preventDefault();reconnect();});
  if(aud.orig3)aud.orig3.addEventListener('ended',function(){v3Ended=true});
  (function watch(){
    if(!done){
      if(playing){sched.forEach(function(e){if(t>=e[0])playKey(e[1]);});}
      if(!rolled&&playing&&!shown&&t>=eggAt){rolled=true;if(hit)showEgg();}
      if(shown){var elap=(window.__EGG_T!=null?window.__EGG_T:(performance.now()-eggShownAt)/1000);eggVoice(elap-eggLineAt);}
      if(!shown&&t>=cfg.duration-0.02){if(!waitStart)waitStart=performance.now();var waitVoice=(playing&&!v3Ended&&(performance.now()-waitStart<3500));if(!waitVoice)flashDone();}
    }
    requestAnimationFrame(watch);
  })();
  window.__DSH_APP__={play:play,pause:pause,seek:seek,showEgg:showEgg,eggFrame:eggFrame,flashDone:flashDone};
})();


/* v2.15.2：加载阶段按空格切换下一条 tips；彩蛋卡片打开时不拦截（交给卡片自己的按钮）。 */
document.addEventListener('keydown',function(e){
  if(e.code!=='Space'&&e.key!==' ')return;
  if(!lastLoaded)return;
  var card=document.getElementById('egg-card');
  if(card){
    var st=getComputedStyle(card);
    if(st.display!=='none'&&st.visibility!=='hidden'&&card.getBoundingClientRect().width>0)return;
  }
  e.preventDefault();e.stopPropagation();
  tipIndex=(tipIndex+1)%tips.length;
  setTip(tipIndex);
});
setTip(0);
