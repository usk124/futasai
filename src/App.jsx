import { useState, useMemo, useRef, useEffect } from "react";

// ── データ ──
const DEFAULT_NAMES   = { person1: "名前", person2: "名前" };
const DEFAULT_ENTRIES = [];
const DEFAULT_FIXED   = [];
const DEFAULT_CARRY = { amount: 0, who: "p1" };
const STORAGE_KEY = "warikan-data-v1";

// ── デザイントークン ──
const C = {
  bg:       "#FAFAF8",
  surface:  "#FFFFFF",
  border:   "#EFEFEC",
  textMain: "#1A1A2E",
  textSub:  "#888884",
  p1:       "#4F46E5",   // インディゴ
  p1Light:  "#EEF2FF",
  p1Mid:    "#818CF8",
  p2:       "#E11D78",   // ローズ
  p2Light:  "#FDF2F8",
  p2Mid:    "#F472B6",
  half:     "#F59E0B",   // アンバー
  halfLight:"#FFFBEB",
  ok:       "#10B981",
  okLight:  "#ECFDF5",
  danger:   "#EF4444",
};

function calcRow(entry) {
  const p1 = Number(entry.p1) || 0;
  const p2 = Number(entry.p2) || 0;
  const h  = Number(entry.half) || 0;
  const halfEach  = h / 2;
  const p1Share   = p1 + halfEach;
  const p2Share   = p2 + halfEach;
  const p1Receive = entry.payer === "p1" ? p2Share : 0;
  const p2Receive = entry.payer === "p2" ? p1Share : 0;
  return { total: p1 + p2 + h, p1Share, p2Share, p1Receive, p2Receive };
}
function loadData() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return null;
}
function saveData(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (_) {}
}

