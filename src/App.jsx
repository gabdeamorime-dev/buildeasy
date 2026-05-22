import { useState, useRef, useEffect } from "react";
import { supabase } from './lib/supabase'

/*
  BuildEasy v9 — SaaS BTP Premium
  Thème clair professionnel — Sans pointage employé

  admin@buildeasy.eu   / admin123
  chef@buildeasy.eu    / chef123
  ali@buildeasy.eu     / employe123
  client@buildeasy.eu  / client123
*/

/* ─── RÔLES ─── */
const ROLES = {
  admin:   { id:"admin",   label:"Administrateur",   abbr:"ADM", color:"#2563EB" },
  chef:    { id:"chef",    label:"Chef de chantier", abbr:"CDC", color:"#0891B2" },
  employe: { id:"employe", label:"Compagnon",        abbr:"CPG", color:"#059669" },
  client:  { id:"client",  label:"Maître d'ouvrage", abbr:"MOA", color:"#D97706" },
};

const PERMS = {
  admin:   { chantiers:true,  finances:true,  equipe:true,  rapports:true,  creerChantier:true,  modChantier:true,  creerTache:true,  modTache:true,  creerFacture:true,  encaisser:true,  montants:true,  tels:true,  rapport:true,  tousRapports:true,  chat:true,  msg:true,  avenants:true,  creerAv:true,  validerAv:true,  heures:true,  punch:true,  gererPunch:true  },
  chef:    { chantiers:true,  finances:false, equipe:true,  rapports:true,  creerChantier:false, modChantier:true,  creerTache:true,  modTache:true,  creerFacture:false, encaisser:false, montants:false, tels:true,  rapport:true,  tousRapports:true,  chat:true,  msg:true,  avenants:true,  creerAv:false, validerAv:false, heures:true,  punch:true,  gererPunch:true  },
  employe: { chantiers:true,  finances:false, equipe:false, rapports:false, creerChantier:false, modChantier:false, creerTache:false, modTache:true,  creerFacture:false, encaisser:false, montants:false, tels:false, rapport:true,  tousRapports:false, chat:true,  msg:true,  avenants:false, creerAv:false, validerAv:false, heures:true,  punch:true,  gererPunch:false },
  client:  { chantiers:true,  finances:true,  equipe:false, rapports:true,  creerChantier:false, modChantier:false, creerTache:false, modTache:false, creerFacture:false, encaisser:false, montants:true,  tels:false, rapport:false, tousRapports:false, chat:false, msg:false, avenants:true,  creerAv:false, validerAv:true,  heures:false, punch:true,  gererPunch:false },
};

const COMPTES = [
  { id:1, nom:"Jean Dupont",    role:"admin",   email:"admin@buildeasy.eu",  mdp:"admin123",   chIds:[] },
  { id:2, nom:"Marc Lefebvre", role:"chef",    email:"chef@buildeasy.eu",   mdp:"chef123",    chIds:[1,5] },
  { id:3, nom:"Ali Benali",    role:"employe", email:"ali@buildeasy.eu",    mdp:"employe123", chIds:[1] },
  { id:4, nom:"M. Dupont",     role:"client",  email:"client@buildeasy.eu", mdp:"client123",  chIds:[1] },
];

/* ─── DONNÉES ─── */
const INIT_CH = [
  { id:1, nom:"Rénovation Villa Dupont",   client:"M. Dupont",         tel:"06 11 22 33 44", corps:"Maçonnerie · Plomberie",  statut:"actif",  av:68,  budget:85000,  dep:62400, debut:"10/03/26", fin:"30/06/26", equipe:["J. Dupont","M. Lefebvre","A. Benali"], prio:1, note:"Délai façade à surveiller",  adresse:"12 rue des Roses, Paris 16e",  meteo:"Ensoleillé · 22°C", rdv:"07:30" },
  { id:2, nom:"Extension Pavillon Martin", client:"Mme Martin",        tel:"06 22 33 44 55", corps:"Gros Œuvre",              statut:"actif",  av:34,  budget:120000, dep:41800, debut:"01/04/26", fin:"15/09/26", equipe:["K. Diallo","S. Petit"],               prio:2, note:"",                           adresse:"8 allée des Pins, Versailles", meteo:"Nuageux · 17°C",    rdv:"08:00" },
  { id:3, nom:"Réfection Toiture Leroy",   client:"M. Leroy",          tel:"06 33 44 55 66", corps:"Couverture",              statut:"livre",  av:100, budget:22000,  dep:21340, debut:"15/01/26", fin:"01/03/26", equipe:["P. Martin","N. Simon"],               prio:3, note:"PV réception signé",          adresse:"5 rue du Moulin, Lyon 3e",     meteo:"—",                 rdv:"" },
  { id:4, nom:"Aménagement Cuisine Brun",  client:"Famille Brun",      tel:"06 44 55 66 77", corps:"Électricité · Plomberie", statut:"planif", av:0,   budget:18500,  dep:0,     debut:"01/06/26", fin:"15/07/26", equipe:[],                                     prio:2, note:"",                           adresse:"3 rue Nationale, Bordeaux",    meteo:"—",                 rdv:"" },
  { id:5, nom:"Ravalement Façade Moreau",  client:"Synd. Copropriété", tel:"06 55 66 77 88", corps:"Façade · Peinture",      statut:"actif",  av:52,  budget:56000,  dep:30200, debut:"20/02/26", fin:"31/05/26", equipe:["T. Bernard","K. Simon"],              prio:1, note:"Réunion copro 25/05",         adresse:"22 bd Haussmann, Paris 9e",    meteo:"Couvert · 18°C",    rdv:"08:00" },
];

const INIT_TACHES = [
  { id:1, chId:1, titre:"Coulage dalle béton",         resp:"A. Benali",   debut:"01/05", fin:"08/05", statut:"fait",     prio:1, duree:7,  check:true  },
  { id:2, chId:1, titre:"Installation plomberie SDB",  resp:"M. Lefebvre", debut:"09/05", fin:"18/05", statut:"en_cours", prio:1, duree:9,  check:false },
  { id:3, chId:1, titre:"Carrelage sol RDC",           resp:"A. Benali",   debut:"15/05", fin:"25/05", statut:"planif",   prio:2, duree:10, check:false },
  { id:4, chId:1, titre:"Peinture intérieure",         resp:"M. Lefebvre", debut:"20/05", fin:"05/06", statut:"planif",   prio:3, duree:16, check:false },
  { id:5, chId:2, titre:"Fondations extension",        resp:"K. Diallo",   debut:"10/04", fin:"20/04", statut:"fait",     prio:1, duree:10, check:true  },
  { id:6, chId:2, titre:"Élévation murs parpaings",    resp:"S. Petit",    debut:"21/04", fin:"10/05", statut:"en_cours", prio:1, duree:19, check:false },
  { id:7, chId:5, titre:"Préparation supports",        resp:"T. Bernard",  debut:"20/02", fin:"05/03", statut:"fait",     prio:2, duree:13, check:true  },
  { id:8, chId:5, titre:"Application enduit finition", resp:"K. Simon",    debut:"01/05", fin:"31/05", statut:"en_cours", prio:2, duree:30, check:false },
];

const INIT_FAC = [
  { id:"FA-001", chId:1, ch:"Villa Dupont",  client:"M. Dupont",         mt:28500, statut:"encaissee", date:"15/03/26", ech:"15/04/26" },
  { id:"FA-002", chId:2, ch:"Ext. Martin",   client:"Mme Martin",        mt:40000, statut:"encaissee", date:"01/04/26", ech:"01/05/26" },
  { id:"FA-003", chId:5, ch:"Rav. Moreau",   client:"Synd. Copropriété", mt:18000, statut:"emise",     date:"20/04/26", ech:"20/05/26" },
  { id:"FA-004", chId:1, ch:"Villa Dupont",  client:"M. Dupont",         mt:22000, statut:"retard",    date:"10/04/26", ech:"10/05/26" },
  { id:"FA-005", chId:3, ch:"Toiture Leroy", client:"M. Leroy",          mt:21340, statut:"encaissee", date:"05/03/26", ech:"05/04/26" },
];

const INIT_EQ = [
  { id:1, nom:"Jean Dupont",    fn:"Conducteur de travaux", tel:"06 12 34 56 78", chIds:[1,2], statut:"present" },
  { id:2, nom:"Marc Lefebvre", fn:"Chef de chantier",      tel:"06 23 45 67 89", chIds:[1,5], statut:"present" },
  { id:3, nom:"Ali Benali",    fn:"Maçon qualifié",        tel:"06 34 56 78 90", chIds:[1],   statut:"retard"  },
  { id:4, nom:"Karim Diallo",  fn:"Gros oeuvre",           tel:"06 45 67 89 01", chIds:[2],   statut:"present" },
  { id:5, nom:"Thomas Bernard",fn:"Façadier",              tel:"06 67 89 01 23", chIds:[5],   statut:"present" },
  { id:6, nom:"Kevin Simon",   fn:"Peintre",               tel:"06 89 01 23 45", chIds:[5],   statut:"absent"  },
];

const INIT_MSG = [
  { id:1, chId:1, auteur:"M. Lefebvre", role:"chef",    txt:"Dalle coulée ce matin. Début plomberie demain.",      h:"08:32", d:"16/05" },
  { id:2, chId:1, auteur:"A. Benali",   role:"employe", txt:"Photos prises. Matériel rangé.",                      h:"08:45", d:"16/05" },
  { id:3, chId:1, auteur:"J. Dupont",   role:"admin",   txt:"Visite client vendredi 9h. Confirmez disponibilité.", h:"09:10", d:"16/05" },
  { id:4, chId:5, auteur:"T. Bernard",  role:"chef",    txt:"Rupture stock blanc cassé. Commande urgente.",        h:"14:20", d:"16/05" },
  { id:5, chId:5, auteur:"J. Dupont",   role:"admin",   txt:"Commande passée. Livraison demain 7h.",               h:"14:35", d:"16/05" },
];

const INIT_AV = [
  { id:1, chId:1, ref:"AV-001", titre:"Douche à l'italienne",      desc:"Remplacement baignoire par douche extra-plate.", mt:2800, statut:"signe",  dc:"20/04/26", ds:"22/04/26", par:"M. Dupont" },
  { id:2, chId:1, ref:"AV-002", titre:"Peinture couloir d'entrée", desc:"Peinture couloir non inclus au marché initial.", mt:650,  statut:"attente", dc:"10/05/26", ds:"",         par:"" },
];

const INIT_HEURES = [
  { id:1,  nom:"A. Benali",   chId:1, date:"2026-05-19", arr:"07:30", dep:"17:00", pause:45, desc:"Coffrage dalle RDC",       valide:true  },
  { id:2,  nom:"M. Lefebvre", chId:1, date:"2026-05-19", arr:"07:00", dep:"17:30", pause:60, desc:"Supervision + réunion",    valide:true  },
  { id:3,  nom:"T. Bernard",  chId:5, date:"2026-05-19", arr:"08:00", dep:"16:00", pause:45, desc:"Enduit façade nord C1",    valide:true  },
  { id:4,  nom:"K. Simon",    chId:5, date:"2026-05-19", arr:"08:30", dep:"16:30", pause:45, desc:"Préparation supports",     valide:true  },
  { id:5,  nom:"A. Benali",   chId:1, date:"2026-05-20", arr:"07:30", dep:"17:00", pause:45, desc:"Coulage dalle béton",      valide:true  },
  { id:6,  nom:"M. Lefebvre", chId:1, date:"2026-05-20", arr:"07:00", dep:"18:00", pause:60, desc:"Contrôle + coordination",  valide:true  },
  { id:7,  nom:"T. Bernard",  chId:5, date:"2026-05-20", arr:"08:00", dep:"16:00", pause:45, desc:"Enduit façade nord C2",    valide:true  },
  { id:8,  nom:"K. Diallo",   chId:2, date:"2026-05-20", arr:"07:00", dep:"16:00", pause:45, desc:"Élévation murs R+1",       valide:true  },
  { id:9,  nom:"A. Benali",   chId:1, date:"2026-05-21", arr:"07:30", dep:"12:00", pause:0,  desc:"Décoffrage dalle ½J",      valide:true  },
  { id:10, nom:"M. Lefebvre", chId:1, date:"2026-05-21", arr:"07:00", dep:"17:00", pause:60, desc:"Plomberie SDB nord",       valide:true  },
  { id:11, nom:"K. Diallo",   chId:2, date:"2026-05-21", arr:"07:00", dep:"16:00", pause:45, desc:"Murs + chaînage",          valide:true  },
  { id:12, nom:"K. Simon",    chId:5, date:"2026-05-21", arr:"08:00", dep:"16:30", pause:45, desc:"Enduit façade est",        valide:false },
  { id:13, nom:"A. Benali",   chId:1, date:"2026-05-22", arr:"07:30", dep:"17:00", pause:45, desc:"Carrelage RDC démarrage",  valide:false },
  { id:14, nom:"M. Lefebvre", chId:1, date:"2026-05-22", arr:"07:00", dep:"17:00", pause:60, desc:"Plomberie SDB raccords",   valide:false },
  { id:15, nom:"T. Bernard",  chId:5, date:"2026-05-22", arr:"08:00", dep:"17:00", pause:45, desc:"Ravalement sud démarrage", valide:false },
  { id:16, nom:"K. Diallo",   chId:2, date:"2026-05-22", arr:"07:00", dep:"15:30", pause:45, desc:"Pose linteaux R+1",        valide:false },
  { id:17, nom:"A. Benali",   chId:1, date:"2026-05-23", arr:"07:30", dep:"16:00", pause:45, desc:"Carrelage RDC 60%",        valide:false },
  { id:18, nom:"M. Lefebvre", chId:1, date:"2026-05-23", arr:"07:00", dep:"16:30", pause:60, desc:"Plomberie SDB terminée",   valide:false },
  { id:19, nom:"T. Bernard",  chId:5, date:"2026-05-23", arr:"08:00", dep:"16:00", pause:45, desc:"Ravalement sud finition",  valide:false },
  { id:20, nom:"K. Simon",    chId:5, date:"2026-05-23", arr:"08:30", dep:"15:00", pause:30, desc:"Retouches + nettoyage",    valide:false },
  { id:21, nom:"A. Benali",   chId:1, date:"2026-05-24", arr:"07:30", dep:"12:00", pause:0,  desc:"Carrelage RDC finition",   valide:false },
  { id:22, nom:"M. Lefebvre", chId:1, date:"2026-05-24", arr:"07:00", dep:"12:30", pause:0,  desc:"Visite client + PV",       valide:false },
];

const INIT_PUNCH = [
  { id:1, chId:1, ref:"RES-001", titre:"Fissure angle mur cuisine",   desc:"Fissure 15cm jonction mur/plafond.", corps:"Maçonnerie", prio:1, statut:"encours", sig:"M. Lefebvre", date:"10/05/26", clos:"",         ass:"A. Benali"   },
  { id:2, chId:1, ref:"RES-002", titre:"Carrelage décollé SDB",       desc:"3 carreaux décollés. Risque sécurité.", corps:"Carrelage",  prio:1, statut:"ouvert",  sig:"M. Dupont",   date:"14/05/26", clos:"",         ass:"A. Benali"   },
  { id:3, chId:1, ref:"RES-003", titre:"Joint silicone non conforme", desc:"Discontinuités joint baignoire 80cm.", corps:"Plomberie",  prio:2, statut:"clos",    sig:"M. Lefebvre", date:"08/05/26", clos:"12/05/26", ass:"M. Lefebvre" },
];

