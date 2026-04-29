// NutriTrack AI — Core Module
const NT={
  state:{currentDate:todayStr(),goals:load('nt_goals')||{cal:2000,protein:150,carbs:250,fat:65,fiber:30,sugar:50,water:8},logs:load('nt_logs')||{},geminiKey:load('nt_gemini')||'',weights:load('nt_weights')||{},exercises:load('nt_exercises')||{},chatHistory:load('nt_chat')||[],profile:load('nt_profile')||{dob:'',sex:'male',height:0,activity:1.55},bodyLogs:load('nt_bodyLogs')||[],bodyGoals:load('nt_bodyGoals')||{targetWeight:0,targetBf:0,targetDate:''},training:load('nt_training')||{gym:3,cardio:0,style:'strength'},coachChats:load('nt_coachChats')||[],activeChatId:load('nt_activeChatId')||null,workoutTemplates:load('nt_workoutTpl')||{push:[{name:'Bench Press',weight:30,reps:12,sets:3},{name:'Incline Bench Press',weight:20,reps:12,sets:3},{name:'Tricep Pushdown Cable',weight:20,reps:12,sets:3},{name:'Tricep Back Extension',weight:12,reps:12,sets:3},{name:'Lateral Cable Raise',weight:8,reps:12,sets:3},{name:'Overhead Press',weight:30,reps:12,sets:3}],pull:[{name:'Lat Pulldown',weight:36,reps:12,sets:3},{name:'Seated Cable Rows',weight:30,reps:12,sets:3},{name:'Barbell Row',weight:30,reps:8,sets:5},{name:'Face Pull',weight:36,reps:12,sets:3},{name:'Hammer Curl',weight:8,reps:12,sets:3},{name:'Bicep Curl Dumbbell',weight:8,reps:12,sets:3}],legs:[{name:'Romanian Deadlift',weight:30,reps:8,sets:3},{name:'Leg Press',weight:50,reps:12,sets:3},{name:'Leg Curl',weight:21,reps:12,sets:3},{name:'Standing Calf Raises',weight:48,reps:12,sets:3}],cardio:{type:'Treadmill Incline Walk',incline:9,speedMin:3,speedMax:5,durationMin:25,durationMax:40},sequence:['push','pull','legs']}},
  $:s=>document.querySelector(s),
  $$:s=>document.querySelectorAll(s)
};
function todayStr(){return new Date().toISOString().slice(0,10)}
function load(k){try{return JSON.parse(localStorage.getItem(k))}catch{return null}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function saveAll(){save('nt_goals',NT.state.goals);save('nt_logs',NT.state.logs);save('nt_gemini',NT.state.geminiKey);save('nt_weights',NT.state.weights);save('nt_exercises',NT.state.exercises);save('nt_chat',NT.state.chatHistory);save('nt_profile',NT.state.profile);save('nt_bodyLogs',NT.state.bodyLogs);save('nt_bodyGoals',NT.state.bodyGoals);save('nt_training',NT.state.training);save('nt_coachChats',NT.state.coachChats);save('nt_activeChatId',NT.state.activeChatId);save('nt_workoutTpl',NT.state.workoutTemplates)}
function dayLog(d){if(!NT.state.logs[d])NT.state.logs[d]={breakfast:[],lunch:[],dinner:[],snacks:[],water:0,workout:null};return NT.state.logs[d]}
function findFood(id){return FOOD_DB.find(f=>f.id===id)}
function shiftDate(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function toast(msg,type='info'){const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;NT.$('#toastContainer').appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(16px)';el.style.transition='all .3s';setTimeout(()=>el.remove(),300)},2500)}

// Tab Navigation
document.addEventListener('DOMContentLoaded',()=>{
  // Gemini key loaded from localStorage only — user enters it in Settings
  if(!NT.state.geminiKey){NT.state.geminiKey=load('nt_gemini')||''}
  
  NT.$$('.nav-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      NT.$$('.nav-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      NT.$$('.page').forEach(p=>p.classList.remove('active'));
      const pg=NT.$('#page-'+tab.dataset.tab);
      if(pg)pg.classList.add('active');
      // Show/hide date nav
      const dn=NT.$('#dateNav');
      if(dn)dn.style.display=tab.dataset.tab==='diary'?'flex':'none';
      if(tab.dataset.tab==='progress'&&typeof renderProgress==='function')renderProgress();
      if(tab.dataset.tab==='body'&&typeof renderBody==='function')renderBody();
    });
  });

  // Date nav
  NT.$('#prevDay').addEventListener('click',()=>{NT.state.currentDate=shiftDate(NT.state.currentDate,-1);updateDiary()});
  NT.$('#nextDay').addEventListener('click',()=>{const t=shiftDate(NT.state.currentDate,1);if(t<=todayStr()){NT.state.currentDate=t;updateDiary()}});
  NT.$('#dateDisplay').addEventListener('click',()=>{NT.state.currentDate=todayStr();updateDiary()});

  // Auto meal select
  const h=new Date().getHours();
  const ms=NT.$('#mealSelect');
  if(h<11)ms.value='breakfast';else if(h<15)ms.value='lunch';else if(h<20)ms.value='dinner';else ms.value='snacks';

  // Quick Add
  let sTimeout;
  const qi=NT.$('#quickAddInput'),sr=NT.$('#searchResults');
  qi.addEventListener('input',()=>{
    clearTimeout(sTimeout);const v=qi.value.trim();
    if(v.length<2){sr.classList.add('hidden');return}
    sTimeout=setTimeout(()=>{
      const m=FOOD_DB.filter(f=>f.name.toLowerCase().includes(v.toLowerCase())).slice(0,8);
      if(m.length){
        sr.innerHTML=m.map(f=>`<div class="search-item" data-id="${f.id}"><div><div class="search-item-name">${esc(f.name)}</div><div class="search-item-serving">${f.servings[0].name} (${f.servings[0].g}g)</div></div><div class="search-item-cal">${Math.round(f.cal*f.servings[0].g/100)} kcal</div></div>`).join('');
        sr.classList.remove('hidden');
        sr.querySelectorAll('.search-item').forEach(el=>{el.addEventListener('click',()=>{openFoodModal(el.dataset.id,ms.value);sr.classList.add('hidden');qi.value=''})});
      }else sr.classList.add('hidden');
    },200);
  });

  qi.addEventListener('keydown',async e=>{
    if(e.key!=='Enter')return;const v=qi.value.trim();if(!v)return;
    sr.classList.add('hidden');
    let items=parseNL(v);
    if(items.length>0){
      const meal=ms.value,log=dayLog(NT.state.currentDate);
      items.forEach(i=>log[meal].push(i));saveAll();updateDiary();
      toast(`Added ${items.length} item${items.length>1?'s':''} to ${meal}`,'success');qi.value='';return;
    }
    if(NT.state.geminiKey){
      NT.$('#aiProcessing').classList.remove('hidden');
      const ai=await geminiAnalyze(v);
      NT.$('#aiProcessing').classList.add('hidden');
      if(ai&&ai.length){
        const meal=ms.value,log=dayLog(NT.state.currentDate);
        ai.forEach(i=>{log[meal].push({name:i.name,cal:i.cal||0,protein:i.protein||0,carbs:i.carbs||0,fat:i.fat||0,fiber:i.fiber||0,sugar:i.sugar||0,servingText:i.servingText||'1 serving',foodId:'ai'})});
        saveAll();updateDiary();toast(`AI added ${ai.length} item${ai.length>1?'s':''}`,'success');qi.value='';return;
      }
    }
    toast('Could not identify food','error');
  });

  document.addEventListener('click',e=>{if(!e.target.closest('#quickAdd'))sr.classList.add('hidden')});

  // Photo
  NT.$('#photoBtn').addEventListener('click',()=>NT.$('#photoInput').click());
  NT.$('#photoInput').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    if(!NT.state.geminiKey){toast('Set Gemini key in More tab','error');return}
    NT.$('#aiProcessing').classList.remove('hidden');
    try{
      const b64=await new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result.split(',')[1]);rd.onerror=j;rd.readAsDataURL(f)});
      const ai=await geminiAnalyze({mime_type:f.type,data:b64},true);
      NT.$('#aiProcessing').classList.add('hidden');
      if(ai&&ai.length){
        const meal=ms.value,log=dayLog(NT.state.currentDate);
        ai.forEach(i=>{log[meal].push({name:i.name,cal:i.cal||0,protein:i.protein||0,carbs:i.carbs||0,fat:i.fat||0,fiber:i.fiber||0,sugar:i.sugar||0,servingText:i.servingText||'1 serving',foodId:'ai_photo'})});
        saveAll();updateDiary();toast(`AI found ${ai.length} food${ai.length>1?'s':''} in photo`,'success');
      }else toast('Could not identify food in photo','error');
    }catch{NT.$('#aiProcessing').classList.add('hidden');toast('Photo analysis failed','error')}
    NT.$('#photoInput').value='';
  });

  // Food Modal
  let selectedFood=null;
  window.openFoodModal=function(fid,meal){
    selectedFood=findFood(fid);if(!selectedFood)return;
    NT.$('#foodModal').classList.remove('hidden');
    NT.$('#foodDetailSection').classList.remove('hidden');
    NT.$('#foodSearchInput').value='';NT.$('#foodSearchResults').innerHTML='';
    NT.$('#selectedFoodName').textContent=selectedFood.name;
    NT.$('#foodModalTitle').textContent='Add Food';
    NT.$('#servingQty').value=1;
    NT.$('#servingUnit').innerHTML=selectedFood.servings.map((s,i)=>`<option value="${i}">${s.name} (${s.g}g)</option>`).join('');
    NT.$('#foodModalMeal').value=meal||'breakfast';
    updPreview();
  };
  function updPreview(){
    if(!selectedFood)return;
    const q=parseFloat(NT.$('#servingQty').value)||1,si=parseInt(NT.$('#servingUnit').value)||0;
    const s=selectedFood.servings[si],g=q*s.g,m=g/100;
    NT.$('#previewCal').textContent=Math.round(selectedFood.cal*m);
    NT.$('#previewProtein').textContent=Math.round(selectedFood.protein*m)+'g';
    NT.$('#previewCarbs').textContent=Math.round(selectedFood.carbs*m)+'g';
    NT.$('#previewFat').textContent=Math.round(selectedFood.fat*m)+'g';
    NT.$('#previewFiber').textContent=Math.round(selectedFood.fiber*m)+'g';
    NT.$('#previewSugar').textContent=Math.round(selectedFood.sugar*m)+'g';
  }
  NT.$('#servingQty').addEventListener('input',updPreview);
  NT.$('#servingUnit').addEventListener('change',updPreview);
  NT.$('#addFoodBtn').addEventListener('click',()=>{
    if(!selectedFood)return;
    const q=parseFloat(NT.$('#servingQty').value)||1,si=parseInt(NT.$('#servingUnit').value)||0;
    const s=selectedFood.servings[si],g=q*s.g,m=g/100;
    const meal=NT.$('#foodModalMeal').value,log=dayLog(NT.state.currentDate);
    log[meal].push({name:selectedFood.name,foodId:selectedFood.id,cal:selectedFood.cal*m,protein:selectedFood.protein*m,carbs:selectedFood.carbs*m,fat:selectedFood.fat*m,fiber:selectedFood.fiber*m,sugar:selectedFood.sugar*m,servingText:`${q} ${s.name} (${Math.round(g)}g)`,grams:g});
    saveAll();updateDiary();NT.$('#foodModal').classList.add('hidden');toast(`${selectedFood.name} added`,'success');
  });
  NT.$('#closeFoodModal').addEventListener('click',()=>NT.$('#foodModal').classList.add('hidden'));
  
  // Food search in modal
  NT.$('#foodSearchInput').addEventListener('input',()=>{
    const v=NT.$('#foodSearchInput').value.trim().toLowerCase();
    if(v.length<2){NT.$('#foodSearchResults').innerHTML='';return}
    const m=FOOD_DB.filter(f=>f.name.toLowerCase().includes(v)).slice(0,10);
    NT.$('#foodSearchResults').innerHTML=m.map(f=>`<div class="search-item" data-id="${f.id}"><div class="search-item-name">${esc(f.name)}</div><div class="search-item-cal">${Math.round(f.cal*f.servings[0].g/100)} kcal / ${f.servings[0].name}</div></div>`).join('');
    NT.$('#foodSearchResults').querySelectorAll('.search-item').forEach(el=>{
      el.addEventListener('click',()=>{selectedFood=findFood(el.dataset.id);if(!selectedFood)return;NT.$('#foodDetailSection').classList.remove('hidden');NT.$('#selectedFoodName').textContent=selectedFood.name;NT.$('#servingQty').value=1;NT.$('#servingUnit').innerHTML=selectedFood.servings.map((s,i)=>`<option value="${i}">${s.name} (${s.g}g)</option>`).join('');updPreview();NT.$('#foodSearchResults').innerHTML='';NT.$('#foodSearchInput').value=''});
    });
  });

  // Add food buttons
  NT.$$('.add-food-btn[data-meal]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      NT.$('#foodModal').classList.remove('hidden');NT.$('#foodDetailSection').classList.add('hidden');
      NT.$('#foodSearchInput').value='';NT.$('#foodSearchResults').innerHTML='';
      NT.$('#foodModalMeal').value=btn.dataset.meal;
      NT.$('#foodModalTitle').textContent='Add to '+btn.dataset.meal.charAt(0).toUpperCase()+btn.dataset.meal.slice(1);
      setTimeout(()=>NT.$('#foodSearchInput').focus(),100);
    });
  });

  // Exercise
  NT.$('#addExerciseBtn').addEventListener('click',()=>NT.$('#exerciseModal').classList.remove('hidden'));
  NT.$('#closeExerciseModal').addEventListener('click',()=>NT.$('#exerciseModal').classList.add('hidden'));
  NT.$('#addExerciseSubmit').addEventListener('click',()=>{
    const d=NT.state.currentDate;if(!NT.state.exercises[d])NT.state.exercises[d]=[];
    NT.state.exercises[d].push({name:NT.$('#exerciseName').value||'Exercise',duration:parseInt(NT.$('#exerciseDuration').value)||30,cal:parseInt(NT.$('#exerciseCalories').value)||200});
    saveAll();updateDiary();NT.$('#exerciseModal').classList.add('hidden');toast('Exercise added','success');
  });

  // Init
  updateDiary();
  updateStreak();
});

