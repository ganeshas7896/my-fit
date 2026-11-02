const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const api=(a,q='',body)=>fetch(`api.php?a=${a}${q}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}).then(r=>r.json()).then(j=>{if(j.error=='auth'){showAuth();throw 0}return j});
const fmt=s=>`${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`;
let S=null,date=ymd(new Date()),type='walking',T={run:0,start:0,acc:0,mode:'up'};
// theme
const setTheme=t=>{document.documentElement.dataset.theme=t;localStorage.theme=t;$('#themeBtn').textContent=t=='dark'?'☀':'☾'};
setTheme(localStorage.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
$('#themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme=='dark'?'light':'dark');
// clock
setInterval(()=>{const n=new Date();$('#clock').textContent=n.toLocaleTimeString('en-GB');$('#today').textContent=n.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short',year:'numeric'})},1000);
// toast, sound, notification
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('s');setTimeout(()=>t.classList.remove('s'),3000)}
function beep(){try{const c=new AudioContext(),o=c.createOscillator();o.connect(c.destination);o.frequency.value=880;o.start();setTimeout(()=>o.stop(),600)}catch(e){}}
function notify(t,b){toast(t+' – '+b);beep();navigator.vibrate&&navigator.vibrate([200,100,200]);
 if('Notification'in window&&Notification.permission=='granted'){try{new Notification(t,{body:b})}catch(e){navigator.serviceWorker?.getRegistration().then(r=>r&&r.showNotification(t,{body:b}))}}}
$('#notifBtn').onclick=()=>'Notification'in window?Notification.requestPermission().then(p=>toast(p=='granted'?'Notifications on':'Notifications blocked')):toast('Not supported');
// nav
$$('#nav button').forEach(b=>b.onclick=()=>{$$('#nav button,section').forEach(e=>e.classList.remove('on'));b.classList.add('on');$('#'+b.dataset.s).classList.add('on');if(b.dataset.s=='month')loadMonth()});
// load + render
async function load(){S=await api('state','&d='+date);render()}
function render(){const c=S.cfg,st=S.acts.reduce((a,x)=>a+ +x.steps,0),sec=S.acts.reduce((a,x)=>a+ +x.duration_sec,0),mins=Math.round(sec/60),done=S.habits.filter(h=>+h.done).length;
 countUp('#steps',st);$('#stepsOf').textContent=`of ${(+c.step_target).toLocaleString()} steps`;
 $('#ring').style.strokeDashoffset=326.7*(1-Math.min(1,st/c.step_target));
 countUp('#mins',mins);$('#minOf').textContent=`Target ${c.min_target} min`;$('#minBar').style.width=Math.min(100,mins/c.min_target*100)+'%';
 $('#hdone').textContent=`${done}/${S.habits.length}`;$('#habBar').style.width=(S.habits.length?done/S.habits.length*100:0)+'%';
 $('#acts').innerHTML=S.acts.map(a=>`<div class="item"><div class="m"><b>${esc(a.name)}</b><small>${a.type} · ${fmt(+a.duration_sec)}${+a.steps?' · '+(+a.steps).toLocaleString()+' steps':''}</small></div><button class="x" onclick="delAct(${a.id})">✕</button></div>`).join('')||'<p class="hint">Nothing logged yet. Open Train to start.</p>';
 $('#hlist').innerHTML=S.habits.map(h=>`<div class="item ${+h.done?'done':''}"><input type="checkbox" ${+h.done?'checked':''} onchange="tog(${h.id},this.checked)"><div class="m"><b>${esc(h.name)}</b><small>${h.remind_time?'Reminder '+h.remind_time.slice(0,5):'No reminder'}</small></div><button class="x" onclick="delHabit(${h.id})">✕</button></div>`).join('');
 $('#chips').innerHTML=SUG.filter(s=>!S.habits.some(h=>h.name==s[0])).map(s=>`<button class="chip" onclick="quick('${s[0]}','${s[1]}')">+ ${s[0]}</button>`).join('')||'<p class="hint">You added them all!</p>';$('#sTarget').value=c.step_target;$('#mTarget').value=c.min_target;$('#spm').value=c.spm;
 if(date==ymd(new Date())&&st>=c.step_target&&localStorage['goal'+date]!=1){localStorage['goal'+date]=1;notify('Daily goal reached!',`${st} steps done`);confetti()}
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function delAct(id){await api('del_activity','',{id});load()}
async function tog(id,done){await api('toggle_habit','',{id,done:done?1:0,date});load()}
async function delHabit(id){if(confirm('Delete this habit?')){await api('del_habit','',{id});load()}}
$('#date').value=date;$('#date').onchange=e=>{date=e.target.value||date;load()};
// habits
$('#hadd').onclick=async()=>{const n=$('#hname').value.trim();if(!n)return toast('Enter a habit name');await api('add_habit','',{name:n,remind_time:$('#htime').value});$('#hname').value='';$('#htime').value='';toast('Habit added');load()};
// settings
$('#saveCfg').onclick=async()=>{await api('save_settings','',{step_target:$('#sTarget').value,min_target:$('#mTarget').value,spm:$('#spm').value});toast('Saved');load()};
// train
$$('#typeSeg button').forEach(b=>b.onclick=()=>{$$('#typeSeg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');type=b.dataset.t;$('#stepHint').style.visibility=type=='walking'?'visible':'hidden'});
$$('#modeSeg button').forEach(b=>b.onclick=()=>{if(T.run||T.acc)return toast('Stop the timer first');$$('#modeSeg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');T.mode=b.dataset.m;$('#goalMin').style.display=T.mode=='down'?'block':'none';tick()});
const el=()=>T.acc+(T.run?Math.floor((Date.now()-T.start)/1000):0);
function tick(){const e=el();if(T.mode=='down'){const goal=(+$('#goalMin').value||1)*60,left=Math.max(0,goal-e);$('#tdisp').textContent=fmt(left);
 if(T.run&&left==0){pause();notify('Timer finished',`${type} session complete – tap Stop & save`)}}else $('#tdisp').textContent=fmt(e)}
setInterval(()=>{tick();$('#tdisp').classList.toggle('run',!!T.run)},250);
function pause(){T.acc=el();T.run=0;$('#startBtn').textContent='Resume'}
$('#startBtn').onclick=()=>{if(T.run)return pause();T.start=Date.now();T.run=1;$('#startBtn').textContent='Pause';if('Notification'in window&&Notification.permission=='default')Notification.requestPermission()};
$('#saveBtn').onclick=async()=>{let s=el();if(T.mode=='down')s=Math.min(s,(+$('#goalMin').value||1)*60);if(s<5)return toast('Run the timer a little longer');
 const r=await api('add_activity','',{type,name:$('#aname').value,duration_sec:s,date});T.run=0;T.acc=0;$('#startBtn').textContent='Start';$('#aname').value='';tick();toast(type=='walking'?`Saved · ${r.steps} steps`:'Saved');load()};
$('#manBtn').onclick=async()=>{const m=+$('#manMin').value;if(m<1)return toast('Enter minutes');const r=await api('add_activity','',{type,name:$('#aname').value,duration_sec:m*60,date});$('#manMin').value='';toast(type=='walking'?`Saved · ${r.steps} steps`:'Saved');load()};
// month
$('#ym').value=date.slice(0,7);$('#ym').onchange=loadMonth;
async function loadMonth(){const ym=$('#ym').value||date.slice(0,7),M=await api('month','&ym='+ym),c=M.cfg;
 const n=new Date(ym.slice(0,4),ym.slice(5),0).getDate(),map=Object.fromEntries(M.days.map(d=>[d.d,d]));
 let ts=0,tm=0,hit=0,rows='',bars='',mx=Math.max(+c.step_target,...M.days.map(d=>+d.steps));
 for(let i=1;i<=n;i++){const k=`${ym}-${pad(i)}`,d=map[k]||{steps:0,sec:0},h=M.habits[k]||0;ts+=+d.steps;tm+=+d.sec;if(+d.steps>=c.step_target)hit++;
  bars+=`<i style="height:${+d.steps/mx*100}%" title="${i}: ${d.steps} steps"></i>`;
  if(+d.sec||h)rows+=`<tr><td>${i}</td><td>${(+d.steps).toLocaleString()}</td><td>${Math.round(d.sec/60)} min</td><td>${h}/${M.total_habits}</td></tr>`}
 $('#chart').innerHTML=bars;
 $('#msum').innerHTML=[['Total steps',ts.toLocaleString()],['Active time',Math.floor(tm/3600)+'h '+Math.round(tm%3600/60)+'m'],['Goal days',hit+'/'+n],['Sessions',M.types.map(t=>`${t.type} ${t.n}`).join(', ')||'0']].map(x=>`<div class="card"><small>${x[0]}</small><br><b style="font-size:1.2rem">${x[1]}</b></div>`).join('');
 $('#mtable').innerHTML=rows?`<table><tr><th>Day</th><th>Steps</th><th>Time</th><th>Habits</th></tr>${rows}</table>`:'<p class="hint">No activity this month.</p>'}
// habit reminders
setInterval(()=>{if(!S||date!=ymd(new Date()))return;const n=new Date(),hm=`${pad(n.getHours())}:${pad(n.getMinutes())}`;
 S.habits.forEach(h=>{const k=`rem${h.id}${date}`;if(h.remind_time&&h.remind_time.slice(0,5)==hm&&!+h.done&&!localStorage[k]){localStorage[k]=1;notify('Habit reminder',h.name)}})},15000);
// ---- real-app extras ----
const SUG=[['Walk 10 minutes after meals','13:30'],['Take vitamins','09:00'],['Journal','21:00'],['No sugar today','12:00'],['Skincare routine','22:00'],['Limit screen time','21:30'],['Plan tomorrow','21:15'],['Gratitude note','07:30'],['Eat fruits','11:00'],['Deep breathing','15:00'],['Stand up every hour','11:30'],['Call family','19:00'],['Cold shower','06:45'],['No phone in bed','22:15']];
async function quick(n,t){await api('add_habit','',{name:n,remind_time:t});toast('Added '+n);load()}
function countUp(sel,to){const e=$(sel),from=parseInt(e.textContent.replace(/,/g,''))||0,t0=performance.now(),f=t=>{const p=Math.min(1,(t-t0)/700);e.textContent=Math.round(from+(to-from)*p).toLocaleString();if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
function confetti(){for(let i=0;i<40;i++){const c=document.createElement('i');c.className='cf';c.style.cssText=`left:${Math.random()*100}vw;background:hsl(${200+Math.random()*60},90%,60%);animation-delay:${Math.random()*.5}s;--x:${Math.random()*120-60}px`;document.body.appendChild(c);setTimeout(()=>c.remove(),2500)}}
let mode='login';
function showAuth(){S=null;$('#auth').classList.add('on')}
$$('#authTabs button').forEach(b=>b.onclick=()=>{$$('#authTabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');mode=b.dataset.m;$('#uname').style.display=mode=='register'?'block':'none';$('#authBtn').textContent=mode=='register'?'Create account':'Log in';$('#autherr').textContent=''});
$('#authBtn').onclick=async()=>{const r=await fetch('api.php?a='+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#uname').value,email:$('#email').value,password:$('#pass').value})}).then(r=>r.json()).catch(()=>({error:'Cannot reach server'}));
 if(r.error)return $('#autherr').textContent=r.error;$('#pass').value='';start(r.user)};
$$('#auth input').forEach(i=>i.onkeydown=e=>e.key=='Enter'&&$('#authBtn').click());
function start(u){$('#auth').classList.remove('on');$('#hello').textContent='Hi, '+u.name.split(' ')[0]+' 👋';$('#avatar').textContent=u.name[0].toUpperCase();$('#acct').textContent=u.name+' · '+u.email;load()}
$('#logout').onclick=async()=>{await fetch('api.php?a=logout',{method:'POST'});showAuth();toast('Logged out')};
fetch('api.php?a=me').then(r=>r.json()).then(j=>j.user?start(j.user):showAuth()).catch(showAuth);