const INIT_RAPPORTS = [
  { id:1, chId:1, date:"16/05/26", auteur:"M. Lefebvre", meteo:"Ensoleillé 22°C", av:"Dalle RDC coulée. Plomberie nord démarrée.", incidents:"RAS",                               presences:["M. Lefebvre","A. Benali"], photos:2 },
  { id:2, chId:5, date:"16/05/26", auteur:"T. Bernard",  meteo:"Couvert 18°C",   av:"Enduit finition 60% zone nord.",              incidents:"Rupture stock blanc cassé — réappro demandé", presences:["T. Bernard","K. Simon"], photos:4 },
];

/* Photos chantier */
const INIT_PHOTOS = [
  { id:1, chId:1, rapportId:1, nom:"Dalle-RDC-coulée.jpg",    date:"16/05/26", auteur:"M. Lefebvre", tache:"Coulage dalle béton",    tags:["avancement","dalle"],  thumb:"🏗" },
  { id:2, chId:1, rapportId:1, nom:"Plomberie-nord-début.jpg", date:"16/05/26", auteur:"A. Benali",   tache:"Installation plomberie",  tags:["plomberie","nord"],   thumb:"🔧" },
  { id:3, chId:5, rapportId:2, nom:"Enduit-facade-nord.jpg",   date:"16/05/26", auteur:"T. Bernard",  tache:"Application enduit",      tags:["façade","enduit"],    thumb:"🎨" },
  { id:4, chId:5, rapportId:2, nom:"Etat-supports-est.jpg",    date:"15/05/26", auteur:"K. Simon",    tache:"Préparation supports",    tags:["supports"],           thumb:"📸" },
  { id:5, chId:1, rapportId:null, nom:"Fissure-cuisine.jpg",   date:"10/05/26", auteur:"M. Lefebvre", tache:"",                        tags:["réserve","fissure"],  thumb:"⚠️" },
];

/* Documents chantier */
const INIT_DOCS = [
  { id:1, chId:1, nom:"Devis-Villa-Dupont-v2.pdf",       type:"devis",    taille:"2.1 Mo", date:"15/02/26", auteur:"J. Dupont" },
  { id:2, chId:1, nom:"Plan-RDC-architecture.pdf",       type:"plan",     taille:"8.4 Mo", date:"20/01/26", auteur:"Arch. Martin" },
  { id:3, chId:1, nom:"CCTP-Lot-Plomberie.pdf",          type:"cctp",     taille:"1.3 Mo", date:"05/02/26", auteur:"J. Dupont" },
  { id:4, chId:1, nom:"PV-réunion-chantier-01.pdf",      type:"rapport",  taille:"0.4 Mo", date:"20/03/26", auteur:"M. Lefebvre" },
  { id:5, chId:1, nom:"Fiche-sécu-maçonnerie.pdf",       type:"securite", taille:"0.8 Mo", date:"10/03/26", auteur:"J. Dupont" },
  { id:6, chId:5, nom:"Devis-Ravalement-Moreau.pdf",     type:"devis",    taille:"1.7 Mo", date:"10/01/26", auteur:"J. Dupont" },
  { id:7, chId:5, nom:"Plan-façade-colorimétrie.pdf",    type:"plan",     taille:"3.2 Mo", date:"15/01/26", auteur:"Arch. Dubois" },
  { id:8, chId:2, nom:"Permis-construire-Martin.pdf",    type:"admin",    taille:"5.1 Mo", date:"05/03/26", auteur:"Mme Martin" },
];

/* Situations de travaux */
const INIT_SITUATIONS = [
  { id:1, chId:1, ref:"SIT-001", num:1, titre:"Situation n°1 — Mars 2026", av:30, mt:25500, statut:"encaissee", date:"31/03/26", ech:"30/04/26", desc:"Fondations + gros œuvre RDC terminés." },
  { id:2, chId:1, ref:"SIT-002", num:2, titre:"Situation n°2 — Avril 2026", av:55, mt:22000, statut:"encaissee", date:"30/04/26", ech:"30/05/26", desc:"Maçonnerie R+1 + charpente." },
  { id:3, chId:1, ref:"SIT-003", num:3, titre:"Situation n°3 — Mai 2026",   av:68, mt:11000, statut:"emise",     date:"20/05/26", ech:"20/06/26", desc:"Plomberie SDB + carrelage en cours." },
  { id:4, chId:5, ref:"SIT-001", num:1, titre:"Situation n°1 — Mars 2026", av:25, mt:14000, statut:"encaissee", date:"31/03/26", ech:"30/04/26", desc:"Échafaudage + préparation supports." },
  { id:5, chId:5, ref:"SIT-002", num:2, titre:"Situation n°2 — Avril 2026", av:52, mt:16200, statut:"emise",     date:"20/05/26", ech:"20/06/26", desc:"Enduit façade nord et est." },
];

/* ─── HELPERS ─── */
const EUR  = n => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n||0);
const PCT  = (a,b) => b>0 ? Math.round(a/b*100) : 0;
const INI  = n => (n||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const calcH = h => {
  if(!h.arr||!h.dep) return 0;
  const [ah,am]=h.arr.split(":").map(Number);
  const [dh,dm]=h.dep.split(":").map(Number);
  return Math.max(0, Math.round(((dh*60+dm)-(ah*60+am)-(h.pause||0))/6)/10);
};
const isoD = d => d instanceof Date ? d.toISOString().split("T")[0] : d;

const SB_OK = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() &&
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() &&
  !String(import.meta.env.VITE_SUPABASE_URL).includes("XXXX")
);

const n = v => (v == null ? 0 : Number(v));
const prioDb = p => ({ 1: "haute", 2: "normale", 3: "basse" }[Number(p)] ?? "normale");
const prioApp = p => ({ haute: 1, normale: 2, basse: 3 }[p] ?? (Number(p) || 2));
const chStatDb = s => ({ actif: "en_cours", planif: "en_attente", livre: "termine" }[s] ?? s);
const chStatApp = s => ({ en_cours: "actif", en_attente: "planif", termine: "livre" }[s] ?? s);
const tStatDb = s => ({ planif: "a_faire" }[s] ?? s);
const tStatApp = s => ({ a_faire: "planif" }[s] ?? s);
const facStatApp = s => ({ payee: "encaissee", en_attente: "emise", en_retard: "retard" }[s] ?? s);
const avStatDb = s => ({ signe: "accepte", attente: "en_attente", refuse: "refuse" }[s] ?? s);
const avStatApp = s => ({ accepte: "signe", en_attente: "attente" }[s] ?? s);
const punchStatDb = s => ({ encours: "en_cours", clos: "resolu" }[s] ?? s);
const punchStatApp = s => ({ en_cours: "encours", resolu: "clos" }[s] ?? s);
const frD = iso => {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y.slice(2)}` : String(iso);
};

const mapCh = r => ({
  id: r.id, nom: r.nom, client: r.client, tel: r.tel ?? "", corps: r.corps ?? "",
  statut: chStatApp(r.statut), av: n(r.avancement), budget: n(r.budget), dep: n(r.depenses),
  debut: frD(r.debut), fin: frD(r.fin), equipe: Array.isArray(r.equipe) ? r.equipe : [],
  prio: prioApp(r.priorite), note: r.note ?? "", adresse: r.adresse ?? "", meteo: r.meteo ?? "—", rdv: "",
});
const mapT = r => ({
  id: r.id, chId: r.chantier_id, titre: r.titre, resp: r.responsable ?? "",
  debut: frD(r.debut), fin: frD(r.fin), statut: tStatApp(r.statut), prio: prioApp(r.priorite),
  duree: n(r.duree), check: r.statut === "fait",
});
const mapF = r => ({
  id: r.id, chId: r.chantier_id, ch: r.chantier ?? "", client: r.client ?? "", mt: n(r.montant),
  statut: facStatApp(r.statut), date: frD(r.date), ech: frD(r.echeance),
});
const mapM = r => ({
  id: r.id, chId: r.chantier_id, auteur: r.auteur, role: r.role ?? "", txt: r.texte,
  h: r.heure ?? "", d: frD(r.date) || String(r.date ?? ""),
});
const mapA = r => ({
  id: r.id, chId: r.chantier_id, ref: `AV-${r.id}`, titre: r.titre, desc: r.description ?? "",
  mt: n(r.montant), statut: avStatApp(r.statut), dc: frD(r.date_creation), ds: frD(r.date_validation), par: r.valide_par ?? "",
});
const mapR = r => ({
  id: r.id, chId: r.chantier_id, date: frD(r.date), auteur: r.auteur ?? "", meteo: r.meteo ?? "",
  av: r.avancement ?? "", incidents: r.problemes ?? "RAS",
  presences: Array.isArray(r.presences) ? r.presences : [], photos: n(r.photos),
});
const mapH = r => ({
  id: r.id, nom: r.membre_nom, chId: r.chantier_id, date: String(r.date ?? "").slice(0, 10),
  arr: r.arrivee ?? "", dep: r.depart ?? "", pause: n(r.pause_min), desc: r.description ?? "", valide: Boolean(r.valide),
});
const mapP = r => ({
  id: r.id, chId: r.chantier_id, ref: `RES-${r.id}`, titre: r.titre, desc: r.description ?? "",
  corps: r.categorie ?? "Autre", prio: prioApp(r.priorite), statut: punchStatApp(r.statut),
  sig: r.signale_par ?? "", date: frD(r.date_signalement), clos: frD(r.date_resolution), ass: r.assigne_a ?? "",
});
const mapE = r => ({
  id: r.id, nom: r.nom, fn: r.role ?? "", tel: r.tel ?? "",
  chIds: Array.isArray(r.chantiers) ? r.chantiers : [], statut: r.dispo ? "present" : "absent",
});

async function sbLoad(table) {
  const { data, error } = await supabase.from(table).select("*").order("id");
  if (error) {
    console.warn(`[BuildEasy] ${table}:`, error.message);
    return null;
  }
  return data;
}

const pick = (rows, init) => (rows?.length ? rows : init);

/* ─── CSS ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#F1F5F9;
  --w:#FFFFFF;
  --g1:#F8FAFC;
  --g2:#E2E8F0;
  --g3:#CBD5E1;
  --g4:#94A3B8;
  --t1:#0F172A;
  --t2:#1E293B;
  --t3:#475569;
  --t4:#94A3B8;
  --blue:#2563EB;
  --blue-l:#EFF6FF;
  --blue-b:#BFDBFE;
  --ok:#059669;
  --ok-l:#ECFDF5;
  --ok-b:#A7F3D0;
  --warn:#D97706;
  --warn-l:#FFFBEB;
  --warn-b:#FDE68A;
  --err:#DC2626;
  --err-l:#FEF2F2;
  --err-b:#FECACA;
  --ora:#EA580C;
  --ora-l:#FFF7ED;
  --ora-b:#FED7AA;
  --r:8px; --r2:12px; --r3:20px;
  --sh:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);
  --sh2:0 4px 16px rgba(0,0,0,.1),0 2px 4px rgba(0,0,0,.06);
  --f:'Inter',-apple-system,sans-serif;
  --sb:env(safe-area-inset-bottom,0px);
  --st:env(safe-area-inset-top,0px);
}
html,body,#root{height:100%;font-family:var(--f);background:var(--bg);color:var(--t1);overflow:hidden;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{display:none;}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes su{from{transform:translateY(100%)}to{transform:none}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.u0{animation:up .22s ease both}
.u1{animation:up .22s .05s ease both}
.u2{animation:up .22s .10s ease both}
.u3{animation:up .22s .15s ease both}

/* Boutons — min 48px tactile */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:48px;padding:0 20px;border-radius:var(--r2);border:none;cursor:pointer;font-family:var(--f);font-size:15px;font-weight:600;transition:all .12s;white-space:nowrap;-webkit-tap-highlight-color:transparent;color:var(--t1);}
.btn:active{transform:scale(.96);}
.btn:disabled{opacity:.4;pointer-events:none;}
.btn-blue{background:var(--blue);color:#fff!important;box-shadow:0 2px 8px rgba(37,99,235,.3);}
.btn-ok{background:var(--ok);color:#fff!important;box-shadow:0 2px 8px rgba(5,150,105,.25);}
.btn-err{background:var(--err);color:#fff!important;box-shadow:0 2px 8px rgba(220,38,38,.25);}
.btn-warn{background:var(--warn);color:#fff!important;}
.btn-ora{background:var(--ora);color:#fff!important;box-shadow:0 2px 8px rgba(234,88,12,.25);}
.btn-out{background:var(--w);color:var(--t2)!important;border:1.5px solid var(--g3);box-shadow:var(--sh);}
.btn-ghost{background:transparent;color:var(--blue)!important;border:none;box-shadow:none;}
.btn-sm{min-height:38px;padding:0 14px;font-size:13px;}
.btn-xs{min-height:32px;padding:0 11px;font-size:12px;}
.btn-fw{width:100%;}
.btn-sq{width:48px;padding:0;}

/* Inputs */
.inp{width:100%;height:48px;padding:0 14px;background:var(--w);border:1.5px solid var(--g2);border-radius:var(--r2);color:var(--t1);font-family:var(--f);font-size:15px;font-weight:400;outline:none;transition:border-color .15s;box-shadow:var(--sh);}
.inp:focus{border-color:var(--blue);}
.inp::placeholder{color:var(--t4);}
select.inp{cursor:pointer;}
select.inp option{background:#fff;color:var(--t1);}
.inp-a{height:auto;padding:12px 14px;resize:none;min-height:80px;line-height:1.6;}
.lbl{font-size:11px;font-weight:700;color:var(--t3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;display:block;}

/* Cards */
.card{background:var(--w);border-radius:var(--r2);box-shadow:var(--sh);border:1px solid var(--g2);}
.card2{background:var(--g1);border-radius:var(--r2);border:1px solid var(--g2);}
.tap{cursor:pointer;transition:all .12s;}
.tap:active{transform:scale(.985);filter:brightness(.97);}

/* Tags statut */
.tag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--r);font-size:11px;font-weight:700;letter-spacing:.02em;}
.tag-ok{background:var(--ok-l);color:var(--ok);border:1px solid var(--ok-b);}
.tag-warn{background:var(--warn-l);color:var(--warn);border:1px solid var(--warn-b);}
.tag-err{background:var(--err-l);color:var(--err);border:1px solid var(--err-b);}
.tag-blue{background:var(--blue-l);color:var(--blue);border:1px solid var(--blue-b);}
.tag-ora{background:var(--ora-l);color:var(--ora);border:1px solid var(--ora-b);}
.tag-gray{background:var(--g1);color:var(--t3);border:1px solid var(--g3);}

/* Barres de progression */
.bar{height:6px;background:var(--g2);border-radius:99px;overflow:hidden;}
.bar-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1);}
.bar4{height:4px;background:var(--g2);border-radius:99px;overflow:hidden;}

/* Bottom sheet */
.sbg{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);z-index:500;display:flex;align-items:flex-end;animation:fi .15s ease both;}
.sh{background:var(--w);border-radius:20px 20px 0 0;border-top:1px solid var(--g2);width:100%;max-height:93vh;overflow-y:auto;padding:0 20px calc(28px + var(--sb));animation:su .25s cubic-bezier(.32,0,.1,1) both;box-shadow:0 -8px 32px rgba(0,0,0,.1);}
.drag{width:40px;height:4px;background:var(--g3);border-radius:99px;margin:14px auto 22px;}

/* Navigation basse */
.nav{position:fixed;bottom:0;left:0;right:0;background:var(--w);border-top:1.5px solid var(--g2);display:flex;padding:8px 4px calc(8px + var(--sb));z-index:100;box-shadow:0 -2px 12px rgba(0,0,0,.05);}
.nt{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 2px;cursor:pointer;position:relative;transition:color .15s;}
.nt-ico{font-size:22px;line-height:1;}
.nt-lbl{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
.nt-off{color:var(--g4);}
.nt-on{color:var(--blue);}
.nt-dot{position:absolute;top:2px;right:calc(50% - 20px);width:8px;height:8px;background:var(--err);border-radius:50%;border:2px solid var(--w);}

/* FAB signalement — bouton flottant rouge très visible */
.fab{position:fixed;bottom:calc(82px + var(--sb));right:16px;z-index:90;display:flex;flex-direction:column;align-items:center;gap:4px;}
.fab-btn{width:58px;height:58px;border-radius:18px;background:var(--err);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 4px 20px rgba(220,38,38,.45),0 2px 8px rgba(0,0,0,.15);transition:transform .15s;-webkit-tap-highlight-color:transparent;}
.fab-btn:active{transform:scale(.88);}
.fab-lbl{font-size:9px;font-weight:700;color:var(--err);letter-spacing:.04em;text-transform:uppercase;background:var(--err-l);padding:2px 6px;border-radius:4px;border:1px solid var(--err-b);}

/* Utilitaires */
.row{display:flex;justify-content:space-between;align-items:center;}
.col{display:flex;flex-direction:column;}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 24px;color:var(--t4);}
.sec{font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;}
.div{height:1px;background:var(--g2);margin:4px 0;}
.sx{display:flex;overflow-x:auto;gap:8px;padding-bottom:2px;}
.pulse{animation:pulse 2s infinite;}
.av{border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
.dot-ok{background:var(--ok);}
.dot-warn{background:var(--warn);}
.dot-err{background:var(--err);}
`;

