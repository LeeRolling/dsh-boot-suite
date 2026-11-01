// Motion reconstruction from the reference's 60 fps timing study.
// A few editable events and analytic curves, never recorded frame arrays.
window.HUDMotion={
 events:{firstExpand:.62,hide:3.05,return:4.30,secondExpand:4.82,loading:9.166667,loadingExpand:9.88},
 clamp:v=>Math.max(0,Math.min(1,v)),
 smooth(v){v=this.clamp(v);return v*v*(3-2*v)},
 ease(v){return 1-Math.pow(1-this.clamp(v),3)},
 state(t,loadingStart){
  const e=this.events,load=t>=loadingStart;
  const start=load?loadingStart:t>=e.return?e.return:0;
  const expansion=load?loadingStart+.71:t>=e.return?e.secondExpand:e.firstExpand;
  const age=t-start,expand=this.ease((t-expansion)/(load?1.5:.7));
  const visible=t<e.hide||t>=e.return;
  const intro=t>=e.return?this.smooth(age/.16):1;
  const phase=((t-(start+.65))%1+1)%1;
  const beat=Math.pow(Math.max(0,Math.sin((t-start)*Math.PI*2/.96)),9);
  return {load,age,visible,opacity:visible?intro:0,expand,
   outerOpacity:this.smooth((t-expansion-.12)/.25),
   outerScale:.51+.49*expand,
   outerPulse:1+.012*beat,
   innerPulse:8+66*this.ease(phase/.85),
   pulseOpacity:!load&&t>expansion?(1-this.smooth((phase-.55)/.4))*.6:0,
   solidRing:1-this.smooth((t-expansion)/.28),
   labelOpacity:this.smooth((t-expansion-.25)/.35),
   percentOpacity:load?this.smooth((age-.91)/.16):0,
   tipOpacity:load?this.clamp(age/.12):0,
   tipReveal:load?this.ease(age/.22):0,
   flicker:load&&age<.18?(Math.floor(age*60)%3===0?.45:1):1};
 }
};
