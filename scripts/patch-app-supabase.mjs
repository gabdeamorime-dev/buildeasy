import fs from 'fs'

const path = new URL('../src/App.jsx', import.meta.url).pathname
let s = fs.readFileSync(path, 'utf8')

if (!s.includes('useBuildEasyData')) {
  s = s.replace(
    'import { useState, useRef, useEffect } from "react";',
    `import { useState, useRef, useEffect } from "react";
import { useBuildEasyData } from "./hooks/useBuildEasyData.js";
import { signInWithEmail, signOut, getSessionUser, onAuthChange } from "./lib/auth.js";`
  )
}

// LoginScreen
s = s.replace(
  `  const login=()=>{
    setErr("");setLoad(true);
    setTimeout(()=>{
      const c=COMPTES.find(c=>c.email===email.trim().toLowerCase()&&c.mdp===mdp);
      c?onLogin(c):(setErr("Email ou mot de passe incorrect"),setLoad(false));
    },400);
  };
  const quick=(c)=>{setLoad(true);setTimeout(()=>onLogin(c),250);};`,
  `  const login=async()=>{
    setErr("");setLoad(true);
    try{
      const u=await signInWithEmail(email,mdp);
      onLogin(u);
    }catch(e){
      setErr(e?.message==="Invalid login credentials"?"Email ou mot de passe incorrect":(e?.message||"Connexion impossible"));
      setLoad(false);
    }
  };
  const quick=async(c)=>{
    setLoad(true);
    try{
      const u=await signInWithEmail(c.email,c.mdp);
      onLogin(u);
    }catch(e){
      setErr("Compte non configuré dans Supabase Auth : "+c.email);
      setLoad(false);
    }
  };`
)

// App root
s = s.replace(
  `export default function App() {
  const [user,setUser]=useState(null);
  return (
    <>
      <style>{CSS}</style>
      {!user?<LoginScreen onLogin={setUser}/>:<AppMobile key={user.id} user={user} onLogout={()=>setUser(null)}/>}
    </>
  );
}`,
  `export default function App() {
  const [user,setUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);

  useEffect(()=>{
    getSessionUser().then(u=>{setUser(u);setAuthReady(true);});
    return onAuthChange(setUser);
  },[]);

  const handleLogout=async()=>{
    await signOut();
    setUser(null);
  };

  if(!authReady) return (<><style>{CSS}</style><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)"}}>Chargement…</div></>);

  return (
    <>
      <style>{CSS}</style>
      {!user?<LoginScreen onLogin={setUser}/>:<AppMobile key={user.id} user={user} onLogout={handleLogout}/>}
    </>
  );
}`
)