/* ─── COMPOSANTS ATOMIQUES ─── */
function Av({ nom, color="#2563EB", size=38 }) {
  const fs = Math.round(size * .32);
  return (
    <div className="av" style={{width:size,height:size,background:color+"18",color,border:"1.5px solid "+color+"35",fontSize:fs,letterSpacing:".02em"}}>
      {INI(nom)}
    </div>
  );
}

function PBar({ v, color, h=6 }) {
  const w = Math.min(Math.max(v||0,0),100);
  const c = color || (w>75?"#DC2626":w>50?"#D97706":"#059669");
  return (
    <div className={h===4?"bar4":"bar"}>
      <div className="bar-fill" style={{width:w+"%",background:c}}/>
    </div>
  );
}

function Tag({ label, type="gray" }) {
  return <span className={"tag tag-"+type}>{label}</span>;
}

function Fld({ label, children }) {
  return (
    <div className="col" style={{gap:6}}>
      <label className="lbl">{label}</label>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, color="#2563EB", onClick }) {
  return (
    <div className={"card"+(onClick?" tap":"")} style={{padding:"14px 16px",cursor:onClick?"pointer":"default",flex:1}} onClick={onClick}>
      <div style={{fontSize:22,fontWeight:800,color,letterSpacing:"-.02em",lineHeight:1,marginBottom:4}}>{value}</div>
      <div style={{fontSize:13,fontWeight:600,color:"var(--t2)",marginBottom:2}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:"var(--t4)"}}>{sub}</div>}
    </div>
  );
}

function MeteoTag({ meteo }) {
  if(!meteo||meteo==="—") return null;
  const ic = meteo.toLowerCase().includes("ensoleillé")?"☀️":meteo.toLowerCase().includes("nuageux")?"⛅":meteo.toLowerCase().includes("couvert")?"🌥️":meteo.toLowerCase().includes("pluie")?"🌧️":"🌤️";
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--blue)",fontWeight:600}}>
      {ic} {meteo}
    </div>
  );
}

/* ─── BOTTOM SHEET ─── */
function Sheet({ title, sub, onClose, footer, children }) {
  return (
    <div className="sbg" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sh">
        <div className="drag"/>
        <div className="row" style={{marginBottom:20}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--t1)"}}>{title}</div>
            {sub&&<div style={{fontSize:13,color:"var(--t3)",marginTop:3}}>{sub}</div>}
          </div>
          <button className="btn btn-out btn-sm" onClick={onClose}>Fermer</button>
        </div>
        <div className="col" style={{gap:16}}>{children}</div>
        {footer&&<div className="col" style={{gap:8,marginTop:24}}>{footer}</div>}
      </div>
    </div>
  );
}

/* ─── FORMULAIRES ─── */
function SheetRapport({ chantiers, user, onClose, onSave }) {
  const [f,setF]=useState({chId:"",date:new Date().toLocaleDateString("fr-FR"),auteur:user?.nom||"",meteo:"",av:"",incidents:"RAS",presences:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.chId&&f.av.trim();
  return (
    <Sheet title="Compte-rendu journalier" sub="Rapport de fin de journée" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,presences:f.presences.split(",").map(x=>x.trim()).filter(Boolean)});onClose();}}>Enregistrer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Chantier">
        <select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}>
          <option value="">Sélectionner...</option>
          {chantiers.filter(c=>c.statut==="actif").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Rédacteur"><input className="inp" value={f.auteur} onChange={e=>s("auteur",e.target.value)}/></Fld>
        <Fld label="Météo"><input className="inp" placeholder="Ex : Ensoleillé 22°C" value={f.meteo} onChange={e=>s("meteo",e.target.value)}/></Fld>
      </div>
      <Fld label="Avancement des travaux"><textarea className="inp inp-a" placeholder="Travaux réalisés aujourd'hui..." value={f.av} onChange={e=>s("av",e.target.value)}/></Fld>
      <Fld label="Incidents / Observations"><textarea className="inp inp-a" style={{minHeight:60}} placeholder="RAS, ou description..." value={f.incidents} onChange={e=>s("incidents",e.target.value)}/></Fld>
      <Fld label="Personnel présent"><input className="inp" placeholder="Noms séparés par des virgules" value={f.presences} onChange={e=>s("presences",e.target.value)}/></Fld>
    </Sheet>
  );
}

function SheetChantier({ onClose, onSave }) {
  const [f,setF]=useState({nom:"",client:"",tel:"",corps:"",budget:"",debut:"",fin:"",prio:2,adresse:"",note:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.nom.trim()&&f.client.trim()&&parseInt(f.budget)>0;
  return (
    <Sheet title="Nouveau chantier" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave(f);onClose();}}>Créer le chantier</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Désignation"><input className="inp" placeholder="Ex : Rénovation appartement T3..." value={f.nom} onChange={e=>s("nom",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Maître d'ouvrage"><input className="inp" placeholder="Nom du client" value={f.client} onChange={e=>s("client",e.target.value)}/></Fld>
        <Fld label="Téléphone"><input className="inp" type="tel" placeholder="06..." value={f.tel} onChange={e=>s("tel",e.target.value)}/></Fld>
      </div>
      <Fld label="Adresse du chantier"><input className="inp" placeholder="N° rue, ville, code postal" value={f.adresse} onChange={e=>s("adresse",e.target.value)}/></Fld>
      <Fld label="Corps d'état"><input className="inp" placeholder="Ex : Maçonnerie · Plomberie" value={f.corps} onChange={e=>s("corps",e.target.value)}/></Fld>
      <Fld label="Montant du marché HT (€)"><input className="inp" type="number" min="0" placeholder="0" value={f.budget} onChange={e=>s("budget",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Démarrage"><input className="inp" type="date" value={f.debut} onChange={e=>s("debut",e.target.value)}/></Fld>
        <Fld label="Fin contractuelle"><input className="inp" type="date" value={f.fin} onChange={e=>s("fin",e.target.value)}/></Fld>
      </div>
      <Fld label="Priorité">
        <select className="inp" value={f.prio} onChange={e=>s("prio",parseInt(e.target.value))}>
          <option value={1}>Urgent</option><option value={2}>Normal</option><option value={3}>Faible</option>
        </select>
      </Fld>
      <Fld label="Note interne"><textarea className="inp inp-a" style={{minHeight:60}} value={f.note} onChange={e=>s("note",e.target.value)}/></Fld>
    </Sheet>
  );
}

function SheetTache({ chantiers, onClose, onSave }) {
  const [f,setF]=useState({titre:"",chId:"",resp:"",debut:"",fin:"",prio:2});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.titre.trim()&&f.chId;
  const duree=f.debut&&f.fin?Math.max(0,Math.round((new Date(f.fin)-new Date(f.debut))/86400000)):null;
  return (
    <Sheet title="Nouvelle tâche" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,duree:duree||1,statut:"planif",check:false});onClose();}}>Créer la tâche</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Désignation"><input className="inp" placeholder="Ex : Coulage dalle béton" value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <Fld label="Chantier">
        <select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}>
          <option value="">Sélectionner...</option>
          {chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Intervenant"><input className="inp" placeholder="Nom" value={f.resp} onChange={e=>s("resp",e.target.value)}/></Fld>
        <Fld label="Priorité">
          <select className="inp" value={f.prio} onChange={e=>s("prio",parseInt(e.target.value))}>
            <option value={1}>Urgent</option><option value={2}>Normal</option><option value={3}>Faible</option>
          </select>
        </Fld>
        <Fld label="Début"><input className="inp" type="date" value={f.debut} onChange={e=>s("debut",e.target.value)}/></Fld>
        <Fld label="Fin"><input className="inp" type="date" value={f.fin} onChange={e=>s("fin",e.target.value)}/></Fld>
      </div>
      {duree!==null&&<div style={{padding:"10px 14px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)",fontSize:13,color:"var(--blue)",fontWeight:600}}>Durée calculée : {duree} jour{duree>1?"s":""}</div>}
    </Sheet>
  );
}