// Ring helper
function setRing(sel,val,max,r){const el=document.querySelector(sel);if(!el)return;const c=2*Math.PI*r;el.style.strokeDasharray=c;el.style.strokeDashoffset=c*(1-Math.min(val/max,1))}

// Update Diary
function updateDiary(){
  const log=dayLog(NT.state.currentDate);
  let t={cal:0,protein:0,carbs:0,fat:0,fiber:0,sugar:0};
  ['breakfast','lunch','dinner','snacks'].forEach(meal=>{
    let mc=0;
    (log[meal]||[]).forEach(i=>{t.cal+=i.cal;t.protein+=i.protein;t.carbs+=i.carbs;t.fat+=i.fat;t.fiber+=(i.fiber||0);t.sugar+=(i.sugar||0);mc+=i.cal});
    const ce=NT.$(`#${meal}Cals`);if(ce)ce.textContent=Math.round(mc);
    renderItems(meal,log[meal]||[]);
  });
  // Exercise calories
  let exCal=0;
  (NT.state.exercises[NT.state.currentDate]||[]).forEach(e=>exCal+=e.cal);
  NT.$('#exerciseCals').textContent=exCal?'-'+exCal:'0';
  renderExercise();
  
  const net=t.cal-exCal;
  
  // Animated calorie counter
  const calEl=NT.$('#caloriesConsumed');
  const targetVal=Math.round(t.cal);
  const startVal=parseInt(calEl.textContent)||0;
  if(startVal!==targetVal){
    const duration=400;const start=performance.now();
    function animateCount(now){
      const elapsed=now-start;const progress=Math.min(elapsed/duration,1);
      const eased=1-Math.pow(1-progress,3); // ease-out cubic
      calEl.textContent=Math.round(startVal+(targetVal-startVal)*eased);
      if(progress<1)requestAnimationFrame(animateCount);
    }
    requestAnimationFrame(animateCount);
  }
  
  NT.$('#calGoalDisplay').textContent=NT.state.goals.cal;
  
  // Over-budget ring logic
  const isOver=net>NT.state.goals.cal;
  const ringFill=NT.$('.calorie-fill');
  const ringBg=NT.$('.ring-bg');
  if(ringFill){
    // Use style.stroke to override CSS (setAttribute loses to CSS specificity)
    ringFill.style.stroke=isOver?'url(#calGradOver)':'url(#calGrad)';
  }
  if(ringBg){
    ringBg.style.stroke=isOver?'rgba(255,69,58,.12)':'rgba(255,255,255,.04)';
  }
  
  // Remaining text — show actual overage
  const remEl=NT.$('#caloriesRemaining');
  if(isOver){
    const over=Math.round(net-NT.state.goals.cal);
    remEl.textContent=over+' over';
    remEl.style.color='var(--danger)';
  } else {
    const rem=Math.round(NT.state.goals.cal-net);
    remEl.textContent=rem+' remaining';
    remEl.style.color='var(--text2)';
  }

  NT.$('#proteinVal').textContent=Math.round(t.protein);NT.$('#proteinGoal').textContent=NT.state.goals.protein;
  NT.$('#carbsVal').textContent=Math.round(t.carbs);NT.$('#carbsGoal').textContent=NT.state.goals.carbs;
  NT.$('#fatVal').textContent=Math.round(t.fat);NT.$('#fatGoal').textContent=NT.state.goals.fat;
  NT.$('#fiberVal').textContent=Math.round(t.fiber);NT.$('#fiberGoal').textContent=NT.state.goals.fiber||30;
  NT.$('#sugarVal').textContent=Math.round(t.sugar);NT.$('#sugarGoal').textContent=NT.state.goals.sugar||50;

  // Protein per kg bodyweight
  const latestBW=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1].weight:Object.values(NT.state.weights).pop()||0;
  const pkgEl=NT.$('#proteinPerKg');
  if(pkgEl&&latestBW>0){pkgEl.textContent=(t.protein/latestBW).toFixed(1)+'g/kg';pkgEl.style.display='inline'}
  else if(pkgEl){pkgEl.style.display='none'}

  setRing('.calorie-fill',net,NT.state.goals.cal,82);
  
  // Macro bars with overflow handling
  const macros=[
    {bar:'#proteinBar',valEl:'#proteinVal',val:t.protein,goal:NT.state.goals.protein},
    {bar:'#carbsBar',valEl:'#carbsVal',val:t.carbs,goal:NT.state.goals.carbs},
    {bar:'#fatBar',valEl:'#fatVal',val:t.fat,goal:NT.state.goals.fat},
    {bar:'#fiberBar',valEl:'#fiberVal',val:t.fiber,goal:NT.state.goals.fiber||30},
    {bar:'#sugarBar',valEl:'#sugarVal',val:t.sugar,goal:NT.state.goals.sugar||50}
  ];
  macros.forEach(({bar,valEl,val,goal})=>{
    const el=NT.$(bar);if(!el)return;
    const pct=val/goal*100;
    el.style.width=Math.min(pct,100)+'%';
    const vEl=NT.$(valEl);
    if(pct>100){
      el.classList.add('over');
      if(vEl)vEl.style.color='var(--danger)';
    } else {
      el.classList.remove('over');
      if(vEl)vEl.style.color='';
    }
  });

  renderWater(log.water||0);
  // Date
  const d=new Date(NT.state.currentDate+'T12:00:00'),today=todayStr();
  if(NT.state.currentDate===today)NT.$('#dateDisplay').textContent='Today';
  else if(NT.state.currentDate===shiftDate(today,-1))NT.$('#dateDisplay').textContent='Yesterday';
  else NT.$('#dateDisplay').textContent=d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  updateStreak();
}