// AppMobile data block
const oldBlock = `  const V = user.vierge; // true = compte vierge, false = données démo
  const [chantiers,setChantiers]=useState(V?[]:D_CH);
  const [taches,setTaches]=useState(V?[]:D_TACHES);
  const [factures,setFactures]=useState(V?[]:D_FAC);
  const [equipe,setEquipe]=useState(V?[]:D_EQ);
  const [rapports,setRapports]=useState(V?[]:D_RAPPORTS);
  const [messages,setMessages]=useState(V?[]:D_MSG);
  const [avenants,setAvenants]=useState(V?[]:D_AV);
  const [heures,setHeures]=useState(V?[]:D_HEURES);
  const [punch,setPunch]=useState(V?[]:D_PUNCH);
  const [incidents,setIncidents]=useState(V?[]:D_INCIDENTS);
  const [situations,setSituations]=useState(V?[]:D_SIT);
  const [devis,setDevis]=useState(V?[]:D_DEVIS);
  const [commandes,setCommandes]=useState(V?[]:D_COMMANDES);
  const [planningEq,setPlanningEq]=useState(V?[]:D_PLANNING_EQ);
  const [conges,setConges]=useState(V?[]:D_CONGES);
  const [agenda,setAgenda]=useState(V?[]:D_AGENDA);
  const [notes,setNotes]=useState(V?[]:D_NOTES);
  const [clients,setClients]=useState(V?[]:D_CLIENTS);
  const [fournisseurs,setFournisseurs]=useState(D_FOURNISSEURS); // annuaire toujours disponible
  const [planId,setPlanId]=useState("pro");
  const plan=PLANS[planId];
  const hasFeat=f=>plan.feats.includes(f);
  const data={chantiers,taches,factures,equipe,rapports,messages,avenants,heures,punch,incidents,situations,devis,commandes,planningEq,conges,agenda,clients,notes,fournisseurs,plan,planId,setPlanId,hasFeat};
  const editT=(id,k,v)=>setTaches(p=>p.map(t=>t.id===id?{...t,[k]:v}:t));
  const addC=f=>{
    const newId=Date.now();
    setChantiers(p=>[...p,{id:newId,nom:f.nom||"",client:f.client||"",tel:f.tel||"",corps:f.corps||"",statut:"planif",av:0,budget:parseInt(f.budget)||0,dep:0,debut:f.debut||"",fin:f.fin||"",rdv:f.rdv||"",meteo:f.meteo||"—",prio:parseInt(f.prio)||2,note:f.note||"",adresse:f.adresse||"",taux:parseInt(f.taux)||35}]);
    if(f.eqIds&&f.eqIds.length>0) setEquipe(p=>p.map(m=>f.eqIds.includes(m.id)?{...m,chIds:[...(m.chIds||[]),newId]}:m));
  };
  const saveC=f=>{
    setChantiers(p=>p.map(c=>c.id===f.id?{...c,...f}:c));
    if(f.eqIds) setEquipe(p=>p.map(m=>f.eqIds.includes(m.id)?{...m,chIds:[...new Set([...(m.chIds||[]).filter(x=>x!==f.id),f.id])]}:{...m,chIds:(m.chIds||[]).filter(x=>x!==f.id)}));
  };
  const addT=f=>setTaches(p=>[...p,{id:Date.now(),chId:parseInt(f.chId),titre:f.titre,resp:f.resp||"",debut:f.debut||"",fin:f.fin||"",statut:"planif",duree:Math.max(1,f.duree||1),prio:parseInt(f.prio)||2}]);
  const addR=f=>setRapports(p=>[...p,{id:Date.now(),chId:parseInt(f.chId)||0,date:f.date||"",auteur:f.auteur||"",meteo:f.meteo||"",av:f.av||"",incidents:f.incidents||"RAS",presences:f.presences||[]}]);
  const sendMsg=m=>setMessages(p=>[...p,{id:Date.now(),...m}]);
  const addAv=f=>setAvenants(p=>[...p,{id:Date.now(),...f}]);
  const valAv=(id,s,par)=>setAvenants(p=>p.map(a=>a.id===id?{...a,statut:s,par,ds:new Date().toLocaleDateString("fr-FR")}:a));
  const valH=id=>setHeures(p=>p.map(h=>h.id===id?{...h,val:true}:h));
  const addP=f=>setPunch(p=>[...p,{id:Date.now(),...f}]);
  const updP=(id,s)=>setPunch(p=>p.map(i=>i.id===id?{...i,statut:s,clos:s==="clos"?new Date().toLocaleDateString("fr-FR"):""}:i));
  const addInc=f=>setIncidents(p=>[...p,{id:Date.now(),ts:Date.now(),...f}]);
  const updInc=(id,changes)=>setIncidents(p=>p.map(i=>i.id===id?{...i,...(typeof changes==="string"?{statut:changes}:changes)}:i));
  const delInc=id=>setIncidents(p=>p.filter(i=>i.id!==id));`

const newBlock = `  const db=useBuildEasyData(user);
  if(db.loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)"}}>Chargement des données…</div>;
  if(db.error) return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:24}}><div style={{color:"var(--err)",fontWeight:600}}>{db.error}</div><button className="btn btn-blue" onClick={db.refresh}>Réessayer</button></div>;
  const {chantiers,taches,factures,equipe,rapports,messages,avenants,heures,punch,incidents,situations,devis,commandes,planningEq,conges,agenda,notes,clients,fournisseurs,planId,setPlanId}=db;
  const plan=PLANS[planId];
  const hasFeat=f=>plan.feats.includes(f);
  const data={chantiers,taches,factures,equipe,rapports,messages,avenants,heures,punch,incidents,situations,devis,commandes,planningEq,conges,agenda,clients,notes,fournisseurs,plan,planId,setPlanId,hasFeat};
  const {editT,addC,saveC,addT,addR,sendMsg,addAv,valAv,valH,addP,updP,addInc,updInc,delInc,onUpdCh,onAddNote,onDelNote,onChangeFactureStatut,onSaveSituation,onChangeSituationStatut,onAddDevis,onChangeDevisStatut,onEditDevis,onAddCmd,onReceptionCmd,onEditPlanning,onValiderConge,onDelAgenda,onAddFournisseur,onEditFournisseur,onDelFournisseur,onUpdEq,onAddConge,onAddAgenda,onAddClient,onAddFacture,onAddHeure}=db;`

if (!s.includes('useBuildEasyData(user)')) {
  if (!s.includes(oldBlock.slice(0, 80))) {
    console.error('AppMobile block not found — manual patch required')
    process.exit(1)
  }
  s = s.replace(oldBlock, newBlock)
}