function SheetAvenant({ chantiers, onClose, onSave }) {
  const [f,setF]=useState({chId:"",titre:"",desc:"",mt:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.chId&&f.titre.trim()&&parseInt(f.mt)>0;
  return (
    <Sheet title="Nouvel avenant" sub="Travaux supplémentaires au marché initial" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({chId:parseInt(f.chId),titre:f.titre,desc:f.desc,mt:parseInt(f.mt),ref:"AV-"+String(Date.now()).slice(-3),statut:"attente",dc:new Date().toLocaleDateString("fr-FR"),ds:"",par:""});onClose();}}>Soumettre au MOA</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <div style={{padding:"12px 14px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r2)"}}>
        <p style={{fontSize:13,color:"var(--warn)",fontWeight:600,lineHeight:1.5}}>Un avenant doit être signé par le maître d'ouvrage avant tout commencement des travaux supplémentaires.</p>
      </div>
      <Fld label="Chantier">
        <select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}>
          <option value="">Sélectionner...</option>
          {chantiers.filter(c=>c.statut==="actif").map(c=><option key={c.id} value={c.id}>{c.nom} — {c.client}</option>)}
        </select>
      </Fld>
      <Fld label="Objet de l'avenant"><input className="inp" placeholder="Désignation courte des travaux" value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <Fld label="Description technique"><textarea className="inp inp-a" placeholder="Nature et étendue des travaux..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <Fld label="Montant HT (€)"><input className="inp" type="number" min="0" placeholder="0" value={f.mt} onChange={e=>s("mt",e.target.value)}/></Fld>
      {parseInt(f.mt)>0&&<div style={{padding:"12px 14px",background:"var(--ok-l)",border:"1px solid var(--ok-b)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:"var(--t2)"}}>Montant avenant HT</span><span style={{fontSize:18,fontWeight:800,color:"var(--ok)"}}>{EUR(parseInt(f.mt))}</span></div>}
    </Sheet>
  );
}

function SheetIncident({ chantiers, onClose, onSave, user }) {
  const [f,setF]=useState({chId:"",type:"securite",desc:"",prio:1});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.chId&&f.desc.trim();
  const types=[{v:"securite",l:"Sécurité",ico:"⚠️"},{v:"materiel",l:"Matériel cassé",ico:"🔧"},{v:"retard",l:"Retard livraison",ico:"📦"},{v:"manque",l:"Manque matériel",ico:"📋"},{v:"autre",l:"Autre",ico:"💬"}];
  return (
    <Sheet title="Signaler un problème" sub="Incident ou danger sur le chantier" onClose={onClose}
      footer={<><button className="btn btn-err btn-fw" disabled={!ok} onClick={()=>{onSave({...f,ref:"INC-"+String(Date.now()).slice(-3),statut:"ouvert",sig:user?.nom||"",date:new Date().toLocaleDateString("fr-FR"),clos:"",ass:""});onClose();}}>Signaler maintenant</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Chantier concerné">
        <select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}>
          <option value="">Sélectionner...</option>
          {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Fld>
      <Fld label="Type d'incident">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {types.map(t=>(
            <button key={t.v} type="button" onClick={()=>s("type",t.v)}
              style={{padding:"12px 8px",background:f.type===t.v?"var(--err-l)":"var(--w)",border:"1.5px solid "+(f.type===t.v?"var(--err)":"var(--g2)"),borderRadius:"var(--r2)",cursor:"pointer",textAlign:"center",transition:"all .12s",fontFamily:"var(--f)"}}>
              <div style={{fontSize:20,marginBottom:4}}>{t.ico}</div>
              <div style={{fontSize:12,fontWeight:600,color:f.type===t.v?"var(--err)":"var(--t2)"}}>{t.l}</div>
            </button>
          ))}
        </div>
      </Fld>
      <Fld label="Description rapide"><textarea className="inp inp-a" placeholder="Décrivez brièvement l'incident..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <Fld label="Niveau d'urgence">
        <div style={{display:"flex",gap:8}}>
          {[{v:1,l:"Danger immédiat",c:"var(--err)"},{v:2,l:"Urgent",c:"var(--warn)"},{v:3,l:"Non urgent",c:"var(--ok)"}].map(u=>(
            <button key={u.v} type="button" onClick={()=>s("prio",u.v)}
              style={{flex:1,padding:"10px 6px",background:f.prio===u.v?u.c+"18":"var(--w)",border:"1.5px solid "+(f.prio===u.v?u.c:"var(--g2)"),borderRadius:"var(--r2)",cursor:"pointer",fontSize:12,fontWeight:700,color:f.prio===u.v?u.c:"var(--t3)",fontFamily:"var(--f)",lineHeight:1.3}}>
              {u.l}
            </button>
          ))}
        </div>
      </Fld>
    </Sheet>
  );
}

function SheetPunch({ chantiers, equipe, user, onClose, onSave }) {
  const [f,setF]=useState({chId:"",titre:"",desc:"",corps:"Maçonnerie",prio:1,ass:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.chId&&f.titre.trim();
  return (
    <Sheet title="Nouvelle réserve" sub="Défaut ou non-conformité à corriger" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,chId:parseInt(f.chId),ref:"RES-"+String(Date.now()).slice(-3),statut:"ouvert",sig:user?.nom||"",date:new Date().toLocaleDateString("fr-FR"),clos:"",prio:parseInt(f.prio)});onClose();}}>Enregistrer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Chantier">
        <select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}>
          <option value="">Sélectionner...</option>
          {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Fld>
      <Fld label="Désignation du défaut"><input className="inp" placeholder="Description courte et précise" value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <Fld label="Localisation et détail"><textarea className="inp inp-a" placeholder="Localisation précise, nature du désordre..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Corps d'état">
          <select className="inp" value={f.corps} onChange={e=>s("corps",e.target.value)}>
            {["Maçonnerie","Plomberie","Électricité","Carrelage","Peinture","Menuiserie","Façade","Autre"].map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </Fld>
        <Fld label="Criticité">
          <select className="inp" value={f.prio} onChange={e=>s("prio",parseInt(e.target.value))}>
            <option value={1}>Bloquant</option><option value={2}>Majeur</option><option value={3}>Mineur</option>
          </select>
        </Fld>
      </div>
      <Fld label="Attribué à">
        <select className="inp" value={f.ass} onChange={e=>s("ass",e.target.value)}>
          <option value="">Non attribué</option>
          {equipe.map(m=><option key={m.id} value={m.nom}>{m.nom} — {m.fn}</option>)}
        </select>
      </Fld>
    </Sheet>
  );
}

/* ─── ÉCRAN CONNEXION ─── */
function LoginScreen({ onLogin }) {
  const [email,setEmail]=useState("");
  const [mdp,setMdp]=useState("");
  const [err,setErr]=useState("");
  const [load,setLoad]=useState(false);
  const login=()=>{setErr("");setLoad(true);setTimeout(()=>{const c=COMPTES.find(c=>c.email===email.trim()&&c.mdp===mdp);if(c)onLogin(c);else{setErr("Identifiants incorrects");setLoad(false);}},500);};
  return (
    <div style={{height:"100vh",background:"var(--bg)",overflowY:"auto",paddingTop:"var(--st)"}}>
      {/* Bandeau supérieur */}
      <div style={{background:"var(--blue)",padding:"44px 24px 32px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:44,height:44,background:"rgba(255,255,255,.2)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏗</div>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-.02em"}}>BuildEasy</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.75)",marginTop:1}}>Logiciel de gestion de chantier</div>
          </div>
        </div>
        <div style={{fontSize:15,color:"rgba(255,255,255,.9)",fontWeight:500,lineHeight:1.5}}>
          Pilotez vos chantiers depuis le terrain. Simple, rapide, efficace.
        </div>
      </div>

      <div style={{padding:"28px 24px",display:"flex",flexDirection:"column",gap:16}}>
        <Fld label="Email professionnel">
          <input className="inp" type="email" inputMode="email" autoComplete="email"
            placeholder="prenom.nom@entreprise.fr" value={email}
            onChange={e=>{setEmail(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&login()}/>
        </Fld>
        <Fld label="Mot de passe">
          <input className="inp" type="password" autoComplete="current-password"
            placeholder="••••••••" value={mdp}
            onChange={e=>{setMdp(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&login()}/>
        </Fld>
        {err&&<div style={{padding:"12px 14px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:"var(--r2)",fontSize:13,color:"var(--err)",fontWeight:600}}>⚠ {err}</div>}
        <button className="btn btn-blue btn-fw" style={{marginTop:4,fontSize:16}} onClick={login} disabled={!email||!mdp||load}>
          {load?"Connexion en cours…":"Se connecter →"}
        </button>
      </div>

      {/* Comptes démo */}
      <div style={{padding:"0 24px 48px"}}>
        <div className="div" style={{marginBottom:20}}/>
        <div className="sec" style={{marginBottom:14}}>Accès démonstration</div>
        <div className="col" style={{gap:8}}>
          {COMPTES.map(c=>{
            const r=ROLES[c.role];
            return (
              <div key={c.id} className="card tap"
                style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}
                onClick={()=>{setLoad(true);setTimeout(()=>onLogin(c),250);}}>
                <Av nom={c.nom} color={r.color} size={40}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{c.nom}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{r.label}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:"var(--t4)",fontVariantNumeric:"tabular-nums"}}>{c.mdp}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── ÉCRAN ACCUEIL ─── */
function HomeScreen({ user, perms, data, onNav, onSheet }) {
  const { chantiers, taches, factures, avenants, punch, equipe, rapports } = data;
  const role = ROLES[user.role];
  const myCh = user.role==="admin" ? chantiers : chantiers.filter(c=>user.chIds.includes(c.id));
  const actifs = myCh.filter(c=>c.statut==="actif");
  const retards = factures.filter(f=>f.statut==="retard");
  const encaisse = factures.filter(f=>f.statut==="encaissee").reduce((s,f)=>s+f.mt,0);
  const avAttente = avenants.filter(a=>a.statut==="attente");
  const resOuverts = punch.filter(p=>p.statut!=="clos"&&(user.role==="admin"||user.chIds.includes(p.chId)));
  const myTaches = taches.filter(t=>(user.role==="admin"||user.chIds.includes(t.chId))&&t.statut!=="fait");
  const monChantier = myCh.find(c=>c.statut==="actif");
  const equipePresente = equipe.filter(m=>m.statut==="present");
  const equipeRetard = equipe.filter(m=>m.statut==="retard");
  const equipeAbsente = equipe.filter(m=>m.statut==="absent");

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      {/* Header identité */}
      <div style={{padding:"18px 20px 16px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div className="row">
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Av nom={user.nom} color={role.color} size={44}/>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:"var(--t1)"}}>Bonjour, {user.nom.split(" ")[0]}</div>
              <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{role.label} · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
            </div>
          </div>
          {retards.length>0&&(
            <div style={{padding:"5px 10px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:"var(--r)"}}>
              <span style={{fontSize:11,fontWeight:700,color:"var(--err)"}}>⚠ {retards.length} retard{retards.length>1?"s":""}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:20}}>

        {/* ── CHANTIER DU JOUR (employé/chef) ── */}
        {(user.role==="employe"||user.role==="chef")&&monChantier&&(
          <div className="u0">
            <div className="sec">Chantier du jour</div>
            <div className="card" style={{padding:"18px",borderLeft:"4px solid var(--blue)"}}>
              <div className="row" style={{marginBottom:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:4}}>{monChantier.nom}</div>
                  <div style={{fontSize:13,color:"var(--t3)",marginBottom:6}}>📍 {monChantier.adresse}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {monChantier.rdv&&<div style={{fontSize:12,fontWeight:600,color:"var(--blue)",background:"var(--blue-l)",border:"1px solid var(--blue-b)",padding:"3px 8px",borderRadius:"var(--r)"}}>🕐 RDV {monChantier.rdv}</div>}
                    <MeteoTag meteo={monChantier.meteo}/>
                  </div>
                </div>
                <div style={{textAlign:"center",flexShrink:0,marginLeft:12}}>
                  <div style={{fontSize:28,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{monChantier.av}%</div>
                  <div style={{fontSize:10,color:"var(--t4)"}}>avancement</div>
                </div>
              </div>
              <PBar v={monChantier.av} h={6}/>
              {monChantier.note&&<div style={{marginTop:10,padding:"8px 12px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)",fontWeight:600}}>⚠ {monChantier.note}</div>}
              {/* Tâches du jour */}
              {myTaches.filter(t=>t.chId===monChantier.id).length>0&&(
                <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--g2)"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Tâches du jour</div>
                  {myTaches.filter(t=>t.chId===monChantier.id).slice(0,3).map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--g2)"}}>
                      <div style={{width:20,height:20,borderRadius:6,border:"2px solid "+(t.statut==="fait"?"var(--ok)":"var(--g3)"),background:t.statut==="fait"?"var(--ok)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {t.statut==="fait"&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:t.statut==="fait"?"var(--t4)":"var(--t1)",textDecoration:t.statut==="fait"?"line-through":"none"}}>{t.titre}</div>
                        <div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>{t.resp} · {t.debut} → {t.fin}</div>
                      </div>
                      {t.prio===1&&<Tag label="Urgent" type="err"/>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── KPIs admin ── */}
        {user.role==="admin"&&(
          <div className="u0">
            <div className="sec">Vue d'ensemble</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Kpi label="Chantiers actifs" value={actifs.length} sub={"sur "+chantiers.length+" au total"} color="var(--blue)" onClick={()=>onNav("chantiers")}/>
              <Kpi label="Encaissé" value={EUR(encaisse)} sub={retards.length>0?retards.length+" retard(s)":"Tréso à jour"} color={retards.length>0?"var(--err)":"var(--ok)"}/>
              <Kpi label="Avenants en attente" value={avAttente.length} sub="signature MOA requise" color={avAttente.length>0?"var(--warn)":"var(--t4)"} onClick={()=>onNav("avenants")}/>
              <Kpi label="Réserves ouvertes" value={resOuverts.length} sub="punch list active" color={resOuverts.length>0?"var(--err)":"var(--ok)"} onClick={()=>onNav("punch")}/>
            </div>
          </div>
        )}

        {/* ── Alertes ── */}
        {retards.length>0&&(
          <div className="u1">
            <div style={{padding:"14px 16px",background:"var(--err-l)",borderRadius:"var(--r2)",border:"1px solid var(--err-b)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--err)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Factures en retard</div>
              {retards.map(f=>(
                <div key={f.id} className="row" style={{padding:"5px 0",borderBottom:"1px solid var(--err-b)"}}>
                  <span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>{f.client}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--err)"}}>{EUR(f.mt)}</span>
                </div>
              ))}
              <button className="btn btn-out btn-sm" style={{marginTop:10,width:"100%"}} onClick={()=>onNav("finances")}>Gérer les factures</button>
            </div>
          </div>
        )}

        {/* ── Avenants MOA ── */}
        {user.role==="client"&&avAttente.length>0&&(
          <div className="u1">
            <div style={{padding:"14px 16px",background:"var(--warn-l)",borderRadius:"var(--r2)",border:"1px solid var(--warn-b)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--warn)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Avenants à signer</div>
              {avAttente.filter(a=>user.chIds.includes(a.chId)).map(a=>(
                <div key={a.id} className="row" style={{padding:"5px 0",borderBottom:"1px solid var(--warn-b)"}}>
                  <span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>{a.titre}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{EUR(a.mt)}</span>
                </div>
              ))}
              <button className="btn btn-warn btn-sm" style={{marginTop:10,width:"100%"}} onClick={()=>onNav("avenants")}>Voir et signer</button>
            </div>
          </div>
        )}

        {/* ── Suivi équipe (chef) ── */}
        {user.role==="chef"&&(
          <div className="u2">
            <div className="sec">Équipe aujourd'hui</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              {[{l:"Présents",v:equipePresente.length,c:"var(--ok)"},{l:"Retards",v:equipeRetard.length,c:"var(--warn)"},{l:"Absents",v:equipeAbsente.length,c:"var(--err)"}].map((m,i)=>(
                <div key={i} className="card" style={{padding:"12px",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:800,color:m.c,marginBottom:3}}>{m.v}</div>
                  <div style={{fontSize:11,color:"var(--t3)"}}>{m.l}</div>
                </div>
              ))}
            </div>
            {equipeRetard.length>0&&(
              <div style={{padding:"10px 14px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r2)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--warn)",marginBottom:6}}>En retard</div>
                {equipeRetard.map(m=>(
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <Av nom={m.nom} color="var(--warn)" size={28}/>
                    <span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>{m.nom}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Chantiers actifs ── */}
        {actifs.length>0&&(
          <div className="u2">
            <div className="row" style={{marginBottom:10}}>
              <div className="sec" style={{margin:0}}>Chantiers en cours</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>onNav("chantiers")}>Voir tout</button>
            </div>
            <div className="col" style={{gap:10}}>
              {actifs.slice(0,3).map(c=>{
                const p=PCT(c.dep,c.budget);
                return (
                  <div key={c.id} className="card" style={{padding:"16px",borderLeft:"3px solid "+(c.prio===1?"var(--err)":c.prio===2?"var(--warn)":"var(--ok)")}}>
                    <div className="row" style={{marginBottom:10}}>
                      <div style={{flex:1,paddingRight:12}}>
                        <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div>
                        <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{c.client} · Fin {c.fin}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:22,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{c.av}%</div>
                        {perms.montants&&<div style={{fontSize:11,color:p>75?"var(--err)":p>50?"var(--warn)":"var(--ok)",marginTop:2}}>Budget {p}%</div>}
                      </div>
                    </div>
                    <PBar v={c.av} h={6}/>
                    {c.note&&<div style={{marginTop:8,padding:"6px 10px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)",fontWeight:500}}>{c.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Actions rapides ── */}
        <div className="u3">
          <div className="sec">Actions rapides</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {perms.rapport&&(
              <div className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("rapport")}>
                <div style={{fontSize:22,marginBottom:8}}>📋</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Compte-rendu</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>Rapport journalier</div>
              </div>
            )}
            {perms.chat&&(
              <div className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onNav("chat")}>
                <div style={{fontSize:22,marginBottom:8}}>💬</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Messagerie</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>Chat chantier</div>
              </div>
            )}
            {perms.gererPunch&&(
              <div className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onNav("punch")}>
                <div style={{fontSize:22,marginBottom:8}}>🔧</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Réserves</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>{resOuverts.length} ouvertes</div>
              </div>
            )}
            {perms.creerChantier&&(
              <div className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("chantier")}>
                <div style={{fontSize:22,marginBottom:8}}>🏗</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Nouveau chantier</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>Créer un dossier</div>
              </div>
            )}
            {perms.creerAv&&(
              <div className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("avenant")}>
                <div style={{fontSize:22,marginBottom:8}}>📄</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Avenant</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>Travaux supplémentaires</div>
              </div>
            )}
            {perms.heures&&(
              <div className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onNav("heures")}>
                <div style={{fontSize:22,marginBottom:8}}>⏱</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Planning heures</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>Semaine équipe</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CHANTIERS ─── */
function ChantiersScreen({ user, perms, chantiers, taches, onEditC }) {
  const [q,setQ]=useState("");
  const [f,setF]=useState("tous");
  const visible=(user.role==="admin"?chantiers:chantiers.filter(c=>user.chIds.includes(c.id)))
    .filter(c=>(f==="tous"||c.statut===f)&&(c.nom+c.client).toLowerCase().includes(q.toLowerCase()));
  const prioBorder={1:"var(--err)",2:"var(--warn)",3:"var(--ok)"};

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"16px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",position:"sticky",top:0,zIndex:10}}>
        <input className="inp" placeholder="🔍 Rechercher un chantier..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:10}}/>
        <div className="sx">
          {[["tous","Tous"],["actif","En cours"],["planif","Planifié"],["livre","Livré"]].map(([v,l])=>(
            <button key={v} onClick={()=>setF(v)} style={{padding:"7px 16px",borderRadius:"var(--r)",border:"1.5px solid "+(f===v?"var(--blue)":"var(--g2)"),background:f===v?"var(--blue-l)":"var(--w)",color:f===v?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>🏗</div><p style={{fontSize:14,fontWeight:600}}>Aucun chantier</p></div>}
        {visible.map((c,i)=>{
          const p=PCT(c.dep,c.budget);
          const chTaches=taches.filter(t=>t.chId===c.id);
          const tFait=chTaches.filter(t=>t.statut==="fait").length;
          return (
            <div key={c.id} className="card u0" style={{padding:"16px",borderLeft:"4px solid "+(prioBorder[c.prio]||"var(--g3)"),animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:10}}>
                <div style={{flex:1,paddingRight:12,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{c.client} · {c.adresse}</div>
                </div>
                <Tag label={c.statut==="actif"?"En cours":c.statut==="livre"?"Livré":"Planifié"} type={c.statut==="actif"?"blue":c.statut==="livre"?"ok":"gray"}/>
              </div>
              {c.corps&&<div style={{marginBottom:10}}><Tag label={c.corps} type="gray"/></div>}
              <MeteoTag meteo={c.meteo}/>
              <div style={{marginTop:10}}>
                <div className="row" style={{marginBottom:5}}>
                  <span style={{fontSize:12,color:"var(--t3)"}}>Avancement physique</span>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--t1)"}}>{c.av}%</span>
                </div>
                <PBar v={c.av} h={6}/>
              </div>
              {perms.montants&&(
                <div style={{marginTop:8}}>
                  <div className="row" style={{marginBottom:5}}>
                    <span style={{fontSize:12,color:"var(--t3)"}}>Consommation budget</span>
                    <span style={{fontSize:12,fontWeight:700,color:p>75?"var(--err)":p>50?"var(--warn)":"var(--ok)"}}>{EUR(c.dep)} / {EUR(c.budget)}</span>
                  </div>
                  <PBar v={p} color={p>75?"#DC2626":p>50?"#D97706":"#059669"} h={4}/>
                </div>
              )}
              <div className="row" style={{marginTop:10,fontSize:11,color:"var(--t4)"}}>
                <span>📅 {c.debut} → {c.fin}</span>
                <span>✅ {tFait}/{chTaches.length} tâches · 👷 {c.equipe.length}</span>
              </div>
              {c.note&&<div style={{marginTop:8,padding:"8px 10px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)",fontWeight:500}}>⚠ {c.note}</div>}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                {c.tel&&perms.tels&&<a href={"tel:"+c.tel} style={{textDecoration:"none",flex:1}}><button className="btn btn-out btn-sm btn-fw">📞 Appeler</button></a>}
                {perms.modChantier&&(
                  <select className="inp" style={{height:38,fontSize:12,flex:1}} value={c.statut} onChange={e=>onEditC(c.id,"statut",e.target.value)}>
                    <option value="planif">Planifié</option>
                    <option value="actif">En cours</option>
                    <option value="livre">Livré</option>
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── TÂCHES ─── */
function TachesScreen({ user, perms, taches, chantiers, onEditT }) {
  const [f,setF]=useState("tous");
  const visible=(user.role==="admin"?taches:
    user.role==="employe"?taches.filter(t=>user.chIds.includes(t.chId)&&t.resp===user.nom.split(" ")[0]):
    taches.filter(t=>user.chIds.includes(t.chId)))
    .filter(t=>f==="tous"||t.statut===f);
  const statColor={fait:"var(--ok)",en_cours:"var(--blue)",planif:"var(--t4)"};

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div className="sx">
          {[["tous","Toutes"],["en_cours","En cours"],["planif","Planifiées"],["fait","Terminées"]].map(([v,l])=>(
            <button key={v} onClick={()=>setF(v)} style={{padding:"7px 16px",borderRadius:"var(--r)",border:"1.5px solid "+(f===v?"var(--blue)":"var(--g2)"),background:f===v?"var(--blue-l)":"var(--w)",color:f===v?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>✅</div><p style={{fontSize:14,fontWeight:600}}>Aucune tâche</p></div>}
        {visible.map((t,i)=>{
          const ch=chantiers.find(c=>c.id===t.chId);
          const sc=statColor[t.statut]||"var(--t4)";
          return (
            <div key={t.id} className="card u0" style={{padding:"14px 16px",borderLeft:"3px solid "+sc,animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:8}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{t.titre}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"} · {t.resp||"—"}</div>
                  <div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>{t.debut} → {t.fin} · {t.duree}j</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                  <Tag label={t.statut==="fait"?"Terminé":t.statut==="en_cours"?"En cours":"Planifié"} type={t.statut==="fait"?"ok":t.statut==="en_cours"?"blue":"gray"}/>
                  {t.prio===1&&<Tag label="Urgent" type="err"/>}
                </div>
              </div>
              {perms.modTache&&(
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  {[["planif","Planifié"],["en_cours","En cours"],["fait","Terminé"]].map(([sv,sl])=>(
                    <button key={sv} onClick={()=>onEditT(t.id,"statut",sv)}
                      style={{flex:1,height:34,borderRadius:"var(--r)",border:"1.5px solid "+(t.statut===sv?sc:"var(--g2)"),background:t.statut===sv?sc+"18":"var(--w)",color:t.statut===sv?sc:"var(--t3)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .12s"}}>
                      {sl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── FINANCES ─── */
function FinancesScreen({ user, perms, factures, chantiers }) {
  if(!perms.finances) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p><p style={{fontSize:13,color:"var(--t4)"}}>Module financier non disponible pour ce profil.</p></div>;
  const total=factures.reduce((s,f)=>s+f.mt,0);
  const enc=factures.filter(f=>f.statut==="encaissee").reduce((s,f)=>s+f.mt,0);
  const att=factures.filter(f=>f.statut==="emise").reduce((s,f)=>s+f.mt,0);
  const ret=factures.filter(f=>f.statut==="retard").reduce((s,f)=>s+f.mt,0);
  const sfMap={encaissee:{l:"Encaissée",t:"ok"},emise:{l:"Émise",t:"blue"},retard:{l:"En retard",t:"err"}};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{l:"Total facturé",v:EUR(total),c:"var(--t1)"},{l:"Encaissé",v:EUR(enc),c:"var(--ok)"},{l:"En attente",v:EUR(att),c:"var(--blue)"},{l:"En retard",v:EUR(ret),c:ret>0?"var(--err)":"var(--t4)"}].map((m,i)=>(
            <div key={i} className="card u0" style={{padding:"14px 16px",animationDelay:i*.04+"s"}}>
              <div style={{fontSize:20,fontWeight:800,color:m.c,letterSpacing:"-.02em",marginBottom:3}}>{m.v}</div>
              <div style={{fontSize:12,color:"var(--t3)"}}>{m.l}</div>
            </div>
          ))}
        </div>
        <div className="sec">Détail des factures</div>
        {factures.map((f,i)=>{
          const sf=sfMap[f.statut]||{l:f.statut,t:"gray"};
          return (
            <div key={f.id} className="card u0" style={{padding:"14px 16px",animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--t1)"}}>{EUR(f.mt)}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{f.id} · {f.ch}</div>
                  <div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>{f.client} · Éch. {f.ech}</div>
                </div>
                <Tag label={sf.l} type={sf.t}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── CHAT ─── */
function ChatScreen({ user, perms, messages, chantiers, onSend }) {
  if(!perms.chat) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const myCh=(user.role==="admin"?chantiers:chantiers.filter(c=>user.chIds.includes(c.id))).filter(c=>c.statut==="actif");
  const [chId,setChId]=useState(myCh[0]?.id||"");
  const [txt,setTxt]=useState("");
  const ref=useRef(null);
  const msgs=messages.filter(m=>m.chId===parseInt(chId));
  const ch=chantiers.find(c=>c.id===parseInt(chId));
  const roleCol={admin:"#2563EB",chef:"#0891B2",employe:"#059669",client:"#D97706"};

  useEffect(()=>{ ref.current?.scrollIntoView({behavior:"smooth"}); },[msgs.length,chId]);

  const send=()=>{
    const t=txt.trim();
    if(!t||!chId) return;
    onSend({chId:parseInt(chId),auteur:user.nom,role:user.role,txt:t,h:new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),d:new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})});
    setTxt("");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"12px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",flexShrink:0}}>
        <select className="inp" style={{height:40,fontSize:13}} value={chId} onChange={e=>setChId(e.target.value)}>
          {myCh.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        {ch&&<div style={{fontSize:11,color:"var(--t4)",marginTop:6}}>📍 {ch.adresse} · {ch.equipe.join(", ")||"—"}</div>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
        {msgs.length===0&&<div className="empty"><div style={{fontSize:40}}>💬</div><p style={{fontSize:13}}>Aucun message sur ce chantier</p></div>}
        {msgs.map((m,i)=>{
          const isMe=m.auteur===user.nom;
          const col=roleCol[m.role]||"#94A3B8";
          const showDate=i===0||m.d!==msgs[i-1]?.d;
          return (
            <div key={m.id}>
              {showDate&&<div style={{textAlign:"center",margin:"4px 0"}}><span style={{fontSize:10,fontWeight:600,color:"var(--t4)",background:"var(--g1)",padding:"3px 10px",borderRadius:99,border:"1px solid var(--g2)"}}>{m.d}</span></div>}
              <div style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",gap:3}}>
                {!isMe&&<span style={{fontSize:10,fontWeight:700,color:col,marginLeft:4}}>{m.auteur} · {ROLES[m.role]?.label}</span>}
                <div style={{maxWidth:"78%",padding:"10px 13px",fontSize:14,lineHeight:1.5,borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",background:isMe?"var(--blue)":"var(--w)",color:isMe?"#fff":"var(--t1)",border:isMe?"none":"1px solid var(--g2)",boxShadow:"var(--sh)"}}>
                  {m.txt}
                </div>
                <span style={{fontSize:10,color:"var(--t4)",margin:isMe?"0 4px 0 0":"0 0 0 4px"}}>{m.h}</span>
              </div>
            </div>
          );
        })}
        <div ref={ref}/>
      </div>
      {perms.msg&&(
        <div style={{padding:"12px 16px",borderTop:"1px solid var(--g2)",display:"flex",gap:8,flexShrink:0,background:"var(--w)",paddingBottom:"calc(12px + var(--sb) + 72px)"}}>
          <input className="inp" style={{flex:1,height:42,fontSize:14}} placeholder="Message…" value={txt}
            onChange={e=>setTxt(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
          <button className="btn btn-blue btn-sq" style={{height:42,width:42}} onClick={send} disabled={!txt.trim()||!chId}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── AVENANTS ─── */
function AvenantsScreen({ user, perms, avenants, chantiers, onValider }) {
  if(!perms.avenants) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const visible=user.role==="client"?avenants.filter(a=>user.chIds.includes(a.chId)):avenants;
  const sfMap={signe:{l:"Signé",t:"ok"},attente:{l:"En attente",t:"warn"},refuse:{l:"Refusé",t:"err"}};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{l:"Signés",v:EUR(visible.filter(a=>a.statut==="signe").reduce((s,a)=>s+a.mt,0)),c:"var(--ok)"},{l:"En attente",v:EUR(visible.filter(a=>a.statut==="attente").reduce((s,a)=>s+a.mt,0)),c:"var(--warn)"}].map((m,i)=>(
            <div key={i} className="card" style={{padding:"14px 16px"}}><div style={{fontSize:20,fontWeight:800,color:m.c,marginBottom:3}}>{m.v}</div><div style={{fontSize:12,color:"var(--t3)"}}>{m.l}</div></div>
          ))}
        </div>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>📄</div><p style={{fontSize:14,fontWeight:600}}>Aucun avenant</p></div>}
        {visible.map((a,i)=>{
          const sf=sfMap[a.statut]||{l:a.statut,t:"gray"};
          const ch=chantiers.find(c=>c.id===a.chId);
          return (
            <div key={a.id} className="card u0" style={{padding:"16px",animationDelay:i*.05+"s"}}>
              <div className="row" style={{marginBottom:8}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:10,color:"var(--t4)",marginBottom:4,fontWeight:600}}>{a.ref}</div>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{a.titre}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:4}}>{ch?.nom||"—"} · Créé le {a.dc}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:800,color:"var(--t1)",marginBottom:5}}>{EUR(a.mt)}</div>
                  <Tag label={sf.l} type={sf.t}/>
                </div>
              </div>
              {a.desc&&<div style={{padding:"10px 12px",background:"var(--g1)",border:"1px solid var(--g2)",borderRadius:"var(--r2)",fontSize:13,color:"var(--t2)",lineHeight:1.5,marginBottom:8}}>{a.desc}</div>}
              {a.ds&&<div style={{fontSize:11,color:"var(--t4)"}}>Signé le {a.ds} par {a.par}</div>}
              {a.statut==="attente"&&perms.validerAv&&(
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button className="btn btn-ok btn-sm" style={{flex:1}} onClick={()=>onValider(a.id,"signe",user.nom)}>Signer l'avenant</button>
                  <button className="btn btn-err btn-sm" style={{flex:1}} onClick={()=>onValider(a.id,"refuse",user.nom)}>Refuser</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PLANNING HEURES ─── */
function HeuresScreen({ user, perms, heures, chantiers, onValider }) {
  if(!perms.heures) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const today=new Date();
  const [offset,setOffset]=useState(0);
  const getLundi=off=>{const d=new Date(today);const day=d.getDay();const diff=(day===0?-6:1-day)+off*7;d.setDate(d.getDate()+diff);d.setHours(0,0,0,0);return d;};
  const lundi=getLundi(offset);
  const JOURS=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const semaine=JOURS.map((_,i)=>{const d=new Date(lundi);d.setDate(lundi.getDate()+i);return d;});
  const isoStr=d=>isoD(d);
  const todayIso=isoD(today);
  const visible=user.role==="employe"?heures.filter(h=>h.nom===user.nom):heures;
  const parJour=semaine.map(d=>({date:d,iso:isoStr(d),entries:visible.filter(h=>h.date===isoStr(d)),total:visible.filter(h=>h.date===isoStr(d)).reduce((s,h)=>s+calcH(h),0)}));
  const totalSem=parJour.reduce((s,j)=>s+j.total,0);
  const maxH=Math.max(...parJour.map(j=>j.total),1);
  const [sel,setSel]=useState(todayIso);
  const detail=visible.filter(h=>h.date===sel);
  const totalNonVal=visible.filter(h=>!h.valide).length;
  const fmtSem=()=>{const fin=new Date(lundi);fin.setDate(lundi.getDate()+6);const f=d=>d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});return f(lundi)+" – "+f(fin);};

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      {/* Stats globales */}
      <div style={{padding:"16px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Total semaine",v:Math.round(totalSem*10)/10+"h",c:"var(--blue)"},{l:"Saisies",v:visible.length,c:"var(--t1)"},{l:"À valider",v:totalNonVal,c:totalNonVal>0?"var(--warn)":"var(--ok)"}].map((m,i)=>(
            <div key={i} style={{textAlign:"center",padding:"10px 6px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
              <div style={{fontSize:18,fontWeight:800,color:m.c,marginBottom:2}}>{m.v}</div>
              <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em"}}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
        {/* Navigation semaine */}
        <div className="card" style={{padding:"16px"}}>
          <div className="row" style={{marginBottom:14}}>
            <button className="btn btn-out btn-sm" onClick={()=>setOffset(o=>o-1)}>← Préc.</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{fmtSem()}</div>
              {offset!==0&&<button style={{fontSize:11,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",marginTop:4,fontFamily:"var(--f)",fontWeight:600}} onClick={()=>setOffset(0)}>Aujourd'hui</button>}
            </div>
            <button className="btn btn-out btn-sm" onClick={()=>setOffset(o=>o+1)}>Suiv. →</button>
          </div>
          {/* Graphe barres */}
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80}}>
            {parJour.map((j,i)=>{
              const isToday=j.iso===todayIso;
              const isSel=j.iso===sel;
              const barH=Math.max(j.total>0?(j.total/maxH)*68:2,2);
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}} onClick={()=>setSel(j.iso)}>
                  <span style={{fontSize:10,fontWeight:600,color:j.total>0?"var(--t2)":"var(--t4)"}}>{j.total>0?Math.round(j.total*10)/10+"h":""}</span>
                  <div style={{width:"100%",height:barH+"px",background:isSel?"var(--blue)":isToday?"var(--blue-b)":"var(--g2)",borderRadius:"4px 4px 0 0",transition:"all .2s"}}/>
                  <span style={{fontSize:10,fontWeight:isSel||isToday?700:400,color:isSel?"var(--blue)":isToday?"var(--t2)":"var(--t4)"}}>{JOURS[i]}</span>
                  <span style={{fontSize:9,color:"var(--t4)"}}>{j.date.getDate()}</span>
                </div>
              );
            })}
          </div>
          <div className="div" style={{marginTop:12,marginBottom:10}}/>
          <div className="row">
            <span style={{fontSize:12,color:"var(--t3)"}}>Total semaine</span>
            <span style={{fontSize:18,fontWeight:800,color:"var(--blue)"}}>{Math.round(totalSem*10)/10}<span style={{fontSize:12,fontWeight:400,color:"var(--t4)",marginLeft:3}}>h</span></span>
          </div>
        </div>

        {/* Détail du jour sélectionné */}
        <div>
          <div className="row" style={{marginBottom:10}}>
            <div className="sec" style={{margin:0}}>{new Date(sel+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>
          {detail.length===0?(
            <div className="card" style={{padding:"24px",textAlign:"center"}}>
              <p style={{fontSize:13,color:"var(--t4)"}}>Aucune activité enregistrée ce jour</p>
            </div>
          ):detail.map((h,i)=>{
            const hT=calcH(h);
            const ch=chantiers.find(c=>c.id===h.chId);
            return (
              <div key={h.id} className="card u0" style={{padding:"14px 16px",marginBottom:8,borderLeft:"3px solid "+(h.valide?"var(--ok)":"var(--warn)"),animationDelay:i*.04+"s"}}>
                <div className="row" style={{marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{h.nom}</div>
                    <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{hT}<span style={{fontSize:12,fontWeight:400,color:"var(--t4)",marginLeft:2}}>h</span></div>
                    <Tag label={h.valide?"Validé":"En attente"} type={h.valide?"ok":"warn"}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:h.desc?8:0}}>
                  {[{l:"Arrivée",v:h.arr},{l:"Départ",v:h.dep},{l:"Pause",v:h.pause+"min"}].map(item=>(
                    <div key={item.l} style={{flex:1,padding:"7px",background:"var(--g1)",borderRadius:"var(--r)",textAlign:"center",border:"1px solid var(--g2)"}}>
                      <div style={{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums",color:"var(--t1)"}}>{item.v}</div>
                      <div style={{fontSize:9,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:2}}>{item.l}</div>
                    </div>
                  ))}
                </div>
                {h.desc&&<div style={{fontSize:12,color:"var(--t2)"}}>{h.desc}</div>}
                {!h.valide&&user.role!=="employe"&&(
                  <button className="btn btn-ok btn-sm btn-fw" style={{marginTop:8}} onClick={()=>onValider(h.id,user.nom)}>✓ Valider cette journée</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Autres jours avec activité */}
        {parJour.filter(j=>j.iso!==sel&&j.entries.length>0).length>0&&(
          <div>
            <div className="sec">Autres jours de la semaine</div>
            {parJour.filter(j=>j.iso!==sel&&j.entries.length>0).map(j=>(
              <div key={j.iso} className="card tap" style={{padding:"12px 16px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setSel(j.iso)}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{new Date(j.iso+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric"})}</div>
                  <div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>{j.entries.length} saisie{j.entries.length>1?"s":""}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18,fontWeight:800,color:"var(--blue)"}}>{j.total}<span style={{fontSize:12,fontWeight:400,color:"var(--t4)",marginLeft:2}}>h</span></span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PUNCH LIST ─── */
function PunchScreen({ user, perms, punch, chantiers, onUpdate }) {
  if(!perms.punch) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const [f,setF]=useState("tous");
  const visible=(user.role==="admin"?punch:punch.filter(p=>user.chIds.includes(p.chId)))
    .filter(p=>f==="tous"||p.statut===f);
  const sfMap={ouvert:{l:"Ouvert",t:"err",c:"var(--err)"},encours:{l:"En cours",t:"warn",c:"var(--warn)"},clos:{l:"Clos",t:"ok",c:"var(--ok)"}};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[{l:"Ouvertes",v:punch.filter(p=>p.statut==="ouvert").length,c:"var(--err)"},{l:"En cours",v:punch.filter(p=>p.statut==="encours").length,c:"var(--warn)"},{l:"Closes",v:punch.filter(p=>p.statut==="clos").length,c:"var(--ok)"}].map((m,i)=>(
            <div key={i} style={{textAlign:"center",padding:"10px 4px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
              <div style={{fontSize:20,fontWeight:800,color:m.c}}>{m.v}</div>
              <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:2}}>{m.l}</div>
            </div>
          ))}
        </div>
        <div className="sx">
          {[["tous","Toutes"],["ouvert","Ouvertes"],["encours","En cours"],["clos","Closes"]].map(([v,l])=>(
            <button key={v} onClick={()=>setF(v)} style={{padding:"7px 14px",borderRadius:"var(--r)",border:"1.5px solid "+(f===v?"var(--blue)":"var(--g2)"),background:f===v?"var(--blue-l)":"var(--w)",color:f===v?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>🎉</div><p style={{fontSize:14,fontWeight:600}}>Aucune réserve{f!=="tous"?" dans ce filtre":""}</p></div>}
        {visible.map((p,i)=>{
          const sf=sfMap[p.statut]||sfMap.ouvert;
          const ch=chantiers.find(c=>c.id===p.chId);
          return (
            <div key={p.id} className="card u0" style={{padding:"14px 16px",borderLeft:"3px solid "+sf.c,animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:10,color:"var(--t4)",marginBottom:3,fontWeight:600}}>{p.ref} · {p.corps}</div>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{p.titre}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{ch?.nom||"—"}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <Tag label={sf.l} type={sf.t}/>
                  <div style={{fontSize:11,color:"var(--t4)",marginTop:5}}>{p.prio===1?"Bloquant":p.prio===2?"Majeur":"Mineur"}</div>
                </div>
              </div>
              {p.desc&&<div style={{padding:"8px 10px",background:"var(--g1)",border:"1px solid var(--g2)",borderRadius:"var(--r2)",fontSize:13,color:"var(--t2)",lineHeight:1.5,marginBottom:8}}>{p.desc}</div>}
              <div style={{fontSize:11,color:"var(--t4)",marginBottom:perms.gererPunch&&p.statut!=="clos"?10:0}}>
                Signalé le {p.date} · {p.ass?"Attribué à "+p.ass:"Non attribué"}{p.clos?" · Clos le "+p.clos:""}
              </div>
              {perms.gererPunch&&p.statut!=="clos"&&(
                <div style={{display:"flex",gap:8}}>
                  {p.statut==="ouvert"&&<button className="btn btn-warn btn-sm" style={{flex:1}} onClick={()=>onUpdate(p.id,"encours")}>Prendre en charge</button>}
                  <button className="btn btn-ok btn-sm" style={{flex:1}} onClick={()=>onUpdate(p.id,"clos")}>Clore la réserve</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PLUS (équipe, rapports) ─── */
function PlusScreen({ user, perms, equipe, rapports, chantiers, onNav, onLogout }) {
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:20}}>
        {/* Liens modules secondaires */}
        <div>
          <div className="sec">Modules</div>
          <div className="col" style={{gap:6}}>
            {[
              perms.avenants&&{id:"avenants",  ico:"📄",l:"Avenants",              s:"Travaux supplémentaires"},
              perms.heures&&  {id:"heures",    ico:"⏱",l:"Planning heures",        s:"Semaine et validation"},
              perms.punch&&   {id:"punch",     ico:"🔧",l:"Punch list",            s:"Réserves et défauts"},
              perms.finances&&{id:"finances",  ico:"💶",l:"Finances",              s:"KPIs et factures"},
              perms.finances&&{id:"situations",ico:"📊",l:"Situations de travaux", s:"Facturation progressive"},
                              {id:"photos",    ico:"📷",l:"Photos chantier",       s:"Galerie et uploads"},
                              {id:"documents", ico:"📂",l:"Documents",             s:"Plans, devis, CCTP"},
              perms.chantiers&&{id:"gantt",    ico:"📅",l:"Planning Gantt",        s:"Vue calendrier par chantier"},
            ].filter(Boolean).map(item=>(
              <div key={item.id} className="card tap" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={()=>onNav(item.id)}>
                <div style={{width:40,height:40,background:"var(--blue-l)",borderRadius:"var(--r2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{item.ico}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--t1)"}}>{item.l}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{item.s}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        </div>

        {/* Équipe */}
        {perms.equipe&&(
          <div>
            <div className="sec">Équipe ({equipe.length} membres)</div>
            <div className="col" style={{gap:8}}>
              {equipe.map((m,i)=>{
                const dotColor={present:"var(--ok)",retard:"var(--warn)",absent:"var(--err)"}[m.statut]||"var(--g4)";
                return (
                  <div key={m.id} className="card" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{position:"relative"}}>
                      <Av nom={m.nom} color={i%2===0?"#2563EB":"#0891B2"} size={40}/>
                      <div style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:dotColor,border:"2px solid var(--w)"}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.nom}</div>
                      <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{m.fn}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                      <Tag label={m.statut==="present"?"Présent":m.statut==="retard"?"En retard":"Absent"} type={m.statut==="present"?"ok":m.statut==="retard"?"warn":"err"}/>
                      {m.tel&&perms.tels&&<a href={"tel:"+m.tel}><button className="btn btn-out btn-xs">Appeler</button></a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rapports */}
        {perms.rapports&&(
          <div>
            <div className="sec">Comptes-rendus récents</div>
            {rapports.length===0&&<div className="card" style={{padding:"24px",textAlign:"center"}}><p style={{fontSize:13,color:"var(--t4)"}}>Aucun compte-rendu</p></div>}
            {rapports.map((r,i)=>{
              const ch=chantiers.find(c=>c.id===parseInt(r.chId));
              return (
                <div key={r.id} className="card" style={{padding:"14px 16px",marginBottom:8}}>
                  <div className="row" style={{marginBottom:6}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{ch?.nom||"—"}</div>
                      <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{r.auteur} · {r.date} · {r.meteo}</div>
                    </div>
                  </div>
                  <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.55,marginBottom:r.incidents&&r.incidents!=="RAS"?8:0}}>{r.av}</div>
                  {r.incidents&&r.incidents!=="RAS"&&<div style={{padding:"8px 10px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r2)",fontSize:12,color:"var(--warn)",fontWeight:500}}>⚠ {r.incidents}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Compte utilisateur */}
        <div>
          <div className="div" style={{marginBottom:16}}/>
          <div className="card" style={{padding:"16px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <Av nom={user.nom} color={ROLES[user.role].color} size={44}/>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:"var(--t1)"}}>{user.nom}</div>
                <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{ROLES[user.role].label}</div>
                <div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>{user.email}</div>
              </div>
            </div>
          </div>
          <button className="btn btn-out btn-fw" onClick={onLogout}>Se déconnecter</button>
        </div>
      </div>
    </div>
  );
}

/* ─── APP PRINCIPALE ─── */
function AppMobile({ user, onLogout }) {
  const role=ROLES[user.role];
  const perms=PERMS[user.role];
  const [screen,setScreen]=useState("home");
  const [sheet,setSheet]=useState(null);
  const [chantiers,setChantiers]=useState(INIT_CH);
  const [taches,setTaches]=useState(INIT_TACHES);
  const [factures,setFactures]=useState(INIT_FAC);
  const [equipe,setEquipe]=useState(INIT_EQ);
  const [rapports,setRapports]=useState(INIT_RAPPORTS);
  const [messages,setMessages]=useState(INIT_MSG);
  const [avenants,setAvenants]=useState(INIT_AV);
  const [heures,setHeures]=useState(INIT_HEURES);
  const [punch,setPunch]=useState(INIT_PUNCH);
  const [incidents,setIncidents]=useState([]);
  const [photos]=useState(INIT_PHOTOS);
  const [docs]=useState(INIT_DOCS);
  const [situations]=useState(INIT_SITUATIONS);

  useEffect(() => {
    const load = async () => {
      const { data: ch } = await supabase.from('chantiers').select('*')
      if (ch?.length > 0) setChantiers(ch)
      const { data: ta } = await supabase.from('taches').select('*')
      if (ta?.length > 0) setTaches(ta)
      const { data: av } = await supabase.from('avenants').select('*')
      if (av?.length > 0) setAvenants(av)
      const { data: pu } = await supabase.from('punchlist').select('*')
      if (pu?.length > 0) setPunch(pu)
      const { data: ra } = await supabase.from('rapports').select('*')
      if (ra?.length > 0) setRapports(ra)
      const { data: me } = await supabase.from('messages').select('*')
      if (me?.length > 0) setMessages(me)
    }
    load()
  }, [])

  const data={chantiers,taches,factures,equipe,rapports,messages,avenants,heures,punch,incidents,photos,docs,situations};

  /* Actions */
  const editC=async(id,k,v)=>{
    setChantiers(p=>p.map(c=>c.id===id?{...c,[k]:v}:c));
    if(!SB_OK) return;
    const col={av:"avancement",dep:"depenses",prio:"priorite",statut:"statut"}[k]??k;
    let val=v;
    if(k==="prio") val=prioDb(v);
    if(k==="statut") val=chStatDb(v);
    const { error }=await supabase.from("chantiers").update({[col]:val}).eq("id",id);
    if(error) console.error("[BuildEasy] editC:", error.message);
  };
  const editT=async(id,k,v)=>{
    setTaches(p=>p.map(t=>t.id===id?{...t,[k]:v}:t));
    if(!SB_OK) return;
    const col={chId:"chantier_id",resp:"responsable"}[k]??k;
    let val=v;
    if(k==="statut") val=tStatDb(v);
    if(k==="prio") val=prioDb(v);
    const { error }=await supabase.from("taches").update({[col]:val}).eq("id",id);
    if(error) console.error("[BuildEasy] editT:", error.message);
  };
  const reloadChantiers=async()=>{
    const { data:ch, error }=await supabase.from("chantiers").select("*");
    if(!error&&ch&&ch.length>0) setChantiers(ch.map(mapCh));
  };
  const addC=async f=>{
    console.log('Tentative insertion Supabase...')
    const newCh={
      nom:f.nom,
      client:f.client,
      tel:f.tel||'',
      corps:f.corps||'',
      statut:'planif',
      avancement:0,
      budget:parseInt(f.budget)||0,
      depenses:0,
      debut:f.debut||'',
      fin:f.fin||'',
      priorite:parseInt(f.prio)||2,
      note:f.note||'',
      adresse:f.adresse||''
    };
    const { data, error }=await supabase.from('chantiers').insert([newCh]).select();
    console.log('Résultat:', data, 'Erreur:', error)
    if(data&&data.length>0){
      setChantiers(p=>[...p,data[0]]);
    }else{
      setChantiers(p=>[...p,{id:Date.now(),...newCh}]);
    }
  };
  const addT=async f=>{
    const local={id:Date.now(),chId:parseInt(f.chId),titre:f.titre,resp:f.resp||"",debut:f.debut||"",fin:f.fin||"",statut:"planif",duree:Math.max(1,f.duree||1),prio:parseInt(f.prio)||2,check:false};
    if(!SB_OK){ setTaches(p=>[...p,local]); return; }
    const row={chantier_id:parseInt(f.chId),titre:f.titre,responsable:f.resp||"",debut:f.debut||null,fin:f.fin||null,statut:"a_faire",duree:Math.max(1,f.duree||1),priorite:prioDb(f.prio)};
    const { data, error }=await supabase.from("taches").insert(row).select().single();
    if(error){ console.error("[BuildEasy] addT:", error.message); setTaches(p=>[...p,local]); return; }
    setTaches(p=>[...p,mapT(data)]);
  };
  const addR=async f=>{
    const local={id:Date.now(),chId:parseInt(f.chId)||0,date:f.date||"",auteur:f.auteur||"",meteo:f.meteo||"",av:f.av||"",incidents:f.incidents||"RAS",presences:f.presences||[],photos:0};
    if(!SB_OK){ setRapports(p=>[...p,local]); return; }
    const row={chantier_id:parseInt(f.chId)||0,date:isoD(f.date)||null,auteur:f.auteur||"",meteo:f.meteo||"",avancement:f.av||"",problemes:f.incidents||"RAS",presences:f.presences||[],photos:0};
    const { data, error }=await supabase.from("rapports").insert(row).select().single();
    if(error){ console.error("[BuildEasy] addR:", error.message); setRapports(p=>[...p,local]); return; }
    setRapports(p=>[...p,mapR(data)]);
  };
  const sendMsg=async m=>{
    const local={id:Date.now(),...m};
    if(!SB_OK){ setMessages(p=>[...p,local]); return; }
    const row={chantier_id:m.chId,auteur:m.auteur,role:m.role||"",texte:m.txt,heure:m.h||"",date:isoD(m.d)||null};
    const { data, error }=await supabase.from("messages").insert(row).select().single();
    if(error){ console.error("[BuildEasy] sendMsg:", error.message); setMessages(p=>[...p,local]); return; }
    setMessages(p=>[...p,mapM(data)]);
  };
  const addAv=async f=>{
    const local={id:Date.now(),...f};
    if(!SB_OK){ setAvenants(p=>[...p,local]); return; }
    const row={chantier_id:f.chId,titre:f.titre,description:f.desc||"",montant:parseInt(f.mt)||0,statut:"en_attente",date_creation:isoD(f.dc)||null,date_validation:null,valide_par:""};
    const { data, error }=await supabase.from("avenants").insert(row).select().single();
    if(error){ console.error("[BuildEasy] addAv:", error.message); setAvenants(p=>[...p,local]); return; }
    setAvenants(p=>[...p,{...mapA(data),ref:f.ref||`AV-${data.id}`}]);
  };
  const validerAv=async(id,s,par)=>{
    const ds=new Date().toLocaleDateString("fr-FR");
    setAvenants(p=>p.map(a=>a.id===id?{...a,statut:s,par,ds}:a));
    if(!SB_OK) return;
    const { error }=await supabase.from("avenants").update({statut:avStatDb(s),valide_par:par,date_validation:isoD(new Date())}).eq("id",id);
    if(error) console.error("[BuildEasy] validerAv:", error.message);
  };
  const validerH=async(id,par)=>{
    setHeures(p=>p.map(h=>h.id===id?{...h,valide:true}:h));
    if(!SB_OK) return;
    const { error }=await supabase.from("heures").update({valide:true,validee_par:par}).eq("id",id);
    if(error) console.error("[BuildEasy] validerH:", error.message);
  };
  const addPunch=async f=>{
    const local={id:Date.now(),...f};
    if(!SB_OK){ setPunch(p=>[...p,local]); return; }
    const row={chantier_id:f.chId,titre:f.titre,description:f.desc||"",categorie:f.corps||"Autre",priorite:prioDb(f.prio),statut:"ouvert",signale_par:f.sig||"",date_signalement:isoD(new Date()),date_resolution:null,assigne_a:f.ass||"",photos:0};
    const { data, error }=await supabase.from("punchlist").insert(row).select().single();
    if(error){ console.error("[BuildEasy] addPunch:", error.message); setPunch(p=>[...p,local]); return; }
    setPunch(p=>[...p,{...mapP(data),ref:f.ref||`RES-${data.id}`}]);
  };
  const updatePunch=async(id,s)=>{
    const clos=s==="clos"?new Date().toLocaleDateString("fr-FR"):"";
    setPunch(p=>p.map(i=>i.id===id?{...i,statut:s,clos}:i));
    if(!SB_OK) return;
    const row={statut:punchStatDb(s),date_resolution:s==="clos"?isoD(new Date()):null};
    const { error }=await supabase.from("punchlist").update(row).eq("id",id);
    if(error) console.error("[BuildEasy] updatePunch:", error.message);
  };
  const addIncident=f=>setIncidents(p=>[...p,{id:Date.now(),...f}]);

  const retards=factures.filter(f=>f.statut==="retard").length;
  const avAtt=avenants.filter(a=>a.statut==="attente"&&(user.role==="admin"||user.chIds.includes(a.chId))).length;
  const punchOuv=punch.filter(p=>p.statut!=="clos"&&(user.role==="admin"||user.chIds.includes(p.chId))).length;

  /* Navigation */
  const TABS=[
    {id:"home",    l:"Accueil", ico:<IcoHome/>},
    perms.chantiers&&{id:"chantiers",l:"Chantiers",ico:<IcoBuild/>},
    {id:"taches",  l:"Tâches",  ico:<IcoTask/>, badge:taches.filter(t=>(user.role==="admin"||user.chIds.includes(t.chId))&&t.statut!=="fait"&&t.prio===1).length},
    perms.chat&&{id:"chat",     l:"Messages",ico:<IcoChat/>},
    {id:"plus",    l:"Plus",    ico:<IcoMore/>, badge:avAtt+punchOuv},
  ].filter(Boolean);

  const renderFAB=()=>{
    const m={chantiers:perms.creerChantier?"chantier":null,taches:perms.creerTache?"tache":null};
    const a=m[screen]||(screen==="home"&&perms.rapport?"rapport":null);
    return (
      <div className="fab">
        <button className="fab-btn" onClick={()=>setSheet("incident")} title="Signaler un problème">⚠</button>
        <div className="fab-lbl">Incident</div>
        {a&&(
          <>
            <button className="fab-btn" style={{marginTop:8,background:"var(--blue)"}} onClick={()=>setSheet(a)} title="Créer">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </>
        )}
      </div>
    );
  };

  const renderScreen=()=>{
    switch(screen){
      case "home":      return <HomeScreen user={user} perms={perms} data={data} onNav={setScreen} onSheet={setSheet}/>;
      case "chantiers": return <ChantiersScreen user={user} perms={perms} chantiers={chantiers} taches={taches} onEditC={editC}/>;
      case "taches":    return <TachesScreen user={user} perms={perms} taches={taches} chantiers={chantiers} onEditT={editT}/>;
      case "finances":  return <FinancesScreen user={user} perms={perms} factures={factures} chantiers={chantiers}/>;
      case "chat":      return <ChatScreen user={user} perms={perms} messages={messages} chantiers={chantiers} onSend={sendMsg}/>;
      case "avenants":    return <AvenantsScreen user={user} perms={perms} avenants={avenants} chantiers={chantiers} onValider={validerAv}/>;
      case "heures":      return <HeuresScreen user={user} perms={perms} heures={heures} chantiers={chantiers} onValider={validerH}/>;
      case "punch":       return <PunchScreen user={user} perms={perms} punch={punch} chantiers={chantiers} onUpdate={updatePunch}/>;
      case "photos":      return <PhotosScreen user={user} photos={photos} chantiers={chantiers}/>;
      case "documents":   return <DocumentsScreen user={user} docs={docs} chantiers={chantiers}/>;
      case "situations":  return <SituationsScreen user={user} perms={perms} situations={situations} chantiers={chantiers}/>;
      case "gantt":       return <GanttScreen user={user} taches={taches} chantiers={chantiers}/>;
      case "plus":        return <PlusScreen user={user} perms={perms} equipe={equipe} rapports={rapports} chantiers={chantiers} onNav={setScreen} onLogout={onLogout}/>;
      default: return null;
    }
  };

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",background:"var(--bg)"}}>
      {/* Header */}
      <div style={{background:"var(--w)",borderBottom:"1px solid var(--g2)",paddingTop:"var(--st)",paddingLeft:20,paddingRight:20,paddingBottom:12,flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,background:"var(--blue)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span style={{fontSize:16,fontWeight:800,letterSpacing:"-.02em",color:"var(--t1)"}}>BuildEasy</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            {retards>0&&<div style={{padding:"4px 10px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:"var(--r)",fontSize:11,fontWeight:700,color:"var(--err)"}}>⚠ {retards} retard{retards>1?"s":""}</div>}
            <div style={{padding:"5px 10px",background:role.color+"15",border:"1px solid "+role.color+"35",borderRadius:"var(--r)"}}>
              <span style={{fontSize:11,fontWeight:800,color:role.color}}>{role.abbr}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{flex:1,overflow:"hidden"}}>{renderScreen()}</div>

      {/* FAB signalement */}
      {renderFAB()}

      {/* Bottom navigation */}
      <div className="nav">
        {TABS.map(tab=>(
          <div key={tab.id} className={"nt "+(screen===tab.id?"nt-on":"nt-off")} onClick={()=>setScreen(tab.id)}>
            <div className="nt-ico">{tab.ico}</div>
            <div className="nt-lbl">{tab.l}</div>
            {(tab.badge||0)>0&&<div className="nt-dot"/>}
          </div>
        ))}
      </div>

      {/* Sheets */}
      {sheet==="rapport"  &&perms.rapport    &&<SheetRapport  chantiers={chantiers} user={user} onClose={()=>setSheet(null)} onSave={addR}/>}
      {sheet==="chantier" &&perms.creerChantier&&<SheetChantier onClose={()=>setSheet(null)} onSave={addC}/>}
      {sheet==="tache"    &&perms.creerTache &&<SheetTache    chantiers={chantiers} onClose={()=>setSheet(null)} onSave={addT}/>}
      {sheet==="avenant"  &&perms.creerAv    &&<SheetAvenant  chantiers={chantiers} onClose={()=>setSheet(null)} onSave={addAv}/>}
      {sheet==="punch"    &&perms.gererPunch &&<SheetPunch    chantiers={chantiers} equipe={equipe} user={user} onClose={()=>setSheet(null)} onSave={addPunch}/>}
      {sheet==="incident"                    &&<SheetIncident chantiers={chantiers} user={user} onClose={()=>setSheet(null)} onSave={addIncident}/>}
    </div>
  );
}

/* ─── ÉCRAN PHOTOS ─── */
function PhotosScreen({ user, photos, chantiers }) {
  const [chId,setChId]=useState("tous");
  const [tag,setTag]=useState("tous");
  const visible=(chId==="tous"?photos:photos.filter(p=>p.chId===parseInt(chId)))
    .filter(p=>tag==="tous"||p.tags.includes(tag));
  const allTags=[...new Set(photos.flatMap(p=>p.tags))];
  const typeIco={devis:"📋",plan:"📐",cctp:"📄",rapport:"📋",securite:"⛑️",admin:"🗂️"};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <select className="inp" style={{flex:1,height:38,fontSize:13}} value={chId} onChange={e=>setChId(e.target.value)}>
            <option value="tous">Tous les chantiers</option>
            {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div className="sx">
          <button onClick={()=>setTag("tous")} style={{padding:"5px 12px",borderRadius:"var(--r)",border:"1.5px solid "+(tag==="tous"?"var(--blue)":"var(--g2)"),background:tag==="tous"?"var(--blue-l)":"var(--w)",color:tag==="tous"?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>Tous</button>
          {allTags.map(t=>(
            <button key={t} onClick={()=>setTag(t)} style={{padding:"5px 12px",borderRadius:"var(--r)",border:"1.5px solid "+(tag===t?"var(--blue)":"var(--g2)"),background:tag===t?"var(--blue-l)":"var(--w)",color:tag===t?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px"}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>📷</div><p style={{fontSize:14,fontWeight:600}}>Aucune photo</p></div>}
        {/* Grille photos */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
          {visible.map((p,i)=>{
            const ch=chantiers.find(c=>c.id===p.chId);
            return (
              <div key={p.id} className="card u0" style={{padding:0,overflow:"hidden",animationDelay:i*.04+"s",cursor:"pointer",aspectRatio:"1"}}>
                <div style={{background:"linear-gradient(135deg,var(--blue-l),var(--g2))",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8}}>
                  <div style={{fontSize:28,marginBottom:6}}>{p.thumb}</div>
                  <div style={{fontSize:9,color:"var(--t3)",textAlign:"center",fontWeight:600,lineHeight:1.3}}>{p.nom.replace(".jpg","").replace(".png","").slice(0,18)}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Liste détaillée */}
        <div className="sec">Détail</div>
        {visible.map((p,i)=>{
          const ch=chantiers.find(c=>c.id===p.chId);
          return (
            <div key={p.id} className="card u0" style={{padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,animationDelay:i*.04+"s"}}>
              <div style={{width:44,height:44,background:"var(--blue-l)",borderRadius:"var(--r2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{p.thumb}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nom}</div>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"} · {p.auteur}</div>
                <div style={{fontSize:10,color:"var(--t4)",marginTop:1}}>{p.date}{p.tache?" · "+p.tache:""}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                {p.tags.slice(0,2).map(t=><Tag key={t} label={t} type="blue"/>)}
              </div>
            </div>
          );
        })}
        {/* Bouton simulé d'upload */}
        <div style={{marginTop:12,padding:"20px",background:"var(--blue-l)",border:"2px dashed var(--blue-b)",borderRadius:"var(--r2)",textAlign:"center",cursor:"pointer"}}>
          <div style={{fontSize:28,marginBottom:8}}>📷</div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--blue)",marginBottom:4}}>Ajouter une photo</div>
          <div style={{fontSize:12,color:"var(--t3)"}}>Depuis votre téléphone · Taille max 20 Mo</div>
        </div>
      </div>
    </div>
  );
}

/* ─── ÉCRAN DOCUMENTS ─── */
function DocumentsScreen({ user, docs, chantiers }) {
  const [chId,setChId]=useState("tous");
  const [type,setType]=useState("tous");
  const visible=(chId==="tous"?docs:docs.filter(d=>d.chId===parseInt(chId)))
    .filter(d=>type==="tous"||d.type===type);
  const types=[...new Set(docs.map(d=>d.type))];
  const typeIco={devis:"📋",plan:"📐",cctp:"📄",rapport:"📑",securite:"⛑️",admin:"🗂️"};
  const typeLabel={devis:"Devis",plan:"Plans",cctp:"CCTP",rapport:"Rapports",securite:"Sécurité",admin:"Admin"};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",position:"sticky",top:0,zIndex:10}}>
        <select className="inp" style={{height:38,fontSize:13,marginBottom:10}} value={chId} onChange={e=>setChId(e.target.value)}>
          <option value="tous">Tous les chantiers</option>
          {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <div className="sx">
          <button onClick={()=>setType("tous")} style={{padding:"5px 12px",borderRadius:"var(--r)",border:"1.5px solid "+(type==="tous"?"var(--blue)":"var(--g2)"),background:type==="tous"?"var(--blue-l)":"var(--w)",color:type==="tous"?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>Tous</button>
          {types.map(t=>(
            <button key={t} onClick={()=>setType(t)} style={{padding:"5px 12px",borderRadius:"var(--r)",border:"1.5px solid "+(type===t?"var(--blue)":"var(--g2)"),background:type===t?"var(--blue-l)":"var(--w)",color:type===t?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
              {typeIco[t]||"📄"} {typeLabel[t]||t}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>📂</div><p style={{fontSize:14,fontWeight:600}}>Aucun document</p></div>}
        {visible.map((d,i)=>{
          const ch=chantiers.find(c=>c.id===d.chId);
          return (
            <div key={d.id} className="card tap u0" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14,animationDelay:i*.04+"s",cursor:"pointer"}}>
              <div style={{width:46,height:46,background:d.type==="securite"?"var(--err-l)":d.type==="devis"?"var(--ok-l)":"var(--blue-l)",borderRadius:"var(--r2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                {typeIco[d.type]||"📄"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.nom}</div>
                <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"} · {d.taille}</div>
                <div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>Ajouté le {d.date} par {d.auteur}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                <Tag label={typeLabel[d.type]||d.type} type={d.type==="securite"?"err":d.type==="devis"?"ok":"blue"}/>
                <button className="btn btn-out btn-xs" style={{fontSize:11}}>Ouvrir</button>
              </div>
            </div>
          );
        })}
        <div style={{marginTop:8,padding:"18px",background:"var(--blue-l)",border:"2px dashed var(--blue-b)",borderRadius:"var(--r2)",textAlign:"center",cursor:"pointer"}}>
          <div style={{fontSize:24,marginBottom:6}}>📎</div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--blue)",marginBottom:3}}>Ajouter un document</div>
          <div style={{fontSize:12,color:"var(--t3)"}}>PDF, Plans, CCTP, Devis · Max 50 Mo</div>
        </div>
      </div>
    </div>
  );
}

/* ─── ÉCRAN SITUATIONS DE TRAVAUX ─── */
function SituationsScreen({ user, perms, situations, chantiers }) {
  const visible=user.role==="client"
    ?situations.filter(s=>user.chIds.includes(s.chId))
    :situations;
  const totalEnc=visible.filter(s=>s.statut==="encaissee").reduce((t,s)=>t+s.mt,0);
  const totalEm=visible.filter(s=>s.statut==="emise").reduce((t,s)=>t+s.mt,0);
  const sfMap={encaissee:{l:"Encaissée",t:"ok"},emise:{l:"Émise",t:"blue"},retard:{l:"En retard",t:"err"}};

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div className="card" style={{padding:"14px 16px"}}>
            <div style={{fontSize:11,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:4}}>Encaissé</div>
            <div style={{fontSize:22,fontWeight:800,color:"var(--ok)",letterSpacing:"-.02em"}}>{EUR(totalEnc)}</div>
          </div>
          <div className="card" style={{padding:"14px 16px"}}>
            <div style={{fontSize:11,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:4}}>En attente</div>
            <div style={{fontSize:22,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{EUR(totalEm)}</div>
          </div>
        </div>

        {/* Par chantier */}
        {chantiers.filter(c=>visible.some(s=>s.chId===c.id)).map(c=>{
          const sits=visible.filter(s=>s.chId===c.id).sort((a,b)=>a.num-b.num);
          const totalCh=sits.reduce((t,s)=>t+s.mt,0);
          const pctCh=PCT(totalCh,c.budget);
          return (
            <div key={c.id} className="card" style={{padding:"16px"}}>
              <div className="row" style={{marginBottom:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--t1)"}}>{c.nom}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>Marché : {EUR(c.budget)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:16,fontWeight:800,color:pctCh>75?"var(--warn)":"var(--ok)"}}>{pctCh}%</div>
                  <div style={{fontSize:10,color:"var(--t4)"}}>facturé</div>
                </div>
              </div>
              <PBar v={pctCh} color={pctCh>90?"#DC2626":pctCh>60?"#D97706":"#059669"} h={6}/>
              <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
                {sits.map((sit,i)=>{
                  const sf=sfMap[sit.statut]||{l:sit.statut,t:"gray"};
                  return (
                    <div key={sit.id} style={{padding:"12px 14px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)",borderLeft:"3px solid "+(sit.statut==="encaissee"?"var(--ok)":sit.statut==="emise"?"var(--blue)":"var(--err)")}}>
                      <div className="row" style={{marginBottom:5}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{sit.titre}</div>
                          <div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>Avancement contractuel : {sit.av}%</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                          <div style={{fontSize:16,fontWeight:800,color:"var(--t1)"}}>{EUR(sit.mt)}</div>
                          <Tag label={sf.l} type={sf.t}/>
                        </div>
                      </div>
                      {sit.desc&&<div style={{fontSize:12,color:"var(--t2)",lineHeight:1.5}}>{sit.desc}</div>}
                      <div style={{fontSize:11,color:"var(--t4)",marginTop:5}}>Émise le {sit.date} · Éch. {sit.ech}</div>
                    </div>
                  );
                })}
              </div>
              {/* Solde restant à facturer */}
              <div style={{marginTop:12,padding:"10px 14px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>Solde restant à facturer</span>
                <span style={{fontSize:15,fontWeight:800,color:"var(--blue)"}}>{EUR(Math.max(0,c.budget-totalCh))}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ÉCRAN PLANNING GANTT ─── */
function GanttScreen({ user, taches, chantiers }) {
  const [chId,setChId]=useState(
    user.role==="admin"?chantiers[0]?.id:
    chantiers.find(c=>user.chIds.includes(c.id)&&c.statut==="actif")?.id||chantiers[0]?.id
  );
  const [vue,setVue]=useState("semaine"); // semaine | mois
  const chTaches=taches.filter(t=>t.chId===parseInt(chId));
  const ch=chantiers.find(c=>c.id===parseInt(chId));

  /* Jours à afficher */
  const today=new Date();
  const JOURS_SEM=["L","M","M","J","V","S","D"];
  const MOIS=["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

  /* Calendrier mai 2026 (mois en cours) */
  const moisRef=new Date(2026,4,1); // Mai 2026
  const nbJours=31;
  const jours=Array.from({length:nbJours},(_,i)=>{
    const d=new Date(2026,4,i+1);
    return {n:i+1,j:JOURS_SEM[d.getDay()===0?6:d.getDay()-1],isWE:d.getDay()===0||d.getDay()===6};
  });
  const todayN=today.getMonth()===4&&today.getFullYear()===2026?today.getDate():0;

  /* Convertit une date dd/mm/yy en numéro de jour mai */
  const toJourMai=str=>{
    if(!str) return null;
    const [d,m]=str.split("/").map(Number);
    return m===5?d:m<5?0:32;
  };

  const statColor={fait:"#059669",en_cours:"#2563EB",planif:"#94A3B8"};
  const prioColor={1:"#DC2626",2:"#D97706",3:"#94A3B8"};

  return (
    <div style={{paddingBottom:100,height:"100%",display:"flex",flexDirection:"column"}}>
      {/* Sélecteurs */}
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",flexShrink:0}}>
        <select className="inp" style={{height:38,fontSize:13,marginBottom:10}} value={chId} onChange={e=>setChId(e.target.value)}>
          {(user.role==="admin"?chantiers:chantiers.filter(c=>user.chIds.includes(c.id))).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        {ch&&(
          <div style={{display:"flex",gap:8,alignItems:"center",fontSize:12,color:"var(--t3)"}}>
            <span>📅 {ch.debut} → {ch.fin}</span>
            <span>·</span>
            <span style={{color:ch.prio===1?"var(--err)":ch.prio===2?"var(--warn)":"var(--ok)",fontWeight:600}}>{ch.prio===1?"Urgent":ch.prio===2?"Normal":"Faible"}</span>
            <span>·</span>
            <span style={{fontWeight:600,color:"var(--blue)"}}>{ch.av}% avancement</span>
          </div>
        )}
      </div>

      {/* Légende statuts */}
      <div style={{padding:"10px 20px",background:"var(--g1)",borderBottom:"1px solid var(--g2)",display:"flex",gap:12,flexShrink:0,overflowX:"auto"}}>
        {[{l:"Terminé",c:"#059669"},{l:"En cours",c:"#2563EB"},{l:"Planifié",c:"#94A3B8"}].map(s=>(
          <div key={s.l} style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <div style={{width:12,height:8,borderRadius:2,background:s.c}}/>
            <span style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>{s.l}</span>
          </div>
        ))}
        {todayN>0&&<div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
          <div style={{width:2,height:12,background:"var(--err)"}}/>
          <span style={{fontSize:11,color:"var(--err)",fontWeight:600}}>Aujourd'hui</span>
        </div>}
      </div>

      {/* GANTT */}
      <div style={{flex:1,overflowY:"auto",overflowX:"auto"}}>
        <div style={{minWidth:600,padding:"12px 0"}}>
          {/* En-tête jours */}
          <div style={{display:"grid",gridTemplateColumns:"140px repeat("+nbJours+",1fr)",borderBottom:"1px solid var(--g2)",paddingBottom:6,marginBottom:4,position:"sticky",top:0,background:"var(--bg)",zIndex:5}}>
            <div style={{fontSize:10,color:"var(--t4)",fontWeight:700,paddingLeft:16}}>TÂCHE</div>
            {jours.map(j=>(
              <div key={j.n} style={{textAlign:"center",fontSize:8,color:j.n===todayN?"var(--err)":j.isWE?"var(--g4)":"var(--t4)",fontWeight:j.n===todayN?800:j.isWE?400:600}}>
                <div>{j.j}</div>
                <div style={{fontWeight:j.n===todayN?800:400}}>{j.n}</div>
              </div>
            ))}
          </div>

          {/* Lignes tâches */}
          {chTaches.length===0&&<div className="empty"><div style={{fontSize:40}}>📋</div><p style={{fontSize:13}}>Aucune tâche sur ce chantier</p></div>}
          {chTaches.map((t,i)=>{
            const debut=toJourMai(t.debut);
            const fin=toJourMai(t.fin);
            const color=statColor[t.statut]||"#94A3B8";
            return (
              <div key={t.id} style={{display:"grid",gridTemplateColumns:"140px repeat("+nbJours+",1fr)",alignItems:"center",marginBottom:4,minHeight:32}}>
                {/* Label tâche */}
                <div style={{paddingLeft:16,paddingRight:4}}>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.titre}</div>
                  <div style={{fontSize:9,color:"var(--t4)",marginTop:1}}>{t.resp||"—"}</div>
                </div>
                {/* Cellules jours */}
                {jours.map(j=>{
                  const inRange=debut!==null&&fin!==null&&j.n>=debut&&j.n<=fin;
                  const isStart=j.n===debut;
                  const isEnd=j.n===fin;
                  const isToday=j.n===todayN;
                  return (
                    <div key={j.n} style={{height:24,position:"relative",background:j.isWE?"rgba(0,0,0,.03)":"transparent"}}>
                      {isToday&&<div style={{position:"absolute",top:0,bottom:0,left:"50%",width:1,background:"rgba(220,38,38,.4)",zIndex:2}}/>}
                      {inRange&&(
                        <div style={{position:"absolute",top:4,bottom:4,left:isStart?2:0,right:isEnd?2:0,background:color,borderRadius:isStart&&isEnd?"4px":isStart?"4px 0 0 4px":isEnd?"0 4px 4px 0":"0",opacity:.85,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {isStart&&<span style={{fontSize:8,color:"#fff",fontWeight:700,paddingLeft:4,overflow:"hidden",whiteSpace:"nowrap"}}>{t.duree}j</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Ligne aujourd'hui */}
          {todayN>0&&(
            <div style={{display:"grid",gridTemplateColumns:"140px repeat("+nbJours+",1fr)",marginTop:4}}>
              <div style={{paddingLeft:16,fontSize:10,color:"var(--err)",fontWeight:700}}>Aujourd'hui</div>
              {jours.map(j=>(
                <div key={j.n} style={{height:2,background:j.n===todayN?"var(--err)":"transparent"}}/>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats tâches */}
      <div style={{padding:"12px 20px",background:"var(--w)",borderTop:"1px solid var(--g2)",flexShrink:0}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Terminées",v:chTaches.filter(t=>t.statut==="fait").length,c:"var(--ok)"},{l:"En cours",v:chTaches.filter(t=>t.statut==="en_cours").length,c:"var(--blue)"},{l:"Planifiées",v:chTaches.filter(t=>t.statut==="planif").length,c:"var(--t4)"}].map((m,i)=>(
            <div key={i} style={{textAlign:"center",padding:"8px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
              <div style={{fontSize:18,fontWeight:800,color:m.c}}>{m.v}</div>
              <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:1}}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const S=({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{c}</svg>;
const IcoHome=()=><S c={<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}/>;
const IcoBuild=()=><S c={<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></>}/>;
const IcoTask=()=><S c={<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>}/>;
const IcoChat=()=><S c={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>}/>;
const IcoMore=()=><S c={<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>}/>;

/* ─── ROOT ─── */
export default function App() {
  const [user,setUser]=useState(null);
  return (
    <>
      <style>{CSS}</style>
      {!user?<LoginScreen onLogin={setUser}/>:<AppMobile user={user} onLogout={()=>setUser(null)}/>}
    </>
  );
}
