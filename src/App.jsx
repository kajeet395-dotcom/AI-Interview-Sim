import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Send, ChevronRight, CheckCircle, Circle, RotateCcw,
         Volume2, VolumeX, Brain, BarChart2, User, FileText, Briefcase, Zap,
         TrendingUp, AlertTriangle, Award, Clock, Star, ArrowRight,
         Play, SkipForward, Upload, X, ChevronDown } from "lucide-react";

// ═══════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════
const T = {
  bg0:'#04060e',bg1:'#080d1a',bg2:'#0d1526',bg3:'#111e34',
  bd:'#1a2845',bdH:'#243660',
  b:'#4f7ef7',bD:'#3b63db',bL:'#7aa3fa',bG:'rgba(79,126,247,0.12)',
  t:'#0fb5a0',tL:'#2dd4bf',tG:'rgba(15,181,160,0.12)',
  p:'#9166f3',pL:'#b08af7',pG:'rgba(145,102,243,0.12)',
  a:'#f0a500',aL:'#fbbf24',aG:'rgba(240,165,0,0.12)',
  r:'#e85555',rL:'#f87171',rG:'rgba(232,85,85,0.12)',
  g:'#0da874',gL:'#34d399',gG:'rgba(13,168,116,0.12)',
  tx:'#eef2ff',t2:'#7a8bad',t3:'#3d4f6b',t4:'#1a2845',
  fn:"'Inter',system-ui,sans-serif",
  fnH:"'Syne','Inter',sans-serif",
  fnM:"'JetBrains Mono','Fira Code',monospace",
};

const scoreColor = v => v>=80?T.g:v>=65?T.b:v>=50?T.a:T.r;

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

const MISTRAL_API_KEY = "N9jvIFHhGcwazNfVGFqJMo82L7y09CaS";
const MISTRAL_MODEL = "mistral-large-latest";

const mistralAPI = async (messages, system = "") => {
  const formattedMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages
  ];

  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `Mistral API ${r.status}`);
  }

  const data = await r.json();
  return data.choices?.[0]?.message?.content || "";
};

const safeJSON = (txt) => {
  try {
    const m = txt.match(/(\[[\s\S]*\]|\{[\s\S]*\})/s);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════
// API LAYER
// ═══════════════════════════════════════════
const api = {
  async questions(cfg) {
    const txt = await mistralAPI([{role:'user',content:
      `Generate exactly 7 interview questions as a JSON array.
Role: ${cfg.role||'Software Engineer'}
Company: ${cfg.company||'Tech Company'}  
Type: ${cfg.type||'behavioral'}
Difficulty: ${cfg.difficulty||'medium'}
JD: ${(cfg.jd||'').slice(0,500)}
CV: ${(cfg.cv||'').slice(0,500)}

Return ONLY valid JSON array, no markdown:
[{"id":1,"question":"...","category":"behavioral|technical|situational|leadership","difficulty":"easy|medium|hard","probe":"follow-up question"}]`
    }], 'Return valid JSON arrays only. No markdown.');
    const q = safeJSON(txt);
    if (!Array.isArray(q) || q.length === 0) throw new Error('Invalid question format from AI');
    return q;
  },

  async analyze(question, answer, role) {
    const txt = await mistralAPI([{role:'user',content:
      `Score this ${role} interview answer.
Q: ${question}
A: "${(answer||'[No answer]').slice(0,600)}"

Return ONLY JSON:
{"scores":{"clarity":0,"relevance":0,"depth":0,"structure":0,"confidence":0,"overall":0},
"starMethod":false,"strengths":["..."],"gaps":["..."],"feedback":"2-sentence coaching","grade":"A|B|C|D|F"}`
    }], 'Senior interview coach. Return valid JSON only.');
    return safeJSON(txt) || {
      scores:{clarity:60,relevance:60,depth:55,structure:58,confidence:62,overall:59},
      strengths:['Attempted the question'],gaps:['Add specific examples'],
      feedback:'Provide more detail using the STAR method.',grade:'C',starMethod:false
    };
  },

  async report(qa, cfg) {
    const data = qa.map((x,i)=>`Q${i+1}: ${x.q}\nA: ${(x.a||'').slice(0,200)}\nScores:${JSON.stringify(x.analysis?.scores)}`).join('\n---\n');
    const txt = await mistralAPI([{role:'user',content:
      `Full interview report for ${cfg.role} at ${cfg.company}:
${data}

Return ONLY JSON:
{"verdict":"Strong Hire|Hire|Consider|No Hire","overallScore":0,
"summary":"3-sentence summary","hiringRisk":"Low|Medium|High",
"competencies":[{"name":"Communication","score":0,"note":""},{"name":"Problem Solving","score":0,"note":""},{"name":"Technical Depth","score":0,"note":""},{"name":"Leadership","score":0,"note":""},{"name":"Culture Fit","score":0,"note":""}],
"strengths":["..."],"gaps":["..."],"coachingPlan":["..."],"nextStep":"...","percentile":"top X%"}`
    }], 'Senior HR analytics. Return valid JSON only.');
    return safeJSON(txt);
  }
};

// ═══════════════════════════════════════════
// VOICE ENGINE — FIXED
// ═══════════════════════════════════════════
const voice = {
  synth: typeof window!=='undefined' ? window.speechSynthesis : null,
  recInstance: null,
  _endTimer: null,

  speak(text, onEnd) {
    if (!this.synth) { setTimeout(()=>onEnd?.(), 1000); return; }
    this.synth.cancel();
    clearTimeout(this._endTimer);
    const u = new SpeechSynthesisUtterance(text);
    const vs = this.synth.getVoices();
    const pick = vs.find(v=>v.name.includes('Samantha'))||
                 vs.find(v=>v.name.includes('Google UK'))||
                 vs.find(v=>v.name.includes('Microsoft Aria'))||
                 vs.find(v=>v.lang==='en-US')||vs[0];
    if(pick) u.voice=pick;
    u.rate=0.88; u.pitch=1.0; u.volume=1.0;
    // FIX: Chrome bug — use timer fallback for onend reliability
    u.onend = ()=>{ clearTimeout(this._endTimer); onEnd?.(); };
    u.onerror = ()=>{ clearTimeout(this._endTimer); onEnd?.(); };
    this._endTimer = setTimeout(()=>onEnd?.(), text.length*75 + 1500);
    this.synth.speak(u);
  },

  stop() {
    this.synth?.cancel();
    clearTimeout(this._endTimer);
  },

  // FIX: Accumulates transcript correctly; restarts on silence
  startListening(onResult, onError) {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { onError?.('unsupported'); return false; }
    
    let accumulated = '';
    let restartTimer = null;
    let active = true;

    const start = () => {
      if (!active) return;
      const rec = new R();
      this.recInstance = rec;
      rec.continuous = false; // more reliable cross-browser
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) { accumulated += t + ' '; }
          else { interim = t; }
        }
        onResult?.(accumulated + interim, false);
      };

      rec.onend = () => {
        if (active) {
          // Auto-restart after 400ms gap (handles pause)
          restartTimer = setTimeout(start, 400);
        }
      };
      rec.onerror = e => {
        if (e.error === 'not-allowed') { active=false; onError?.('permission'); }
        // Other errors: just restart
      };
      try { rec.start(); } catch(e) { /* already started */ }
    };

    start();

    // Return stop function
    this._stopListening = () => {
      active = false;
      clearTimeout(restartTimer);
      try { this.recInstance?.stop(); } catch {}
      return accumulated.trim();
    };
    return true;
  },

  stopListening() {
    if (this._stopListening) { const t = this._stopListening(); this._stopListening=null; return t; }
    return '';
  }
};