// renderScreen callbacks
const reps = [
  ['onUpdCh={(id,k,v)=>setChantiers(p=>p.map(c=>c.id===id?{...c,[k]:v}:c))}', 'onUpdCh={onUpdCh}'],
  ['onAddNote={(n)=>setNotes(p=>[...p,{id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),ts:Date.now(),...n}])}', 'onAddNote={onAddNote}'],
  ['onDelNote={id=>setNotes(p=>p.filter(n=>n.id!==id))}', 'onDelNote={onDelNote}'],
  ['onChangeStatut={(id,s)=>setFactures(p=>p.map(f=>f.id===id?{...f,statut:s}:f))}', 'onChangeStatut={onChangeFactureStatut}'],
  ['onSave={s=>setSituations(p=>[...p,{id:Date.now(),...s}])}', 'onSave={onSaveSituation}'],
  ['onChangeStatut={(id,s)=>setSituations(p=>p.map(x=>x.id===id?{...x,statut:s}:x))}', 'onChangeStatut={onChangeSituationStatut}'],
  ['onAddDevis={d=>setDevis(p=>[...p,{id:Date.now(),...d}])}', 'onAddDevis={onAddDevis}'],
  ['onChangeStatut={(id,s)=>setDevis(p=>p.map(d=>d.id===id?{...d,statut:s}:d))}', 'onChangeStatut={onChangeDevisStatut}'],
  ['onEditDevis={(id,changes)=>setDevis(p=>p.map(d=>d.id===id?{...d,...changes}:d))}', 'onEditDevis={onEditDevis}'],
  ['onAddCmd={c=>setCommandes(p=>[...p,{id:Date.now(),...c}])}', 'onAddCmd={onAddCmd}'],
  ['onReception={id=>setCommandes(p=>p.map(c=>c.id===id?{...c,statut:"livree",livraison:new Date().toLocaleDateString("fr-FR")}:c))}', 'onReception={onReceptionCmd}'],
  ['onEdit={(memId,ji,chId)=>setPlanningEq(p=>p.map(m=>m.id===memId?{...m,sem:m.sem.map((s,i)=>i===ji?{...s,chId}:s)}:m))}', 'onEdit={onEditPlanning}'],
  ['onValider={(id,s)=>setConges(p=>p.map(c=>c.id===id?{...c,statut:s}:c))}', 'onValider={onValiderConge}'],
  ['onDel={id=>setAgenda(p=>p.filter(e=>e.id!==id))}', 'onDel={onDelAgenda}'],
  ['onAdd={f=>setFournisseurs(p=>[...p,{id:Date.now(),...f}])}', 'onAdd={onAddFournisseur}'],
  ['onEdit={(id,f)=>setFournisseurs(p=>p.map(x=>x.id===id?{...x,...f}:x))}', 'onEdit={onEditFournisseur}'],
  ['onDel={id=>setFournisseurs(p=>p.filter(x=>x.id!==id))}', 'onDel={onDelFournisseur}'],
  ['onUpdEq={(id,s)=>setEquipe(p=>p.map(m=>m.id===id?{...m,statut:s}:m))}', 'onUpdEq={onUpdEq}'],
  ['onSave={d=>setDevis(p=>[...p,{id:Date.now(),...d}])}', 'onSave={onAddDevis}'],
  ['onSave={c=>setCommandes(p=>[...p,{id:Date.now(),...c}])}', 'onSave={onAddCmd}'],
  ['onSave={c=>setConges(p=>[...p,{id:Date.now(),...c}])}', 'onSave={onAddConge}'],
  ['onSave={e=>setAgenda(p=>[...p,{id:Date.now(),...e,date:e.date?new Date(e.date+\'T12:00:00\').toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"}):e.date}])}', 'onSave={onAddAgenda}'],
  ['onSave={c=>setClients(p=>[...p,{id:Date.now(),...c}])}', 'onSave={onAddClient}'],
  ['onSave={f=>setFactures(p=>[...p,f])}', 'onSave={onAddFacture}'],
  ['onSave={s=>setSituations(p=>[...p,{id:Date.now(),...s}])}', 'onSave={onSaveSituation}'],
  ['onSave={h=>setHeures(p=>[...p,h])}', 'onSave={onAddHeure}'],
]

for (const [a, b] of reps) {
  if (s.includes(a)) s = s.replace(a, b)
}

// Fix duplicate borderLeft while we're at it
s = s.replace(
  /style=\{\{padding:"12px 14px",marginBottom:8,borderLeft:"3px solid "\+pc,background:inc\.prio===1\?"var\(--err-l\)":"var\(--w\)",border:"1px solid "\+\(inc\.prio===1\?"var\(--err-b\)":"var\(--g2\)"\),borderLeft:"3px solid "\+pc\}\}/,
  'style={{padding:"12px 14px",marginBottom:8,background:inc.prio===1?"var(--err-l)":"var(--w)",border:"1px solid "+(inc.prio===1?"var(--err-b)":"var(--g2)"),borderLeft:"3px solid "+pc}}'
)

fs.writeFileSync(path, s)
console.log('App.jsx patched OK')
