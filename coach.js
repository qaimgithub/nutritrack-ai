// NutriTrack AI — Coach Module (Multi-Chat, STT, TTS, Body-Aware)
document.addEventListener('DOMContentLoaded',()=>{
  const chatMsgs=NT.$('#chatMessages'),chatIn=NT.$('#chatInput'),chatSend=NT.$('#chatSend');
  const sidebar=NT.$('#chatSidebar'),overlay=NT.$('#chatSidebarOverlay');

  // ═══ MULTI-CHAT MANAGEMENT ═══
  function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

  // Migrate old single chatHistory into multi-chat if needed
  if(!NT.state.coachChats.length && NT.state.chatHistory.length){
    const chat={id:genId(),title:NT.state.chatHistory[0]?.text?.slice(0,40)||'First chat',messages:[...NT.state.chatHistory],created:Date.now()};
    NT.state.coachChats.push(chat);
    NT.state.activeChatId=chat.id;
    saveAll();
  }

  function getActiveChat(){
    if(!NT.state.activeChatId && NT.state.coachChats.length)NT.state.activeChatId=NT.state.coachChats[0].id;
    return NT.state.coachChats.find(c=>c.id===NT.state.activeChatId)||null;
  }

  function createNewChat(){
    const chat={id:genId(),title:'New conversation',messages:[],created:Date.now()};
    NT.state.coachChats.unshift(chat);
    NT.state.activeChatId=chat.id;
    saveAll();
    loadChat(chat);
    renderChatList();
    closeSidebar();
  }

  function loadChat(chat){
    chatMsgs.innerHTML='';
    if(!chat||!chat.messages.length){
      addMsg("Hey! I'm your AI nutrition coach. I know your body stats, goals, and history — ask me anything about your nutrition! 🧠💪",'ai',false);
      return;
    }
    chat.messages.forEach(m=>addMsg(m.text,m.role,false));
    chatMsgs.scrollTop=chatMsgs.scrollHeight;
  }

  function switchChat(id){
    NT.state.activeChatId=id;
    saveAll();
    const chat=getActiveChat();
    loadChat(chat);
    renderChatList();
    closeSidebar();
  }

  function deleteChat(id){
    NT.state.coachChats=NT.state.coachChats.filter(c=>c.id!==id);
    if(NT.state.activeChatId===id){
      NT.state.activeChatId=NT.state.coachChats[0]?.id||null;
      const chat=getActiveChat();
      if(chat)loadChat(chat);
      else{chatMsgs.innerHTML='';createNewChat();}
    }
    saveAll();renderChatList();
  }

  function renderChatList(){
    const list=NT.$('#chatList');list.innerHTML='';
    NT.state.coachChats.forEach(c=>{
      const div=document.createElement('div');
      div.className='chat-list-item'+(c.id===NT.state.activeChatId?' active':'');
      const dateStr=new Date(c.created).toLocaleDateString('en',{month:'short',day:'numeric'});
      div.innerHTML=`<div class="chat-item-icon">💬</div><div class="chat-item-info"><span class="chat-item-title">${esc(c.title)}</span><span class="chat-item-date">${dateStr}</span></div><button class="chat-item-del" title="Delete">×</button>`;
      div.addEventListener('click',e=>{if(!e.target.closest('.chat-item-del'))switchChat(c.id)});
      div.querySelector('.chat-item-del').addEventListener('click',e=>{e.stopPropagation();if(confirm('Delete this chat?'))deleteChat(c.id)});
      list.appendChild(div);
    });
    if(!NT.state.coachChats.length)list.innerHTML='<p style="color:var(--muted);font-size:.78rem;text-align:center;padding:20px">No conversations yet</p>';
  }

  // Sidebar open/close
  function openSidebar(){sidebar.classList.remove('closed');overlay.classList.remove('hidden')}
  function closeSidebar(){sidebar.classList.add('closed');overlay.classList.add('hidden')}
  NT.$('#openSidebar').addEventListener('click',openSidebar);
  NT.$('#closeSidebar').addEventListener('click',closeSidebar);
  overlay.addEventListener('click',closeSidebar);
  NT.$('#newChatBtn').addEventListener('click',createNewChat);
  NT.$('#newChatSidebar').addEventListener('click',createNewChat);

  // Init sidebar as closed
  sidebar.classList.add('closed');
  // Hide suggestions container permanently
  NT.$('#coachSuggestions')?.classList.add('hidden');

  // ═══ VOICE INPUT TRACKING & IMAGE STATE ═══
  let usedVoiceInput=false;
  let stagedImage=null; // {base64, mimeType}
  let currentAbort=null; // AbortController for stopping requests

  // ═══ PHOTO UPLOAD ═══
  const photoBtn=NT.$('#coachPhotoBtn'),photoInput=NT.$('#coachPhotoInput');
  const imgPreview=NT.$('#coachImagePreview'),previewImg=NT.$('#coachPreviewImg'),removeImg=NT.$('#coachRemoveImg');

  if(photoBtn)photoBtn.addEventListener('click',()=>photoInput.click());
  if(photoInput)photoInput.addEventListener('change',e=>{
    const file=e.target.files[0];if(!file)return;
    stageImageFile(file);
    photoInput.value='';
  });
  if(removeImg)removeImg.addEventListener('click',clearStagedImage);

  function stageImageFile(file){
    const reader=new FileReader();
    reader.onload=()=>{
      const base64=reader.result.split(',')[1];
      stagedImage={base64,mimeType:file.type};
      previewImg.src=reader.result;
      imgPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
  function clearStagedImage(){
    stagedImage=null;
    imgPreview.classList.add('hidden');
    previewImg.src='';
  }

  // ═══ PASTE SUPPORT (images from clipboard) ═══
  chatIn.addEventListener('paste',e=>{
    const items=e.clipboardData?.items;
    if(!items)return;
    for(let i=0;i<items.length;i++){
      if(items[i].type.startsWith('image/')){
        e.preventDefault();
        const file=items[i].getAsFile();
        if(file)stageImageFile(file);
        return;
      }
    }
  });

  // ═══ MESSAGE RENDERING ═══
  function addMsg(text,role,save=true){
    const div=document.createElement('div');div.className='chat-msg '+role;
    if(role==='ai'){
      div.innerHTML=formatAI(text);
      // Add TTS button
      const ttsBtn=document.createElement('button');
      ttsBtn.className='tts-btn';ttsBtn.title='Read aloud';
      ttsBtn.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
      ttsBtn.addEventListener('click',()=>speakText(text,ttsBtn));
      div.appendChild(ttsBtn);
    } else {
      div.innerHTML=esc(text);
    }
    chatMsgs.appendChild(div);chatMsgs.scrollTop=chatMsgs.scrollHeight;
  }

  function formatAI(t){
    const lines=t.split('\n');
    let html='',inTable=false,tableRows=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim();
      if(line.startsWith('|')&&line.endsWith('|')){
        if(!inTable){inTable=true;tableRows=[];}
        if(/^\|[\s\-:|]+\|$/.test(line))continue;
        const cells=line.split('|').filter((_,j,a)=>j>0&&j<a.length-1).map(c=>c.trim());
        tableRows.push({cells,isHeader:tableRows.length===0});
      } else {
        if(inTable){html+=renderTable(tableRows);inTable=false;tableRows=[];}
        let l=line;
        l=l.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
        l=l.replace(/\*(.*?)\*/g,'<em>$1</em>');
        l=l.replace(/^[*\-]\s+(.*)$/,'<div style="padding-left:12px">• $1</div>');
        if(l==='')html+='<br>';else html+=l+'<br>';
      }
    }
    if(inTable)html+=renderTable(tableRows);
    return html;
  }

  function renderTable(rows){
    let h='<div class="ai-table-wrap"><table class="ai-table">';
    rows.forEach(r=>{
      const tag=r.isHeader?'th':'td';
      h+='<tr>'+r.cells.map(c=>{
        c=c.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
        const isTotal=c.toLowerCase().includes('total');
        return `<${tag}${isTotal?' class="total-row"':''}>${c}</${tag}>`;
      }).join('')+'</tr>';
    });
    return h+'</table></div>';
  }

  function showTyping(){
    const d=document.createElement('div');d.className='chat-msg ai typing';d.id='typingInd';d.innerHTML='<div class="ai-dot-pulse"><span></span><span></span><span></span></div>';chatMsgs.appendChild(d);chatMsgs.scrollTop=chatMsgs.scrollHeight;
    // Show stop, hide send
    NT.$('#chatSend').classList.add('hidden');
    NT.$('#chatStop').classList.remove('hidden');
  }
  function hideTyping(){
    const t=NT.$('#typingInd');if(t)t.remove();
    NT.$('#chatSend').classList.remove('hidden');
    NT.$('#chatStop').classList.add('hidden');
  }

  // ═══ TEXT-TO-SPEECH ═══
  let currentUtterance=null;
  function speakText(text,btn){
    // Strip markdown/HTML for clean speech
    const clean=text.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/\|/g,' ').replace(/---+/g,'').replace(/<[^>]+>/g,'').replace(/<!--.*?-->/g,'').trim();
    if(window.speechSynthesis.speaking){window.speechSynthesis.cancel();if(btn)btn.classList.remove('speaking');return}
    const utter=new SpeechSynthesisUtterance(clean);
    utter.rate=1.05;utter.pitch=1;utter.volume=1;
    // Try to pick a good voice
    const voices=window.speechSynthesis.getVoices();
    const pref=voices.find(v=>/google.*us|samantha|daniel|karen/i.test(v.name))||voices.find(v=>v.lang.startsWith('en'))||voices[0];
    if(pref)utter.voice=pref;
    if(btn){btn.classList.add('speaking');utter.onend=()=>btn.classList.remove('speaking');utter.onerror=()=>btn.classList.remove('speaking')}
    currentUtterance=utter;
    window.speechSynthesis.speak(utter);
  }
  // Load voices
  if(window.speechSynthesis)window.speechSynthesis.onvoiceschanged=()=>{};

  // ═══ SPEECH-TO-TEXT ═══
  let recognition=null;
  const micBtn=NT.$('#micBtn'),micStatus=NT.$('#micStatus'),micStop=NT.$('#micStop');

  if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
    const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
    recognition=new SpeechRec();
    recognition.continuous=true;recognition.interimResults=true;recognition.lang='en-US';

    let finalTranscript='';
    recognition.onstart=()=>{micBtn.classList.add('recording');micStatus.classList.remove('hidden');finalTranscript='';usedVoiceInput=true};
    recognition.onend=()=>{micBtn.classList.remove('recording');micStatus.classList.add('hidden');if(finalTranscript.trim()){chatIn.value=finalTranscript.trim();chatIn.dispatchEvent(new Event('input'))}};
    recognition.onerror=e=>{micBtn.classList.remove('recording');micStatus.classList.add('hidden');if(e.error!=='aborted')toast('Mic error: '+e.error,'error')};
    recognition.onresult=e=>{
      let interim='';finalTranscript='';
      for(let i=0;i<e.results.length;i++){
        if(e.results[i].isFinal)finalTranscript+=e.results[i][0].transcript;
        else interim+=e.results[i][0].transcript;
      }
      chatIn.value=(finalTranscript+interim).trim();
      chatIn.dispatchEvent(new Event('input'));
    };
    micBtn.addEventListener('click',()=>{
      if(micBtn.classList.contains('recording')){recognition.stop();return}
      try{recognition.start()}catch(e){toast('Microphone not available','error')}
    });
    micStop.addEventListener('click',()=>recognition.stop());
  } else {
    micBtn.style.display='none';
    micStatus.style.display='none';
  }

  // ═══ BODY STATS CONTEXT BUILDER ═══
  function buildBodyContext(){
    const p=NT.state.profile;
    const latest=NT.state.bodyLogs.length?NT.state.bodyLogs[NT.state.bodyLogs.length-1]:null;
    const g=NT.state.bodyGoals;
    const t=NT.state.training;
    let ctx='';

    // Profile
    if(p.dob){
      const age=Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000));
      ctx+=`User: ${age}yr ${p.sex}, ${p.height}cm tall. `;
    }

    // Latest body stats
    if(latest){
      ctx+=`Latest body stats (${latest.date}): ${latest.weight}kg`;
      if(latest.waist)ctx+=`, waist ${latest.waist}cm`;
      if(latest.neck)ctx+=`, neck ${latest.neck}cm`;

      // Calculate BF% if possible
      if(latest.waist&&latest.neck&&p.height){
        let bf;
        if(p.sex==='male')bf=495/(1.0324-0.19077*Math.log10(latest.waist-latest.neck)+0.15456*Math.log10(p.height))-450;
        else if(latest.hip)bf=495/(1.29579-0.35004*Math.log10(latest.waist+latest.hip-latest.neck)+0.22100*Math.log10(p.height))-450;
        if(bf!==undefined){
          bf=Math.max(3,Math.min(50,bf));
          const lean=(latest.weight*(1-bf/100)).toFixed(1);
          ctx+=`, BF ${bf.toFixed(1)}%, lean mass ${lean}kg`;
        }
      }
      ctx+='. ';
    }

    // Weight trend
    const wEntries=Object.entries(NT.state.weights).sort((a,b)=>a[0].localeCompare(b[0]));
    if(wEntries.length>=2){
      const recent=wEntries.slice(-7);
      const wChange=(recent[recent.length-1][1]-recent[0][1]).toFixed(1);
      ctx+=`Weight trend (last ${recent.length} entries): ${wChange>0?'+':''}${wChange}kg. `;
    }

    // Training
    ctx+=`Training: gym ${t.gym}x/wk (${t.style}), cardio ${t.cardio}x/wk. `;

    // Goals
    if(g.targetWeight)ctx+=`Goal: ${g.targetWeight}kg`;
    if(g.targetBf)ctx+=`, ${g.targetBf}% BF`;
    if(g.targetDate)ctx+=` by ${g.targetDate}`;
    ctx+='. ';

    // TDEE estimate
    if(latest&&p.height&&p.dob){
      const age=Math.floor((Date.now()-new Date(p.dob).getTime())/(365.25*86400000));
      let bmr=p.sex==='male'?10*latest.weight+6.25*p.height-5*age+5:10*latest.weight+6.25*p.height-5*age-161;
      const tdee=Math.round(bmr*(p.activity||1.55));
      ctx+=`Estimated TDEE: ${tdee}cal/day. `;
    }

    return ctx;
  }

  function buildPastConversationContext(){
    const allChats=NT.state.coachChats;
    if(allChats.length<=1)return '';
    let ctx='Past conversation topics: ';
    const topics=[];
    allChats.forEach(c=>{
      if(c.id===NT.state.activeChatId)return;
      const userMsgs=c.messages.filter(m=>m.role==='user').map(m=>m.text).slice(0,3);
      if(userMsgs.length)topics.push(c.title+' ('+userMsgs[0].slice(0,60)+')');
    });
    return topics.length?ctx+topics.slice(0,5).join('; ')+'. ':'';
  }

  function buildWorkoutContext(){
    const tpl=NT.state.workoutTemplates;if(!tpl)return '';
    let ctx='WORKOUT TEMPLATES:\n';
    ['push','pull','legs'].forEach(type=>{
      if(!tpl[type])return;
      ctx+=`${type.toUpperCase()}: ${tpl[type].map(e=>`${e.name} ${e.weight}kg x${e.reps} x${e.sets}sets`).join(', ')}\n`;
    });
    if(tpl.cardio)ctx+=`CARDIO: ${tpl.cardio.type}, incline ${tpl.cardio.incline}%, ${tpl.cardio.speedMin}-${tpl.cardio.speedMax}km/h, ${tpl.cardio.durationMin}-${tpl.cardio.durationMax}min\n`;
    ctx+=`Rotation: ${(tpl.sequence||['push','pull','legs']).join(' → ')}, 3-5x/week\n`;
    // Today's workout status
    const log=dayLog(NT.state.currentDate);
    if(log.workout)ctx+=`Today already logged: ${log.workout.type||'workout'}`;
    else ctx+=`Today: no workout logged yet`;
    return ctx;
  }

  function buildWorkoutRule(detectedType){
    const tpl=NT.state.workoutTemplates;
    let exercisesJson='[]';
    if(detectedType&&tpl[detectedType]){
      exercisesJson=JSON.stringify(tpl[detectedType]);
    }
    return `
The user is LOGGING A WORKOUT. Acknowledge it briefly and confirm what they did.
After your response, on a NEW line add EXACTLY this hidden JSON (parsed by app):
<!--WORKOUT_JSON:{"type":"${detectedType||'push'}","exercises":${exercisesJson}${detectedType==='cardio'||!detectedType?',"cardio":{"type":"'+((tpl?.cardio?.type)||'Treadmill')+'","duration":30,"incline":'+(tpl?.cardio?.incline||9)+',"speed":'+(tpl?.cardio?.speedMin||4)+'}':''}}--> 
If the user mentions specific weight changes (e.g. "increased bench to 35kg"), also add on a new line:
<!--WEIGHT_UPDATE:{"exercise":"Bench Press","weight":35}-->
Use the exact exercise name from the templates above.`;
  }

  // ═══ FOOD DETECTION ═══
  function isFoodLog(text){
    const t=text.toLowerCase();
    return /\b(i ate|i had|i just had|i just ate|i've eaten|i've had|i eat|my breakfast|my lunch|my dinner|my snack|for breakfast|for lunch|for dinner|for snack|log this|i drank|i consumed)\b/.test(t) || /\b(\d+\s*g\b.*\b(chicken|rice|egg|roti|bread|fish|meat|dal|milk|yogurt|paneer|butter|oil|ghee|paratha|biryani|tikka|nihari|naan|chapati|daal|sabzi|halwa|puri|oats|banana|apple|protein))/i.test(t);
  }
  function autoMeal(){const h=new Date().getHours();if(h<11)return'breakfast';if(h<15)return'lunch';if(h<20)return'dinner';return'snacks'}
  function detectMeal(text){
    const t=text.toLowerCase();
    if(/\b(breakfast|morning meal|nashta)\b/.test(t))return'breakfast';
    if(/\b(lunch|afternoon meal|dopahar)\b/.test(t))return'lunch';
    if(/\b(dinner|evening meal|raat)\b/.test(t))return'dinner';
    if(/\b(snack|snacks)\b/.test(t))return'snacks';
    return autoMeal();
  }

  // ═══ WORKOUT DETECTION ═══
  function isWorkoutLog(text){
    const t=text.toLowerCase();
    return /\b(i did|i trained|i worked out|did my|just finished|completed|done with|workout done|push day|pull day|leg day|legs day|did push|did pull|did legs|did cardio|treadmill|walked|ran|jogging)\b/.test(t);
  }
  function detectWorkoutType(text){
    const t=text.toLowerCase();
    if(/\b(push|chest|tricep|bench|overhead press|shoulder)\b/.test(t))return'push';
    if(/\b(pull|back|bicep|lat|row|pulldown|face pull)\b/.test(t))return'pull';
    if(/\b(leg|legs|squat|deadlift|leg press|calf|hamstring|quad)\b/.test(t))return'legs';
    if(/\b(cardio|treadmill|walk|run|jog|cycling|bike)\b/.test(t))return'cardio';
    return null;
  }

  // ═══ SEND CHAT ═══
  async function sendChat(text){
    if(!text.trim())return;

    // /clear command — wipe current chat and start fresh
    if(text.trim().toLowerCase()==='/clear'){
      chatIn.value='';chatIn.style.height='auto';
      const chat=getActiveChat();
      if(chat){chat.messages=[];chat.title='New conversation';saveAll();}
      chatMsgs.innerHTML='';
      addMsg("Chat cleared! Let's start fresh. 💪",'ai',false);
      renderChatList();
      toast('Conversation cleared','info');
      return;
    }

    // Ensure active chat exists
    let chat=getActiveChat();
    if(!chat){createNewChat();chat=getActiveChat();}

    addMsg(text,'user');
    chat.messages.push({role:'user',text});

    // Auto-title from first user message
    if(chat.messages.filter(m=>m.role==='user').length===1){
      chat.title=text.slice(0,50);
      renderChatList();
    }

    chatIn.value='';chatIn.style.height='auto';
    const shouldSpeak=usedVoiceInput;
    usedVoiceInput=false; // reset after capturing

    if(!NT.state.geminiKey){addMsg("Please set your Gemini API key in the More tab.",'ai');return}
    showTyping();

    const log=dayLog(NT.state.currentDate);
    let t={cal:0,protein:0,carbs:0,fat:0};
    ['breakfast','lunch','dinner','snacks'].forEach(m=>(log[m]||[]).forEach(i=>{t.cal+=i.cal;t.protein+=i.protein;t.carbs+=i.carbs;t.fat+=i.fat}));

    const dailyCtx=`Today (${NT.state.currentDate}): Goals: ${NT.state.goals.cal}cal/${NT.state.goals.protein}gP/${NT.state.goals.carbs}gC/${NT.state.goals.fat}gF. Eaten: ${Math.round(t.cal)}cal/${Math.round(t.protein)}gP/${Math.round(t.carbs)}gC/${Math.round(t.fat)}gF. Water: ${log.water||0}/${NT.state.goals.water}.`;
    const bodyCtx=buildBodyContext();
    const pastCtx=buildPastConversationContext();
    const workoutCtx=buildWorkoutContext();
    const hist=chat.messages.slice(-8).map(m=>`${m.role}: ${m.text}`).join('\n');
    const foodDetected=isFoodLog(text);
    const workoutDetected=isWorkoutLog(text);
    const detectedWorkoutType=detectWorkoutType(text);
    const userMeal=detectMeal(text);

    const foodRule=foodDetected?`
The user is LOGGING FOOD they ate. For this:
- Break down into components in a markdown table with columns: Food | Serving | Cal | P(g) | C(g) | F(g). Include a TOTAL row.
- Raw chicken breast = 120 cal/100g (NOT 165 — that's cooked). Assume raw unless stated.
- Calories for the TOTAL stated portion, not per 100g.
- This food WILL BE AUTO-LOGGED to their **${userMeal}** diary. Tell them it's been logged. Do NOT say "would you like me to log it?" — it is automatic.

CRITICAL — YOU MUST DO THIS OR THE APP BREAKS:
After your response, on the VERY LAST LINE, you MUST add this hidden HTML comment with the food data as JSON:
<!--FOOD_JSON:[{"name":"Seeded Bread","cal":110,"protein":4.6,"carbs":11.5,"fat":5.1,"fiber":1,"sugar":0.5,"servingText":"1 slice"}]-->
The JSON array MUST contain one object per food item. Numbers MUST match your table. DO NOT forget this line. Without it, NOTHING gets saved.`:'';

    const sp=`You are NutriTrack AI Coach — a friendly, knowledgeable nutrition expert who knows this user personally. Talk like a real person, not a robot.

USER CONTEXT:
${bodyCtx}
${dailyCtx}
${workoutCtx}
${pastCtx}

HOW TO RESPOND:
- Talk naturally, like a helpful friend who happens to be a nutritionist. Use conversational language.
- Keep answers concise and actionable. No walls of text.
- Reference the user's actual stats, goals, and progress when relevant — make it personal.
- Use **bold** for key numbers or important points.
- Use bullet points for lists, not tables.
- ONLY use a table when the user is logging specific food they ate (see below). For general advice, questions, meal ideas, or discussion — just talk normally. Do NOT use tables for advice or suggestions.
- Use markdown formatting: **bold**, *italic*, bullet points.
${foodRule}
${workoutDetected?buildWorkoutRule(detectedWorkoutType):''}

Chat history:
${hist}
${foodDetected?'\nREMINDER: You MUST end your response with the <!--FOOD_JSON:[...]-->  comment. This is mandatory.':''}`;

    try{
      currentAbort=new AbortController();
      // Build parts: system prompt + text + optional image
      const parts=[{text:sp},{text:text}];
      if(stagedImage){
        parts.push({inline_data:{mime_type:stagedImage.mimeType,data:stagedImage.base64}});
      }
      const sentImage=stagedImage; // capture before clearing
      clearStagedImage();

      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${NT.state.geminiKey}`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0.3,maxOutputTokens:4096}}),
        signal:currentAbort.signal
      });
      hideTyping();
      if(!res.ok){const errBody=await res.text();addMsg(`API error ${res.status}: ${errBody.slice(0,200)}`,'ai');return}
      const data=await res.json();
      if(data.error){addMsg(`Error: ${data.error.message}`,'ai');return}
      let reply=data.candidates?.[0]?.content?.parts?.[0]?.text||'Could not process.';

      // Extract food JSON — try multiple patterns for robustness
      let foodItems=null;
      const foodPatterns=[
        /<!--\s*FOOD_JSON\s*:\s*(\[[\s\S]*?\])\s*-->/,
        /<!--FOOD_JSON:(\[[\s\S]*?\])-->/,
        /```json\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/
      ];
      for(const pat of foodPatterns){
        const jm=reply.match(pat);
        if(jm){
          try{foodItems=JSON.parse(jm[1]);break}catch(e){console.warn('Food JSON parse fail:',e)}
        }
      }
      // Clean all food JSON markers from the reply
      reply=reply.replace(/<!--\s*FOOD_JSON\s*:\s*\[[\s\S]*?\]\s*-->/g,'').trim();

      // Extract workout JSON
      let workoutData=null;
      const wm=reply.match(/<!--\s*WORKOUT_JSON\s*:\s*(\{[\s\S]*?\})\s*-->/);
      if(wm){
        try{workoutData=JSON.parse(wm[1])}catch(e){console.warn('Workout JSON parse fail:',e)}
        reply=reply.replace(/<!--\s*WORKOUT_JSON\s*:[\s\S]*?-->/,'').trim();
        if(workoutData){
          const log=dayLog(NT.state.currentDate);
          log.workout=workoutData;
          saveAll();
          if(window.renderWorkout)window.renderWorkout();
          toast(`${(workoutData.type||'Workout').toUpperCase()} day logged!`,'success');
        }
      }

      // Extract weight updates
      const wuMatch=reply.match(/<!--\s*WEIGHT_UPDATE\s*:\s*(\{[\s\S]*?\})\s*-->/);
      if(wuMatch){
        try{
          const wu=JSON.parse(wuMatch[1]);
          const tpl=NT.state.workoutTemplates;
          ['push','pull','legs'].forEach(type=>{
            if(!tpl[type])return;
            tpl[type].forEach(ex=>{
              if(ex.name.toLowerCase()===wu.exercise.toLowerCase()){
                ex.weight=wu.weight;
              }
            });
          });
          saveAll();
          toast(`Updated ${wu.exercise} to ${wu.weight}kg`,'success');
        }catch(e){console.warn('Weight update parse fail:',e)}
        reply=reply.replace(/<!--\s*WEIGHT_UPDATE\s*:[\s\S]*?-->/,'').trim();
      }

      addMsg(reply,'ai');
      chat.messages.push({role:'ai',text:reply});
      if(chat.messages.length>60)chat.messages=chat.messages.slice(-40);
      saveAll();

      // Auto-read response aloud ONLY if user used voice input
      if(shouldSpeak)speakText(reply,chatMsgs.lastElementChild?.querySelector('.tts-btn'));

      // ═══ FALLBACK: If food was detected but no JSON found, extract it with a second call ═══
      if(foodDetected&&!foodItems){
        console.warn('Food detected but no JSON in response — running fallback extraction');
        try{
          const extractRes=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${NT.state.geminiKey}`,{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({contents:[{parts:[{text:`Extract ALL food items from this nutrition response and return ONLY a JSON array. No markdown, no text, no explanation — just the raw JSON array.

Format: [{"name":"Food Name","cal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"servingText":"portion description"}]

Response to extract from:
${reply}`}]}],generationConfig:{temperature:0,maxOutputTokens:1024}})
          });
          if(extractRes.ok){
            const extractData=await extractRes.json();
            let extractText=extractData.candidates?.[0]?.content?.parts?.[0]?.text||'';
            extractText=extractText.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
            try{foodItems=JSON.parse(extractText);console.log('Fallback extraction succeeded:',foodItems)}catch(e){console.warn('Fallback JSON parse fail:',e)}
          }
        }catch(e){console.warn('Fallback extraction error:',e)}
      }

      // ═══ AUTO-LOG FOOD TO DIARY ═══
      if(foodItems&&foodItems.length>0){
        const meal=userMeal;
        const totalCal=foodItems.reduce((s,i)=>s+(i.cal||0),0);

        // Write to diary state immediately
        const dl=dayLog(NT.state.currentDate);
        foodItems.forEach(i=>{
          dl[meal].push({
            name:i.name,cal:i.cal||0,protein:i.protein||0,carbs:i.carbs||0,
            fat:i.fat||0,fiber:i.fiber||0,sugar:i.sugar||0,
            servingText:i.servingText||'1 serving',foodId:'ai_coach'
          });
        });
        saveAll();
        updateDiary();

        // Show confirmation card with undo option
        const card=document.createElement('div');card.className='chat-msg ai';
        card.innerHTML=`<div style="border:1px solid rgba(48,209,88,.3);border-radius:12px;padding:12px;margin-top:4px;background:rgba(48,209,88,.06)">
          <div style="font-weight:600;margin-bottom:6px;color:#30D158;display:flex;align-items:center;gap:6px">
            <span style="font-size:1.1rem">✅</span> Logged to ${meal.charAt(0).toUpperCase()+meal.slice(1)}
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${foodItems.map(i=>`${i.name}: ${Math.round(i.cal)} cal`).join('<br>')}<br><strong style="color:var(--text)">Total: ${Math.round(totalCal)} cal</strong></div>
          <button class="undo-log" style="padding:6px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text2);cursor:pointer;font-size:.75rem;font-family:var(--font)">↩ Undo</button>
        </div>`;
        chatMsgs.appendChild(card);chatMsgs.scrollTop=chatMsgs.scrollHeight;
        toast(`${foodItems.length} item${foodItems.length>1?'s':''} logged to ${meal} (${Math.round(totalCal)} cal)`,'success');

        // Undo handler
        card.querySelector('.undo-log')?.addEventListener('click',()=>{
          const dl2=dayLog(NT.state.currentDate);
          const count=foodItems.length;
          dl2[meal].splice(-count,count);
          saveAll();updateDiary();
          card.innerHTML=`<div style="color:var(--text2);padding:8px">↩ Removed from ${meal}</div>`;
          toast('Food entry undone','info');
        });
      }
    }catch(e){
      hideTyping();
      if(e.name==='AbortError'){addMsg('Response stopped.','ai',false);}
      else{addMsg('Network error: '+e.message,'ai');console.error(e)}
    }finally{currentAbort=null}
  }

  // ═══ EVENT LISTENERS ═══
  chatSend.addEventListener('click',()=>sendChat(chatIn.value));
  chatIn.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendChat(chatIn.value)}});
  chatIn.addEventListener('input',()=>{chatIn.style.height='auto';chatIn.style.height=Math.min(chatIn.scrollHeight,100)+'px'});

  // Stop button
  NT.$('#chatStop').addEventListener('click',()=>{
    if(currentAbort){currentAbort.abort();currentAbort=null}
  });

  // Reset voice flag when typing
  chatIn.addEventListener('keydown',()=>{usedVoiceInput=false});

  // ═══ INIT ═══
  const activeChat=getActiveChat();
  if(activeChat)loadChat(activeChat);
  else createNewChat();
  renderChatList();
});
