// NutriTrack AI — Core Module
const NT={
  state:{currentDate:todayStr(),goals:load('nt_goals')||{cal:2000,protein:150,carbs:250,fat:65,fiber:30,sugar:50,water:8},logs:load('nt_logs')||{},geminiKey:load('nt_gemini')||'',groqKey:load('nt_groq')||'',weights:load('nt_weights')||{},exercises:load('nt_exercises')||{},chatHistory:load('nt_chat')||[],profile:load('nt_profile')||{dob:'',sex:'male',height:0,activity:1.55},bodyLogs:load('nt_bodyLogs')||[],bodyGoals:load('nt_bodyGoals')||{targetWeight:0,targetBf:0,targetDate:''},training:load('nt_training')||{gym:3,cardio:0,style:'strength'},coachChats:load('nt_coachChats')||[],activeChatId:load('nt_activeChatId')||null,workoutTemplates:load('nt_workoutTpl')||{push:[{name:'Bench Press',weight:30,reps:12,sets:3},{name:'Incline Bench Press',weight:20,reps:12,sets:3},{name:'Tricep Pushdown Cable',weight:20,reps:12,sets:3},{name:'Tricep Back Extension',weight:12,reps:12,sets:3},{name:'Lateral Cable Raise',weight:8,reps:12,sets:3},{name:'Overhead Press',weight:30,reps:12,sets:3}],pull:[{name:'Lat Pulldown',weight:36,reps:12,sets:3},{name:'Seated Cable Rows',weight:30,reps:12,sets:3},{name:'Barbell Row',weight:30,reps:8,sets:5},{name:'Face Pull',weight:36,reps:12,sets:3},{name:'Hammer Curl',weight:8,reps:12,sets:3},{name:'Bicep Curl Dumbbell',weight:8,reps:12,sets:3}],legs:[{name:'Romanian Deadlift',weight:30,reps:8,sets:3},{name:'Leg Press',weight:50,reps:12,sets:3},{name:'Leg Curl',weight:21,reps:12,sets:3},{name:'Standing Calf Raises',weight:48,reps:12,sets:3}],cardio:{type:'Treadmill Incline Walk',incline:9,speedMin:3,speedMax:5,durationMin:25,durationMax:40},sequence:['push','pull','legs']}},
  $:s=>document.querySelector(s),
  $$:s=>document.querySelectorAll(s)
};
function todayStr(){return new Date().toISOString().slice(0,10)}
function load(k){try{return JSON.parse(localStorage.getItem(k))}catch{return null}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function saveAll(){save('nt_goals',NT.state.goals);save('nt_logs',NT.state.logs);save('nt_gemini',NT.state.geminiKey);save('nt_groq',NT.state.groqKey);save('nt_weights',NT.state.weights);save('nt_exercises',NT.state.exercises);save('nt_chat',NT.state.chatHistory);save('nt_profile',NT.state.profile);save('nt_bodyLogs',NT.state.bodyLogs);save('nt_bodyGoals',NT.state.bodyGoals);save('nt_training',NT.state.training);save('nt_coachChats',NT.state.coachChats);save('nt_activeChatId',NT.state.activeChatId);save('nt_workoutTpl',NT.state.workoutTemplates)}
function hasAiKey(){return !!(NT.state.groqKey||NT.state.geminiKey)}
function dayLog(d){if(!NT.state.logs[d])NT.state.logs[d]={breakfast:[],lunch:[],dinner:[],snacks:[],water:0,workout:null};return NT.state.logs[d]}
function findFood(id){return FOOD_DB.find(f=>f.id===id)}
function shiftDate(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function toast(msg,type='info'){const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;NT.$('#toastContainer').appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(16px)';el.style.transition='all .3s';setTimeout(()=>el.remove(),300)},2500)}

// Tab Navigation
document.addEventListener('DOMContentLoaded',()=>{
  // AI keys loaded from localStorage — user enters them in Settings
  
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
      // Defer heavy renders to next frame so tab swap is instant
      if(tab.dataset.tab==='progress'&&typeof renderProgress==='function')requestAnimationFrame(()=>renderProgress());
      if(tab.dataset.tab==='body'&&typeof renderBody==='function')requestAnimationFrame(()=>renderBody());
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

  // USDA FoodData Central API — 300K+ foods fallback
  const USDA_KEY='DEMO_KEY';
  async function searchUSDA(query){
    try{
      const res=await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=8&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&api_key=${USDA_KEY}`);
      if(!res.ok)return[];
      const data=await res.json();
      return(data.foods||[]).map(f=>{
        const get=(id)=>{const n=f.foodNutrients?.find(n=>n.nutrientId===id);return n?n.value:0};
        const servingG=f.servingSize||100;
        const servingName=f.householdServingFullText||'serving';
        return{
          id:'usda_'+f.fdcId,name:f.description.split(',').slice(0,3).join(','),
          cal:get(1008),protein:get(1003),carbs:get(1005),fat:get(1004),fiber:get(1079),sugar:get(2000),
          servings:[{name:servingName,g:servingG},{name:'g',g:1}],
          _usda:true
        };
      }).filter(f=>f.cal>0);
    }catch{return[]}
  }

  // Quick Add
  let sTimeout,usdaTimeout;
  const qi=NT.$('#quickAddInput'),sr=NT.$('#searchResults');
  qi.addEventListener('input',()=>{
    clearTimeout(sTimeout);clearTimeout(usdaTimeout);const v=qi.value.trim();
    if(v.length<2){sr.classList.add('hidden');return}
    sTimeout=setTimeout(()=>{
      const m=FOOD_DB.filter(f=>f.name.toLowerCase().includes(v.toLowerCase())).slice(0,8);
      if(m.length){
        sr.innerHTML=m.map(f=>`<div class="search-item" data-id="${f.id}"><div><div class="search-item-name">${esc(f.name)}</div><div class="search-item-serving">${f.servings[0].name} (${f.servings[0].g}g)</div></div><div class="search-item-cal">${Math.round(f.cal*f.servings[0].g/100)} kcal</div></div>`).join('');
        sr.classList.remove('hidden');
        sr.querySelectorAll('.search-item').forEach(el=>{el.addEventListener('click',()=>{openFoodModal(el.dataset.id,ms.value);sr.classList.add('hidden');qi.value=''})});
      }else{
        sr.innerHTML=`<div class="search-no-results"><span style="color:var(--text2)">"${esc(v)}" not in local DB</span><br><small style="color:var(--accent)">Searching USDA database...</small></div>`;
        sr.classList.remove('hidden');
        // Fallback: search USDA
        if(v.length>=3){
          usdaTimeout=setTimeout(async()=>{
            const usdaResults=await searchUSDA(v);
            if(usdaResults.length){
              // Temporarily add USDA results to FOOD_DB so openFoodModal works
              usdaResults.forEach(f=>{if(!FOOD_DB.find(x=>x.id===f.id))FOOD_DB.push(f)});
              sr.innerHTML=usdaResults.map(f=>`<div class="search-item" data-id="${f.id}"><div><div class="search-item-name">🌐 ${esc(f.name)}</div><div class="search-item-serving">${f.servings[0].name} (${f.servings[0].g}g)</div></div><div class="search-item-cal">${Math.round(f.cal*f.servings[0].g/100)} kcal</div></div>`).join('');
              sr.querySelectorAll('.search-item').forEach(el=>{el.addEventListener('click',()=>{openFoodModal(el.dataset.id,ms.value);sr.classList.add('hidden');qi.value=''})});
            }else{
              sr.innerHTML=`<div class="search-no-results"><span style="color:var(--text2)">No results for "${esc(v)}"</span><br><small style="color:var(--accent)">Press Enter to ask AI, or use AI Coach tab</small></div>`;
            }
          },300);
        }
      }
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
    if(hasAiKey()){
      NT.$('#aiProcessing').classList.remove('hidden');
      const ai=await geminiAnalyze(v);
      NT.$('#aiProcessing').classList.add('hidden');
      if(ai&&ai.length){
        const meal=ms.value,log=dayLog(NT.state.currentDate);
        ai.forEach(i=>{
          // Extract grams from AI servingText like "200g" or "1 cup (240g)"
          let g=100;
          const gm=(i.servingText||'').match(/(\d+\.?\d*)\s*g/i);
          if(gm)g=parseFloat(gm[1]);
          log[meal].push({name:i.name,cal:i.cal||0,protein:i.protein||0,carbs:i.carbs||0,fat:i.fat||0,fiber:i.fiber||0,sugar:i.sugar||0,servingText:i.servingText||'1 serving',foodId:'ai',grams:g});
        });
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
    if(!hasAiKey()){toast('Set a Groq or Gemini key in More tab','error');return}
    NT.$('#aiProcessing').classList.remove('hidden');
    try{
      const b64=await new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result.split(',')[1]);rd.onerror=j;rd.readAsDataURL(f)});
      const ai=await geminiAnalyze({mime_type:f.type,data:b64},true);
      NT.$('#aiProcessing').classList.add('hidden');
      if(ai&&ai.length){
        const meal=ms.value,log=dayLog(NT.state.currentDate);
        ai.forEach(i=>{
          let g=100;
          const gm=(i.servingText||'').match(/(\d+\.?\d*)\s*g/i);
          if(gm)g=parseFloat(gm[1]);
          log[meal].push({name:i.name,cal:i.cal||0,protein:i.protein||0,carbs:i.carbs||0,fat:i.fat||0,fiber:i.fiber||0,sugar:i.sugar||0,servingText:i.servingText||'1 serving',foodId:'ai_photo',grams:g});
        });
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
  // Backdrop click to close
  NT.$('#foodModal .modal-backdrop')?.addEventListener('click',()=>NT.$('#foodModal').classList.add('hidden'));
  
  // Food search in modal
  let modalUsdaTimeout;
  NT.$('#foodSearchInput').addEventListener('input',()=>{
    clearTimeout(modalUsdaTimeout);
    const v=NT.$('#foodSearchInput').value.trim().toLowerCase();
    if(v.length<2){NT.$('#foodSearchResults').innerHTML='';return}
    const m=FOOD_DB.filter(f=>f.name.toLowerCase().includes(v)).slice(0,10);
    if(m.length){
      NT.$('#foodSearchResults').innerHTML=m.map(f=>`<div class="search-item" data-id="${f.id}"><div class="search-item-name">${esc(f.name)}</div><div class="search-item-cal">${Math.round(f.cal*f.servings[0].g/100)} kcal / ${f.servings[0].name}</div></div>`).join('');
    }else{
      NT.$('#foodSearchResults').innerHTML=`<div class="search-no-results" style="padding:12px;color:var(--text2);font-size:.8rem;text-align:center">Searching USDA for "${esc(v)}"...</div>`;
      if(v.length>=3){
        modalUsdaTimeout=setTimeout(async()=>{
          const usdaResults=await searchUSDA(v);
          if(usdaResults.length){
            usdaResults.forEach(f=>{if(!FOOD_DB.find(x=>x.id===f.id))FOOD_DB.push(f)});
            NT.$('#foodSearchResults').innerHTML=usdaResults.map(f=>`<div class="search-item" data-id="${f.id}"><div class="search-item-name">🌐 ${esc(f.name)}</div><div class="search-item-cal">${Math.round(f.cal*f.servings[0].g/100)} kcal / ${f.servings[0].name}</div></div>`).join('');
          }else{
            NT.$('#foodSearchResults').innerHTML=`<div class="search-no-results" style="padding:12px;color:var(--text2);font-size:.8rem;text-align:center">No results for "${esc(v)}"<br><small style="color:var(--accent)">Try AI Coach tab</small></div>`;
          }
          // Re-bind click handlers
          NT.$('#foodSearchResults').querySelectorAll('.search-item').forEach(el=>{
            el.addEventListener('click',()=>{selectedFood=findFood(el.dataset.id);if(!selectedFood)return;NT.$('#foodDetailSection').classList.remove('hidden');NT.$('#selectedFoodName').textContent=selectedFood.name;NT.$('#servingQty').value=1;NT.$('#servingUnit').innerHTML=selectedFood.servings.map((s,i)=>`<option value="${i}">${s.name} (${s.g}g)</option>`).join('');updPreview();NT.$('#foodSearchResults').innerHTML='';NT.$('#foodSearchInput').value=''});
          });
        },400);
      }
    }
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
  NT.$('#exerciseModal .modal-backdrop')?.addEventListener('click',()=>NT.$('#exerciseModal').classList.add('hidden'));
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
      const eased=1-Math.pow(1-progress,3);
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
    ringFill.style.stroke=isOver?'url(#calGradOver)':'url(#calGrad)';
  }
  if(ringBg){
    ringBg.style.stroke=isOver?'rgba(255,69,58,.12)':'rgba(255,255,255,.04)';
  }
  
  // Remaining text
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

  // ═══ YESTERDAY GHOST RING ═══
  const yesterdayDate=shiftDate(NT.state.currentDate,-1);
  const yLog=NT.state.logs[yesterdayDate];
  let yCal=0;
  if(yLog)['breakfast','lunch','dinner','snacks'].forEach(m=>(yLog[m]||[]).forEach(i=>yCal+=i.cal));
  setRing('#yesterdayRing',yCal,NT.state.goals.cal,82);

  // ═══ MEAL SEGMENT DOTS ═══
  const mealDots=NT.$('#mealDots');
  if(mealDots){
    mealDots.innerHTML='';
    const mealColors={breakfast:'#FFD60A',lunch:'#FF9F0A',dinner:'#5E5CE6',snacks:'#FF6482'};
    let cumCal=0;
    ['breakfast','lunch','dinner','snacks'].forEach(meal=>{
      let mc=0;
      (log[meal]||[]).forEach(i=>mc+=i.cal);
      if(mc>0){
        cumCal+=mc;
        const pct=Math.min(cumCal/NT.state.goals.cal,1);
        const angle=-Math.PI/2+pct*Math.PI*2;
        const dotR=82;
        const x=100+Math.cos(angle)*dotR;
        const y=100+Math.sin(angle)*dotR;
        const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
        dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','4');
        dot.setAttribute('fill',mealColors[meal]);dot.setAttribute('stroke','#000');dot.setAttribute('stroke-width','2');
        mealDots.appendChild(dot);
      }
    });
  }

  // ═══ TIME-BASED PACING ═══
  const pacingRow=NT.$('#pacingRow');
  const pacingText=NT.$('#pacingText');
  const pacingIcon=NT.$('#pacingIcon');
  const pacingDetail=NT.$('#pacingDetail');
  if(pacingRow&&NT.state.currentDate===todayStr()){
    const now=new Date();
    const hoursPassed=now.getHours()+now.getMinutes()/60;
    const dayFraction=Math.min(hoursPassed/16,1); // 16 waking hours (6am-10pm)
    const expectedCal=Math.round(NT.state.goals.cal*dayFraction);
    const diff=Math.round(t.cal-expectedCal);
    const timeLabel=now.toLocaleTimeString('en',{hour:'numeric',minute:'2-digit',hour12:true});
    pacingRow.style.display='';
    if(isOver){
      pacingRow.className='pacing-row over';
      pacingIcon.textContent='⚠️';
      pacingText.textContent=Math.round(net-NT.state.goals.cal)+' cal over your daily budget';
      if(pacingDetail) pacingDetail.textContent=`You've hit ${Math.round(t.cal)} cal — your target is ${NT.state.goals.cal}`;
    } else if(diff>100){
      pacingRow.className='pacing-row behind';
      pacingIcon.textContent='⏫';
      pacingText.textContent=diff+' cal ahead of pace';
      if(pacingDetail) pacingDetail.textContent=`Eaten ${Math.round(t.cal)} cal · expected ~${expectedCal} by ${timeLabel}`;
    } else if(diff<-100){
      pacingRow.className='pacing-row ahead';
      pacingIcon.textContent='✅';
      pacingText.textContent=Math.abs(diff)+' cal under pace';
      if(pacingDetail) pacingDetail.textContent=`Eaten ${Math.round(t.cal)} cal · expected ~${expectedCal} by ${timeLabel}. Room to eat more.`;
    } else {
      pacingRow.className='pacing-row on-pace';
      pacingIcon.textContent='⏱';
      pacingText.textContent='On pace';
      if(pacingDetail) pacingDetail.textContent=`Eaten ${Math.round(t.cal)} cal · expected ~${expectedCal} by ${timeLabel}`;
    }
  } else if(pacingRow){
    pacingRow.style.display='none';
  }

  // ═══ CALORIE RATIO BAR ═══
  const pCal=t.protein*4,cCal=t.carbs*4,fCal=t.fat*9;
  const totalMacroCal=pCal+cCal+fCal;
  if(totalMacroCal>0){
    const pP=pCal/totalMacroCal*100,cP=cCal/totalMacroCal*100,fP=fCal/totalMacroCal*100;
    const rp=NT.$('#ratioProtein');if(rp)rp.style.width=pP+'%';
    const rc=NT.$('#ratioCarbs');if(rc)rc.style.width=cP+'%';
    const rf=NT.$('#ratioFat');if(rf)rf.style.width=fP+'%';
    const rlp=NT.$('#ratioProteinLabel');if(rlp)rlp.textContent='P '+Math.round(pP)+'%';
    const rlc=NT.$('#ratioCarbsLabel');if(rlc)rlc.textContent='C '+Math.round(cP)+'%';
    const rlf=NT.$('#ratioFatLabel');if(rlf)rlf.textContent='F '+Math.round(fP)+'%';
  }

  NT.$('#proteinVal').textContent=Math.round(t.protein);NT.$('#proteinGoal').textContent=NT.state.goals.protein;
  NT.$('#carbsVal').textContent=Math.round(t.carbs);NT.$('#carbsGoal').textContent=NT.state.goals.carbs;
  NT.$('#fatVal').textContent=Math.round(t.fat);NT.$('#fatGoal').textContent=NT.state.goals.fat;
  NT.$('#fiberVal').textContent=Math.round(t.fiber);NT.$('#fiberGoal').textContent=NT.state.goals.fiber||30;
  NT.$('#sugarVal').textContent=Math.round(t.sugar);NT.$('#sugarGoal').textContent=NT.state.goals.sugar||50;

  // ═══ REMAINING GRAMS ═══
  // (Cleaned: removed per-macro 'Xg left' and 'cal contribution' labels for cleaner UI)
  // The P/C/F ratio bar above and X/Yg values already convey this info

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

  // ═══ NUTRIENT INSIGHT BADGES ═══
  const badgeContainer=NT.$('#insightBadges');
  if(badgeContainer&&t.cal>0){
    let badges=[];
    // Fiber
    const fiberPct=t.fiber/(NT.state.goals.fiber||30);
    if(fiberPct>=0.8)badges.push({text:'☑ Fiber',cls:'good'});
    else if(fiberPct>=0.4)badges.push({text:'◐ Fiber',cls:'warn'});
    else badges.push({text:'✗ Fiber',cls:'bad'});
    // Sugar
    const sugarPct=t.sugar/(NT.state.goals.sugar||50);
    if(sugarPct>1)badges.push({text:'⚠ Sugar high',cls:'bad'});
    else if(sugarPct>0.8)badges.push({text:'◐ Sugar',cls:'warn'});
    else badges.push({text:'☑ Sugar',cls:'good'});
    // Protein/kg
    if(latestBW>0){
      const pkg=t.protein/latestBW;
      if(pkg>=1.6)badges.push({text:'☑ '+pkg.toFixed(1)+'g/kg',cls:'good'});
      else if(pkg>=1.0)badges.push({text:'◐ '+pkg.toFixed(1)+'g/kg',cls:'warn'});
      else badges.push({text:'✗ '+pkg.toFixed(1)+'g/kg',cls:'bad'});
    }
    // Calorie status
    if(!isOver&&net>0){
      const calPct=net/NT.state.goals.cal;
      if(calPct>=0.8&&calPct<=1.05)badges.push({text:'☑ Cal on target',cls:'good'});
    }
    badgeContainer.innerHTML=badges.map(b=>`<span class="insight-badge ${b.cls}">${b.text}</span>`).join('');
  } else if(badgeContainer){
    badgeContainer.innerHTML='';
  }

  // ═══ DAILY GRADE ═══
  const gradeEl=NT.$('#dailyGrade');
  if(gradeEl&&t.cal>0){
    const scores=[];
    const calScore=Math.max(0,100-Math.abs(net/NT.state.goals.cal-1)*100);scores.push(calScore);
    const proScore=Math.max(0,100-Math.abs(t.protein/NT.state.goals.protein-1)*80);scores.push(proScore);
    const carbScore=Math.max(0,100-Math.abs(t.carbs/NT.state.goals.carbs-1)*80);scores.push(carbScore);
    const fatScore=Math.max(0,100-Math.abs(t.fat/NT.state.goals.fat-1)*80);scores.push(fatScore);
    const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
    let letter,color;
    if(avg>=90){letter='A';color='#30D158'}
    else if(avg>=75){letter='B';color='#5AC8FA'}
    else if(avg>=60){letter='C';color='#FFD60A'}
    else if(avg>=40){letter='D';color='#FF9F0A'}
    else{letter='F';color='#FF453A'}
    gradeEl.querySelector('.grade-letter').textContent=letter;
    gradeEl.querySelector('.grade-letter').style.color=color;
  } else if(gradeEl){
    gradeEl.querySelector('.grade-letter').textContent='--';
    gradeEl.querySelector('.grade-letter').style.color='var(--muted)';
  }

  // ═══ MEAL TIMING TIMELINE ═══
  const timelineBar=NT.$('#timelineBar');
  if(timelineBar){
    timelineBar.innerHTML='';
    const mealTColors={breakfast:'#FFD60A',lunch:'#FF9F0A',dinner:'#5E5CE6',snacks:'#FF6482'};
    const mealTLabels={breakfast:'B',lunch:'L',dinner:'D',snacks:'S'};
    const mealTNames={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',snacks:'Snacks'};
    const mealTimes={breakfast:8,lunch:13,dinner:19,snacks:16}; // default hours
    let hasMeals=false;
    ['breakfast','lunch','dinner','snacks'].forEach(meal=>{
      const items=log[meal]||[];
      if(items.length>0){
        hasMeals=true;
        const hr=items[0].time?parseInt(items[0].time.split(':')[0]):mealTimes[meal];
        let mc=0; items.forEach(i=>mc+=i.cal);
        const pct=Math.max(0,Math.min(((hr-6)/18)*100,100)); // 6am=0%, 12am=100%

        // Pill-shaped block with label
        const block=document.createElement('div');
        block.className='timeline-block';
        block.style.left=`${pct}%`;
        block.style.setProperty('--meal-color',mealTColors[meal]);
        block.innerHTML=`<span class="timeline-block-label">${mealTLabels[meal]}</span><span class="timeline-block-cal">${Math.round(mc)}</span>`;
        block.title=`${mealTNames[meal]} ~${hr}:00 \u2022 ${Math.round(mc)} cal`;
        timelineBar.appendChild(block);
      }
    });

    // Show/hide the "no meals" state
    const emptyMsg=NT.$('#timelineEmpty');
    if(emptyMsg) emptyMsg.style.display=hasMeals?'none':'block';

    // Position the "now" needle
    const needle=NT.$('#timelineNow');
    if(needle){
      if(NT.state.currentDate===todayStr()){
        const now=new Date();
        const nowHr=now.getHours()+now.getMinutes()/60;
        const nowPct=Math.max(0,Math.min(((nowHr-6)/18)*100,100));
        needle.style.left=nowPct+'%';
        needle.style.display='';
      } else {
        needle.style.display='none';
      }
    }
  }

  // Update timeline legend visibility
  const tLegend=NT.$('#timelineLegend');
  if(tLegend){
    const anyMeals=['breakfast','lunch','dinner','snacks'].some(m=>(log[m]||[]).length>0);
    tLegend.style.display=anyMeals?'flex':'none';
  }

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
    div.innerHTML=`<div class="food-item-info" style="cursor:pointer"><div class="food-item-name">${esc(item.name)}</div><div class="food-item-serving">${esc(item.servingText||'')}</div><div class="food-item-macros"><span class="p">P${Math.round(item.protein)}g</span><span class="c">C${Math.round(item.carbs)}g</span><span class="f">F${Math.round(item.fat)}g</span>${extraMacros}</div></div><div class="food-item-cal">${Math.round(item.cal)}</div><button class="food-item-delete" aria-label="Remove"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg></button>`;
    div.querySelector('.food-item-delete').addEventListener('click',(e)=>{e.stopPropagation();dayLog(NT.state.currentDate)[meal].splice(idx,1);saveAll();updateDiary();toast('Removed','info')});
    div.querySelector('.food-item-info').addEventListener('click',()=>openEditModal(meal,idx,item));
    c.appendChild(div);
  });
}

// ═══ EDIT FOOD ENTRY MODAL ═══
let editCtx=null; // {meal, idx, item, per100}

function openEditModal(meal,idx,item){
  const modal=NT.$('#editFoodModal');if(!modal)return;

  // Calculate per-100g base values for proportional scaling
  // If item came from DB and we know the food, use DB values; otherwise derive from current entry
  const food=item.foodId&&item.foodId!=='ai'&&item.foodId!=='ai_photo'?findFood(item.foodId):null;
  let per100;
  if(food){
    per100={cal:food.cal,protein:food.protein,carbs:food.carbs,fat:food.fat,fiber:food.fiber,sugar:food.sugar};
  } else {
    // Derive from current values — need a reference grams to back-calculate
    const g=item.grams||100; // fallback to 100g if unknown
    const m=g/100;
    per100={cal:item.cal/m,protein:item.protein/m,carbs:item.carbs/m,fat:item.fat/m,fiber:(item.fiber||0)/m,sugar:(item.sugar||0)/m};
  }

  let currentGrams=item.grams||0;
  if(!currentGrams){
    // Try to extract grams from servingText like "1 Large (50g)" or "200g"
    const gMatch=(item.servingText||'').match(/(\d+\.?\d*)\s*g(?:\b|\))/i);
    if(gMatch)currentGrams=parseFloat(gMatch[1]);
  }
  if(!currentGrams && per100.cal>0){
    // Reverse-calculate from calories using per-100g base
    currentGrams=Math.round(item.cal/per100.cal*100);
  }
  if(!currentGrams)currentGrams=100; // absolute last resort

  editCtx={meal,idx,item,per100,originalGrams:currentGrams};

  NT.$('#editFoodName').textContent=item.name;
  NT.$('#editGramsInput').value=Math.round(currentGrams);
  NT.$('#editMealSelect').value=meal;
  updateEditPreview();
  modal.classList.remove('hidden');
}

function updateEditPreview(){
  if(!editCtx)return;
  const g=parseFloat(NT.$('#editGramsInput').value)||0;
  const m=g/100;
  const p=editCtx.per100;
  NT.$('#editPreviewCal').textContent=Math.round(p.cal*m);
  NT.$('#editPreviewProtein').textContent=Math.round(p.protein*m)+'g';
  NT.$('#editPreviewCarbs').textContent=Math.round(p.carbs*m)+'g';
  NT.$('#editPreviewFat').textContent=Math.round(p.fat*m)+'g';
  NT.$('#editPreviewFiber').textContent=Math.round(p.fiber*m)+'g';
  NT.$('#editPreviewSugar').textContent=Math.round(p.sugar*m)+'g';
}

document.addEventListener('DOMContentLoaded',()=>{
  const modal=NT.$('#editFoodModal');if(!modal)return;

  NT.$('#editGramsInput').addEventListener('input',updateEditPreview);
  NT.$('#editFoodClose').addEventListener('click',()=>modal.classList.add('hidden'));

  NT.$('#editFoodSave').addEventListener('click',()=>{
    if(!editCtx)return;
    const g=parseFloat(NT.$('#editGramsInput').value)||0;
    if(g<=0){toast('Enter a valid weight','error');return}
    const m=g/100, p=editCtx.per100;
    const newMeal=NT.$('#editMealSelect').value;
    const log=dayLog(NT.state.currentDate);

    // Build updated entry
    const updated={
      ...editCtx.item,
      cal:p.cal*m, protein:p.protein*m, carbs:p.carbs*m,
      fat:p.fat*m, fiber:p.fiber*m, sugar:p.sugar*m,
      grams:g, servingText:`${Math.round(g)}g`
    };

    // If meal changed, remove from old and add to new
    if(newMeal!==editCtx.meal){
      log[editCtx.meal].splice(editCtx.idx,1);
      log[newMeal].push(updated);
    } else {
      log[editCtx.meal][editCtx.idx]=updated;
    }

    saveAll();updateDiary();
    modal.classList.add('hidden');
    toast('Updated '+updated.name,'success');
    editCtx=null;
  });
});


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

// ═══ UNIFIED AI CALL — Groq first, Gemini fallback ═══
async function aiCall(systemPrompt, userContent, options={}){
  const {temperature=0.1, maxTokens=2048, imageData=null, signal=null}=options;
  const providers=[];
  if(NT.state.groqKey)providers.push('groq');
  if(NT.state.geminiKey)providers.push('gemini');
  if(!providers.length)throw new Error('No AI key set. Add a Groq or Gemini key in Settings.');

  for(const provider of providers){
    try{
      let text;
      if(provider==='groq'){
        const messages=[{role:'system',content:systemPrompt}];
        if(imageData){
          messages.push({role:'user',content:[{type:'text',text:userContent},{type:'image_url',image_url:{url:`data:${imageData.mime_type};base64,${imageData.data}`}}]});
        } else {
          messages.push({role:'user',content:userContent});
        }
        const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${NT.state.groqKey}`},
          body:JSON.stringify({model:imageData?'meta-llama/llama-4-scout-17b-16e-instruct':'qwen/qwen3-32b',messages,temperature,max_completion_tokens:maxTokens}),
          signal
        });
        if(!res.ok){
          const errText=await res.text().catch(()=>'');
          console.warn(`Groq ${res.status}:`,errText.slice(0,200));
          if(providers.includes('gemini')&&provider==='groq')continue; // fallback
          throw new Error(`Groq API ${res.status}`);
        }
        const data=await res.json();
        text=data.choices?.[0]?.message?.content||'';
      } else {
        // Gemini
        let parts;
        if(imageData)parts=[{text:systemPrompt},{text:userContent},{inline_data:imageData}];
        else parts=[{text:systemPrompt},{text:userContent}];
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${NT.state.geminiKey}`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({contents:[{parts}],generationConfig:{temperature,maxOutputTokens:maxTokens}}),
          signal
        });
        if(!res.ok){
          const errText=await res.text().catch(()=>'');
          throw new Error(`Gemini API ${res.status}: ${errText.slice(0,200)}`);
        }
        const data=await res.json();
        text=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
      }
      // Strip <think> tags — extract thinking for UI, return clean text
      let thinking='';
      const thinkMatch=text.match(/<think>([\s\S]*?)<\/think>/i);
      if(thinkMatch){
        thinking=thinkMatch[1].trim();
        text=text.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
      }
      const clean=text.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      // Return object with thinking if present, otherwise just the string
      if(thinking) return {text:clean, thinking};
      return clean;
    }catch(e){
      if(e.name==='AbortError')throw e;
      console.warn(`${provider} failed:`,e.message);
      if(provider===providers[providers.length-1])throw e; // last provider, rethrow
      // otherwise continue to next provider
    }
  }
  throw new Error('All AI providers failed');
}

