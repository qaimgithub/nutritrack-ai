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
    chat.messages.forEach(m=>addMsg(m.text,m.role,false,m.thinking||''));
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
  function addMsg(text,role,save=true,thinking=''){
    const div=document.createElement('div');div.className='chat-msg '+role;
    if(role==='ai'){
      let html='';
      // Thinking dropdown (Gemini-style)
      if(thinking){
        html+=`<details class="ai-thinking"><summary><span class="thinking-icon">💭</span> Thought process</summary><div class="thinking-content">${esc(thinking).replace(/\n/g,'<br>')}</div></details>`;
      }
      html+=formatAI(text);
      div.innerHTML=html;
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
    // Direct food logging phrases
    if(/\b(i ate|i had|i just had|i just ate|i've eaten|i've had|i eat|my breakfast|my lunch|my dinner|my snack|for breakfast|for lunch|for dinner|for snack|log this|i drank|i consumed)\b/.test(t)) return true;
    // Food item + quantity pattern
    if(/\b(\d+\s*g\b.*\b(chicken|rice|egg|roti|bread|fish|meat|dal|milk|yogurt|paneer|butter|oil|ghee|paratha|biryani|tikka|nihari|naan|chapati|daal|sabzi|halwa|puri|oats|banana|apple|protein|rooh afza|lassi|dahi|keema|qeema|pulao))/i.test(t)) return true;
    // Correction/re-log patterns — user wants to fix and re-save
    if(/\b(log it again|save it again|re-?log|correct (cals|calories|values|macros|it)|actually it'?s|the correct|update it|fix it|save (it|this) (as|with)|no it'?s|it should be|wrong.*(log|save)|redo it)\b/i.test(t)) return true;
    // Context: if last AI msg had food JSON and user is giving corrections
    const chat=getActiveChat();
    if(chat){
      const lastAi=[...chat.messages].reverse().find(m=>m.role==='ai');
      if(lastAi && /FOOD_JSON/.test(lastAi.text) && /\b(\d+\s*cal|correct|wrong|actually|should be|log|save)\b/i.test(t)) return true;
    }
    return false;
  }
  function autoMeal(){const h=new Date().getHours();if(h<11)return'breakfast';if(h<15)return'lunch';if(h<20)return'dinner';return'snacks'}
  function detectMeal(text){
    const t=text.toLowerCase();
    if(/\b(breakfast|morning meal|nashta|subah)\b/.test(t))return'breakfast';
    if(/\b(lunch|afternoon meal|dopahar)\b/.test(t))return'lunch';
    if(/\b(dinner|evening meal|raat|shaam)\b/.test(t))return'dinner';
    if(/\b(snack|snacks)\b/.test(t))return'snacks';
    // If re-logging/correcting, check recent chat history for the last meal keyword
    const chat=NT.state.coachChats.find(c=>c.id===NT.state.activeChatId);
    if(chat && /\b(relog|re-log|correct|fix|update|again|with fiber|with sugar|same meal)\b/i.test(t)){
      const recentMsgs=chat.messages.slice(-10);
      for(let i=recentMsgs.length-1;i>=0;i--){
        const mt=recentMsgs[i].text.toLowerCase();
        if(/\b(breakfast|nashta)\b/.test(mt))return'breakfast';
        if(/\b(lunch|dopahar)\b/.test(mt))return'lunch';
        if(/\b(dinner|raat|shaam)\b/.test(mt))return'dinner';
        if(/\b(snack)\b/.test(mt))return'snacks';
        // Also check if the AI confirmed logging to a specific meal
        if(/logged to breakfast/i.test(mt))return'breakfast';
        if(/logged to lunch/i.test(mt))return'lunch';
        if(/logged to dinner/i.test(mt))return'dinner';
        if(/logged to snack/i.test(mt))return'snacks';
      }
    }
    return autoMeal();
  }

  // ═══ WORKOUT DETECTION ═══
  function isWorkoutLog(text){
    const t=text.toLowerCase();
    return /\b(i did|i trained|i worked out|did my|just finished|completed|done with|workout done|push day|pull day|leg day|legs day|did push|did pull|did legs|did cardio|treadmill|walked|ran|jogging|log.{0,10}push|log.{0,10}pull|log.{0,10}legs|log.{0,10}cardio|log.{0,10}workout|push.{0,15}(yesterday|kal|log)|pull.{0,15}(yesterday|kal|log)|legs.{0,15}(yesterday|kal|log)|did.{0,5}gym|gym.{0,10}(kia|kiya|done|log))\b/.test(t);
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

    if(!hasAiKey()){addMsg("Please set your Groq or Gemini API key in the More tab.",'ai');return}
    showTyping();

    // ═══ DATE DETECTION — support back-date logging ═══
    let targetDate=NT.state.currentDate;
    const datePatterns=[
      // "30 apr", "30 april", "april 30", "apr 30"
      /(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*(\d{1,2})/i,
      // "yesterday", "kal", "parso"
      /\b(yesterday|kal)\b/i,
      /\b(day before yesterday|parso|parson)\b/i,
      // "2026-04-30" or "30/04" or "30-04"
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{1,2})[\/\-](\d{1,2})/
    ];
    const monthMap={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const lowerText=text.toLowerCase();
    // Check relative dates first
    if(/\b(yesterday|kal|pichle|guzishta)\b/i.test(lowerText)){
      targetDate=shiftDate(todayStr(),-1);
    }else if(/\b(day before yesterday|parso|parson)\b/i.test(lowerText)){
      targetDate=shiftDate(todayStr(),-2);
    }else if(/\b(tomorrow)\b/i.test(lowerText)){
      targetDate=shiftDate(todayStr(),1);
    }else{
      // Try "30 apr", "30 april", "30th april", "april 30"
      const monthNames='jan|feb|mar|apr|april|may|jun|june|jul|july|aug|sep|sept|oct|nov|dec';
      let dm=lowerText.match(new RegExp('(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(' + monthNames + ')\\w*','i'));
      if(!dm) dm=lowerText.match(new RegExp('(' + monthNames + ')\\w*\\s*(\\d{1,2})','i'));
      if(dm){
        // Figure out which group is the day and which is the month
        const g1=dm[1], g2=dm[2];
        let day, monStr;
        if(/^\d+$/.test(g1)){
          day=parseInt(g1);
          monStr=g2.slice(0,3).toLowerCase();
        }else{
          monStr=g1.slice(0,3).toLowerCase();
          day=parseInt(g2);
        }
        const mon=monthMap[monStr];
        if(mon!==undefined && day>=1 && day<=31){
          const yr=new Date().getFullYear();
          const d=new Date(yr,mon,day);
          targetDate=d.toISOString().slice(0,10);
        }
      }
    }
    console.log('[NutriTrack] Date detection → targetDate:', targetDate, '| from text:', lowerText.slice(0,60));
    if(targetDate!==todayStr()) toast(`📅 Logging to: ${targetDate}`,'info');

    const log=dayLog(targetDate);
    let t={cal:0,protein:0,carbs:0,fat:0};
    ['breakfast','lunch','dinner','snacks'].forEach(m=>(log[m]||[]).forEach(i=>{t.cal+=i.cal;t.protein+=i.protein;t.carbs+=i.carbs;t.fat+=i.fat}));

    // Build detailed per-meal breakdown so AI knows exactly what's logged
    const mealDetail=['breakfast','lunch','dinner','snacks'].map(m=>{
      const items=log[m]||[];
      if(items.length===0) return `  ${m}: (empty — nothing logged)`;
      const list=items.map(i=>`${i.name} ${Math.round(i.cal)}cal`).join(', ');
      return `  ${m}: ${list}`;
    }).join('\n');

    const dateLabel=targetDate===todayStr()?'Today':targetDate===shiftDate(todayStr(),-1)?'Yesterday':targetDate===shiftDate(todayStr(),1)?'Tomorrow':targetDate;
    const dailyCtx=`DIARY STATE for ${dateLabel} (${targetDate}):\nGoals: ${NT.state.goals.cal}cal/${NT.state.goals.protein}gP/${NT.state.goals.carbs}gC/${NT.state.goals.fat}gF.\nTotal eaten: ${Math.round(t.cal)}cal/${Math.round(t.protein)}gP/${Math.round(t.carbs)}gC/${Math.round(t.fat)}gF. Water: ${log.water||0}/${NT.state.goals.water}.\nMeal slots:\n${mealDetail}\nNOTE: When logging food, save to date ${targetDate}. If user mentions a different date, use that date.`;

    // Build 3-day diary history for trend awareness
    let diaryHistory='';
    for(let i=1;i<=3;i++){
      const pastDate=shiftDate(todayStr(),-i);
      if(pastDate===targetDate) continue; // skip if already shown above
      const pLog=NT.state.logs[pastDate];
      if(!pLog) continue;
      let pt={cal:0,protein:0,carbs:0,fat:0};
      ['breakfast','lunch','dinner','snacks'].forEach(m=>(pLog[m]||[]).forEach(item=>{pt.cal+=item.cal;pt.protein+=item.protein;pt.carbs+=item.carbs;pt.fat+=item.fat}));
      if(pt.cal>0){
        const pLabel=i===1?'Yesterday':i===2?'2 days ago':'3 days ago';
        diaryHistory+=`${pLabel} (${pastDate}): ${Math.round(pt.cal)}cal, ${Math.round(pt.protein)}gP, ${Math.round(pt.carbs)}gC, ${Math.round(pt.fat)}gF. Water: ${pLog.water||0}.\n`;
      }
    }
    if(diaryHistory) diaryHistory='\nRECENT DIARY HISTORY:\n'+diaryHistory;
    const bodyCtx=buildBodyContext();
    const pastCtx=buildPastConversationContext();
    const workoutCtx=buildWorkoutContext();
    const hist=chat.messages.slice(-8).map(m=>`${m.role}: ${m.text}`).join('\n');

    // /log command — explicit food logging trigger (works before or after food text)
    const hasLogCmd=/\/log\b/i.test(text);
    if(hasLogCmd){
      text=text.replace(/\/log\b/gi,'').trim();
      // If user just said "/log" or "/log this" with no real food text,
      // pull context from the last AI response so the model knows what to log
      if(!text || /^(this|it|that|these|above|prev|previous|last)$/i.test(text)){
        const lastAi=chat.messages.filter(m=>m.role==='ai').pop();
        if(lastAi) text='Log the food items discussed in this conversation. Here is the last response for reference:\n'+lastAi.text;
        else text='The user wants to log food but no prior context found.';
      }
    }

    const foodDetected=hasLogCmd||isFoodLog(text);
    const workoutDetected=isWorkoutLog(text);
    const detectedWorkoutType=detectWorkoutType(text);
    const userMeal=detectMeal(text);

    const foodRule=foodDetected?`
The user is LOGGING FOOD they ate. You must be PRECISE and INTELLIGENT about this:

STEP 1 — IDENTIFY & REASON:
- Identify every food item and its quantity.
- If a photo is attached with a NUTRITION LABEL, READ the label — it's the most accurate source.
- For packaged/branded foods (Dawn bread, Sabroso, K&N's), use published brand nutrition info.
- For home-cooked South Asian food: reason about what goes INTO the dish — protein source + cooking fat (oil/ghee, typically 1-2 tbsp per serving = 120-250 cal) + carb base + spices.
- For unknown foods, reason from first principles: what are the ingredients? How is it cooked? What's a realistic portion?

STEP 2 — CALCULATE:
- Show a markdown table: Food | Serving | Cal | P(g) | C(g) | F(g). Include a TOTAL row.
- Anchor to USDA/IFCT reference values:
  * Chapati/Roti (~40g): 120 cal. Paratha (~80g): 260 cal. Naan (~90g): 260 cal.
  * Cooked rice: 130 cal/100g. Cooked chicken: 165 cal/100g. Raw chicken: 120 cal/100g.
  * Egg: 75 cal. Dal (cooked): 115 cal/100g. Oil/Ghee: ~120 cal/tbsp.
  * Milk (whole): 62 cal/100ml. Dahi/Yogurt: 60 cal/100g.
- Calories = total for the ENTIRE stated portion, NEVER per 100g.
- MANDATORY 4-9-4 SELF-CHECK: cal MUST equal (protein*4)+(carbs*4)+(fat*9) within 5%. If not, fix the numbers before responding. The macros DEFINE the calories.
- COOKING FAT: "dal"/"curry"/"sabzi" = cooked with oil/ghee tadka, add 5-10g fat. Only 0-1g fat if explicitly "boiled"/"steamed"/"plain".
- After your breakdown, a confirmation button will appear. Do NOT say "logged" or "saved" — say something like "Here's the breakdown — confirm to log it to your diary."

CRITICAL — YOU MUST DO THIS OR THE APP BREAKS:
After your response, on the VERY LAST LINE, you MUST add this hidden HTML comment with the food data as JSON:
<!--FOOD_JSON:[{"name":"Seeded Bread","cal":110,"protein":4.6,"carbs":11.5,"fat":5.1,"fiber":1,"sugar":0.5,"servingText":"1 slice (30g)"}]-->
The JSON array MUST contain one object per food item. Numbers MUST match your table. Each item MUST include ALL of these fields:
"name", "cal", "protein", "carbs", "fat", "fiber" (default 0 if unknown), "sugar" (default 0 if unknown), "servingText" (with grams like "(126g)").
NEVER skip fiber or sugar — use 0 if you don't know. Without this line, NOTHING gets saved.

WATER LOGGING:
If the user mentions drinking water (e.g. "a glass of water", "log water", "drank water"), ALSO add this on a separate line:
<!--WATER_JSON:1-->
The number is how many glasses. This is IN ADDITION to the FOOD_JSON line if there is food too.`:'';

    // ═══ INJECT LOCAL DB VALUES INTO PROMPT ═══
    // Scan user message for known foods and inject exact values so the AI doesn't guess
    let dbHints='';
    if(typeof FOOD_DB!=='undefined' && typeof FOOD_ALIASES!=='undefined'){
      const words=text.toLowerCase();
      const matched=new Set();
      // Check aliases
      for(const [alias,id] of Object.entries(FOOD_ALIASES)){
        if(words.includes(alias)){
          matched.add(id);
        }
      }
      // Check direct name matches
      for(const food of FOOD_DB){
        if(words.includes(food.name.toLowerCase().split('(')[0].trim())){
          matched.add(food.id);
        }
      }
      if(matched.size>0){
        const hints=[];
        for(const id of matched){
          const food=FOOD_DB.find(f=>f.id===id);
          if(!food)continue;
          const servingInfo=food.servings.filter(s=>s.name!=='g').map(s=>`1 ${s.name} (${s.g}g) = ${Math.round(food.cal*s.g/100)} cal`).join(', ');
          hints.push(`• ${food.name}: per 100g → ${food.cal}cal, ${food.protein}gP, ${food.carbs}gC, ${food.fat}gF. Servings: ${servingInfo}`);
        }
        dbHints=`\nVERIFIED REFERENCE VALUES (for SIMPLE/SINGLE ingredients only — use these exact per-100g macros):\n${hints.join('\n')}\nUSAGE RULES:\n- Use these DB values for SIMPLE items (roti, egg, rice, naan, raita, etc.) — just scale to portion.\n- For COMPLEX/COOKED dishes (fried rice, biryani, karahi, etc.), IGNORE the DB entry and DECOMPOSE into ingredients instead.\n- After computing all macros, do a FINAL CHECK: add up P, C, F from all items. Then verify total_cal = (total_P*4)+(total_C*4)+(total_F*9). If it doesn't match, you made an error — go back and fix.\n`;
      }
    }

    const sp=`You are NutriTrack AI Coach — a friendly, knowledgeable nutrition expert who knows this user personally. Talk like a real person, not a robot.

USER CONTEXT:
${bodyCtx}
${dailyCtx}${diaryHistory}
${workoutCtx}
${pastCtx}
${dbHints}

HOW TO RESPOND:
- Talk naturally, like a helpful friend who happens to be a nutritionist. Use conversational language.
- Keep answers concise and actionable. No walls of text.
- Reference the user's actual stats, goals, and progress when relevant — make it personal.
- Use **bold** for key numbers or important points.
- Use bullet points for lists, not tables.
- ONLY use a table when the user is logging specific food they ate (see below). For general advice, questions, meal ideas, or discussion — just talk normally. Do NOT use tables for advice or suggestions.
- Use markdown formatting: **bold**, *italic*, bullet points.

NUTRITION ACCURACY — HOW TO THINK ABOUT FOOD (apply to ALL food discussions):
NEVER estimate a dish as a whole. ALWAYS decompose into ingredients first. Follow this exact process:

STEP 1 — DECOMPOSE INTO INGREDIENTS:
Break any dish into its raw components. Example for "chicken karahi":
  → Chicken pieces: ~200g cooked chicken
  → Cooking oil/ghee: ~2 tbsp (28g)
  → Tomatoes, onions, spices: ~100g
  → Gravy base: flour/yogurt if applicable

STEP 2 — CALCULATE MACROS PER INGREDIENT (use these anchors):
  Proteins: Chicken (cooked) 31gP/0gC/3.6gF per 100g. Beef (cooked) 26gP/0gC/11gF per 100g. Egg: 6.5gP/0.5gC/5gF per egg. Lentils (cooked): 9gP/20gC/0.4gF per 100g. Chickpeas (cooked): 9gP/27gC/2.6gF per 100g.
  Carbs: Cooked rice: 2.7gP/28gC/0.3gF per 100g. Roti (40g): 3.5gP/20gC/3gF. Naan (90g): 8gP/45gC/5gF. Puri (40g, fried): 2.5gP/17gC/8gF.
  Fats: Oil/Ghee: 0gP/0gC/14gF per tbsp (120cal). Butter: 0gP/0gC/11gF per tbsp (100cal).
  Dairy: Yogurt/Dahi: 3.5gP/4.7gC/3.3gF per 100g. Milk (whole): 3.2gP/4.8gC/3.3gF per 100ml.
  Vegetables: Tomato/onion gravy base adds ~5-10gC per serving, negligible P/F.

STEP 3 — ALWAYS ADD COOKING FAT:
  Desi home cooking ALWAYS uses oil/ghee. Never skip this:
  → Light dishes (dal, sabzi): 1 tbsp oil = 14gF / 120cal
  → Medium (karahi, keema): 2 tbsp = 28gF / 240cal
  → Heavy (nihari, halwa, deep-fried): 3+ tbsp = 42gF+ / 360cal+
  → Deep fried (puri, samosa, pakora): item absorbs oil, already in per-piece values
  → ONLY skip cooking fat if user says "plain", "boiled", "steamed", or "grilled"

STEP 4 — SCALE TO ACTUAL PORTION:
  Reference values are per 100g. If the portion is different, multiply ALL values by (portion_g / 100).
  Example: Paratha is 7gP/45gC/13gF per 100g. For 80g: P=5.6g, C=36g, F=10.4g. NEVER use per-100g macros with scaled calories — that makes the math wrong.

STEP 5 — SUM ALL SCALED INGREDIENT MACROS:
  Add up P, C, F from all ingredients. These are your final macros.

STEP 6 — DERIVE CALORIES USING 4-9-4:
  cal = (total_P × 4) + (total_C × 4) + (total_F × 9)
  NEVER state calories independently. The macros DEFINE the calories. Period.
  Do this check PER ITEM and for the TOTAL. If any item's macros don't produce its stated calories, you made a scaling error — go back and fix it.

IMPORTANT MINDSET:
- Think like a chef, not a calorie counter. What GOES INTO the pot?
- A "bowl of nihari" is NOT one thing — it's beef shank + bone marrow + ghee + flour + spices. Decompose it.
- When in doubt, overestimate fat rather than underestimate. Desi cooking is generous with oil.
- ALWAYS scale macros AND calories together. Never mix per-100g macros with portion-scaled calories.
- Oil math: 1 tbsp = 14g fat = 126 cal. 2 tbsp = 28g fat = 252 cal. NOT 240.

MANDATORY FINAL VERIFICATION (do this BEFORE writing your response):
1. Add up P from all items. Add up C from all items. Add up F from all items.
2. Verify: stated_total_P = sum of individual P values. Same for C and F.
3. Verify: total_cal = (total_P × 4) + (total_C × 4) + (total_F × 9).
4. If ANY check fails, FIX the numbers. Do NOT output incorrect totals.
${foodRule}
${workoutDetected?buildWorkoutRule(detectedWorkoutType):''}

Chat history:
${hist}
${foodDetected?'\nREMINDER: You MUST end your response with the <!--FOOD_JSON:[...]-->  comment. This is mandatory.':''}`;

    try{
      currentAbort=new AbortController();
      // Build image data if staged
      let imgData=null;
      if(stagedImage){
        imgData={mime_type:stagedImage.mimeType,data:stagedImage.base64};
      }
      const sentImage=stagedImage;
      clearStagedImage();

      const reply_result=await aiCall(sp,text,{temperature:0.3,maxTokens:4096,imageData:imgData,signal:currentAbort.signal});
      hideTyping();
      // Unpack thinking from aiCall response
      let reply,thinkingText='';
      if(typeof reply_result==='object'&&reply_result.text!==undefined){
        reply=reply_result.text;
        thinkingText=reply_result.thinking||'';
      } else {
        reply=reply_result;
      }

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

      // Extract water JSON
      let waterGlasses=0;
      const waterMatch=reply.match(/<!--\s*WATER_JSON\s*:\s*(\d+)\s*-->/);
      if(waterMatch){
        waterGlasses=parseInt(waterMatch[1])||0;
        reply=reply.replace(/<!--\s*WATER_JSON\s*:\s*\d+\s*-->/g,'').trim();
      }
      // Also detect water from text if AI forgot the tag
      if(!waterGlasses && foodDetected){
        const waterTextMatch=text.match(/(\d+)\s*(?:glass|cup|glas)(?:es|s)?\s*(?:of\s*)?water/i);
        if(waterTextMatch) waterGlasses=parseInt(waterTextMatch[1])||1;
        else if(/\b(?:a\s+glass\s+of\s+water|glass\s+of\s+water|log\s+water|drank\s+water)\b/i.test(text)) waterGlasses=1;
      }

      // Extract workout JSON
      let workoutData=null;
      const wm=reply.match(/<!--\s*WORKOUT_JSON\s*:\s*(\{[\s\S]*?\})\s*-->/);
      if(wm){
        try{workoutData=JSON.parse(wm[1])}catch(e){console.warn('Workout JSON parse fail:',e)}
        reply=reply.replace(/<!--\s*WORKOUT_JSON\s*:[\s\S]*?-->/,'').trim();
        if(workoutData){
          const log=dayLog(targetDate);
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

      addMsg(reply,'ai',true,thinkingText);
      chat.messages.push({role:'ai',text:reply,thinking:thinkingText||undefined});
      if(chat.messages.length>60)chat.messages=chat.messages.slice(-40);
      saveAll();

      // Auto-read response aloud ONLY if user used voice input
      if(shouldSpeak)speakText(reply,chatMsgs.lastElementChild?.querySelector('.tts-btn'));

      // ═══ FALLBACK: If food was detected but no JSON found, extract it with a second call ═══
      if(foodDetected&&!foodItems){
        console.warn('Food detected but no JSON in response — running fallback extraction');
        try{
          const extractText=await aiCall(
            'Extract ALL food items from the text below and return ONLY a JSON array.',
            `Format: [{"name":"Food Name","cal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"servingText":"portion description"}]\n\nResponse to extract from:\n${reply}`,
            {temperature:0,maxTokens:1024}
          );
          try{foodItems=JSON.parse(extractText);console.log('Fallback extraction succeeded:',foodItems)}catch(e){console.warn('Fallback JSON parse fail:',e)}
        }catch(e){console.warn('Fallback extraction error:',e)}
      }

      // ═══ CONFIRM BEFORE LOGGING — show card with meal picker + date ═══
      if(foodItems&&foodItems.length>0){
        const defaultMeal=userMeal;
        const totalCal=foodItems.reduce((s,i)=>s+(i.cal||0),0);

        const card=document.createElement('div');card.className='chat-msg ai';
        card.innerHTML=`<div style="border:1px solid rgba(var(--accent-rgb),.3);border-radius:12px;padding:12px;margin-top:4px;background:rgba(var(--accent-rgb),.04)">
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">${foodItems.map(i=>`${i.name}: <strong style="color:var(--text)">${Math.round(i.cal)}</strong> cal`).join('<br>')}<br><strong style="color:var(--accent)">Total: ${Math.round(totalCal)} cal</strong></div>
          <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
            <select class="meal-select" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);font-size:.78rem;font-family:var(--font);flex:1;min-width:100px">
              <option value="breakfast"${defaultMeal==='breakfast'?' selected':''}>🌅 Breakfast</option>
              <option value="lunch"${defaultMeal==='lunch'?' selected':''}>☀️ Lunch</option>
              <option value="dinner"${defaultMeal==='dinner'?' selected':''}>🌙 Dinner</option>
              <option value="snacks"${defaultMeal==='snacks'?' selected':''}>🍿 Snacks</option>
            </select>
            <input type="date" class="date-select" value="${targetDate}" style="padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);font-size:.75rem;font-family:var(--font);flex:1;min-width:120px" />
          </div>
          <div style="display:flex;gap:8px">
            <button class="confirm-log" style="flex:1;padding:8px 14px;border:0;border-radius:8px;background:var(--accent);color:#000;cursor:pointer;font-size:.78rem;font-weight:600;font-family:var(--font)">✅ Log this</button>
            <button class="skip-log" style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text2);cursor:pointer;font-size:.78rem;font-family:var(--font)">✗ Skip</button>
          </div>
        </div>`;
        chatMsgs.appendChild(card);chatMsgs.scrollTop=chatMsgs.scrollHeight;

        // Log handler — reads meal & date from the card's controls
        card.querySelector('.confirm-log')?.addEventListener('click',()=>{
          const selectedMeal=card.querySelector('.meal-select').value;
          const selectedDate=card.querySelector('.date-select').value;
          const dl=dayLog(selectedDate);
          foodItems.forEach(i=>{
            let g=100;
            const gm=(i.servingText||'').match(/(\d+\.?\d*)\s*g/i);
            if(gm)g=parseFloat(gm[1]);
            dl[selectedMeal].push({
              name:i.name,cal:i.cal||0,protein:i.protein||0,carbs:i.carbs||0,
              fat:i.fat||0,fiber:i.fiber||0,sugar:i.sugar||0,
              servingText:i.servingText||'1 serving',foodId:'ai_coach',grams:g
            });
          });
          saveAll();updateDiary();
          const mealLabel=selectedMeal.charAt(0).toUpperCase()+selectedMeal.slice(1);
          const dateShow=selectedDate===todayStr()?'':` (${selectedDate})`;
          card.innerHTML=`<div style="border:1px solid rgba(48,209,88,.3);border-radius:12px;padding:10px;background:rgba(48,209,88,.06)">
            <span style="color:#30D158;font-weight:600">✅ Logged to ${mealLabel}${dateShow}</span>
            <span style="font-size:.72rem;color:var(--text2);margin-left:8px">${Math.round(totalCal)} cal</span>
            <button class="undo-log" style="float:right;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text2);cursor:pointer;font-size:.7rem;font-family:var(--font)">↩ Undo</button>
          </div>`;
          toast(`${foodItems.length} item${foodItems.length>1?'s':''} logged to ${mealLabel}${dateShow} (${Math.round(totalCal)} cal)`,'success');
          // Undo handler
          card.querySelector('.undo-log')?.addEventListener('click',()=>{
            const dl2=dayLog(selectedDate);
            dl2[selectedMeal].splice(-foodItems.length,foodItems.length);
            saveAll();updateDiary();
            card.innerHTML=`<div style="color:var(--text2);padding:8px">↩ Removed from ${mealLabel}</div>`;
            toast('Food entry undone','info');
          });
        });

        // Skip handler
        card.querySelector('.skip-log')?.addEventListener('click',()=>{
          card.innerHTML=`<div style="color:var(--muted);padding:8px;font-size:.78rem">Skipped — not logged</div>`;
        });
      }

      // ═══ AUTO-LOG WATER ═══
      if(waterGlasses>0){
        const dl=dayLog(targetDate);
        dl.water=(dl.water||0)+waterGlasses;
        saveAll();updateDiary();
        toast(`💧 ${waterGlasses} glass${waterGlasses>1?'es':''} of water logged (${dl.water} total)`,'success');
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
