// NutriTrack AI — Body Tab Logic
document.addEventListener('DOMContentLoaded',()=>{
  // State is initialized in core.js — no need to re-init here

  const $=s=>NT.$(s);

  // ═══ PROFILE ═══
  function loadProfile(){
    const p=NT.state.profile;
    if(p.dob)$('#bodyDob').value=p.dob;
    $('#bodySex').value=p.sex||'male';
    if(p.height)$('#bodyHeight').value=p.height;
    $('#bodyActivity').value=p.activity||1.55;
    updateHipRow();
  }
  function updateHipRow(){
    const row=$('#hipRow');
    if(row)row.style.display=$('#bodySex').value==='female'?'':'none';
  }
  $('#bodySex')?.addEventListener('change',updateHipRow);

  $('#saveProfile')?.addEventListener('click',()=>{
    NT.state.profile.dob=$('#bodyDob').value;
    NT.state.profile.sex=$('#bodySex').value;
    NT.state.profile.height=parseFloat($('#bodyHeight').value)||0;
    NT.state.profile.activity=parseFloat($('#bodyActivity').value)||1.55;
    saveAll();updateMetrics();toast('Profile saved','success');
  });

  // ═══ LOG BODY STATS ═══
  $('#logBodyStats')?.addEventListener('click',()=>{
    const weight=parseFloat($('#bodyWeight').value);
    if(!weight){toast('Enter weight','error');return}
    const entry={
      date:todayStr(),weight,
      waist:parseFloat($('#bodyWaist').value)||null,
      neck:parseFloat($('#bodyNeck').value)||null,
      hip:parseFloat($('#bodyHip').value)||null
    };
    const idx=NT.state.bodyLogs.findIndex(e=>e.date===entry.date);
    if(idx>=0)NT.state.bodyLogs[idx]=entry;
    else NT.state.bodyLogs.push(entry);
    NT.state.weights[entry.date]=weight;
    saveAll();updateMetrics();renderHistory();
    toast('Body stats logged','success');
  });

  // ═══ BODY GOALS ═══
  function loadGoals(){
    const g=NT.state.bodyGoals;
    if(g.targetWeight)$('#goalWeight').value=g.targetWeight;
    if(g.targetBf)$('#goalBf').value=g.targetBf;
    if(g.targetDate)$('#goalDate').value=g.targetDate;
  }
  $('#saveBodyGoals')?.addEventListener('click',()=>{
    NT.state.bodyGoals.targetWeight=parseFloat($('#goalWeight').value)||0;
    NT.state.bodyGoals.targetBf=parseFloat($('#goalBf').value)||0;
    NT.state.bodyGoals.targetDate=$('#goalDate').value;
    saveAll();updateMetrics();toast('Goals saved','success');
    generateGoalInsight();
  });

  // ═══ TRAINING ═══
  function loadTraining(){
    const t=NT.state.training;
    $('#gymDays').value=t.gym||0;
    $('#cardioDays').value=t.cardio||0;
    $('#trainingStyle').value=t.style||'strength';
  }
  $('#saveTraining')?.addEventListener('click',()=>{
    NT.state.training.gym=parseInt($('#gymDays').value)||0;
    NT.state.training.cardio=parseInt($('#cardioDays').value)||0;
    NT.state.training.style=$('#trainingStyle').value;
    saveAll();toast('Training saved','success');
  });

  // ═══ SMART NUTRITION GOALS ═══
  function loadNutritionGoals(){
    $('#bodyCalGoal').value=NT.state.goals.cal;
    $('#bodyProteinGoal').value=NT.state.goals.protein;
    $('#bodyCarbsGoal').value=NT.state.goals.carbs;
    $('#bodyFatGoal').value=NT.state.goals.fat;
    $('#bodyFiberGoal').value=NT.state.goals.fiber||30;
    $('#bodySugarGoal').value=NT.state.goals.sugar||50;
    $('#bodyWaterGoal').value=NT.state.goals.water;
    updateMacroHints();
  }

  // Live calorie hint updates when macros change
  ['bodyProteinGoal','bodyCarbsGoal','bodyFatGoal'].forEach(id=>{
    $('#'+id)?.addEventListener('input',updateMacroHints);
  });

  function updateMacroHints(){
    const p=parseInt($('#bodyProteinGoal').value)||0;
    const c=parseInt($('#bodyCarbsGoal').value)||0;
    const f=parseInt($('#bodyFatGoal').value)||0;
    const pCal=p*4,cCal=c*4,fCal=f*9;
    const total=pCal+cCal+fCal;
    const budget=parseInt($('#bodyCalGoal').value)||0;

    $('#proteinCalHint').textContent=pCal+'cal';
    $('#carbsCalHint').textContent=cCal+'cal';
    $('#fatCalHint').textContent=fCal+'cal';
    $('#macroTotalCal').textContent=total;

    const totalRow=$('#macroTotalRow');
    if(budget&&Math.abs(total-budget)>50){
      totalRow.classList.add('over');
      $('#macroTotalCal').textContent=total+' ('+((total>budget?'+':'')+Math.round(total-budget))+')';
    } else {
      totalRow.classList.remove('over');
    }
  }

  // ═══ AUTO-CALCULATE MACROS ═══
  $('#autoCalcMacros')?.addEventListener('click',()=>{
    const cal=parseInt($('#bodyCalGoal').value);
    if(!cal||cal<800){toast('Set a calorie budget first (800+)','error');return}

    const latest=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1]:null;
    const weight=latest?latest.weight:75; // fallback
    const p=NT.state.profile;
    const t=NT.state.training;
    const g=NT.state.bodyGoals;

    // Determine if cutting, maintaining, or bulking
    let phase='maintain';
    if(g.targetWeight&&latest){
      if(g.targetWeight<latest.weight-1)phase='cut';
      else if(g.targetWeight>latest.weight+1)phase='bulk';
    }

    // Calculate BF% for lean mass estimate
    let leanMass=weight*0.80; // default 20% BF assumption
    if(latest&&latest.waist&&latest.neck&&p.height){
      let bf;
      if(p.sex==='male')bf=495/(1.0324-0.19077*Math.log10(latest.waist-latest.neck)+0.15456*Math.log10(p.height))-450;
      else if(latest.hip)bf=495/(1.29579-0.35004*Math.log10(latest.waist+latest.hip-latest.neck)+0.22100*Math.log10(p.height))-450;
      if(bf)leanMass=weight*(1-Math.max(3,Math.min(50,bf))/100);
    }

    // PROTEIN: based on lean mass + training + phase
    let proteinPerKg;
    if(t.style==='strength'||t.style==='mixed'){
      proteinPerKg=phase==='cut'?2.4:phase==='bulk'?2.0:2.2; // g per kg lean mass
    } else if(t.style==='endurance'){
      proteinPerKg=phase==='cut'?2.0:1.6;
    } else {
      proteinPerKg=phase==='cut'?2.0:1.5;
    }
    let protein=Math.round(leanMass*proteinPerKg);

    // FAT: 25% of calories (floor), adjust for phase
    let fatPct=phase==='cut'?0.22:phase==='bulk'?0.28:0.25;
    let fat=Math.round((cal*fatPct)/9);
    fat=Math.max(fat,Math.round(weight*0.7)); // minimum 0.7g/kg for hormones

    // CARBS: remaining calories
    let proteinCal=protein*4;
    let fatCal=fat*9;
    let carbCal=cal-proteinCal-fatCal;
    if(carbCal<0){
      // Protein too high for budget, scale down
      protein=Math.round((cal-fatCal-100)/4); // leave 100 cal for carbs
      proteinCal=protein*4;
      carbCal=cal-proteinCal-fatCal;
    }
    let carbs=Math.round(carbCal/4);
    carbs=Math.max(carbs,30); // min 30g carbs

    // Set values
    $('#bodyProteinGoal').value=protein;
    $('#bodyCarbsGoal').value=carbs;
    $('#bodyFatGoal').value=fat;
    updateMacroHints();

    const phaseEmoji=phase==='cut'?'🔻':phase==='bulk'?'🔺':'⚖️';
    toast(`${phaseEmoji} Macros set for ${phase} (${Math.round(leanMass)}kg lean mass)`,'success');
  });

  $('#saveNutritionGoals')?.addEventListener('click',()=>{
    NT.state.goals.cal=parseInt($('#bodyCalGoal').value)||2000;
    NT.state.goals.protein=parseInt($('#bodyProteinGoal').value)||150;
    NT.state.goals.carbs=parseInt($('#bodyCarbsGoal').value)||250;
    NT.state.goals.fat=parseInt($('#bodyFatGoal').value)||65;
    NT.state.goals.fiber=parseInt($('#bodyFiberGoal').value)||30;
    NT.state.goals.sugar=parseInt($('#bodySugarGoal').value)||50;
    NT.state.goals.water=parseInt($('#bodyWaterGoal').value)||8;
    saveAll();updateDiary();toast('Nutrition goals saved','success');
  });

  // ═══ AI NUTRITION INSIGHT ═══
  $('#generateNutritionInsight')?.addEventListener('click',async()=>{
    if(!hasAiKey()){toast('Set a Groq or Gemini API key first','error');return}
    const panel=$('#nutritionInsight');
    panel.innerHTML='<div class="ai-dot-pulse"><span></span><span></span><span></span></div>';

    const latest=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1]:null;
    const p=NT.state.profile;
    const g=NT.state.bodyGoals;
    const t=NT.state.training;
    const goals=NT.state.goals;

    const age=p.dob?Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000)):'unknown';
    const bf=$('#metricBf').textContent;
    const tdee=$('#metricTdee').textContent;

    let weeksLeft='no deadline';
    if(g.targetDate){
      const msLeft=new Date(g.targetDate)-new Date();
      weeksLeft=Math.max(1,Math.round(msLeft/(7*86400000)))+' weeks';
    }

    const sp='Sports nutrition expert. EXACTLY 5 numbered points, 1 sentence each. Bold key numbers. End with 1-line VERDICT. No intro. **bold** numbers.';
    const prompt=`DATA: ${age}yr ${p.sex}, ${p.height}cm, ${latest?latest.weight+'kg':'?'}, BF ${bf||'?'}, TDEE ${tdee}cal.\nTRAINING: Gym ${t.gym}x/wk (${t.style}), Cardio ${t.cardio}x/wk.\nGOAL: ${g.targetWeight||'?'}kg, ${g.targetBf||'?'}%BF. Deadline: ${g.targetDate||'none'} (${weeksLeft} from now).\nCURRENT: ${goals.cal}cal, P${goals.protein}g, C${goals.carbs}g, F${goals.fat}g.\n\nIMPORTANT: The deadline is ${weeksLeft} away. Use this for point #4.\nPoints: 1.Calorie target 2.Protein 3.Fat 4.Timeline (use ${weeksLeft}) 5.Key change.`;

    try{
      const text=await aiCall(sp,prompt,{temperature:0.3,maxTokens:4096});
      let html=text
        .split('\n')
        .filter(l=>l.trim())
        .map(line=>{
          line=line.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
          line=line.replace(/^(\d+)\.\s*/,'<span style="color:var(--accent);font-weight:800">$1.</span> ');
          if(/verdict|summary|bottom.line/i.test(line))line='<div style="margin-top:6px;padding:6px 8px;background:rgba(52,211,153,.1);border-radius:6px;font-weight:600">'+line+'</div>';
          return line;
        })
        .join('<br>');
      panel.innerHTML=html;
    }catch(e){panel.innerHTML='Error: '+e.message}
  });

  // ═══ METRICS CALCULATION ═══
  function updateMetrics(){
    const p=NT.state.profile;
    const latest=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1]:null;
    if(!latest)return;

    if(p.dob){
      const age=Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000));
      $('#metricAge').textContent=age;
    }

    if(p.height&&latest.weight){
      const hm=p.height/100;
      const bmi=(latest.weight/(hm*hm)).toFixed(1);
      $('#metricBmi').textContent=bmi;
      const tag=$('#bmiTag');
      if(bmi<18.5){tag.textContent='Underweight';tag.className='metric-tag tag-under'}
      else if(bmi<25){tag.textContent='Normal';tag.className='metric-tag tag-normal'}
      else if(bmi<30){tag.textContent='Overweight';tag.className='metric-tag tag-over'}
      else{tag.textContent='Obese';tag.className='metric-tag tag-obese'}
    }

    if(latest.waist&&latest.neck&&p.height){
      let bf;
      if(p.sex==='male')bf=495/(1.0324-0.19077*Math.log10(latest.waist-latest.neck)+0.15456*Math.log10(p.height))-450;
      else if(latest.hip)bf=495/(1.29579-0.35004*Math.log10(latest.waist+latest.hip-latest.neck)+0.22100*Math.log10(p.height))-450;
      if(bf!==undefined){
        bf=Math.max(3,Math.min(50,bf));
        $('#metricBf').textContent=bf.toFixed(1)+'%';
        const lean=(latest.weight*(1-bf/100)).toFixed(1);
        $('#metricLean').textContent=lean;
      }
    }

    if(p.height&&p.dob&&latest.weight){
      const age=Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000));
      let bmr=p.sex==='male'?10*latest.weight+6.25*p.height-5*age+5:10*latest.weight+6.25*p.height-5*age-161;
      $('#metricBmr').textContent=Math.round(bmr);
    }

    calcAdaptiveTDEE();
  }

  // ═══ ADAPTIVE TDEE ═══
  function calcAdaptiveTDEE(){
    const logs=NT.state.bodyLogs.sort((a,b)=>a.date.localeCompare(b.date));
    if(logs.length<2){
      $('#metricTdee').textContent='--';
      const p=NT.state.profile;
      const latest=logs[logs.length-1];
      if(latest&&p.height&&p.dob){
        const age=Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000));
        let bmr=p.sex==='male'?10*latest.weight+6.25*p.height-5*age+5:10*latest.weight+6.25*p.height-5*age-161;
        const tdee=Math.round(bmr*(p.activity||1.55));
        $('#metricTdee').textContent='~'+tdee;
        $('#tdeeExplainer').innerHTML=`<small>Formula estimate: <strong>${tdee} cal/day</strong>. Becomes adaptive after 2+ weeks of data.</small>`;
      } else {
        $('#tdeeExplainer').innerHTML='<small>Log weight + calories for 2+ weeks for adaptive TDEE.</small>';
      }
      return;
    }

    const pairs=[];
    logs.forEach(entry=>{
      const dayData=NT.state.logs[entry.date];
      if(!dayData)return;
      let cal=0;
      ['breakfast','lunch','dinner','snacks'].forEach(m=>(dayData[m]||[]).forEach(i=>cal+=i.cal||0));
      if(cal>0)pairs.push({date:entry.date,weight:entry.weight,cal});
    });

    if(pairs.length<2){$('#metricTdee').textContent='--';return}

    const recent=pairs.slice(-28);
    const first=recent[0],last=recent[recent.length-1];
    const days=Math.max(1,(new Date(last.date)-new Date(first.date))/(86400000));
    const weightChange=last.weight-first.weight;
    const avgCal=recent.reduce((s,p)=>s+p.cal,0)/recent.length;
    const tdee=Math.round(avgCal-(weightChange*7700)/days);

    if(tdee>=800&&tdee<=5000){
      $('#metricTdee').textContent=tdee;
      const status=weightChange<-0.1?'losing':weightChange>0.1?'gaining':'maintaining';
      const rate=Math.abs(weightChange/days*7).toFixed(2);
      $('#tdeeExplainer').innerHTML=`<small>Based on <strong>${recent.length} data points</strong> over <strong>${Math.round(days)} days</strong>. ${status} ~${rate} kg/week.</small>`;
    } else {
      const p=NT.state.profile;const latest=logs[logs.length-1];
      if(p.height&&p.dob){
        const age=Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000));
        let bmr=p.sex==='male'?10*latest.weight+6.25*p.height-5*age+5:10*latest.weight+6.25*p.height-5*age-161;
        const formulaTdee=Math.round(bmr*(p.activity||1.55));
        $('#metricTdee').textContent='~'+formulaTdee;
        $('#tdeeExplainer').innerHTML=`<small>Insufficient data. Formula estimate: ${formulaTdee} cal/day.</small>`;
      }
    }
  }

  // ═══ GOAL INSIGHT (AI) ═══
  async function generateGoalInsight(){
    const g=NT.state.bodyGoals;
    const latest=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1]:null;
    if(!latest||!g.targetWeight||!hasAiKey())return;
    const insight=$('#goalInsight');
    insight.classList.remove('hidden');
    insight.innerHTML='<div class="ai-dot-pulse"><span></span><span></span><span></span></div>';
    const tdeeText=$('#metricTdee').textContent;
    const bfText=$('#metricBf').textContent;
    const t=NT.state.training;
    let weeksLeft='no deadline';
    if(g.targetDate){
      const msLeft=new Date(g.targetDate)-new Date();
      weeksLeft=Math.max(1,Math.round(msLeft/(7*86400000)))+' weeks';
    }
    const sp='Sports nutrition advisor. Be direct, use **bold** for numbers. Max 3 sentences.';
    const prompt=`Current: ${latest.weight}kg, BF ${bfText}. Target: ${g.targetWeight}kg, ${g.targetBf}%BF. Deadline: ${g.targetDate||'none'} (${weeksLeft} away). TDEE: ${tdeeText}cal. Training: gym ${t.gym}x/wk, cardio ${t.cardio}x/wk. Is this realistic in ${weeksLeft}? What calorie target? Rate of loss/gain needed?`;
    try{
      const text=await aiCall(sp,prompt,{temperature:0.3,maxTokens:1024});
      insight.innerHTML='✨ '+text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
    }catch(e){insight.innerHTML='Could not generate AI insight.'}
  }

  // ═══ HISTORY ═══
  function renderHistory(){
    const hist=$('#bodyHistory');if(!hist)return;
    const logs=[...NT.state.bodyLogs].sort((a,b)=>b.date.localeCompare(a.date));
    if(!logs.length){hist.innerHTML='<p class="muted-text">Log your first body stats above</p>';return}
    // Header row
    let html='<div class="body-entry body-entry-head"><span class="body-entry-date">Date</span><div class="body-entry-stats"><span>Weight</span><span>Waist</span><span>Neck</span><span>Calories</span></div><span style="width:24px"></span></div>';
    html+=logs.map(e=>{
      // Pull calories from diary for that day
      let dayCal='--';
      const dayData=NT.state.logs[e.date];
      if(dayData){
        let cal=0;
        ['breakfast','lunch','dinner','snacks'].forEach(m=>(dayData[m]||[]).forEach(i=>cal+=i.cal||0));
        if(cal>0)dayCal=cal+'cal';
      }
      return `<div class="body-entry">
      <span class="body-entry-date">${new Date(e.date+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric'})}</span>
      <div class="body-entry-stats">
        <span>${e.weight}kg</span>
        <span>${e.waist?e.waist+'cm':'--'}</span>
        <span>${e.neck?e.neck+'cm':'--'}</span>
        <span>${dayCal}</span>
      </div>
      <button class="body-entry-del" data-idx="${NT.state.bodyLogs.indexOf(e)}" title="Delete">×</button>
    </div>`;
    }).join('');
    hist.innerHTML=html;
    hist.querySelectorAll('.body-entry-del').forEach(btn=>btn.addEventListener('click',()=>{
      NT.state.bodyLogs.splice(parseInt(btn.dataset.idx),1);
      saveAll();renderHistory();updateMetrics();
    }));
  }

  // ═══ RENDER ON TAB SWITCH ═══
  window.renderBody=function(){
    loadProfile();loadGoals();loadNutritionGoals();loadTraining();
    updateMetrics();renderHistory();
  };

  loadProfile();loadGoals();loadNutritionGoals();loadTraining();
});