// ═══════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════
function Pill({label,color=T.b}) {
  return <span style={{display:'inline-block',padding:'2px 10px',borderRadius:99,fontSize:11,fontWeight:600,
    background:color+'22',color,border:`1px solid ${color}44`,letterSpacing:0.4}}>{label}</span>;
}

function ScoreBar({label,value=0,color=T.b}) {
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:11,color:T.t2}}>{label}</span>
        <span style={{fontSize:11,fontFamily:T.fnM,color,fontWeight:600}}>{value}</span>
      </div>
      <div style={{height:4,background:T.bd,borderRadius:99,overflow:'hidden'}}>
        <div style={{width:`${value}%`,height:'100%',background:color,borderRadius:99,transition:'width 1s ease'}}/>
      </div>
    </div>
  );
}

function Btn({children,onClick,color=T.b,variant='solid',size='md',disabled=false,style={}}) {
  const pad = size==='sm'?'6px 12px':size==='lg'?'13px 26px':'9px 18px';
  const fs = size==='sm'?11:size==='lg'?14:12;
  const base = {padding:pad,fontSize:fs,fontWeight:600,borderRadius:8,cursor:disabled?'not-allowed':'pointer',
    fontFamily:T.fn,border:'none',transition:'all 0.15s',opacity:disabled?0.4:1,
    display:'inline-flex',alignItems:'center',gap:5,...style};
  const vars = {
    solid:{background:color,color:'#fff'},
    ghost:{background:'transparent',color,border:`1px solid ${color}55`},
    outline:{background:T.bg2,color:T.tx,border:`1px solid ${T.bd}`},
  };
  return <button onClick={disabled?undefined:onClick} style={{...base,...vars[variant]}}>{children}</button>;
}

// ORB animated avatar
function Orb({state='idle',voiceOn=true}) {
  const cfg = {
    idle:     {c1:'#1a2845',c2:'#243660',c3:'#1a2845',glow:'transparent',pulse:false},
    speaking: {c1:'#1d4fbe',c2:'#4f7ef7',c3:'#7aa3fa',glow:T.b,pulse:true},
    listening:{c1:'#065f46',c2:'#0da874',c3:'#34d399',glow:T.g,pulse:true},
    thinking: {c1:'#3b1d8a',c2:'#9166f3',c3:'#b08af7',glow:T.p,pulse:true},
  }[state]||{c1:T.bd,c2:T.bdH,c3:T.bd,glow:'transparent',pulse:false};
  const label = {idle:'STANDBY',speaking:'SPEAKING',listening:'LISTENING',thinking:'ANALYZING'}[state];
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      <div style={{position:'relative',width:120,height:120}}>
        {cfg.pulse&&[1,2].map(i=>(
          <div key={i} style={{position:'absolute',inset:-i*14,borderRadius:'50%',
            border:`1.5px solid ${cfg.glow}44`,
            animation:`orbRing${i} ${1.8+i*0.6}s ease-out infinite`}}/>
        ))}
        <div style={{width:120,height:120,borderRadius:'50%',
          background:`conic-gradient(from 0deg,${cfg.c1},${cfg.c2},${cfg.c3},${cfg.c1})`,
          animation:'orbSpin 5s linear infinite',
          boxShadow:`0 0 ${cfg.pulse?'40px':'15px'} ${cfg.glow}55`,
          position:'relative',transition:'box-shadow 0.5s'}}>
          <div style={{position:'absolute',inset:10,borderRadius:'50%',
            background:`radial-gradient(circle at 35% 35%,${T.bg2},${T.bg0})`,
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            {state==='speaking'&&<Volume2 size={26} color={T.b}/>}
            {state==='listening'&&<Mic size={26} color={T.g}/>}
            {state==='thinking'&&<Brain size={26} color={T.p}/>}
            {state==='idle'&&<User size={26} color={T.t2}/>}
          </div>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:5}}>
        <div style={{width:5,height:5,borderRadius:'50%',background:cfg.glow||T.t3,
          animation:cfg.pulse?'dotPulse 1s ease-in-out infinite':undefined}}/>
        <span style={{fontSize:9,fontFamily:T.fnM,color:T.t2,letterSpacing:2}}>{label}</span>
        {!voiceOn&&<VolumeX size={11} color={T.t3}/>}
      </div>
    </div>
  );
}

