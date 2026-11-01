// 全景大肥鱼-含彩蛋版 · 可编辑代码动画参数（Lead 2026-11-05 更新）
window.CONFIG={
  username:'人类与AI的日常',
  title:'什么是「模板」？',
  description:'模板是别人做好的启动动画，一键安装就生效。也可以自己换标题、换台词、换时长。',
  tips:[
    {title:'什么是「模板」？',description:'模板是别人做好的启动动画，一键安装就生效。也可以自己换标题、换台词、换时长。'},
    {title:'操作提示',description:'按 空格 可以切换下一条提示；动画结束会自动进入聊天。'},
    {title:'掉线彩蛋',description:'进度条运行中，有小概率遇到一条「掉线」消息，按提示重连即可继续。'},
    {title:'想自己改？',description:'打开模板编辑器，标题、正文、连接用户名都能改，保存后下次启动生效。'},
    {title:'怎么跳过？',description:'等进度条走完会自动进入聊天；想提前进，按 Esc 或点右上角「跳过」。'}
  ],
  duration:25.92,
  startAt:3.4,
  loadingStart:9.2,
  voiceY:908,
  voiceWidth:520,
  speedStart:9.2,
  speed:1.5,
  speedEnd:25.45,
  egg:{},   // v2.15.10：掉线时机在「进度 0–100%」之间随机（app.js 按 loadingStart~speedEnd 计算）
  voice:{subs:{orig1:'警告：检测到新特工登录。',line1:'战术模块传输中，请稍候。',line2:'装备与技能配置已验证。倒计时十秒。',line3:'网络同步完成。正在移交权限。',line4:'警告：特工已离线。',reconnect:'检测到特工重新连接。',orig3:'欢迎回来，特工。很高兴再次见到你。'},orig1:'assets/voice-orig1.wav',line1:'assets/voice-line1.wav',line2:'assets/voice-line2.wav',line3:'assets/voice-line3.wav',orig3:'assets/voice-orig3.wav',line4:'assets/voice-line4.wav',reconnect:'assets/voice-reconnect.wav',sched:[[4.6,'orig1',2.65],[8.0,'line1',3.375],[12.8,'line2',3.232],[20.0,'line3',3.300],[25.45,'orig3',2.77]],eggLineAt: 1.0,line4Dur:1.911},
  progress:[[9.2,0],[10,0],[10.9,0],[11.5,10],[12,29],[13,41],[14,43],[15,43],[20,43],[21,46],[22,51],[23,55],[24,59],[25,63],[25.4,64],[25.45,100],[25.92,100]]
};