function renderItems(meal,items){
  const c=NT.$(`#${meal}Items`);if(!c)return;c.innerHTML='';
  items.forEach((item,idx)=>{
    const div=document.createElement('div');div.className='food-item';
    const fi=Math.round(item.fiber||0),su=Math.round(item.sugar||0);
    const extraMacros=(fi?`<span class="fi">Fi${fi}g</span>`:'')+
                      (su?`<span class="s">S${su}g</span>`:'');
    div.innerHTML=`<div class="food-item-info"><div class="food-item-name">${esc(item.name)}</div><div class="food-item-serving">${esc(item.servingText||'')}</div><div class="food-item-macros"><span class="p">P${Math.round(item.protein)}g</span><span class="c">C${Math.round(item.carbs)}g</span><span class="f">F${Math.round(item.fat)}g</span>${extraMacros}</div></div><div class="food-item-cal">${Math.round(item.cal)}</div><button class="food-item-delete" aria-label="Remove"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    div.querySelector('.food-item-delete').addEventListener('click',()=>{dayLog(NT.state.currentDate)[meal].splice(idx,1);saveAll();updateDiary();toast('Removed','info')});
    c.appendChild(div);
  });
}

function renderExercise(){
  const c=NT.$('#exerciseItems');c.innerHTML='';
  (NT.state.exercises[NT.state.currentDate]||[]).forEach((ex,idx)=>{
    const div=document.createElement('div');div.className='food-item';
    div.innerHTML=`<div class="food-item-info"><div class="food-item-name">${esc(ex.name)}</div><div class="food-item-serving">${ex.duration} min</div></div><div class="food-item-cal" style="color:var(--protein)">-${ex.cal}</div><button class="food-item-delete" aria-label="Remove"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    div.querySelector('.food-item-delete').addEventListener('click',()=>{NT.state.exercises[NT.state.currentDate].splice(idx,1);saveAll();updateDiary()});
    c.appendChild(div);
  });
}

