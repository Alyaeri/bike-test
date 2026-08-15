(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const STORE='roadsBetweenUs';
  const build=window.__BUILD_INFO__||{};
  const stamp=build.builtAt?new Date(build.builtAt).toLocaleString('en-AU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Australia/Melbourne'}):'unknown';
  function state(){try{return JSON.parse(localStorage.getItem(STORE)||'null')||{};}catch(e){return {};}}
  function save(s){localStorage.setItem(STORE,JSON.stringify(s));}
  function addNotesUI(){
    const tools=document.querySelector('.tools');
    if(!tools||document.getElementById('qaNoteHint')) return;
    const note=document.getElementById('note');
    if(note) note.id='qaNoteHint';
    if($('voice')) $('voice').textContent='NOTE';
    if($('voice')) $('voice').title='Speak a QA note for the next test report';
    if($('note')) $('note').textContent='Tap NOTE, describe anything weird';
  }
  let recognition=null, listening=false;
  function setupVoice(){
    const btn=$('voice'); if(!btn) return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){btn.onclick=()=>{if($('note')) $('note').textContent='Voice transcription is not supported here';};return;}
    recognition=new SR();
    recognition.lang='en-AU'; recognition.interimResults=false; recognition.continuous=false; recognition.maxAlternatives=1;
    recognition.onstart=()=>{listening=true;btn.textContent='STOP';btn.classList.add('primary');if($('note'))$('note').textContent='Listening… describe the bug';};
    recognition.onresult=e=>{
      const text=Array.from(e.results).map(r=>r[0].transcript).join(' ').trim();
      if(text){const s=state();s.notes=Array.isArray(s.notes)?s.notes:[];s.notes.push({time:new Date().toISOString(),text});save(s);if($('note'))$('note').textContent='✓ Note saved';}
    };
    recognition.onerror=e=>{listening=false;btn.textContent='NOTE';btn.classList.remove('primary');if($('note'))$('note').textContent='Voice error: '+(e.error||'try again');};
    recognition.onend=()=>{listening=false;btn.textContent='NOTE';btn.classList.remove('primary');if($('note')&&$('note').textContent==='Listening… describe the bug')$('note').textContent='No note captured';};
    btn.onclick=()=>{try{if(listening)recognition.stop();else recognition.start();}catch(e){if($('note'))$('note').textContent='Tap again to start the microphone';}};
  }
  let wakeLock=null;
  function wakeStatus(text,good){
    let el=$('wakeStatus');
    if(!el){el=document.createElement('div');el.id='wakeStatus';el.style.cssText='position:absolute;left:9px;bottom:9px;z-index:8;background:#090909dd;border:1px solid #333;border-radius:7px;padding:4px 6px;font-size:8px;color:#999;pointer-events:none';$('ride')?.querySelector('.world')?.appendChild(el);}
    el.textContent=text;el.style.color=good?'#a9c997':'#999';
  }
  async function requestWake(){
    if(!('wakeLock' in navigator)){wakeStatus('SCREEN AWAKE: unavailable',false);return false;}
    try{wakeLock=await navigator.wakeLock.request('screen');wakeStatus('SCREEN AWAKE ✓',true);wakeLock.addEventListener('release',()=>{wakeLock=null;wakeStatus('SCREEN AWAKE: released',false);});return true;}
    catch(e){wakeStatus('SCREEN AWAKE: blocked',false);return false;}
  }
  function isRideVisible(){const r=$('ride');return r&&getComputedStyle(r).display!=='none'&&!document.hidden;}
  document.addEventListener('click',e=>{if(e.target&&e.target.id==='start')setTimeout(requestWake,150);},{capture:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isRideVisible())setTimeout(requestWake,150);});
  function addBuildBadge(){
    const targets=[$('home'),$('ride'),$('loggingPage')].filter(Boolean);
    targets.forEach(t=>{
      if(t.querySelector('.buildBadge'))return;
      const b=document.createElement('div');b.className='buildBadge';b.textContent='UPDATED '+stamp+(build.sha?' · '+build.sha.slice(0,7):'');
      b.style.cssText='font-size:8px;line-height:1;color:#666;letter-spacing:.04em;text-align:right;margin-top:6px;pointer-events:none';
      const head=t.querySelector('.head');if(head)head.appendChild(b);else t.insertBefore(b,t.firstChild);
    });
  }
  function combinedReport(){
    const s=state();const notes=Array.isArray(s.notes)?s.notes:[];const log=($('rawLog')?.textContent||'Ready.').trim();
    const lines=notes.map(n=>{const d=new Date(n.time);return (isNaN(d)?'':d.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})+'  ')+n.text;});
    return ['ROADS BETWEEN US — TEST REPORT','Build: '+stamp+(build.sha?' · '+build.sha:'') ,'','VOICE QA NOTES',lines.length?lines.join('\n'):'(none)','','DIAGNOSTICS',log].join('\n');
  }
  function setupCopy(){
    const b=$('copyLog');if(!b)return;b.textContent='COPY NOTES + LOG';b.style.width='100%';
    b.onclick=async()=>{const text=combinedReport();try{await navigator.clipboard.writeText(text);b.textContent='COPIED ✓';setTimeout(()=>b.textContent='COPY NOTES + LOG',1600);}catch(e){window.prompt('Copy this test report:',text);}};
  }
  function init(){addNotesUI();setupVoice();addBuildBadge();setupCopy();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  setTimeout(init,800);
})();
