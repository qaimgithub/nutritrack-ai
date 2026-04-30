// NutriTrack AI — Progress, Settings (Coach moved to coach.js)
document.addEventListener('DOMContentLoaded',()=>{

  // ═══ PROGRESS ═══
  window.renderProgress=function(){
    const cal=NT.$('#streakCalendar');if(!cal)return;cal.innerHTML='';
    const today=todayStr();

    // Build 28-day grid (4 rows x 7 cols), aligned to weekdays
    // Find the Monday 4 weeks ago
    const todayDate=new Date(today+'T12:00:00');
    const dayOfWeek=todayDate.getDay()||7; // Mon=1..Sun=7
    const startOffset=27+(dayOfWeek-1); // go back to fill 4 full weeks starting on Monday
    // Actually, we want 4 rows of 7, ending on today's weekday column
    // Simpler: fill 28 days ending today, grid will auto-flow
    const totalCells=28;

    for(let i=totalCells-1;i>=0;i--){
      const d=shiftDate(today,-i),div=document.createElement('div');
      div.className='streak-day';
      const l=NT.state.logs[d];
      let mealCount=0;
      if(l)['breakfast','lunch','dinner','snacks'].forEach(m=>{if((l[m]||[]).length>0)mealCount++});
      // Intensity levels based on meal count
      if(mealCount>0){
        div.classList.add('active');
        const intensity=Math.min(mealCount/4,1); // 0.25, 0.5, 0.75, 1.0
        div.style.opacity=0.25+intensity*0.75;
        div.style.background='var(--accent)';
      }
      if(d===today)div.classList.add('today');
      // Tooltip
      const dateObj=new Date(d+'T12:00:00');
      const label=dateObj.toLocaleDateString('en',{month:'short',day:'numeric'});
      div.title=`${label}: ${mealCount} meal${mealCount!==1?'s':''}`;
      cal.appendChild(div);
    }

    // Streak calculation
    let cur=0,longest=0,total=0,s=0,d2=today;
    while(true){const l=NT.state.logs[d2];if(l&&['breakfast','lunch','dinner','snacks'].some(m=>(l[m]||[]).length>0)){s++;d2=shiftDate(d2,-1)}else break}
    cur=s;
    const allDates=Object.keys(NT.state.logs).filter(k=>{const l=NT.state.logs[k];return l&&['breakfast','lunch','dinner','snacks'].some(m=>(l[m]||[]).length>0)}).sort();
    total=allDates.length;
    let ls=1;longest=allDates.length?1:0;
    for(let i=1;i<allDates.length;i++){
      const prev=new Date(allDates[i-1]+'T12:00:00'),curr=new Date(allDates[i]+'T12:00:00');
      if((curr-prev)/(86400000)===1){ls++;if(ls>longest)longest=ls}else ls=1;
    }
    NT.$('#currentStreakVal').textContent=cur;
    NT.$('#longestStreakVal').textContent=longest;

    // Consistency: % of days logged since first log
    if(allDates.length>=2){
      const firstDate=new Date(allDates[0]+'T12:00:00');
      const daysSinceFirst=Math.ceil((todayDate-firstDate)/(86400000))+1;
      const pct=Math.round((total/daysSinceFirst)*100);
      NT.$('#consistencyVal').textContent=pct+'%';
    } else {
      NT.$('#consistencyVal').textContent=total>0?'100%':'0%';
    }

    drawBarChart('calorieChart',7,'cal',NT.state.goals.cal);
    drawMacroPie('macroChart',7);
    drawWeightChart();
    renderEnergyBalance();
  };

  // ═══ WEEKLY ENERGY BALANCE ═══
  function renderEnergyBalance(){
    const today=todayStr();
    // Sum 7 days of calorie intake
    let totalIntake=0, daysWithData=0;
    for(let i=0;i<7;i++){
      const d=shiftDate(today,-i),l=NT.state.logs[d];
      if(l){
        let dayCal=0;
        ['breakfast','lunch','dinner','snacks'].forEach(m=>(l[m]||[]).forEach(item=>dayCal+=item.cal||0));
        totalIntake+=dayCal;
        if(dayCal>0)daysWithData++;
      }
    }

    // Calculate TDEE
    const p=NT.state.profile;
    const latest=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1]:null;
    const latestWeight=latest?.weight||Object.values(NT.state.weights).pop()||0;
    let dailyTdee=NT.state.goals.cal; // fallback to calorie goal
    if(latestWeight&&p.height&&p.dob){
      const age=Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000));
      const bmr=p.sex==='male'?10*latestWeight+6.25*p.height-5*age+5:10*latestWeight+6.25*p.height-5*age-161;
      dailyTdee=Math.round(bmr*(p.activity||1.55));
    }
    const totalTdee=dailyTdee*7;

    // Net balance & fat estimate
    const net=totalIntake-totalTdee;
    const fatKg=net/7700; // positive = gained, negative = lost

    // Update DOM
    const elIntake=NT.$('#ebIntake'),elTdee=NT.$('#ebTdee'),elNet=NT.$('#ebNet'),elNetSub=NT.$('#ebNetSub');
    const elResult=NT.$('#ebResult'),elResultLabel=NT.$('#ebResultLabel'),elResultSub=NT.$('#ebResultSub');
    const elHighlight=NT.$('.eb-highlight'),elResultBox=NT.$('.eb-result');
    const elBar=NT.$('#ebBarFill');

    if(!elIntake)return;

    elIntake.textContent=totalIntake.toLocaleString();
    elTdee.textContent=totalTdee.toLocaleString();
    elNet.textContent=(net>0?'+':'')+net.toLocaleString();
    elNetSub.textContent=net<0?'cal deficit':'cal surplus';

    // Highlight color
    if(elHighlight){
      elHighlight.classList.toggle('surplus',net>0);
    }

    // Result box
    const absKg=Math.abs(fatKg);
    if(daysWithData===0){
      elResult.textContent='--';
      elResultLabel.textContent='No data yet';
      elResultSub.textContent='log food to see results';
    } else if(net<0){
      elResult.textContent='-'+absKg.toFixed(2);
      elResultLabel.textContent='🔥 Fat Lost';
      elResultSub.textContent='kg estimated this week';
      if(elResultBox){elResultBox.classList.add('fat-lost');elResultBox.classList.remove('fat-gained')}
    } else {
      elResult.textContent='+'+absKg.toFixed(2);
      elResultLabel.textContent='📈 Weight Gained';
      elResultSub.textContent='kg estimated this week';
      if(elResultBox){elResultBox.classList.add('fat-gained');elResultBox.classList.remove('fat-lost')}
    }

    // Visual bar (center = balance, left = deficit, right = surplus)
    if(elBar){
      const maxDelta=totalTdee*0.3; // 30% of TDEE is max visual range
      const pct=Math.max(-1,Math.min(1,net/maxDelta));
      if(pct<0){
        // Deficit: bar grows left from center
        const width=Math.abs(pct)*50;
        elBar.style.left=(50-width)+'%';
        elBar.style.width=width+'%';
        elBar.style.background='linear-gradient(90deg,#5AC8FA,rgba(90,200,250,.3))';
      } else {
        // Surplus: bar grows right from center
        const width=pct*50;
        elBar.style.left='50%';
        elBar.style.width=width+'%';
        elBar.style.background='linear-gradient(90deg,rgba(239,68,68,.3),#FF453A)';
      }
    }
  }

  function drawBarChart(id,days,key,goal){
    const canvas=NT.$('#'+id);if(!canvas)return;
    const ctx=canvas.getContext('2d');const w=canvas.width=canvas.offsetWidth*2;const h=canvas.height=320;
    ctx.clearRect(0,0,w,h);
    const today=todayStr();const vals=[];const labels=[];
    for(let i=days-1;i>=0;i--){
      const d=shiftDate(today,-i);labels.push(new Date(d+'T12:00:00').toLocaleDateString('en',{weekday:'short'}));
      const l=NT.state.logs[d];let v=0;
      if(l)['breakfast','lunch','dinner','snacks'].forEach(m=>(l[m]||[]).forEach(item=>v+=item[key]||0));
      vals.push(Math.round(v));
    }
    const max=Math.max(...vals,goal)*1.15;
    const barW=w/(days*2.2);const gap=(w-barW*days)/(days+1);
    const gy=h-40-(goal/max)*(h-70);
    ctx.setLineDash([6,4]);ctx.strokeStyle='rgba(90,200,250,0.25)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(90,200,250,0.5)';ctx.font=`${20}px "DM Sans"`;ctx.fillText('Goal: '+goal,8,gy-6);
    vals.forEach((v,i)=>{
      const x=gap+(barW+gap)*i;const bh=(v/max)*(h-70);const y=h-40-bh;
      const grad=ctx.createLinearGradient(x,y,x,h-40);
      grad.addColorStop(0,v>goal?'#FF453A':'#5AC8FA');grad.addColorStop(1,v>goal?'rgba(239,68,68,0.3)':'rgba(90,200,250,0.2)');
      ctx.fillStyle=grad;
      roundRect(ctx,x,y,barW,bh,6);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.48)';ctx.font=`${18}px "DM Sans"`;ctx.textAlign='center';
      ctx.fillText(labels[i],x+barW/2,h-14);
      ctx.fillStyle='rgba(255,255,255,.88)';ctx.font=`bold ${18}px "JetBrains Mono"`;
      ctx.fillText(v,x+barW/2,y-8);
    });
  }
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}

  function drawMacroPie(id,days){
    const canvas=NT.$('#'+id);if(!canvas)return;
    const ctx=canvas.getContext('2d');const w=canvas.width=canvas.offsetWidth*2;const h=canvas.height=420;
    ctx.clearRect(0,0,w,h);
    const today=todayStr();let tp=0,tc=0,tf=0,tfi=0,ts=0,totalCal=0,daysWithData=0;
    for(let i=0;i<days;i++){
      const d=shiftDate(today,-i),l=NT.state.logs[d];
      if(l){
        let hasCal=false;
        ['breakfast','lunch','dinner','snacks'].forEach(m=>(l[m]||[]).forEach(item=>{
          tp+=item.protein||0;tc+=item.carbs||0;tf+=item.fat||0;
          tfi+=(item.fiber||0);ts+=(item.sugar||0);
          totalCal+=item.cal||0;hasCal=true;
        }));
        if(hasCal)daysWithData++;
      }
    }
    const denom=daysWithData||1;
    const avgP=Math.round(tp/denom),avgC=Math.round(tc/denom),avgF=Math.round(tf/denom);
    const avgFi=Math.round(tfi/denom),avgS=Math.round(ts/denom);
    const avgCal=Math.round(totalCal/denom);

    if(!avgCal){ctx.fillStyle='rgba(255,255,255,.22)';ctx.font='20px "DM Sans"';ctx.textAlign='center';ctx.fillText('No data yet',w/2,h/2);return}

    // Calorie contribution from macros
    const pCal=avgP*4,cCal=avgC*4,fCal=avgF*9;
    const macCal=pCal+cCal+fCal;

    // Layout: stacked horizontal bars with labels
    const pad={l:24,r:24,t:16};
    const rowH=54;
    const barH=8;
    const goals={
      protein:NT.state.goals.protein||150,
      carbs:NT.state.goals.carbs||250,
      fat:NT.state.goals.fat||65,
      fiber:NT.state.goals.fiber||30,
      sugar:NT.state.goals.sugar||50
    };

    // Title: avg cal
    ctx.fillStyle='rgba(255,255,255,.88)';ctx.font='bold 18px "JetBrains Mono"';ctx.textAlign='left';
    ctx.fillText(avgCal+' cal',pad.l,pad.t+16);
    ctx.fillStyle='rgba(255,255,255,.35)';ctx.font='13px "DM Sans"';
    ctx.fillText('avg/day  ·  '+daysWithData+' of '+days+' days logged',pad.l+ctx.measureText(avgCal+' cal').width+12,pad.t+16);

    // Calorie split bar (thin horizontal stacked bar)
    const splitY=pad.t+34;const splitH=6;const splitW=w-pad.l-pad.r;
    const pPct=macCal?pCal/macCal:0.33;const cPct=macCal?cCal/macCal:0.33;const fPct=macCal?fCal/macCal:0.34;
    // Protein segment
    ctx.fillStyle='#5E5CE6';
    roundRect(ctx,pad.l,splitY,splitW*pPct,splitH,3);ctx.fill();
    // Carbs segment
    ctx.fillStyle='#FFD60A';
    ctx.fillRect(pad.l+splitW*pPct,splitY,splitW*cPct,splitH);
    // Fat segment
    ctx.fillStyle='#FF6482';
    roundRect(ctx,pad.l+splitW*(pPct+cPct),splitY,splitW*fPct,splitH,3);ctx.fill();

    // Split labels
    ctx.font='11px "DM Sans"';ctx.textBaseline='top';
    const labels=[
      {pct:pPct,cal:pCal,c:'#5E5CE6',l:'P'},
      {pct:cPct,cal:cCal,c:'#FFD60A',l:'C'},
      {pct:fPct,cal:fCal,c:'#FF6482',l:'F'}
    ];
    let lx=pad.l;
    labels.forEach(lb=>{
      const segW=splitW*lb.pct;
      if(segW>40){
        ctx.fillStyle=lb.c;ctx.textAlign='left';
        ctx.fillText(lb.l+' '+Math.round(lb.pct*100)+'%',lx+4,splitY+splitH+4);
      }
      lx+=segW;
    });

    // Individual nutrient rows
    const startY=splitY+splitH+32;
    const nutrients=[
      {name:'Protein',val:avgP,goal:goals.protein,color:'#5E5CE6',unit:'g',calPer:'4 cal/g'},
      {name:'Carbs',val:avgC,goal:goals.carbs,color:'#FFD60A',unit:'g',calPer:'4 cal/g'},
      {name:'Fat',val:avgF,goal:goals.fat,color:'#FF6482',unit:'g',calPer:'9 cal/g'},
      {name:'Fiber',val:avgFi,goal:goals.fiber,color:'#30D158',unit:'g',calPer:''},
      {name:'Sugar',val:avgS,goal:goals.sugar,color:'#FF9F0A',unit:'g',calPer:'limit'}
    ];
    const barMaxW=splitW-120;

    nutrients.forEach((n,i)=>{
      const y=startY+i*rowH;
      const pct=n.goal?(n.val/n.goal):0;
      const isOver=pct>1;

      // Name + dot
      ctx.fillStyle=n.color;
      ctx.beginPath();ctx.arc(pad.l+5,y+4,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='14px "DM Sans"';ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText(n.name,pad.l+16,y+4);

      // Value / Goal
      ctx.font='bold 14px "JetBrains Mono"';ctx.textAlign='right';
      ctx.fillStyle=isOver?(n.name==='Sugar'?'#FF453A':'rgba(255,255,255,.88)'):'rgba(255,255,255,.88)';
      ctx.fillText(n.val+n.unit,w-pad.r,y+4);
      ctx.fillStyle='rgba(255,255,255,.25)';ctx.font='12px "DM Sans"';
      ctx.fillText('/ '+n.goal+n.unit,w-pad.r,y+22);

      // Progress bar
      const barY=y+14;const barW=Math.min(pct,1)*barMaxW;
      // Track
      ctx.fillStyle='rgba(255,255,255,.04)';
      roundRect(ctx,pad.l,barY,barMaxW,barH,4);ctx.fill();
      // Fill
      if(barW>0){
        ctx.fillStyle=isOver&&n.name==='Sugar'?'#FF453A':n.color;
        roundRect(ctx,pad.l,barY,Math.max(barW,4),barH,4);ctx.fill();
      }

      // Percentage badge
      const pctText=Math.round(pct*100)+'%';
      ctx.fillStyle=isOver?'rgba(255,69,58,.6)':'rgba(255,255,255,.15)';ctx.font='11px "JetBrains Mono"';ctx.textAlign='left';
      ctx.fillText(pctText,pad.l+barMaxW+8,barY+barH/2+1);
    });
  }

  function drawWeightChart(){
    const canvas=NT.$('#weightChart');if(!canvas)return;
    const ctx=canvas.getContext('2d');const w=canvas.width=canvas.offsetWidth*2;const h=canvas.height=320;
    ctx.clearRect(0,0,w,h);
    const entries=Object.entries(NT.state.weights).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
    const deltaEl=NT.$('#weightDelta');
    const bmiEl=NT.$('#weightBmi');
    const lastEl=NT.$('#weightLastLogged');

    if(!entries.length){
      ctx.fillStyle='rgba(255,255,255,.22)';ctx.font='20px "DM Sans"';ctx.textAlign='center';
      ctx.fillText('Log your weight to see trends',w/2,h/2);
      if(deltaEl)deltaEl.textContent='';
      if(bmiEl)bmiEl.textContent='';
      if(lastEl)lastEl.textContent='';
      return;
    }

    const currentWeight=entries[entries.length-1][1];
    const currentDate=entries[entries.length-1][0];
    NT.$('#currentWeight').textContent=currentWeight;

    // Delta badge
    if(deltaEl){
      if(entries.length>=2){
        const prevWeight=entries[entries.length-2][1];
        const diff=(currentWeight-prevWeight).toFixed(1);
        const sign=diff>0?'+':'';
        const arrow=diff>0?'↑':diff<0?'↓':'→';
        deltaEl.textContent=`${arrow} ${sign}${diff} kg`;
        deltaEl.className='weight-delta '+(diff>0?'up':diff<0?'down':'same');
      } else deltaEl.textContent='';
    }

    // BMI
    if(bmiEl){
      const heightM=(NT.state.profile.height||170)/100;
      const bmi=(currentWeight/(heightM*heightM)).toFixed(1);
      let cat='Normal';
      if(bmi<18.5)cat='Underweight';
      else if(bmi>=25&&bmi<30)cat='Overweight';
      else if(bmi>=30)cat='Obese';
      bmiEl.textContent=`BMI ${bmi} · ${cat}`;
    }

    // Last logged
    if(lastEl){
      const today=todayStr();
      const daysDiff=Math.round((new Date(today+'T12:00:00')-new Date(currentDate+'T12:00:00'))/(86400000));
      if(daysDiff===0)lastEl.textContent='Logged today';
      else if(daysDiff===1)lastEl.textContent='Logged yesterday';
      else lastEl.textContent=`Logged ${daysDiff} days ago`;
    }

    // Not enough data for a meaningful chart
    if(entries.length<3){
      ctx.fillStyle='rgba(255,255,255,.15)';ctx.font='18px "DM Sans"';ctx.textAlign='center';
      ctx.fillText('Log more data to see chart trends',w/2,h/2);
      return;
    }

    const vals=entries.map(e=>e[1]);
    const goalWeight=NT.state.bodyGoals?.targetWeight||0;
    // Include goal weight in range calculation if set
    let min=Math.min(...vals)-2;
    let max=Math.max(...vals)+2;
    if(goalWeight>0){min=Math.min(min,goalWeight-1);max=Math.max(max,goalWeight+1)}

    const pad={t:30,b:50,l:50,r:20};const cw=w-pad.l-pad.r;const ch=h-pad.t-pad.b;
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const y=pad.t+ch*(i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.22)';ctx.font='14px "JetBrains Mono"';ctx.textAlign='right';ctx.fillText((max-(max-min)*(i/4)).toFixed(1),pad.l-8,y+5)}

    // Goal weight dashed line
    if(goalWeight>0&&goalWeight>=min&&goalWeight<=max){
      const gy=pad.t+(1-(goalWeight-min)/(max-min))*ch;
      ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(w-pad.r,gy);ctx.stroke();
      ctx.setLineDash([]);ctx.fillStyle='rgba(255,255,255,.3)';ctx.font='13px "DM Sans"';ctx.textAlign='left';
      ctx.fillText('Goal: '+goalWeight+' kg',pad.l+4,gy-8);ctx.restore();
    }

    // Line
    ctx.beginPath();ctx.strokeStyle='#5AC8FA';ctx.lineWidth=3;ctx.lineJoin='round';
    entries.forEach((e,i)=>{const x=pad.l+i/(entries.length-1||1)*cw;const y=pad.t+(1-(e[1]-min)/(max-min))*ch;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
    ctx.stroke();

    // Area fill
    const lastX=pad.l+(entries.length-1)/(entries.length-1||1)*cw;
    ctx.lineTo(lastX,h-pad.b);ctx.lineTo(pad.l,h-pad.b);ctx.closePath();
    ctx.fillStyle='rgba(90,200,250,.06)';ctx.fill();

    // Dots + date labels
    entries.forEach((e,i)=>{
      const x=pad.l+i/(entries.length-1||1)*cw;
      const y=pad.t+(1-(e[1]-min)/(max-min))*ch;
      ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='#5AC8FA';ctx.fill();
      ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();
      // Date labels (show every other to avoid crowding)
      if(i%2===0||i===entries.length-1){
        const d=new Date(e[0]+'T12:00:00');
        ctx.fillStyle='rgba(255,255,255,.22)';ctx.font='12px "DM Sans"';ctx.textAlign='center';
        ctx.fillText(d.toLocaleDateString('en',{month:'short',day:'numeric'}),x,h-pad.b+18);
      }
    });
  }

  // Weight modal
  NT.$('#logWeightBtn').addEventListener('click',()=>NT.$('#weightModal').classList.remove('hidden'));
  NT.$('#closeWeightModal').addEventListener('click',()=>NT.$('#weightModal').classList.add('hidden'));
  NT.$('#logWeightSubmit').addEventListener('click',()=>{
    const v=parseFloat(NT.$('#weightInput').value);if(!v)return;
    NT.state.weights[todayStr()]=v;saveAll();
    NT.$('#weightModal').classList.add('hidden');toast('Weight logged','success');
    if(typeof renderProgress==='function')renderProgress();
  });

  // AI Weekly Summary
  NT.$('#generateSummaryBtn').addEventListener('click',async()=>{
    if(!NT.state.geminiKey){toast('Set Gemini key first','error');return}
    NT.$('#aiWeeklySummary').innerHTML='<div class="ai-dot-pulse"><span></span><span></span><span></span></div>';
    const today=todayStr();let weekData='';
    for(let i=6;i>=0;i--){
      const d=shiftDate(today,-i),l=NT.state.logs[d];let t={cal:0,p:0,c:0,f:0};
      if(l)['breakfast','lunch','dinner','snacks'].forEach(m=>(l[m]||[]).forEach(item=>{t.cal+=item.cal;t.p+=item.protein;t.c+=item.carbs;t.f+=item.fat}));
      weekData+=`${d}: ${Math.round(t.cal)}cal, P${Math.round(t.p)}g, C${Math.round(t.c)}g, F${Math.round(t.f)}g\n`;
    }
    const sp=`Analyze this week of nutrition data. Goals: ${NT.state.goals.cal}cal, ${NT.state.goals.protein}g protein, ${NT.state.goals.carbs}g carbs, ${NT.state.goals.fat}g fat. Brief actionable summary. Use **bold**. Max 200 words.\n\n${weekData}`;
    try{
      const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${NT.state.geminiKey}`;
      const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:sp}]}],generationConfig:{temperature:0.5,maxOutputTokens:1024}})});
      const data=await res.json();
      const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'Could not generate summary.';
      NT.$('#aiWeeklySummary').innerHTML=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    }catch{NT.$('#aiWeeklySummary').innerHTML='<p>Error generating summary</p>'}
  });

  // ═══ SETTINGS (More tab — simplified, goals in Body tab) ═══
  function loadSettings(){
    NT.$('#geminiKey').value=NT.state.geminiKey||'';
    // Populate snapshot card
    const log=dayLog(NT.state.currentDate);
    let cal=0,pro=0;
    ['breakfast','lunch','dinner','snacks'].forEach(m=>(log[m]||[]).forEach(i=>{cal+=i.cal||0;pro+=i.protein||0}));
    const snapCal=NT.$('#snapCal');if(snapCal)snapCal.textContent=Math.round(cal);
    const snapGoal=NT.$('#snapGoal');if(snapGoal)snapGoal.textContent=NT.state.goals.cal;
    const snapPro=NT.$('#snapProtein');if(snapPro)snapPro.textContent=Math.round(pro)+'g';
    const latestW=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1].weight:null;
    const snapW=NT.$('#snapWeight');if(snapW)snapW.textContent=latestW?latestW+'kg':'--';
    // Streak
    const streakEl=NT.$('#snapshotStreak');
    if(streakEl){
      let streak=0,d=todayStr();
      while(NT.state.logs[d]){const l=NT.state.logs[d];if(['breakfast','lunch','dinner','snacks'].some(m=>(l[m]||[]).length>0))streak++;else break;d=shiftDate(d,-1)}
      streakEl.textContent='🔥 '+streak;
    }
    const snapDate=NT.$('#snapshotDate');
    if(snapDate){
      const d=new Date();
      snapDate.textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
    }
  }
  loadSettings();

  NT.$('#saveAllSettings').addEventListener('click',()=>{
    NT.state.geminiKey=NT.$('#geminiKey').value.trim();
    saveAll();toast('Settings saved','success');
  });

  NT.$('#exportData').addEventListener('click',()=>{
    const data=JSON.stringify({goals:NT.state.goals,logs:NT.state.logs,weights:NT.state.weights,exercises:NT.state.exercises,profile:NT.state.profile||{},bodyLogs:NT.state.bodyLogs||[],bodyGoals:NT.state.bodyGoals||{},workoutTemplates:NT.state.workoutTemplates||{},coachChats:NT.state.coachChats||[],training:NT.state.training||{}},null,2);
    const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`nutritrack_${todayStr()}.json`;a.click();URL.revokeObjectURL(url);
    toast('Data exported','success');
  });
  NT.$('#importDataBtn').addEventListener('click',()=>NT.$('#importDataInput').click());
  NT.$('#importDataInput').addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=()=>{
      try{const d=JSON.parse(r.result);
        if(d.goals)NT.state.goals=d.goals;if(d.logs)NT.state.logs=d.logs;
        if(d.weights)NT.state.weights=d.weights;if(d.exercises)NT.state.exercises=d.exercises;
        if(d.profile)NT.state.profile=d.profile;if(d.bodyLogs)NT.state.bodyLogs=d.bodyLogs;
        if(d.bodyGoals)NT.state.bodyGoals=d.bodyGoals;
        if(d.workoutTemplates)NT.state.workoutTemplates=d.workoutTemplates;
        if(d.coachChats)NT.state.coachChats=d.coachChats;
        if(d.training)NT.state.training=d.training;
        saveAll();updateDiary();loadSettings();toast('Data imported','success');
      }catch{toast('Invalid file','error')}
    };r.readAsText(f);NT.$('#importDataInput').value='';
  });

  NT.$('#clearAllData').addEventListener('click',()=>{
    if(!confirm('Delete ALL data? Cannot be undone.'))return;
    NT.state.logs={};NT.state.weights={};NT.state.exercises={};NT.state.chatHistory=[];
    NT.state.bodyLogs=[];NT.state.bodyGoals={targetWeight:0,targetBf:0,targetDate:''};
    saveAll();updateDiary();toast('All data cleared','info');
  });

  // ═══ WORKOUT DISPLAY & QUICK LOG ═══
  window.renderWorkout=function(){
    const log=dayLog(NT.state.currentDate);
    const badge=NT.$('#workoutBadge'),content=NT.$('#workoutContent'),quickLog=NT.$('#workoutQuickLog');
    if(!badge||!content)return;
    const w=log.workout;
    if(!w){
      badge.textContent='Rest Day';badge.className='workout-badge rest';
      content.innerHTML='<p class="workout-empty">No workout logged yet</p>';
      if(quickLog)quickLog.style.display='flex';
      return;
    }
    if(quickLog)quickLog.style.display='none';
    if(w.type){
      const hasGym=w.exercises&&w.exercises.length;
      const hasCardio=!!w.cardio;
      if(hasGym&&hasCardio){
        badge.textContent=w.type.toUpperCase()+' + CARDIO';badge.className='workout-badge '+w.type;
      } else {
        badge.textContent=w.type.toUpperCase();badge.className='workout-badge '+w.type;
      }
    }
    let html='';
    if(w.exercises&&w.exercises.length){
      w.exercises.forEach(ex=>{
        html+=`<div class="workout-exercise"><span class="we-name">${esc(ex.name)}</span><span class="we-detail">${ex.weight}kg × ${ex.reps} × ${ex.sets}s</span></div>`;
      });
    }
    if(w.cardio){
      const c=w.cardio;
      html+=`<div class="workout-cardio-row"><span class="wc-icon">🏃</span><span>${c.type||'Cardio'}</span><span class="wc-detail">${c.duration||'?'}min · ${c.incline||0}% · ${c.speed||'?'}km/h</span></div>`;
    }
    html+=`<div style="text-align:right;margin-top:6px"><button class="workout-clear-btn" id="clearWorkoutBtn">✕ Clear</button></div>`;
    content.innerHTML=html;
    const clearBtn=NT.$('#clearWorkoutBtn');
    if(clearBtn)clearBtn.addEventListener('click',()=>{log.workout=null;saveAll();renderWorkout();toast('Workout cleared','info')});
  };

  // Quick-log buttons
  NT.$$('.wql-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const type=btn.dataset.type;
      const tpl=NT.state.workoutTemplates;
      const log=dayLog(NT.state.currentDate);
      if(type==='cardio'){
        // Cardio ADDS to existing workout (gym + cardio same day)
        const c=tpl.cardio||{};
        const cardioData={type:c.type||'Treadmill',duration:c.durationMin||30,incline:c.incline||9,speed:c.speedMin||4};
        if(log.workout){
          log.workout.cardio=cardioData;
        } else {
          log.workout={type:'cardio',exercises:[],cardio:cardioData};
        }
      } else {
        // Gym workout: keep existing cardio if already logged
        const existingCardio=log.workout?.cardio||null;
        log.workout={type,exercises:tpl[type]?JSON.parse(JSON.stringify(tpl[type])):[]};
        if(existingCardio)log.workout.cardio=existingCardio;
      }
      saveAll();renderWorkout();
      toast(`${type.toUpperCase()} day logged!`,'success');
    });
  });

  // Initial render
  renderWorkout();
});
