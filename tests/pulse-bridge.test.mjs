import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('real bridge script calls supported APIs then acknowledges; forwards ready/state/error/blocked', () => {
  const html = fs.readFileSync('public/yt-embed.html','utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const events=[], handlers={}; let options;
  const window={location:{search:'?v=abcdefghijk&autoplay=1&mute=0&controls=1',origin:'https://www.truevoice.digital'},
    parent:{postMessage:message=>events.push(message)},addEventListener:(type,fn)=>handlers[type]=fn};
  class Player {
    constructor(_id,config){options=config;}
    playVideo(){events.push('playVideo');}
    unMute(){events.push('unMute');}
    mute(){events.push('mute');}
    stopVideo(){events.push('stopVideo');}
    seekTo(){events.push('seekTo');}
  }
  const document={createElement:()=>({}),head:{appendChild:()=>{}},addEventListener:()=>{}};
  vm.runInNewContext(script,{window,document,YT:{Player},URLSearchParams});
  window.onYouTubeIframeAPIReady();
  assert.equal(options.videoId,'abcdefghijk');assert.equal(options.playerVars.autoplay,1);
  assert.equal(options.playerVars.controls,1);assert.equal(options.playerVars.origin,window.location.origin);
  options.events.onReady();assert.equal(events.at(-1).type,'ready');
  handlers.message({source:window.parent,data:{source:'tvd-yt-embed-cmd',type:'unmute'}});
  handlers.message({source:window.parent,data:{source:'tvd-yt-embed-cmd',type:'play'}});
  assert.equal(events[1],'unMute');assert.equal(events[2].command,'unmute');
  assert.equal(events[3],'playVideo');assert.equal(events[4].command,'play');
  assert.equal(events[4].executed,true);
  const count=events.length;
  handlers.message({source:{},data:{source:'tvd-yt-embed-cmd',type:'play'}});
  assert.equal(events.length,count,'commands from non-parent windows are rejected');
  options.events.onAutoplayBlocked();assert.equal(events.at(-1).type,'autoplayBlocked');
  options.events.onStateChange({data:1});assert.equal(events.at(-1).state,1);
  options.events.onError({data:153});assert.equal(events.at(-1).code,153);
  handlers.message({source:window.parent,data:{source:'tvd-yt-embed-cmd',type:'stop'}});
  assert.equal(events.at(-2),'stopVideo');assert.equal(events.at(-1).command,'stop');
});

test('bridge progress is opt-in, real, bounded and stops on end/stop/pagehide', () => {
  const script=fs.readFileSync('public/yt-embed.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const messages=[],handlers={},timers=new Map();let options,currentTime=0,duration=100,timerId=0;
  const window={location:{search:'?v=abcdefghijk&progress=1',origin:'http://localhost:5173'},
    parent:{postMessage:m=>messages.push(m)},addEventListener:(type,fn)=>handlers[type]=fn,
    setInterval:(fn,ms)=>{assert.equal(ms,500);timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id)};
  const document={hidden:false,createElement:()=>({}),head:{appendChild:()=>{}},addEventListener:(type,fn)=>handlers[type]=fn};
  class Player {constructor(_id,config){options=config;}getCurrentTime(){return currentTime;}getDuration(){return duration;}stopVideo(){}}
  vm.runInNewContext(script,{window,document,YT:{Player},URLSearchParams});window.onYouTubeIframeAPIReady();
  options.events.onReady();assert.equal(messages.at(-1).type,'progress');
  options.events.onStateChange({data:1});assert.equal(timers.size,1);
  currentTime=40;[...timers.values()][0]();assert.equal(messages.at(-1).currentTime,40);
  options.events.onStateChange({data:2});assert.equal(timers.size,1);
  [...timers.values()][0]();assert.equal(messages.at(-1).currentTime,40);
  currentTime=70;[...timers.values()][0]();assert.equal(messages.at(-1).currentTime,70,'seek while paused uses actual time');
  options.events.onStateChange({data:3});assert.equal(timers.size,1);
  options.events.onStateChange({data:1});assert.equal(timers.size,1);
  duration=0;[...timers.values()][0]();assert.equal(messages.at(-1).duration,0);
  document.hidden=true;handlers.visibilitychange();assert.equal(timers.size,0);
  document.hidden=false;handlers.visibilitychange();assert.equal(timers.size,1);
  options.events.onStateChange({data:0});assert.equal(timers.size,0);
  options.events.onStateChange({data:1});handlers.message({source:window.parent,data:{source:'tvd-yt-embed-cmd',type:'stop'}});assert.equal(timers.size,0);
  options.events.onStateChange({data:1});handlers.pagehide();assert.equal(timers.size,0);
});