function renderWater(filled){
  const wg=NT.$('#waterGlasses');wg.innerHTML='';
  for(let i=0;i<NT.state.goals.water;i++){
    const b=document.createElement('button');b.className='water-glass'+(i<filled?' filled':'');
    b.textContent=i<filled?'💧':'○';
    b.addEventListener('click',()=>{dayLog(NT.state.currentDate).water=i<filled?i:i+1;saveAll();updateDiary()});
    wg.appendChild(b);
  }
  NT.$('#waterCount').textContent=`${filled} / ${NT.state.goals.water}`;
}

function updateStreak(){
  let streak=0,d=todayStr();
  while(true){const l=NT.state.logs[d];if(l&&['breakfast','lunch','dinner','snacks'].some(m=>(l[m]||[]).length>0)){streak++;d=shiftDate(d,-1)}else break}
  NT.$('#streakCount').textContent=streak;
  if(NT.$('#currentStreakVal'))NT.$('#currentStreakVal').textContent=streak;
}

// NL Parser
function parseNL(text){
  const items=[];
  const parts=text.toLowerCase().replace(/,/g,' and ').split(/\s+and\s+|\s+with\s+|\s*\+\s*/).map(s=>s.trim()).filter(Boolean);
  parts.forEach(part=>{
    let qty=1,unit=null,foodText=part;
    const qm=part.match(/^(\d+\.?\d*)\s*(g|oz|cup|cups|tbsp|tsp|slice|slices|piece|pieces|scoop|scoops|large|medium|small|ml|can|bowl|plate|serving|servings)?\s*(.+)/i);
    const hm=part.match(/^(half|a half|1\/2)\s+(.+)/i);
    const am=part.match(/^(a|an|one)\s+(.+)/i);
    if(qm){qty=parseFloat(qm[1]);unit=qm[2]?qm[2].toLowerCase().replace(/s$/,''):null;foodText=qm[3].trim()}
    else if(hm){qty=0.5;foodText=hm[2].trim()}
    else if(am){qty=1;foodText=am[2].trim()}
    let fid=FOOD_ALIASES[foodText];
    if(!fid){const w=foodText.split(/\s+/);for(let l=w.length;l>0&&!fid;l--)fid=FOOD_ALIASES[w.slice(0,l).join(' ')]}
    if(!fid){const found=FOOD_DB.find(f=>f.name.toLowerCase().includes(foodText));if(found)fid=found.id}
    if(fid){
      const food=findFood(fid);if(!food)return;
      let grams;
      if(unit==='g')grams=qty;else if(unit==='oz')grams=qty*28.35;else if(unit==='ml')grams=qty;
      else if(unit){const srv=food.servings.find(s=>s.name.toLowerCase().includes(unit));grams=srv?qty*srv.g:qty*food.servings[0].g}
      else grams=qty*food.servings[0].g;
      const m=grams/100;
      items.push({name:food.name,foodId:food.id,cal:food.cal*m,protein:food.protein*m,carbs:food.carbs*m,fat:food.fat*m,fiber:food.fiber*m,sugar:food.sugar*m,servingText:`${qty} ${unit||food.servings[0].name} (${Math.round(grams)}g)`,grams});
    }
  });
  return items;
}

async function geminiAnalyze(input,isImage=false){
  if(!NT.state.geminiKey)return null;
  const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${NT.state.geminiKey}`;
  const sp=`You are a nutrition analyzer for a calorie tracking app.

RULES:
1. Return ONLY a valid JSON array. No markdown, no text, no code fences.
2. Format: [{"name":"string","cal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"servingText":"string"}]
3. Break down each component separately.
4. IMPORTANT: Raw chicken breast = 120 cal/100g (NOT 165 — that is cooked). Use raw values when user specifies raw weight.
5. cal = total calories for the ENTIRE stated portion.
6. servingText = the portion as described.`;
  let parts;
  if(isImage)parts=[{text:sp},{text:"Analyze this food image and return nutrition JSON:"},{inline_data:input}];
  else parts=[{text:sp},{text:`Analyze and return JSON: "${input}"`}];
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0.1,maxOutputTokens:2048}})});
    if(!res.ok)throw new Error(`API ${res.status}`);
    const data=await res.json();
    let text=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    text=text.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    return JSON.parse(text);
  }catch(e){console.error('Gemini:',e);return null}
}