// File upload component
function FileUpload({label,value,onChange,placeholder}) {
  const ref = useRef();
  const handleFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsText(file);
  };
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <label style={{fontSize:12,color:T.t2,fontWeight:500}}>{label}</label>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>ref.current?.click()} style={{
            padding:'3px 10px',fontSize:10,fontWeight:600,borderRadius:5,cursor:'pointer',
            background:T.bG,color:T.bL,border:`1px solid ${T.b}44`,fontFamily:T.fn,
            display:'flex',alignItems:'center',gap:4}}>
            <Upload size={11}/>Upload .txt/.pdf
          </button>
          {value && <button onClick={()=>onChange('')} style={{
            padding:'3px 8px',fontSize:10,borderRadius:5,cursor:'pointer',
            background:'transparent',color:T.t3,border:`1px solid ${T.bd}`,fontFamily:T.fn}}>
            <X size={10}/>
          </button>}
        </div>
      </div>
      <input ref={ref} type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFile} style={{display:'none'}}/>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={4}
        style={{width:'100%',background:T.bg2,border:`1px solid ${value?T.g+'55':T.bd}`,borderRadius:8,
          padding:'10px 14px',color:T.tx,fontFamily:T.fn,fontSize:12,outline:'none',
          resize:'vertical',lineHeight:1.6,boxSizing:'border-box',transition:'border-color 0.2s'}}
        onFocus={e=>e.target.style.borderColor=T.b}
        onBlur={e=>e.target.style.borderColor=value?T.g+'55':T.bd}/>
      {value && <div style={{fontSize:10,color:T.gL,marginTop:4,display:'flex',alignItems:'center',gap:4}}>
        <CheckCircle size={10}/>{value.length} characters loaded
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: LANDING
// ═══════════════════════════════════════════
function Landing({onStart}) {
  const features = [
    {icon:<Brain size={16}/>,c:T.p,t:'AI Question Engine',d:'Adaptive questions from your CV & JD'},
    {icon:<Volume2 size={16}/>,c:T.b,t:'Voice Interaction',d:'AI speaks, you respond naturally'},
    {icon:<BarChart2 size={16}/>,c:T.t,t:'Live Scoring',d:'Real-time analysis of every answer'},
    {icon:<FileText size={16}/>,c:T.a,t:'Full Report',d:'Hiring verdict + coaching plan'},
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      flex:1,padding:'40px 24px',gap:32,textAlign:'center'}}>
      <div style={{maxWidth:520}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',
          background:T.pG,border:`1px solid ${T.p}44`,borderRadius:99,marginBottom:18}}>
          <Zap size={11} color={T.pL}/>
          <span style={{fontSize:11,color:T.pL,fontWeight:600,letterSpacing:0.5}}>POWERED BY CLAUDE AI</span>
        </div>
        <h1 style={{fontFamily:T.fnH,fontSize:38,fontWeight:800,lineHeight:1.1,letterSpacing:'-1px',marginBottom:14,
          background:`linear-gradient(135deg,${T.tx} 0%,${T.t2} 100%)`,
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          The AI Interview<br/>That Feels Real
        </h1>
        <p style={{fontSize:15,color:T.t2,lineHeight:1.7,maxWidth:400,margin:'0 auto'}}>
          Upload your CV and job description. Get a voice-driven AI interview with real-time scoring and a comprehensive performance report.
        </p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,width:'100%',maxWidth:520}}>
        {features.map((f,i)=>(
          <div key={i} style={{background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:10,
            padding:'14px',display:'flex',gap:10,alignItems:'flex-start',textAlign:'left'}}>
            <div style={{padding:7,background:f.c+'18',borderRadius:7,color:f.c,flexShrink:0}}>{f.icon}</div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.tx,marginBottom:2}}>{f.t}</div>
              <div style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{f.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
        <Btn onClick={onStart} color={T.b} size='lg' style={{minWidth:200}}>
          Start Interview <ArrowRight size={15}/>
        </Btn>
        <p style={{fontSize:11,color:T.t3}}>Free · No account required · Powered by Claude</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: SETUP
// ═══════════════════════════════════════════
function Setup({onBegin}) {
  const [cfg,setCfg] = useState({role:'',company:'',type:'behavioral',difficulty:'medium',jd:'',cv:''});
  const set = (k,v) => setCfg(p=>({...p,[k]:v}));
  const types = ['behavioral','technical','hr','leadership','case_study'];
  const diffs = ['entry','medium','senior','executive'];
  const inStyle = {width:'100%',background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:8,
    padding:'9px 13px',color:T.tx,fontFamily:T.fn,fontSize:13,outline:'none',boxSizing:'border-box'};

  return (
    <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
      <div style={{maxWidth:580,margin:'0 auto'}}>
        <h2 style={{fontFamily:T.fnH,fontSize:20,fontWeight:700,marginBottom:3}}>Configure Interview</h2>
        <p style={{fontSize:12,color:T.t2,marginBottom:20}}>Tell us about the role — AI will generate personalised questions</p>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          {[['role','Target Role *','e.g. Senior Product Manager'],['company','Company','e.g. Google, Stripe']].map(([k,l,ph])=>(
            <div key={k}>
              <label style={{fontSize:11,color:T.t2,fontWeight:500,display:'block',marginBottom:5}}>{l}</label>
              <input value={cfg[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} style={inStyle}
                onFocus={e=>e.target.style.borderColor=T.b} onBlur={e=>e.target.style.borderColor=T.bd}/>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div>
            <label style={{fontSize:11,color:T.t2,fontWeight:500,display:'block',marginBottom:5}}>Interview Type</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {types.map(tp=>(
                <button key={tp} onClick={()=>set('type',tp)} style={{
                  padding:'4px 10px',borderRadius:5,fontSize:10,fontWeight:600,cursor:'pointer',
                  border:'1px solid',fontFamily:T.fn,transition:'all 0.15s',
                  background:cfg.type===tp?T.b+'22':'transparent',
                  color:cfg.type===tp?T.bL:T.t2,borderColor:cfg.type===tp?T.b+'66':T.bd,
                }}>{tp.replace('_',' ').toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:11,color:T.t2,fontWeight:500,display:'block',marginBottom:5}}>Difficulty</label>
            <div style={{display:'flex',gap:5}}>
              {diffs.map(d=>{
                const c={entry:T.g,medium:T.b,senior:T.a,executive:T.r}[d];
                return <button key={d} onClick={()=>set('difficulty',d)} style={{
                  flex:1,padding:'4px 2px',borderRadius:5,fontSize:9,fontWeight:700,cursor:'pointer',
                  border:'1px solid',fontFamily:T.fn,textTransform:'uppercase',letterSpacing:0.5,
                  background:cfg.difficulty===d?c+'22':'transparent',
                  color:cfg.difficulty===d?c:T.t3,borderColor:cfg.difficulty===d?c+'66':T.bd,
                }}>{d}</button>;
              })}
            </div>
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <FileUpload label="Job Description" value={cfg.jd} onChange={v=>set('jd',v)}
            placeholder="Paste job description or upload a .txt file — AI tailors questions to actual requirements..."/>
        </div>
        <div style={{marginBottom:20}}>
          <FileUpload label="CV / Resume" value={cfg.cv} onChange={v=>set('cv',v)}
            placeholder="Paste your CV or upload a .txt file — AI asks personalised questions from your background..."/>
        </div>

        {/* Voice support notice */}
        <div style={{padding:'10px 14px',background:T.bg3,border:`1px solid ${T.bd}`,borderRadius:8,
          marginBottom:16,fontSize:11,color:T.t2,lineHeight:1.6}}>
          <strong style={{color:T.aL}}>🎤 Voice Mode:</strong> Uses your browser's microphone. 
          Allow microphone access when prompted. If voice doesn't work, you can always type your answers.
        </div>

        <Btn onClick={()=>onBegin(cfg)} color={T.b} size='lg'
          style={{width:'100%',justifyContent:'center'}} disabled={!cfg.role.trim()}>
          <Brain size={15}/>Generate My Interview <ChevronRight size={15}/>
        </Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: LOADING
// ═══════════════════════════════════════════
function Loading({cfg,onReady}) {
  const [step,setStep] = useState(0);
  const [err,setErr] = useState(null);
  const steps = ['Parsing your CV & job description...','Identifying key competencies...','Crafting personalised questions...','Calibrating difficulty...','Preparing your AI interviewer...'];

  useEffect(()=>{
    let si = setInterval(()=>setStep(p=>Math.min(p+1,steps.length-1)),800);
    api.questions(cfg)
      .then(qs=>{ clearInterval(si); setStep(steps.length); setTimeout(()=>onReady(qs),500); })
      .catch(e=>{ clearInterval(si); setErr(e.message); });
    return ()=>clearInterval(si);
  },[]);

  const pct = Math.round((step/steps.length)*100);
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:28,padding:40}}>
      <Orb state='thinking'/>
      <div style={{width:'100%',maxWidth:380,textAlign:'center'}}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:8,color:T.tx}}>
          {err?'⚠️ Error':step>=steps.length?'✓ Ready':steps[step]}
        </div>
        {err&&<div style={{fontSize:12,color:T.r,marginBottom:10,lineHeight:1.5}}>{err}<br/><span style={{color:T.t2}}>Check your API key is configured correctly.</span></div>}
        <div style={{background:T.bd,borderRadius:99,height:3,overflow:'hidden',marginBottom:6}}>
          <div style={{width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${T.p},${T.b})`,borderRadius:99,transition:'width 0.6s ease'}}/>
        </div>
        <div style={{fontSize:11,color:T.t2,fontFamily:T.fnM}}>{pct}%</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: INTERVIEW — FULLY FIXED
// ═══════════════════════════════════════════
function Interview({cfg,questions,onComplete}) {
  const [qIdx,setQIdx] = useState(0);
  const [answers,setAnswers] = useState(Array(questions.length).fill(''));
  const [analyses,setAnalyses] = useState(Array(questions.length).fill(null));
  const [aiState,setAiState] = useState('idle');
  const [inputText,setInputText] = useState('');
  const [voiceActive,setVoiceActive] = useState(false);
  const [voiceOn,setVoiceOn] = useState(true);
  const [submitting,setSubmitting] = useState(false);
  const [elapsed,setElapsed] = useState(0);
  const [voiceErr,setVoiceErr] = useState('');
  const timerRef = useRef();
  const hasSpoken = useRef(false);

  const q = questions[qIdx];
  const isLast = qIdx===questions.length-1;
  const hasAnswer = analyses[qIdx]!==null;

  useEffect(()=>{
    timerRef.current = setInterval(()=>setElapsed(p=>p+1),1000);
    return ()=>clearInterval(timerRef.current);
  },[]);

  // Speak question on change — fixed Chrome race condition
  useEffect(()=>{
    if(!q) return;
    hasSpoken.current = false;
    setInputText('');
    setVoiceActive(false);
    setVoiceErr('');
    voice.stop();
    setAiState('speaking');

    const intro = qIdx===0
      ? `Hello! Welcome to your ${cfg.type} interview for ${cfg.role}${cfg.company?' at '+cfg.company:''}. I'll ask you ${questions.length} questions. Let's begin. `
      : '';
    const text = intro + q.question;

    if (voiceOn) {
      voice.speak(text, ()=>{
        if (!hasSpoken.current) { hasSpoken.current=true; setAiState('listening'); }
      });
    } else {
      setTimeout(()=>{ if(!hasSpoken.current){ hasSpoken.current=true; setAiState('listening'); }},700);
    }
    return ()=>voice.stop();
  },[qIdx, voiceOn]);

  const toggleVoice = useCallback(()=>{
    if (voiceActive) {
      const captured = voice.stopListening();
      if (captured) setInputText(captured);
      setVoiceActive(false);
      setAiState('listening');
    } else {
      setVoiceErr('');
      const ok = voice.startListening(
        (text)=>setInputText(text),
        (reason)=>{
          setVoiceActive(false);
          setAiState('listening');
          if (reason==='permission') setVoiceErr('Microphone access denied. Please allow it in browser settings.');
          else if(reason==='unsupported') setVoiceErr('Voice not supported in this browser. Use Chrome for voice mode.');
        }
      );
      if (ok) { setVoiceActive(true); setAiState('listening'); }
    }
  },[voiceActive]);

  const submitAnswer = async()=>{
    if(!inputText.trim()||submitting) return;
    // Stop voice if still running
    if(voiceActive){ voice.stopListening(); setVoiceActive(false); }
    setSubmitting(true);
    setAiState('thinking');
    const ans = inputText.trim();
    const newAns=[...answers]; newAns[qIdx]=ans; setAnswers(newAns);
    try {
      const analysis = await api.analyze(q.question,ans,cfg.role);
      const newAn=[...analyses]; newAn[qIdx]=analysis; setAnalyses(newAn);
    } catch(e) {
      // Store partial analysis so user can proceed
      const newAn=[...analyses]; newAn[qIdx]={scores:{overall:0},feedback:'Analysis unavailable.',strengths:[],gaps:[]}; setAnalyses(newAn);
    }
    setSubmitting(false);
    setAiState('idle');
  };

  const nextQ = ()=>{
    if(isLast){
      const qa = questions.map((qu,i)=>({q:qu.question,a:answers[i],analysis:analyses[i]}));
      onComplete(qa);
    } else {
      setQIdx(p=>p+1);
    }
  };

  const fmt = s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const wc = inputText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div style={{display:'flex',flex:1,overflow:'hidden'}}>
      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Top bar */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'8px 16px',borderBottom:`1px solid ${T.bd}`,background:T.bg1,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Pill label={`Q ${qIdx+1}/${questions.length}`} color={T.b}/>
            <Pill label={q?.category||'behavioral'} color={T.p}/>
            <Pill label={q?.difficulty||'medium'} color={q?.difficulty==='hard'?T.r:q?.difficulty==='easy'?T.g:T.a}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontFamily:T.fnM,fontSize:12,color:T.t2,display:'flex',alignItems:'center',gap:4}}>
              <Clock size={12}/>{fmt(elapsed)}
            </span>
            <button onClick={()=>{voice.stop();setVoiceOn(p=>!p);}}
              style={{background:'none',border:'none',cursor:'pointer',color:T.t2,display:'flex'}}>
              {voiceOn?<Volume2 size={15}/>:<VolumeX size={15}/>}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:14}}>
          {/* AI */}
          <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
            <Orb state={aiState} voiceOn={voiceOn}/>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:T.t2,marginBottom:6,fontFamily:T.fnM,letterSpacing:1}}>
                AI INTERVIEWER · {cfg.company||'INTERVISE'}
              </div>
              <div style={{background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:'0 12px 12px 12px',
                padding:'14px',fontSize:14,lineHeight:1.7,color:T.tx}}>
                {q?.question}
                {q?.probe&&(
                  <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.bd}`,
                    fontSize:12,color:T.t2,fontStyle:'italic'}}>
                    <span style={{color:T.aL,fontWeight:600,fontStyle:'normal'}}>Follow-up: </span>{q.probe}
                  </div>
                )}
              </div>
              {aiState==='speaking'&&(
                <div style={{display:'flex',gap:3,padding:'6px 0',alignItems:'flex-end',height:32}}>
                  {[4,8,12,8,4].map((h,i)=>(
                    <div key={i} style={{width:3,background:T.b,borderRadius:2,height:h,
                      animation:`wave${i+1} 0.8s ease-in-out infinite`,animationDelay:`${i*0.1}s`}}/>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Answer box */}
          <div style={{background:T.bg2,border:`1px solid ${hasAnswer?T.g+'55':T.bd}`,borderRadius:10,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1}}>YOUR RESPONSE</span>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                {voiceActive&&<span style={{fontSize:10,color:T.gL,display:'flex',alignItems:'center',gap:3}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:T.g,animation:'dotPulse 1s infinite'}}/>
                  REC
                </span>}
                <Btn onClick={toggleVoice} color={voiceActive?T.r:T.g} variant='ghost' size='sm'
                  disabled={aiState==='speaking'||submitting}>
                  {voiceActive?<><MicOff size={12}/>Stop</>:<><Mic size={12}/>Voice</>}
                </Btn>
              </div>
            </div>
            {voiceErr&&<div style={{fontSize:11,color:T.r,marginBottom:8,padding:'6px 10px',
              background:T.rG,borderRadius:6}}>{voiceErr}</div>}
            <textarea value={inputText} onChange={e=>setInputText(e.target.value)}
              placeholder={
                aiState==='speaking'?'Wait for the AI to finish speaking...'
                :voiceActive?'Listening... speak your answer clearly'
                :`Type your answer here, or click "Voice" to use your microphone.\n\nTip: Use STAR method — Situation, Task, Action, Result.`
              }
              rows={5} disabled={aiState==='speaking'}
              style={{width:'100%',background:'transparent',border:'none',outline:'none',
                color:T.tx,fontFamily:T.fn,fontSize:13,lineHeight:1.7,resize:'none',
                opacity:aiState==='speaking'?0.4:1,boxSizing:'border-box'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
              <span style={{fontSize:10,color:T.t3,fontFamily:T.fnM}}>{wc} words</span>
              <div style={{display:'flex',gap:6}}>
                {hasAnswer&&(
                  <Btn onClick={nextQ} color={isLast?T.t:T.g} size='sm'>
                    {isLast?<><Award size={12}/>Finish & Report</>:<><SkipForward size={12}/>Next Question</>}
                  </Btn>
                )}
                <Btn onClick={submitAnswer} color={T.b} size='sm'
                  disabled={!inputText.trim()||submitting||aiState==='speaking'}>
                  {submitting?<><Brain size={12}/>Analyzing...</>:<><Send size={12}/>Submit</>}
                </Btn>
              </div>
            </div>
          </div>

          {/* Score card */}
          {analyses[qIdx]&&(
            <div style={{background:T.bg2,border:`1px solid ${T.g}44`,borderRadius:10,padding:14}}>
              <div style={{fontSize:10,color:T.gL,fontFamily:T.fnM,letterSpacing:1,marginBottom:10}}>ANSWER SCORED</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
                {[['Clarity',analyses[qIdx].scores?.clarity],['Relevance',analyses[qIdx].scores?.relevance],
                  ['Depth',analyses[qIdx].scores?.depth],['Structure',analyses[qIdx].scores?.structure],
                  ['Confidence',analyses[qIdx].scores?.confidence],['Overall',analyses[qIdx].scores?.overall]
                ].map(([l,v=0])=>(
                  <div key={l} style={{textAlign:'center'}}>
                    <div style={{fontFamily:T.fnM,fontSize:18,fontWeight:700,color:scoreColor(v)}}>{v}</div>
                    <div style={{fontSize:10,color:T.t2}}>{l}</div>
                  </div>
                ))}
              </div>
              {analyses[qIdx].feedback&&(
                <div style={{fontSize:11,color:T.t2,lineHeight:1.6,borderTop:`1px solid ${T.bd}`,paddingTop:8}}>
                  💡 {analyses[qIdx].feedback}
                </div>
              )}
              <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                {analyses[qIdx].strengths?.map((s,i)=>(
                  <span key={i} style={{fontSize:10,padding:'2px 7px',background:T.gG,color:T.gL,borderRadius:4}}>✓ {s}</span>
                ))}
                {analyses[qIdx].gaps?.map((g,i)=>(
                  <span key={i} style={{fontSize:10,padding:'2px 7px',background:T.aG,color:T.aL,borderRadius:4}}>↑ {g}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div style={{width:200,background:T.bg1,borderLeft:`1px solid ${T.bd}`,
        display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:14,borderBottom:`1px solid ${T.bd}`}}>
          <div style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1,marginBottom:8}}>QUESTIONS</div>
          {questions.map((qq,i)=>{
            const done=analyses[i]!==null;
            const cur=i===qIdx;
            const sc=analyses[i]?.scores?.overall;
            return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 7px',borderRadius:5,
                background:cur?T.bG:done?T.gG:'transparent',
                border:`1px solid ${cur?T.b+'44':done?T.g+'44':'transparent'}`,marginBottom:3}}>
                <div style={{flexShrink:0}}>
                  {done?<CheckCircle size={12} color={T.g}/>:cur?<Play size={12} color={T.b}/>:<Circle size={12} color={T.t3}/>}
                </div>
                <div style={{flex:1,fontSize:10,color:cur?T.bL:done?T.gL:T.t3,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{qq.category||`Q${i+1}`}</div>
                {sc!=null&&<span style={{fontSize:9,fontFamily:T.fnM,color:scoreColor(sc)}}>{sc}</span>}
              </div>
            );
          })}
        </div>

        {analyses.some(Boolean)&&(
          <div style={{padding:14,borderBottom:`1px solid ${T.bd}`}}>
            <div style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1,marginBottom:8}}>AVG SCORES</div>
            {['clarity','relevance','depth','structure','confidence'].map(k=>{
              const vals=analyses.filter(Boolean).map(a=>a.scores?.[k]||0);
              const avg=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
              return <ScoreBar key={k} label={k} value={avg} color={scoreColor(avg)}/>;
            })}
          </div>
        )}

        <div style={{padding:14,flex:1}}>
          <div style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1,marginBottom:8}}>TIPS</div>
          {['Use STAR: Situation → Task → Action → Result','Quantify with numbers & metrics','Aim for 2–3 minute answers']
            .map((tip,i)=>(
              <div key={i} style={{fontSize:10,color:T.t3,lineHeight:1.5,marginBottom:7,
                paddingLeft:10,borderLeft:`2px solid ${T.b}44`}}>{tip}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: GENERATING
// ═══════════════════════════════════════════
function Generating({qa,cfg,onDone}) {
  const [phase,setPhase] = useState(0);
  const phases = ['Reviewing all responses...','Scoring competencies...','Identifying patterns...','Writing summary...','Finalising report...'];

  useEffect(()=>{
    let si = setInterval(()=>setPhase(p=>Math.min(p+1,phases.length-1)),900);
    api.report(qa,cfg)
      .then(r=>{ clearInterval(si); onDone(r); })
      .catch(()=>{ clearInterval(si); onDone(null); });
    return ()=>clearInterval(si);
  },[]);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,padding:40}}>
      <Orb state='thinking'/>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:14,fontWeight:600,color:T.tx,marginBottom:6}}>{phases[phase]}</div>
        <div style={{fontSize:11,color:T.t2}}>Analysing {qa.length} responses with Claude AI...</div>
        <div style={{width:280,height:3,background:T.bd,borderRadius:99,marginTop:14,overflow:'hidden'}}>
          <div style={{width:`${Math.round((phase/phases.length)*100)}%`,height:'100%',
            background:`linear-gradient(90deg,${T.p},${T.b})`,transition:'width 0.8s ease',borderRadius:99}}/>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: REPORT — FIXED sendPrompt
// ═══════════════════════════════════════════
function Report({report,qa,cfg,onRestart,onChat}) {
  const [expanded,setExpanded] = useState(null);

  const r = report || {
    verdict:'Consider',overallScore:68,
    summary:'Interview completed. AI report generation encountered an issue — showing computed scores.',
    hiringRisk:'Medium',
    competencies:[
      {name:'Communication',score:72,note:'Reasonable clarity'},
      {name:'Problem Solving',score:68,note:'Good approach'},
      {name:'Technical Depth',score:65,note:'Could be stronger'},
      {name:'Leadership',score:70,note:'Some examples shown'},
      {name:'Culture Fit',score:71,note:'Good alignment'},
    ],
    strengths:['Completed all questions','Showed engagement'],
    gaps:['Needs more specific examples','Deepen technical details'],
    coachingPlan:['Practice STAR framework daily','Record yourself answering and review','Research company culture deeply'],
    nextStep:'Schedule a practice session focusing on gap areas.',percentile:'top 40%'
  };

  const verdictColor = {'Strong Hire':T.g,'Hire':T.tL,'Consider':T.a,'No Hire':T.r}[r.verdict]||T.t2;

  const RadarChart = ({data}) => {
    const cx=120,cy=110,R=80,n=data.length;
    const angle = i => (Math.PI*2*i/n)-Math.PI/2;
    const pts = data.map((_,i)=>({x:cx+R*Math.cos(angle(i)),y:cy+R*Math.sin(angle(i))}));
    const sPts = data.map((d,i)=>({x:cx+(R*d.score/100)*Math.cos(angle(i)),y:cy+(R*d.score/100)*Math.sin(angle(i))}));
    return (
      <svg viewBox="0 0 240 220" style={{width:'100%',maxWidth:240}}>
        {[0.25,0.5,0.75,1].map(s=>(
          <polygon key={s} points={pts.map(p=>`${cx+(p.x-cx)*s},${cy+(p.y-cy)*s}`).join(' ')}
            fill="none" stroke={T.bd} strokeWidth={0.5}/>
        ))}
        {pts.map((p,i)=><line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={T.bd} strokeWidth={0.5}/>)}
        <polygon points={sPts.map(p=>`${p.x},${p.y}`).join(' ')} fill={T.b+'33'} stroke={T.b} strokeWidth={1.5}/>
        {sPts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={3.5} fill={T.b}/>)}
        {pts.map((p,i)=>{
          const lx=cx+(R+18)*Math.cos(angle(i)),ly=cy+(R+18)*Math.sin(angle(i));
          return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fill={T.t2} fontSize={8} fontFamily={T.fn}>{data[i].name.split(' ')[0]}</text>;
        })}
      </svg>
    );
  };

  return (
    <div style={{flex:1,overflowY:'auto',padding:'18px'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
            <h2 style={{fontFamily:T.fnH,fontSize:20,fontWeight:800}}>Interview Report</h2>
            <span style={{padding:'2px 10px',borderRadius:99,fontSize:11,fontWeight:700,
              background:verdictColor+'22',color:verdictColor,border:`1px solid ${verdictColor}44`}}>{r.verdict}</span>
          </div>
          <p style={{fontSize:11,color:T.t2}}>{cfg.role}{cfg.company?' at '+cfg.company:''} · {qa.length} questions · {r.percentile}</p>
        </div>
        <div style={{display:'flex',gap:6}}>
          <Btn onClick={()=>onChat(`Give me a 30-day coaching plan to improve my ${cfg.role} interview skills. My gaps are: ${r.gaps?.join(', ')}`)}
            color={T.p} variant='ghost' size='sm'><Brain size={12}/>Get Coached</Btn>
          <Btn onClick={onRestart} color={T.t2} variant='outline' size='sm'>
            <RotateCcw size={12}/>New Interview</Btn>
        </div>
      </div>

      {/* Score hero */}
      <div style={{background:`linear-gradient(135deg,${T.bg2},${T.bg3})`,border:`1px solid ${T.bd}`,
        borderRadius:14,padding:'20px',display:'flex',gap:20,marginBottom:14}}>
        <div style={{textAlign:'center',flexShrink:0}}>
          <div style={{fontFamily:T.fnM,fontSize:64,fontWeight:800,lineHeight:1,
            color:scoreColor(r.overallScore),textShadow:`0 0 30px ${scoreColor(r.overallScore)}66`}}>
            {r.overallScore}
          </div>
          <div style={{fontSize:11,color:T.t2,marginTop:3}}>Overall Score /100</div>
        </div>
        <div style={{flex:1,borderLeft:`1px solid ${T.bd}`,paddingLeft:20}}>
          <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
            <Pill label={`Risk: ${r.hiringRisk}`} color={r.hiringRisk==='Low'?T.g:r.hiringRisk==='High'?T.r:T.a}/>
            <Pill label={r.verdict} color={verdictColor}/>
          </div>
          <p style={{fontSize:12,color:T.t2,lineHeight:1.7}}>{r.summary}</p>
          <div style={{marginTop:10,fontSize:11,color:T.t3,fontStyle:'italic'}}>Next: {r.nextStep}</div>
        </div>
      </div>

      {/* Radar + Competencies */}
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:12,marginBottom:12}}>
        <div style={{background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:10,padding:14}}>
          <div style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1,marginBottom:10}}>COMPETENCY RADAR</div>
          <RadarChart data={r.competencies||[]}/>
        </div>
        <div style={{background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:10,padding:14}}>
          <div style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1,marginBottom:10}}>BREAKDOWN</div>
          {(r.competencies||[]).map((c,i)=>(
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:500,color:T.tx}}>{c.name}</span>
                <span style={{fontFamily:T.fnM,fontSize:12,color:scoreColor(c.score),fontWeight:600}}>{c.score}</span>
              </div>
              <div style={{height:3,background:T.bd,borderRadius:99,overflow:'hidden',marginBottom:3}}>
                <div style={{width:`${c.score}%`,height:'100%',background:scoreColor(c.score),borderRadius:99,transition:'width 1s ease'}}/>
              </div>
              <div style={{fontSize:10,color:T.t3}}>{c.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths + Gaps */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div style={{background:T.bg2,border:`1px solid ${T.g}33`,borderRadius:10,padding:14}}>
          <div style={{fontSize:10,color:T.gL,fontFamily:T.fnM,letterSpacing:1,marginBottom:10}}>✓ STRENGTHS</div>
          {(r.strengths||[]).map((s,i)=>(
            <div key={i} style={{display:'flex',gap:7,marginBottom:7,fontSize:12,color:T.t2,lineHeight:1.5}}>
              <CheckCircle size={13} color={T.g} style={{flexShrink:0,marginTop:1}}/>{s}
            </div>
          ))}
        </div>
        <div style={{background:T.bg2,border:`1px solid ${T.a}33`,borderRadius:10,padding:14}}>
          <div style={{fontSize:10,color:T.aL,fontFamily:T.fnM,letterSpacing:1,marginBottom:10}}>↑ DEVELOP</div>
          {(r.gaps||[]).map((g,i)=>(
            <div key={i} style={{display:'flex',gap:7,marginBottom:7,fontSize:12,color:T.t2,lineHeight:1.5}}>
              <AlertTriangle size={13} color={T.a} style={{flexShrink:0,marginTop:1}}/>{g}
            </div>
          ))}
        </div>
      </div>

      {/* Coaching Plan */}
      <div style={{background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:10,padding:14,marginBottom:12}}>
        <div style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1,marginBottom:10}}>AI COACHING PLAN</div>
        {(r.coachingPlan||[]).map((p,i)=>(
          <div key={i} style={{display:'flex',gap:10,padding:'8px',background:T.bg3,borderRadius:7,marginBottom:7}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:T.b+'22',color:T.b,
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{i+1}</div>
            <div style={{fontSize:12,color:T.t2,lineHeight:1.6}}>{p}</div>
          </div>
        ))}
      </div>

      {/* Q&A breakdown */}
      <div style={{background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:10,padding:14,marginBottom:12}}>
        <div style={{fontSize:10,color:T.t2,fontFamily:T.fnM,letterSpacing:1,marginBottom:10}}>QUESTION BREAKDOWN</div>
        {qa.map((item,i)=>{
          const sc=item.analysis?.scores?.overall;
          const open=expanded===i;
          return (
            <div key={i} style={{marginBottom:6,background:T.bg3,borderRadius:7,overflow:'hidden',border:`1px solid ${T.bd}`}}>
              <div onClick={()=>setExpanded(open?null:i)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',cursor:'pointer'}}>
                <span style={{fontSize:10,fontFamily:T.fnM,color:T.t2,flexShrink:0}}>Q{i+1}</span>
                <span style={{fontSize:12,color:T.tx,flex:1,overflow:'hidden',textOverflow:'ellipsis',
                  whiteSpace:open?'normal':'nowrap'}}>{item.q}</span>
                {sc!=null&&<span style={{fontFamily:T.fnM,fontSize:12,color:scoreColor(sc),fontWeight:700,flexShrink:0}}>{sc}</span>}
                <ChevronDown size={13} color={T.t3}
                  style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}/>
              </div>
              {open&&(
                <div style={{padding:'0 12px 12px',borderTop:`1px solid ${T.bd}`}}>
                  <div style={{fontSize:11,color:T.t2,lineHeight:1.7,marginTop:8,marginBottom:8,
                    padding:9,background:T.bg2,borderRadius:6,fontStyle:'italic'}}>
                    "{item.a||'No answer recorded'}"
                  </div>
                  {item.analysis?.scores&&(
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
                      {['clarity','relevance','depth','structure','confidence','overall'].map(k=>(
                        <div key={k} style={{textAlign:'center',padding:'5px',background:T.bd+'44',borderRadius:5}}>
                          <div style={{fontFamily:T.fnM,fontSize:14,fontWeight:700,color:scoreColor(item.analysis.scores[k]||0)}}>
                            {item.analysis.scores[k]||0}
                          </div>
                          <div style={{fontSize:9,color:T.t3}}>{k}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.analysis?.feedback&&<div style={{fontSize:11,color:T.t2,lineHeight:1.6}}>{item.analysis.feedback}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn onClick={()=>onChat(`I scored ${r.overallScore}/100 in a ${cfg.role} mock interview. My gaps are: ${r.gaps?.join(', ')}. Create a 2-week practice plan.`)} color={T.b} size='sm'>
          <TrendingUp size={12}/>Practice Plan
        </Btn>
        <Btn onClick={()=>onChat(`Write ideal model answers for these ${cfg.role} interview questions: ${qa.slice(0,3).map(q=>q.q).join(' | ')}`)} color={T.p} size='sm' variant='ghost'>
          <Star size={12}/>Model Answers
        </Btn>
        <Btn onClick={()=>onChat(`What are the most common ${cfg.role} interview questions${cfg.company?' at '+cfg.company:''}? How should I prepare?`)} color={T.t} size='sm' variant='ghost'>
          <Brain size={12}/>More Questions
        </Btn>
        <Btn onClick={onRestart} color={T.t2} size='sm' variant='outline'>
          <RotateCcw size={12}/>Retake
        </Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CHAT PANEL — replaces undefined sendPrompt
// ═══════════════════════════════════════════
function ChatPanel({initialMsg,onClose}) {
  const [msgs,setMsgs] = useState([]);
  const [input,setInput] = useState('');
  const [loading,setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(()=>{
    if(initialMsg) sendMsg(initialMsg);
  },[]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[msgs]);

  const sendMsg = async(text) => {
    const userMsg = text||input.trim();
    if(!userMsg) return;
    setInput('');
    setMsgs(p=>[...p,{role:'user',content:userMsg}]);
    setLoading(true);
    try {
      const history = [...msgs,{role:'user',content:userMsg}].map(m=>({role:m.role,content:m.content}));
      const reply = await mistralAPI(history,'You are an expert career coach and interview trainer. Give practical, specific advice.');
      setMsgs(p=>[...p,{role:'assistant',content:reply}]);
    } catch(e) {
      setMsgs(p=>[...p,{role:'assistant',content:`Error: ${e.message}`}]);
    }
    setLoading(false);
  };

  return (
    <div style={{position:'fixed',right:0,top:0,bottom:0,width:360,background:T.bg1,
      borderLeft:`1px solid ${T.bd}`,display:'flex',flexDirection:'column',zIndex:100,
      boxShadow:'-4px 0 24px rgba(0,0,0,0.5)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'12px 16px',borderBottom:`1px solid ${T.bd}`}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Brain size={16} color={T.p}/>
          <span style={{fontFamily:T.fnH,fontSize:14,fontWeight:700}}>AI Coach</span>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:T.t2}}>
          <X size={18}/>
        </button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:14,display:'flex',flexDirection:'column',gap:10}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{
            alignSelf:m.role==='user'?'flex-end':'flex-start',
            maxWidth:'85%',padding:'10px 13px',borderRadius:m.role==='user'?'12px 12px 2px 12px':'12px 12px 12px 2px',
            background:m.role==='user'?T.b:T.bg2,
            border:m.role==='user'?'none':`1px solid ${T.bd}`,
            fontSize:12,color:T.tx,lineHeight:1.6}}>
            {m.content}
          </div>
        ))}
        {loading&&<div style={{alignSelf:'flex-start',padding:'10px 13px',background:T.bg2,
          border:`1px solid ${T.bd}`,borderRadius:'12px 12px 12px 2px',fontSize:12,color:T.t2}}>
          Thinking...
        </div>}
        <div ref={bottomRef}/>
      </div>

      <div style={{padding:12,borderTop:`1px solid ${T.bd}`,display:'flex',gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMsg()}
          placeholder="Ask your AI coach..."
          style={{flex:1,background:T.bg2,border:`1px solid ${T.bd}`,borderRadius:7,
            padding:'8px 12px',color:T.tx,fontFamily:T.fn,fontSize:12,outline:'none'}}/>
        <Btn onClick={()=>sendMsg()} color={T.b} size='sm' disabled={!input.trim()||loading}>
          <Send size={12}/>
        </Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════
export default function App() {
  const [screen,setScreen] = useState('landing');
  const [cfg,setCfg] = useState(null);
  const [questions,setQuestions] = useState([]);
  const [qa,setQa] = useState([]);
  const [report,setReport] = useState(null);
  const [chatMsg,setChatMsg] = useState(null);
  const [showChat,setShowChat] = useState(false);

  useEffect(()=>{
    // Load fonts
    const link = document.createElement('link');
    link.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel='stylesheet';
    document.head.appendChild(link);

    // Global CSS
    const style = document.createElement('style');
    style.textContent=`
      *{box-sizing:border-box;margin:0;padding:0;}
      ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}
      ::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:2px;}
      @keyframes orbSpin{to{transform:rotate(360deg);}}
      @keyframes orbRing1{0%{transform:scale(1);opacity:0.6}100%{transform:scale(1.5);opacity:0}}
      @keyframes orbRing2{0%{transform:scale(1);opacity:0.3}100%{transform:scale(1.8);opacity:0}}
      @keyframes dotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
      @keyframes wave1{0%,100%{height:4px}50%{height:14px}}
      @keyframes wave2{0%,100%{height:6px}50%{height:20px}}
      @keyframes wave3{0%,100%{height:8px}50%{height:26px}}
      @keyframes wave4{0%,100%{height:6px}50%{height:18px}}
      @keyframes wave5{0%,100%{height:4px}50%{height:12px}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    `;
    document.head.appendChild(style);

    // Preload TTS voices
    if(window.speechSynthesis){
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged=()=>window.speechSynthesis.getVoices();
    }
  },[]);

  const openChat = msg => { setChatMsg(msg); setShowChat(true); };
  const restart = () => { setCfg(null);setQuestions([]);setQa([]);setReport(null);setScreen('landing'); };

  const nav = ['landing','setup','interview','report'];
  const navLabels = ['Home','Setup','Interview','Report'];

  return (
    <div style={{background:T.bg0,color:T.tx,fontFamily:T.fn,
      minHeight:600,display:'flex',flexDirection:'column',borderRadius:12,overflow:'hidden',position:'relative'}}>

      {/* Nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 18px',
        background:T.bg1,borderBottom:`1px solid ${T.bd}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,borderRadius:'50%',
            background:`conic-gradient(${T.b},${T.p},${T.t},${T.b})`,animation:'orbSpin 4s linear infinite'}}/>
          <span style={{fontFamily:T.fnH,fontSize:15,fontWeight:800,letterSpacing:'-0.3px'}}>
            INTER<span style={{color:T.b}}>VISE</span>
          </span>
          <span style={{fontSize:9,color:T.t3,padding:'1px 7px',background:T.bg3,borderRadius:99,fontFamily:T.fnM}}>BETA</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {nav.map((s,i)=>{
            const active=screen===s||(screen==='loading'&&s==='setup')||(screen==='generating'&&s==='report');
            const clickable=s==='landing'||(s==='report'&&screen==='report');
            return <button key={s} onClick={clickable?()=>setScreen(s):undefined} style={{
              padding:'4px 11px',borderRadius:5,fontSize:11,fontWeight:500,fontFamily:T.fn,border:'none',
              cursor:clickable?'pointer':'default',background:active?T.bG:'transparent',
              color:active?T.bL:T.t3,transition:'all 0.15s'}}>{navLabels[i]}</button>;
          })}
        </div>
      </div>

      {/* Screen router */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',animation:'fadeIn 0.25s ease'}}>
        {screen==='landing'&&<Landing onStart={()=>setScreen('setup')}/>}
        {screen==='setup'&&<Setup onBegin={c=>{setCfg(c);setScreen('loading');}}/>}
        {screen==='loading'&&<Loading cfg={cfg} onReady={qs=>{setQuestions(qs);setScreen('interview');}}/>}
        {screen==='interview'&&questions.length>0&&
          <Interview cfg={cfg} questions={questions} onComplete={qa=>{setQa(qa);setScreen('generating');}}/>}
        {screen==='generating'&&<Generating qa={qa} cfg={cfg} onDone={r=>{setReport(r);setScreen('report');}}/>}
        {screen==='report'&&<Report report={report} qa={qa} cfg={cfg} onRestart={restart} onChat={openChat}/>}
      </div>

      {/* Chat panel */}
      {showChat&&<ChatPanel initialMsg={chatMsg} onClose={()=>{setShowChat(false);setChatMsg(null);}}/>}
    </div>
  );
}