async function geminiAnalyze(input,isImage=false){
  if(!hasAiKey())return null;
  const sp=`You are a precision nutrition analyzer. Your job: return accurate calorie and macro data.

OUTPUT FORMAT (strict):
Return ONLY a valid JSON array. No markdown, no text, no code fences, no thinking tags.
Format: [{"name":"string","cal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"servingText":"string"}]

HOW TO ANALYZE:

FOR IMAGES:
1. FIRST check if there is a NUTRITION LABEL or PACKAGING visible. If yes, READ the label values directly — they are the most accurate source. Extract serving size, calories, protein, carbs, fat from the printed label.
2. If no label visible, identify each food item visually. Estimate portion size using visual cues (plate size ~25cm, hand comparison, typical restaurant serving).
3. For packaged/branded foods (e.g. Dawn bread, Sabroso, K&N's), use the known published nutrition info for that brand.

FOR TEXT:
1. Identify each food item and the stated quantity.
2. Think about what goes INTO the dish — main ingredient + oil/ghee + spices + sides.
3. South Asian home-cooked dishes typically use 1-2 tbsp oil/ghee per serving (120-250 extra cal). Account for this.

ACCURACY — INGREDIENT DECOMPOSITION METHOD:
NEVER estimate a whole dish. ALWAYS decompose into ingredients:

1. IDENTIFY each ingredient and its weight (e.g. "dal" → lentils 150g + oil 1 tbsp + onion/tomato 50g)
2. CALCULATE macros per ingredient using these anchors:
   Proteins: Chicken (cooked) 31gP/0gC/3.6gF per 100g. Beef (cooked) 26gP/0gC/11gF per 100g. Egg: 6.5gP/0.5gC/5gF. Lentils (cooked): 9gP/20gC/0.4gF per 100g.
   Carbs: Rice (cooked): 2.7gP/28gC/0.3gF per 100g. Roti (40g): 3.5gP/20gC/3gF. Naan (90g): 8gP/45gC/5gF.
   Fats: Oil/Ghee: 0gP/0gC/14gF per tbsp. Butter: 0gP/0gC/11gF per tbsp.
   Dairy: Yogurt: 3.5gP/4.7gC/3.3gF per 100g. Milk: 3.2gP/4.8gC/3.3gF per 100ml.
3. ADD COOKING FAT — desi dishes ALWAYS have oil/ghee:
   Light (dal, sabzi): +1 tbsp (14gF). Medium (karahi, keema): +2 tbsp (28gF). Heavy (nihari, halwa): +3 tbsp (42gF).
   ONLY skip if food is explicitly "plain", "boiled", "steamed", or "grilled".
4. SCALE TO PORTION: Reference values are per 100g. Multiply ALL values (P, C, F) by (portion_g / 100). NEVER use per-100g macros with a different portion's calories.
5. SUM all scaled ingredient macros → these are final P, C, F values.
6. DERIVE calories: cal = (P*4) + (C*4) + (F*9). Verify PER ITEM and TOTAL. If any item's macros don't match its calories, fix the scaling.
- servingText MUST include grams, e.g. "2 chapatis (80g)" or "1 cup rice (200g)".
- When a specific brand or weight is mentioned (e.g. "Dawn bread 25g"), use THAT exact weight.`;
  const userMsg=isImage?'Analyze this food image. If there is a nutrition label visible, READ it and use those exact values. Otherwise identify all food items and estimate portions accurately. Return nutrition JSON:':`Analyze and return JSON: "${input}"`;
  const imgData=isImage?input:null;
  try{
    let result=await aiCall(sp,userMsg,{temperature:0.1,maxTokens:2048,imageData:imgData});
    // aiCall may return {text, thinking} object or plain string
    const text=typeof result==='string'?result:result.text;
    return JSON.parse(text);
  }catch(e){console.error('AI analyze:',e);return null}
}