// ── CSV ──
function exportCSV({ entries, fixedItems, carryOver, names, totals }) {
  const n1 = names.person1, n2 = names.person2;
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [];
  rows.push(["【記録簿】"]);
  rows.push(["日付","お店",n1,n2,"半々","支払者","合計",`${n1}受取`,`${n2}受取`]);
  entries.forEach(e => {
    const r = calcRow(e);
    rows.push([e.date,e.shop,e.p1||0,e.p2||0,e.half||0,e.payer==="p1"?n1:n2,r.total,Math.round(r.p1Receive),Math.round(r.p2Receive)]);
  });
  rows.push([]);
  rows.push(["【定期購入リスト】"]);
  rows.push(["項目名","税抜き","税込み","備考","1人あたり(税込)"]);
  fixedItems.forEach(f => {
    const p = Number(f.priceIn)||Math.round((Number(f.priceEx)||0)*1.1);
    rows.push([f.name,f.priceEx||"",f.priceIn||"",f.note||"",Math.round(p/2)]);
  });
  rows.push([]);
  rows.push(["【精算サマリー】"]);
  rows.push(["項目","金額"]);
  rows.push([`${n1} 個人負担合計`,totals.sumP1],[`${n2} 個人負担合計`,totals.sumP2],["半々合計",totals.sumHalf],[`${n1} 受取合計`,Math.round(totals.sumP1R)],[`${n2} 受取合計`,Math.round(totals.sumP2R)]);
  if (Number(carryOver.amount)>0) rows.push([`引き継ぎ残高（${carryOver.who==="p1"?n1:n2}が多い）`,carryOver.amount]);
  const b=totals.balance;
  rows.push(["最終精算差額", b===0?"均等":b>0?`${n2}→${n1} ¥${Math.round(b)}`:`${n1}→${n2} ¥${Math.round(Math.abs(b))}`]);
  const csv = "\uFEFF"+rows.map(r=>r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const t = new Date();
  const ds = `${t.getFullYear()}${String(t.getMonth()+1).padStart(2,"0")}${String(t.getDate()).padStart(2,"0")}`;
  a.href=url; a.download=`futasai_${ds}.csv`; a.click(); URL.revokeObjectURL(url);
}

// ══════════════════════════════════════
export default function App() {
  const [ready,      setReady]      = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [names,      setNames]      = useState(DEFAULT_NAMES);
  const [entries,    setEntries]    = useState(DEFAULT_ENTRIES);
  const [fixedItems, setFixedItems] = useState(DEFAULT_FIXED);
  const [carryOver,  setCarryOver]  = useState(DEFAULT_CARRY);
  const nextIdRef      = useRef(DEFAULT_ENTRIES.length + 1);
  const nextFixedIdRef = useRef(DEFAULT_FIXED.length + 1);

  const [view,               setView]               = useState("ledger");
  const [filterPayer,        setFilterPayer]        = useState("all");
  const [showForm,           setShowForm]           = useState(false);
  const [form,               setForm]               = useState({date:"",shop:"",p1:"",p2:"",half:"",payer:"p1"});
  const [editId,             setEditId]             = useState(null);
  const [deleteConfirm,      setDeleteConfirm]      = useState(null);
  const [showNameEdit,       setShowNameEdit]       = useState(false);
  const [nameInput,          setNameInput]          = useState(DEFAULT_NAMES);
  const [showCarryEdit,      setShowCarryEdit]      = useState(false);
  const [carryOverInput,     setCarryOverInput]     = useState({amount:"",who:"p1"});
  const [showFixedForm,      setShowFixedForm]      = useState(false);
  const [fixedForm,          setFixedForm]          = useState({name:"",priceEx:"",priceIn:"",note:""});
  const [fixedEditId,        setFixedEditId]        = useState(null);
  const [fixedDeleteConfirm, setFixedDeleteConfirm] = useState(null);
  const [addingFixedId,      setAddingFixedId]      = useState(null);
  const [fixedAddForm,       setFixedAddForm]       = useState({date:"",payer:"p1"});
  const [addedToast,         setAddedToast]         = useState("");
  const [showExport,         setShowExport]         = useState(false);

  const formRef     = useRef(null);
  const carryRef    = useRef(null);
  const fixedRef    = useRef(null);
  const nameRef     = useRef(null);
  const fixedAddRef = useRef(null);

  useEffect(() => {
    const saved = loadData();
    if (saved) {
      if (saved.names) setNames(saved.names);
      if (saved.entries?.length > 0) { setEntries(saved.entries); nextIdRef.current = Math.max(...saved.entries.map(e=>e.id),0)+1; }
      if (saved.fixedItems?.length > 0) { setFixedItems(saved.fixedItems); nextFixedIdRef.current = Math.max(...saved.fixedItems.map(f=>f.id),0)+1; }
      if (saved.carryOver) setCarryOver(saved.carryOver);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { saveData({names,entries,fixedItems,carryOver}); setSaveStatus("saved"); setTimeout(()=>setSaveStatus("idle"),1800); }
    catch (_) { setSaveStatus("error"); }
  }, [names,entries,fixedItems,carryOver,ready]);

  const n1 = names.person1, n2 = names.person2;

  const totals = useMemo(() => {
    let sumP1=0,sumP2=0,sumHalf=0,sumP1R=0,sumP2R=0;
    entries.forEach(e => {
      sumP1+=Number(e.p1)||0; sumP2+=Number(e.p2)||0; sumHalf+=Number(e.half)||0;
      const r=calcRow(e); sumP1R+=r.p1Receive; sumP2R+=r.p2Receive;
    });
    const raw=sumP1R-sumP2R, carryVal=Number(carryOver.amount)||0;
    return {sumP1,sumP2,sumHalf,sumP1R,sumP2R,balance:raw+(carryOver.who==="p1"?carryVal:-carryVal)};
  },[entries,carryOver]);

  const filteredEntries = useMemo(()=>filterPayer==="all"?entries:entries.filter(e=>e.payer===filterPayer),[entries,filterPayer]);
  const fixedTotal = useMemo(()=>fixedItems.reduce((a,f)=>a+(Number(f.priceIn)||Math.round((Number(f.priceEx)||0)*1.1)),0),[fixedItems]);

  const fmt = n => Math.round(n).toLocaleString();
  const todayStr = () => { const t=new Date(); return `${t.getFullYear()}/${String(t.getMonth()+1).padStart(2,"0")}/${String(t.getDate()).padStart(2,"0")}`; };

  function openAdd() { setForm({date:todayStr(),shop:"",p1:"",p2:"",half:"",payer:"p1"}); setEditId(null); setShowForm(true); setTimeout(()=>formRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  function openEdit(e) { setForm({date:e.date,shop:e.shop,p1:e.p1,p2:e.p2,half:e.half,payer:e.payer}); setEditId(e.id); setShowForm(true); setTimeout(()=>formRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  function saveForm() {
    if (!form.date||!form.shop) return;
    if (editId!==null) setEntries(es=>es.map(e=>e.id===editId?{...e,...form}:e));
    else { const id=nextIdRef.current++; setEntries(es=>[...es,{id,...form}]); }
    setShowForm(false); setEditId(null);
  }
  function deleteEntry(id) { setEntries(es=>es.filter(e=>e.id!==id)); setDeleteConfirm(null); }
  function openCarryEdit() { setCarryOverInput({amount:carryOver.amount||"",who:carryOver.who}); setShowCarryEdit(true); setTimeout(()=>carryRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  function saveCarryOver() { const v=Number(carryOverInput.amount); if(isNaN(v)||v<0)return; setCarryOver({amount:v,who:carryOverInput.who}); setShowCarryEdit(false); }
  function openFixedAdd() { setFixedForm({name:"",priceEx:"",priceIn:"",note:""}); setFixedEditId(null); setShowFixedForm(true); setTimeout(()=>fixedRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  function openFixedEdit(item) { setFixedForm({name:item.name,priceEx:item.priceEx,priceIn:item.priceIn,note:item.note}); setFixedEditId(item.id); setShowFixedForm(true); setTimeout(()=>fixedRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  function saveFixed() {
    if (!fixedForm.name) return;
    if (fixedEditId!==null) setFixedItems(fs=>fs.map(f=>f.id===fixedEditId?{...f,...fixedForm}:f));
    else { const id=nextFixedIdRef.current++; setFixedItems(fs=>[...fs,{id,...fixedForm}]); }
    setShowFixedForm(false); setFixedEditId(null);
  }
  function deleteFixed(id) { setFixedItems(fs=>fs.filter(f=>f.id!==id)); setFixedDeleteConfirm(null); }
  function openFixedAddToLedger(item) { setAddingFixedId(item.id); setFixedAddForm({date:todayStr(),payer:"p1"}); setTimeout(()=>fixedAddRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  function confirmAddToLedger(item) {
    const priceIn=Number(item.priceIn)||Math.round((Number(item.priceEx)||0)*1.1);
    const id=nextIdRef.current++;
    setEntries(es=>[...es,{id,date:fixedAddForm.date,shop:item.name,p1:"",p2:"",half:priceIn,payer:fixedAddForm.payer}]);
    setAddingFixedId(null);
    setAddedToast(`「${item.name}」を記録に追加しました`);
    setTimeout(()=>setAddedToast(""),2500);
  }
  function openNameEdit() { setNameInput({...names}); setShowNameEdit(true); setTimeout(()=>nameRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  function saveNames() { if(!nameInput.person1.trim()||!nameInput.person2.trim())return; setNames({person1:nameInput.person1.trim(),person2:nameInput.person2.trim()}); setShowNameEdit(false); }
  const getFixedPrice = f => Number(f.priceIn)||Math.round((Number(f.priceEx)||0)*1.1);

  // バランスバーの計算
  const p1Total = totals.sumP1 + totals.sumHalf/2;
  const p2Total = totals.sumP2 + totals.sumHalf/2;
  const grandTotal = p1Total + p2Total;
  const p1Pct = grandTotal > 0 ? (p1Total/grandTotal)*100 : 50;

  if (!ready) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,gap:16}}>
      <div style={{fontSize:28}}>👛</div>
      <div style={{fontSize:16,fontWeight:700,color:C.textMain}}>ふたりの財布</div>
      <div style={{width:36,height:36,border:`3px solid ${C.border}`,borderTopColor:C.p1,borderRadius:"50%",animation:"spin 0.8s linear infinite",marginTop:8}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif",background:C.bg,minHeight:"100vh",maxWidth:480,margin:"0 auto",paddingBottom:96}}>
      <style>{`
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        input { -webkit-appearance:none; outline:none; }
        button { -webkit-tap-highlight-color:transparent; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .card { background:${C.surface}; border-radius:20px; box-shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04); border:1px solid ${C.border}; }
        .pill { border-radius:100px; }
      `}</style>

      {/* トースト */}
      {addedToast && (
        <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:C.textMain,color:"#fff",padding:"11px 22px",borderRadius:100,fontSize:13,fontWeight:600,zIndex:999,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",whiteSpace:"nowrap",animation:"slideDown 0.25s ease"}}>
          ✓ {addedToast}
        </div>
      )}

      {/* ══ ヘッダー ══ */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100}}>
        {/* タイトルバー */}
        <div style={{padding:"16px 20px 12px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontSize:22,fontWeight:800,color:C.textMain,letterSpacing:"-0.5px"}}>👛 ふたりの財布</span>
            </div>
            <div style={{fontSize:11,color:C.textSub,letterSpacing:"0.05em",marginTop:1}}>ふたサイ — ふたりで賢く管理</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {saveStatus==="saved"&&<span style={{fontSize:10,color:C.ok,fontWeight:600}}>✓ 保存済み</span>}
            <button onClick={openNameEdit} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 12px",color:C.textMain,fontSize:12,cursor:"pointer",fontWeight:600}}>
              名前変更
            </button>
          </div>
        </div>

        {/* バランスバー（シグネチャ要素） */}
        <div style={{padding:"0 20px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:11,fontWeight:700}}>
            <span style={{color:C.p1}}>{n1}　¥{fmt(p1Total)}</span>
            <span style={{color:C.p2}}>¥{fmt(p2Total)}　{n2}</span>
          </div>
          <div style={{height:8,borderRadius:100,background:C.p2Light,overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${p1Pct}%`,background:`linear-gradient(90deg,${C.p1},${C.p1Mid})`,borderRadius:100,transition:"width 0.6s cubic-bezier(.4,0,.2,1)"}}/>
            <div style={{position:"absolute",left:"50%",top:0,height:"100%",width:2,background:"#fff",transform:"translateX(-50%)"}}/>
          </div>
          <div style={{textAlign:"center",marginTop:5,fontSize:10,color:C.textSub}}>支払い比率</div>
        </div>

        {/* ナビ */}
        <div style={{display:"flex",borderTop:`1px solid ${C.border}`}}>
          {[["ledger","記録簿","📋"],["calc","精算","⚖️"],["fixed","定期購入","🔁"]].map(([v,label,icon])=>(
            <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"11px 0",border:"none",background:"transparent",color:view===v?C.p1:C.textSub,fontWeight:view===v?700:400,fontSize:12,cursor:"pointer",borderBottom:`2.5px solid ${view===v?C.p1:"transparent"}`,transition:"all 0.15s",letterSpacing:"0.02em"}}>
              <span style={{fontSize:14}}>{icon}</span><br/>{label}
            </button>
          ))}
        </div>

        {/* 記録簿フィルター */}
        {view==="ledger"&&(
          <div style={{display:"flex",gap:6,padding:"10px 20px",borderTop:`1px solid ${C.border}`}}>
            {[["all","すべて"],[`p1`,n1],[`p2`,n2]].map(([val,label])=>(
              <button key={val} onClick={()=>setFilterPayer(val)} style={{padding:"5px 14px",borderRadius:100,border:`1.5px solid ${filterPayer===val?(val==="p1"?C.p1:val==="p2"?C.p2:C.textMain):C.border}`,fontSize:12,fontWeight:filterPayer===val?700:400,cursor:"pointer",background:filterPayer===val?(val==="p1"?C.p1Light:val==="p2"?C.p2Light:"#F3F4F6"):"transparent",color:filterPayer===val?(val==="p1"?C.p1:val==="p2"?C.p2:C.textMain):C.textSub,transition:"all 0.15s"}}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 名前編集 */}
      {showNameEdit&&(
        <div ref={nameRef} style={{margin:"16px 16px 0",animation:"fadeIn 0.2s ease"}}>
          <div className="card" style={{padding:20}}>
            <div style={{fontWeight:700,fontSize:15,color:C.textMain,marginBottom:16}}>名前を変更する</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              {[["person1",n1,C.p1],["person2",n2,C.p2]].map(([key,placeholder,col])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:6,letterSpacing:"0.05em"}}>{key==="person1"?"ひとり目":"ふたり目"}</div>
                  <input value={nameInput[key]} onChange={e=>setNameInput(n=>({...n,[key]:e.target.value}))} placeholder={placeholder}
                    style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:14,color:C.textMain,background:C.bg}}/>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:C.textSub,marginBottom:14}}>名前を変えても記録データは引き継がれます</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={saveNames} style={{flex:1,background:C.p1,color:"#fff",border:"none",borderRadius:12,padding:"12px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>保存する</button>
              <button onClick={()=>setShowNameEdit(false)} style={{flex:1,background:C.bg,color:C.textSub,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 0",fontWeight:600,fontSize:14,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 記録簿 ══ */}
      {view==="ledger"&&(
        <div style={{padding:"16px 16px 0"}}>
          {filteredEntries.length===0&&!showForm&&(
            <div style={{textAlign:"center",padding:"60px 0",color:C.textSub}}>
              <div style={{fontSize:40,marginBottom:12}}>📝</div>
              <div style={{fontSize:15,fontWeight:600,color:C.textMain,marginBottom:4}}>記録がありません</div>
              <div style={{fontSize:13}}>右下の ＋ から追加してください</div>
            </div>
          )}
          {filteredEntries.slice().reverse().map(entry=>{
            const r=calcRow(entry);
            const isP1=entry.payer==="p1";
            return (
              <div key={entry.id} className="card" style={{marginBottom:10,overflow:"hidden",animation:"fadeIn 0.2s ease"}}>
                {/* 左アクセントライン */}
                <div style={{display:"flex"}}>
                  <div style={{width:4,background:`linear-gradient(180deg,${isP1?C.p1:C.p2},${isP1?C.p1Mid:C.p2Mid})`,flexShrink:0}}/>
                  <div style={{flex:1,padding:"14px 14px 0"}}>
                    <div style={{display:"flex",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:15,fontWeight:700,color:C.textMain,marginBottom:2}}>{entry.shop}</div>
                        <div style={{fontSize:11,color:C.textSub}}>{entry.date}</div>
                      </div>
                      <PayerChip payer={entry.payer} n1={n1} n2={n2}/>
                      <button onClick={()=>openEdit(entry)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,opacity:0.35,padding:"2px 4px",marginLeft:2}}>✏️</button>
                      <button onClick={()=>setDeleteConfirm(entry.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,opacity:0.3,padding:"2px 4px"}}>🗑️</button>
                    </div>
                    {/* 金額グリッド */}
                    <div style={{display:"flex",gap:0,margin:"12px 0 0",borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                      {[[n1,entry.p1,C.p1,C.p1Light],[n2,entry.p2,C.p2,C.p2Light],["半々",entry.half,C.half,C.halfLight]].map(([label,val,col,bg])=>{
                        const v=Number(val)||0;
                        return (
                          <div key={label} style={{flex:1,textAlign:"center",padding:"6px 4px",background:v>0?bg:"transparent",borderRadius:8,margin:"0 2px"}}>
                            <div style={{fontSize:10,color:v>0?col:C.textSub,fontWeight:600,marginBottom:3,letterSpacing:"0.04em"}}>{label}</div>
                            <div style={{fontSize:14,fontWeight:700,color:v>0?col:"#CCC"}}>{v>0?`¥${v.toLocaleString()}`:"—"}</div>
                          </div>
                        );
                      })}
                    </div>
                    {/* フッター */}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"10px 2px 14px",fontSize:12}}>
                      <span style={{color:C.textSub}}>合計 <strong style={{color:C.textMain,fontSize:13}}>¥{fmt(r.total)}</strong></span>
                      {r.p1Receive>0&&<span style={{color:C.p1,fontWeight:700}}>→ {n1}が受取 ¥{fmt(r.p1Receive)}</span>}
                      {r.p2Receive>0&&<span style={{color:C.p2,fontWeight:700}}>→ {n2}が受取 ¥{fmt(r.p2Receive)}</span>}
                    </div>
                  </div>
                </div>
                {deleteConfirm===entry.id&&(
                  <div style={{background:"#FEF2F2",padding:"12px 18px",display:"flex",alignItems:"center",gap:8,borderTop:`1px solid ${C.border}`}}>
                    <span style={{flex:1,fontSize:13,color:C.danger}}>この記録を削除しますか？</span>
                    <button onClick={()=>deleteEntry(entry.id)} style={{background:C.danger,color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:13,cursor:"pointer",fontWeight:700}}>削除</button>
                    <button onClick={()=>setDeleteConfirm(null)} style={{background:C.bg,color:C.textSub,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer"}}>戻る</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* 追加フォーム */}
          {showForm&&(
            <div ref={formRef} className="card" style={{padding:20,marginBottom:80,border:`2px solid ${C.p1}`,animation:"slideDown 0.2s ease"}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:18,color:C.p1}}>{editId?"記録を編集":"新しい記録を追加"}</div>
              <FField label="日付" type="date" value={form.date.replace(/\//g,"-")} onChange={v=>setForm(f=>({...f,date:v.replace(/-/g,"/")}))}/>
              <FField label="お店・用途" type="text" value={form.shop} onChange={v=>setForm(f=>({...f,shop:v}))} placeholder="例：スーパー、電気代"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                <FField label={n1} type="number" value={form.p1} onChange={v=>setForm(f=>({...f,p1:v}))} placeholder="0" accent={C.p1}/>
                <FField label={n2} type="number" value={form.p2} onChange={v=>setForm(f=>({...f,p2:v}))} placeholder="0" accent={C.p2}/>
                <FField label="半々" type="number" value={form.half} onChange={v=>setForm(f=>({...f,half:v}))} placeholder="0" accent={C.half}/>
              </div>
              <div style={{marginBottom:18}}>
                <div style={{fontSize:11,color:C.textSub,fontWeight:700,marginBottom:8,letterSpacing:"0.05em"}}>会計した人</div>
                <div style={{display:"flex",gap:8}}>
                  {[["p1",n1,C.p1,C.p1Light],["p2",n2,C.p2,C.p2Light]].map(([val,label,col,bg])=>(
                    <button key={val} onClick={()=>setForm(f=>({...f,payer:val}))} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${form.payer===val?col:C.border}`,background:form.payer===val?bg:C.surface,color:form.payer===val?col:C.textSub,fontWeight:700,cursor:"pointer",fontSize:14,transition:"all 0.15s"}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveForm} style={{flex:2,background:C.p1,color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>{editId?"更新する":"追加する"}</button>
                <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{flex:1,background:C.bg,color:C.textSub,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 0",fontWeight:600,fontSize:14,cursor:"pointer"}}>キャンセル</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ 精算 ══ */}
      {view==="calc"&&(
        <div style={{padding:"16px 16px 0"}}>
          {/* 最終精算カード（メイン） */}
          <FinalCard balance={totals.balance} n1={n1} n2={n2} fmt={fmt}/>

          {/* サマリー */}
          <div className="card" style={{padding:20,marginBottom:12,marginTop:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.textSub,letterSpacing:"0.08em",marginBottom:14}}>内訳</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <MiniStat label={`${n1} 負担合計`} value={`¥${fmt(totals.sumP1+totals.sumHalf/2)}`} col={C.p1} bg={C.p1Light}/>
              <MiniStat label={`${n2} 負担合計`} value={`¥${fmt(totals.sumP2+totals.sumHalf/2)}`} col={C.p2} bg={C.p2Light}/>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
              <CRow label={`${n1} 個人分`} value={totals.sumP1} fmt={fmt}/>
              <CRow label={`${n2} 個人分`} value={totals.sumP2} fmt={fmt}/>
              <CRow label="半々（共同費）" value={totals.sumHalf} fmt={fmt} col={C.half}/>
              <CRow label={`${n1} 受取合計`} value={totals.sumP1R} fmt={fmt} col={C.p1} bold/>
              <CRow label={`${n2} 受取合計`} value={totals.sumP2R} fmt={fmt} col={C.p2} bold/>
              {Number(carryOver.amount)>0&&<CRow label={`引き継ぎ（${carryOver.who==="p1"?n1:n2}が多い）`} value={carryOver.amount} fmt={fmt} col={C.half}/>}
            </div>
          </div>

          {/* 引き継ぎ残高 */}
          <div className="card" style={{padding:20,marginBottom:12,border:`1.5px dashed ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:C.textMain}}>引き継ぎ残高</div>
                <div style={{fontSize:11,color:C.textSub,marginTop:2}}>アプリ移行前の差額</div>
              </div>
              <button onClick={openCarryEdit} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",color:C.textMain}}>編集</button>
            </div>
            {Number(carryOver.amount)>0?(
              <div style={{background:carryOver.who==="p1"?C.p1Light:C.p2Light,borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,color:C.textSub,marginBottom:2}}>多く払っている</div>
                  <div style={{fontWeight:700,fontSize:15,color:carryOver.who==="p1"?C.p1:C.p2}}>{carryOver.who==="p1"?n1:n2}</div>
                </div>
                <div style={{fontSize:22,fontWeight:800,color:carryOver.who==="p1"?C.p1:C.p2}}>¥{fmt(carryOver.amount)}</div>
              </div>
            ):(
              <div style={{background:C.bg,borderRadius:12,padding:"14px",textAlign:"center",color:C.textSub,fontSize:13}}>未設定 — 移行前の差額があれば入力してください</div>
            )}
            {showCarryEdit&&(
              <div ref={carryRef} style={{marginTop:14,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                <div style={{fontSize:11,fontWeight:700,color:C.textSub,marginBottom:8,letterSpacing:"0.05em"}}>多く払っている人</div>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  {[["p1",n1,C.p1,C.p1Light],["p2",n2,C.p2,C.p2Light]].map(([val,label,col,bg])=>(
                    <button key={val} onClick={()=>setCarryOverInput(c=>({...c,who:val}))} style={{flex:1,padding:"10px 0",borderRadius:12,border:`2px solid ${carryOverInput.who===val?col:C.border}`,background:carryOverInput.who===val?bg:C.surface,color:carryOverInput.who===val?col:C.textSub,fontWeight:700,cursor:"pointer",fontSize:14}}>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{position:"relative",marginBottom:12}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.textSub,fontSize:14}}>¥</span>
                  <input type="number" value={carryOverInput.amount} onChange={e=>setCarryOverInput(c=>({...c,amount:e.target.value}))} placeholder="例: 26203"
                    style={{width:"100%",padding:"12px 14px 12px 30px",border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:15,fontWeight:700,color:C.textMain,background:C.bg}}/>
                </div>
                {Number(carryOverInput.amount)>0&&(
                  <div style={{background:C.okLight,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.ok}}>
                    {carryOverInput.who==="p1"?n2:n1} が ¥{Number(carryOverInput.amount).toLocaleString()} を {carryOverInput.who==="p1"?n1:n2} に返す必要があります
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveCarryOver} style={{flex:1,background:C.p1,color:"#fff",border:"none",borderRadius:12,padding:"11px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>保存する</button>
                  <button onClick={()=>setShowCarryEdit(false)} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 0",fontWeight:600,fontSize:14,cursor:"pointer",color:C.textSub}}>キャンセル</button>
                </div>
              </div>
            )}
          </div>

          {/* CSV */}
          <button onClick={()=>setShowExport(true)} style={{width:"100%",background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"14px 0",color:C.textMain,fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:16}}>📥</span> CSVエクスポート
          </button>
          {showExport&&(
            <div className="card" style={{padding:20,marginBottom:12,border:`1.5px solid ${C.p1}`,animation:"slideDown 0.2s ease"}}>
              <div style={{fontWeight:700,fontSize:14,color:C.textMain,marginBottom:8}}>📥 CSVエクスポート</div>
              <div style={{fontSize:13,color:C.textSub,lineHeight:1.7,marginBottom:14}}>記録簿（{entries.length}件）・定期購入リスト・精算サマリーをCSVに出力します。</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{exportCSV({entries,fixedItems,carryOver,names,totals});setShowExport(false);}} style={{flex:1,background:C.p1,color:"#fff",border:"none",borderRadius:12,padding:"12px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>ダウンロード</button>
                <button onClick={()=>setShowExport(false)} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 0",fontWeight:600,fontSize:14,cursor:"pointer",color:C.textSub}}>キャンセル</button>
              </div>
            </div>
          )}

          <div className="card" style={{padding:16,marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.textSub,letterSpacing:"0.06em",marginBottom:10}}>計算の仕組み</div>
            <div style={{fontSize:12,color:C.textSub,lineHeight:1.8}}>
              <span style={{color:C.p1,fontWeight:700}}>{n1}列</span> ＋ <span style={{color:C.p2,fontWeight:700}}>{n2}列</span> ＋ <span style={{color:C.half,fontWeight:700}}>半々（折半）</span> を合算し、会計した人が立て替えた分を後で精算します。引き継ぎ残高を加算したものが最終差額です。
            </div>
          </div>
        </div>
      )}

      {/* ══ 定期購入 ══ */}
      {view==="fixed"&&(
        <div style={{padding:"16px 16px 0"}}>
          {/* 合計バナー */}
          <div style={{background:`linear-gradient(135deg,${C.p1} 0%,#7C3AED 100%)`,borderRadius:20,padding:"18px 20px",marginBottom:12,color:"#fff"}}>
            <div style={{fontSize:11,opacity:0.8,marginBottom:4,letterSpacing:"0.06em"}}>定期購入 合計（税込）</div>
            <div style={{fontSize:30,fontWeight:800,letterSpacing:"-1px"}}>¥{fmt(fixedTotal)}</div>
            <div style={{display:"flex",gap:16,marginTop:8,fontSize:12,opacity:0.85}}>
              <span>{fixedItems.length}件</span>
              <span>1人あたり ¥{fmt(fixedTotal/2)}</span>
            </div>
          </div>

          <div style={{background:"#EFF6FF",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.p1,lineHeight:1.6,border:`1px solid ${C.p1Light}`}}>
            💡 各アイテムの <strong>「記録に追加」</strong> で今月分を記録簿に追加できます
          </div>

          {fixedItems.length===0&&!showFixedForm?(
            <div className="card" style={{padding:"48px 0",textAlign:"center",color:C.textSub}}>
              <div style={{fontSize:36,marginBottom:10}}>🔁</div>
              <div style={{fontSize:15,fontWeight:600,color:C.textMain,marginBottom:4}}>定期購入はまだありません</div>
              <div style={{fontSize:13}}>＋ボタンから追加してください</div>
            </div>
          ):(
            fixedItems.map(item=>{
              const price=getFixedPrice(item);
              const isAdding=addingFixedId===item.id;
              return (
                <div key={item.id} className="card" style={{marginBottom:10,overflow:"hidden"}}>
                  <div style={{padding:"14px 14px 12px"}}>
                    <div style={{display:"flex",alignItems:"center"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:15,fontWeight:700,color:C.textMain,marginBottom:4}}>{item.name}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                          {Number(item.priceEx)>0&&<span style={{fontSize:12,color:C.textSub}}>税抜 ¥{Number(item.priceEx).toLocaleString()}</span>}
                          {Number(item.priceIn)>0&&<span style={{fontSize:13,fontWeight:700,color:C.ok}}>¥{Number(item.priceIn).toLocaleString()}</span>}
                          {!Number(item.priceEx)&&!Number(item.priceIn)&&<span style={{fontSize:12,color:"#CCC"}}>金額未設定</span>}
                          {price>0&&<span style={{fontSize:11,color:C.textSub,background:C.bg,padding:"2px 8px",borderRadius:100}}>1人 ¥{fmt(price/2)}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <button onClick={()=>isAdding?setAddingFixedId(null):openFixedAddToLedger(item)}
                          style={{background:isAdding?C.bg:C.p1Light,color:isAdding?C.textSub:C.p1,border:`1.5px solid ${isAdding?C.border:C.p1}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                          {isAdding?"閉じる":"＋ 記録に追加"}
                        </button>
                        <button onClick={()=>openFixedEdit(item)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,opacity:0.35,padding:"4px"}}>✏️</button>
                        <button onClick={()=>setFixedDeleteConfirm(item.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,opacity:0.3,padding:"4px"}}>🗑️</button>
                      </div>
                    </div>
                    {item.note&&<div style={{marginTop:8,fontSize:12,color:C.textSub,background:C.bg,borderRadius:8,padding:"6px 10px"}}>📝 {item.note}</div>}
                  </div>

                  {/* インライン追加フォーム */}
                  {isAdding&&(
                    <div ref={fixedAddRef} style={{borderTop:`1px solid ${C.border}`,padding:"14px 14px 16px",background:"#F8FAFF"}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.p1,marginBottom:12}}>記録簿に追加する</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                        <div>
                          <div style={{fontSize:11,color:C.textSub,fontWeight:600,marginBottom:4}}>日付</div>
                          <input type="date" value={fixedAddForm.date.replace(/\//g,"-")} onChange={e=>setFixedAddForm(f=>({...f,date:e.target.value.replace(/-/g,"/")}))}
                            style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:13,color:C.textMain,background:C.surface}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.textSub,fontWeight:600,marginBottom:4}}>会計した人</div>
                          <div style={{display:"flex",gap:6}}>
                            {[["p1",n1,C.p1,C.p1Light],["p2",n2,C.p2,C.p2Light]].map(([val,label,col,bg])=>(
                              <button key={val} onClick={()=>setFixedAddForm(f=>({...f,payer:val}))} style={{flex:1,padding:"9px 0",borderRadius:10,border:`2px solid ${fixedAddForm.payer===val?col:C.border}`,background:fixedAddForm.payer===val?bg:C.surface,color:fixedAddForm.payer===val?col:C.textSub,fontWeight:700,cursor:"pointer",fontSize:12}}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",marginBottom:10,fontSize:12,color:C.textSub}}>
                        {fixedAddForm.date}　{item.name}　<strong style={{color:C.half}}>半々 ¥{price.toLocaleString()}</strong>　<span style={{color:fixedAddForm.payer==="p1"?C.p1:C.p2}}>会計：{fixedAddForm.payer==="p1"?n1:n2}</span>
                      </div>
                      <button onClick={()=>confirmAddToLedger(item)} style={{width:"100%",background:C.p1,color:"#fff",border:"none",borderRadius:10,padding:"11px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                        記録簿に追加する
                      </button>
                    </div>
                  )}

                  {fixedDeleteConfirm===item.id&&(
                    <div style={{background:"#FEF2F2",padding:"12px 14px",display:"flex",alignItems:"center",gap:8,borderTop:`1px solid ${C.border}`}}>
                      <span style={{flex:1,fontSize:13,color:C.danger}}>削除しますか？</span>
                      <button onClick={()=>deleteFixed(item.id)} style={{background:C.danger,color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:13,cursor:"pointer",fontWeight:700}}>削除</button>
                      <button onClick={()=>setFixedDeleteConfirm(null)} style={{background:C.bg,color:C.textSub,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",fontSize:13,cursor:"pointer"}}>戻る</button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* 定期購入フォーム */}
          {showFixedForm&&(
            <div ref={fixedRef} className="card" style={{padding:20,marginBottom:80,border:`2px solid ${C.p1}`,animation:"slideDown 0.2s ease"}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:18,color:C.p1}}>{fixedEditId?"定期購入を編集":"定期購入を追加"}</div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:C.textSub,fontWeight:700,marginBottom:6,letterSpacing:"0.05em"}}>項目名 <span style={{color:C.danger}}>*</span></div>
                <input value={fixedForm.name} onChange={e=>setFixedForm(f=>({...f,name:e.target.value}))} placeholder="例：Amazonプライム、キック代"
                  style={{width:"100%",padding:"11px 14px",border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:14,color:C.textMain,background:C.bg}}/>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:C.textSub,fontWeight:700,marginBottom:8,letterSpacing:"0.05em"}}>価格（どちらか一方）</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["priceEx","税抜き"],["priceIn","税込み"]].map(([key,label])=>(
                    <div key={key}>
                      <div style={{fontSize:11,color:C.textSub,marginBottom:4}}>{label}</div>
                      <div style={{position:"relative"}}>
                        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.textSub,fontSize:13}}>¥</span>
                        <input type="number" value={fixedForm[key]} onChange={e=>setFixedForm(f=>({...f,[key]:e.target.value}))} placeholder="0"
                          style={{width:"100%",padding:"10px 12px 10px 26px",border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:14,color:C.textMain,background:C.bg}}/>
                      </div>
                      {key==="priceEx"&&Number(fixedForm.priceEx)>0&&(
                        <div style={{fontSize:10,color:C.ok,marginTop:3}}>→ 税込 ¥{Math.round(Number(fixedForm.priceEx)*1.1).toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
                {(Number(fixedForm.priceEx)>0||Number(fixedForm.priceIn)>0)&&(
                  <div style={{background:C.okLight,borderRadius:10,padding:"8px 12px",marginTop:8,fontSize:12,color:C.ok,fontWeight:600}}>
                    1人あたり ¥{fmt((Number(fixedForm.priceIn)||Math.round(Number(fixedForm.priceEx)*1.1))/2)}
                  </div>
                )}
              </div>
              <div style={{marginBottom:18}}>
                <div style={{fontSize:11,color:C.textSub,fontWeight:700,marginBottom:6,letterSpacing:"0.05em"}}>備考（数量・購入店・クーポンなど）</div>
                <input value={fixedForm.note} onChange={e=>setFixedForm(f=>({...f,note:e.target.value}))} placeholder="例：800ml、業務スーパー、スギ15%クーポン"
                  style={{width:"100%",padding:"11px 14px",border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:14,color:C.textMain,background:C.bg}}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveFixed} style={{flex:2,background:C.p1,color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>{fixedEditId?"更新する":"追加する"}</button>
                <button onClick={()=>{setShowFixedForm(false);setFixedEditId(null);}} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 0",fontWeight:600,fontSize:14,cursor:"pointer",color:C.textSub}}>キャンセル</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      {(view==="ledger"||view==="fixed")&&(
        <button onClick={view==="ledger"?openAdd:openFixedAdd}
          style={{position:"fixed",bottom:28,right:22,width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${C.p1},#7C3AED)`,border:"none",color:"#fff",fontSize:26,cursor:"pointer",boxShadow:`0 4px 20px rgba(79,70,229,0.45)`,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          ＋
        </button>
      )}
    </div>
  );
}

// ══ サブコンポーネント ══

function FinalCard({balance,n1,n2,fmt}) {
  const isZero=balance===0, p1Owes=balance<0, amt=Math.abs(balance);
  const payer=p1Owes?n1:n2, recv=p1Owes?n2:n1;
  const col=p1Owes?C.p2:C.p1, bg=p1Owes?C.p2Light:C.p1Light;
  return (
    <div style={{background:isZero?C.okLight:bg,borderRadius:20,padding:"22px 20px",textAlign:"center",border:`1.5px solid ${isZero?C.ok:col}`}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:isZero?C.ok:col,marginBottom:10}}>最終精算結果</div>
      {isZero?(
        <>
          <div style={{fontSize:38,marginBottom:4}}>✅</div>
          <div style={{fontWeight:800,fontSize:20,color:C.ok}}>ふたりはトントン！</div>
          <div style={{fontSize:13,color:C.ok,marginTop:4,opacity:0.8}}>支払いは均等です</div>
        </>
      ):(
        <>
          <div style={{fontSize:11,color:col,fontWeight:600,marginBottom:12}}>支払う金額</div>
          <div style={{fontSize:36,fontWeight:800,color:col,letterSpacing:"-1px",marginBottom:12}}>¥{fmt(amt)}</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
            <div style={{background:"#fff",borderRadius:100,padding:"7px 16px",border:`2px solid ${col}`,fontSize:13,fontWeight:800,color:col}}>{payer}</div>
            <div style={{fontSize:20,color:col}}>→</div>
            <div style={{background:"#fff",borderRadius:100,padding:"7px 16px",border:`2px solid ${col}`,fontSize:13,fontWeight:800,color:col}}>{recv}</div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({label,value,col,bg}) {
  return (
    <div style={{background:bg,borderRadius:14,padding:"12px 14px"}}>
      <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:4,letterSpacing:"0.04em"}}>{label}</div>
      <div style={{fontSize:18,fontWeight:800,color:col}}>{value}</div>
    </div>
  );
}

function PayerChip({payer,n1,n2}) {
  const isP1=payer==="p1";
  return (
    <span style={{background:isP1?C.p1Light:C.p2Light,color:isP1?C.p1:C.p2,borderRadius:100,padding:"3px 10px",fontSize:11,fontWeight:700,letterSpacing:"0.02em"}}>{isP1?n1:n2}</span>
  );
}

function FField({label,type,value,onChange,placeholder,accent}) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,color:accent||C.textSub,fontWeight:700,marginBottom:5,letterSpacing:"0.05em"}}>{label}</div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:14,color:C.textMain,background:C.bg}}/>
    </div>
  );
}

function CRow({label,value,fmt,col,bold}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:13}}>
      <span style={{color:C.textSub}}>{label}</span>
      <span style={{fontWeight:bold?800:600,color:col||C.textMain}}>¥{fmt(value)}</span>
    </div>
  );
}
