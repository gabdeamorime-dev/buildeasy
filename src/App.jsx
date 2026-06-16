import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { isSupabaseConfigured, supabase } from "./supabase.js";
import { signInWithEmail, signUpWithEmail, resetPassword, signOut as authSignOut, onAuthChange, getSessionUser } from "./lib/auth.js";
import { loadAppDataForUi } from "./lib/appDataBridge.js";
import { isStripeConfigured, stripeCheckoutUrl, stripePortalUrl } from "./lib/stripe.js";
import { loadAppState, saveAppState, clearAppState, loadLastChId, saveLastChId } from "./lib/persistence.js";
import { chIdsOf, filterByChAccess, visibleChantiers, isAdmin } from "./lib/access.js";
import * as cloud from "./lib/cloudSync.js";

const DEMO_AUTH = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";

/*
  BuildEasy v10 — Terrain BTP Premium
  admin@buildeasy.eu / admin123
  chef@buildeasy.eu  / chef123
  ali@buildeasy.eu   / employe123
  client@buildeasy.eu/ client123
*/

const ROLES = {
  admin:   { id:"admin",   label:"Gérant",           abbr:"GER", color:"#2563EB" },
  chef:    { id:"chef",    label:"Chef de chantier",  abbr:"CDC", color:"#0891B2" },
  employe: { id:"employe", label:"Compagnon",         abbr:"CPG", color:"#059669" },
  client:  { id:"client",  label:"Maître d'ouvrage",  abbr:"MOA", color:"#D97706" },
};
const PERMS = {
  admin:   { chantiers:true,  finances:true,  equipe:true,  rapports:true,  taches:true,  creerCh:true,  modCh:true,  creerT:true,  modT:true,  montants:true,  tels:true,  rapport:true,  tousRap:true,  chat:true,  msg:true,  avenants:true,  creerAv:true,  valAv:true,  heures:true,  punch:true,  gPunch:true,  incidents:true,  situations:true,  creerCmd:true  },
  chef:    { chantiers:true,  finances:false, equipe:true,  rapports:true,  taches:true,  creerCh:false, modCh:true,  creerT:true,  modT:true,  montants:false, tels:true,  rapport:true,  tousRap:true,  chat:true,  msg:true,  avenants:true,  creerAv:false, valAv:false, heures:true,  punch:true,  gPunch:true,  incidents:true,  situations:false, creerCmd:true  },
  employe: { chantiers:true,  finances:false, equipe:false, rapports:false, taches:true,  creerCh:false, modCh:false, creerT:false, modT:true,  montants:false, tels:false, rapport:true,  tousRap:false, chat:true,  msg:true,  avenants:false, creerAv:false, valAv:false, heures:true,  punch:true,  gPunch:false, incidents:true,  situations:false, creerCmd:false },
  client:  { chantiers:true,  finances:true,  equipe:false, rapports:true,  taches:false, creerCh:false, modCh:false, creerT:false, modT:false, montants:true,  tels:false, rapport:false, tousRap:false, chat:false, msg:false, avenants:true,  creerAv:false, valAv:true,  heures:false, punch:true,  gPunch:false, incidents:false, situations:true,  creerCmd:false },
};
const PLANS = {
  starter: {
    id:"starter", nom:"Starter", prix:80,
    maxUsers:5, maxChantiers:3,
    desc:"Pour les artisans et petites équipes",
    feats:["chantiers","taches","devis","factures","situations","heures","punch","chat","incidents","rapports","commandes","agenda"],
  },
  pro: {
    id:"pro", nom:"Pro", prix:149,
    maxUsers:20, maxChantiers:Infinity,
    desc:"Pour les PME qui veulent tout centraliser",
    feats:["chantiers","taches","devis","factures","situations","heures","punch","chat","incidents","rapports","commandes","agenda","clients","avenants","tresorerie","planningEq","conges"],
  },
  entreprise: {
    id:"entreprise", nom:"Entreprise", prix:249,
    maxUsers:Infinity, maxChantiers:Infinity,
    desc:"Pour les entreprises en croissance",
    feats:["chantiers","taches","devis","factures","situations","heures","punch","chat","incidents","rapports","commandes","agenda","clients","avenants","tresorerie","planningEq","conges","multiagence","api","exports"],
  },
};
// Modules verrouillés par plan (affichage cadenas + upsell)
const FEAT_LABELS = {
  clients:"CRM clients & prospects", avenants:"Avenants & signature MOA",
  tresorerie:"Trésorerie prévisionnelle", planningEq:"Planning d'équipe",
  conges:"Gestion des congés",
};
const COMPTES = [
  // ── Comptes démo riches (données pré-remplies pour présentation) ──
  { id:1, nom:"Jean Dupont",    role:"admin",   email:"admin@buildeasy.eu",  mdp:"admin123",   chIds:[],   vierge:false },
  { id:2, nom:"Marc Lefebvre", role:"chef",    email:"chef@buildeasy.eu",   mdp:"chef123",    chIds:[1,5], vierge:false },
  { id:3, nom:"Ali Benali",    role:"employe", email:"ali@buildeasy.eu",    mdp:"employe123", chIds:[1],   vierge:false },
  { id:4, nom:"M. Dupont",     role:"client",  email:"client@buildeasy.eu", mdp:"client123",  chIds:[1],   vierge:false },
  // ── Comptes démo vierges (à donner aux prospects — repartent de zéro) ──
  { id:10, nom:"Gérant Demo 1", role:"admin",  email:"demo1@buildeasy.eu",  mdp:"buildeasy",  chIds:[],   vierge:true },
  { id:11, nom:"Gérant Demo 2", role:"admin",  email:"demo2@buildeasy.eu",  mdp:"buildeasy",  chIds:[],   vierge:true },
  { id:12, nom:"Gérant Demo 3", role:"admin",  email:"demo3@buildeasy.eu",  mdp:"buildeasy",  chIds:[],   vierge:true },
];

const D_CH = [
  { id:1, nom:"Rénovation Villa Dupont",   client:"M. Dupont",         tel:"06 11 22 33 44", corps:"Maçonnerie · Plomberie", statut:"actif",  av:68,  budget:85000,  dep:62400, debut:"10/03/26", fin:"30/06/26", rdv:"07:30", meteo:"Ensoleillé 22°C", prio:1, note:"Délai façade à surveiller", adresse:"12 rue des Roses, Paris 16e",  taux:38 },
  { id:2, nom:"Extension Pavillon Martin", client:"Mme Martin",        tel:"06 22 33 44 55", corps:"Gros Œuvre",             statut:"actif",  av:34,  budget:120000, dep:41800, debut:"01/04/26", fin:"15/09/26", rdv:"08:00", meteo:"Nuageux 17°C",    prio:2, note:"",                           adresse:"8 allée des Pins, Versailles", taux:36 },
  { id:3, nom:"Réfection Toiture Leroy",   client:"M. Leroy",          tel:"06 33 44 55 66", corps:"Couverture",             statut:"livre",  av:100, budget:22000,  dep:21340, debut:"15/01/26", fin:"01/03/26", rdv:"",      meteo:"—",               prio:3, note:"PV réception signé",         adresse:"5 rue du Moulin, Lyon 3e",     taux:35 },
  { id:4, nom:"Aménagement Cuisine Brun",  client:"Famille Brun",      tel:"06 44 55 66 77", corps:"Élec · Plomberie",       statut:"planif", av:0,   budget:18500,  dep:0,     debut:"01/06/26", fin:"15/07/26", rdv:"",      meteo:"—",               prio:2, note:"",                           adresse:"3 rue Nationale, Bordeaux",    taux:35 },
  { id:5, nom:"Ravalement Façade Moreau",  client:"Synd. Copropriété", tel:"06 55 66 77 88", corps:"Façade · Peinture",      statut:"actif",  av:52,  budget:56000,  dep:30200, debut:"20/02/26", fin:"31/05/26", rdv:"08:00", meteo:"Couvert 18°C",    prio:1, note:"Réunion copro 25/05",         adresse:"22 bd Haussmann, Paris 9e",    taux:36 },
];
const D_TACHES = [
  { id:1, chId:1, titre:"Coulage dalle béton",        resp:"A. Benali",   debut:"01/05", fin:"08/05", statut:"fait",     prio:1, duree:7  },
  { id:2, chId:1, titre:"Installation plomberie SDB", resp:"M. Lefebvre", debut:"09/05", fin:"18/05", statut:"en_cours", prio:1, duree:9  },
  { id:3, chId:1, titre:"Carrelage sol RDC",          resp:"A. Benali",   debut:"15/05", fin:"25/05", statut:"planif",   prio:2, duree:10 },
  { id:4, chId:1, titre:"Peinture intérieure",        resp:"M. Lefebvre", debut:"20/05", fin:"05/06", statut:"planif",   prio:3, duree:16 },
  { id:5, chId:2, titre:"Fondations extension",       resp:"K. Diallo",   debut:"10/04", fin:"20/04", statut:"fait",     prio:1, duree:10 },
  { id:6, chId:2, titre:"Élévation murs parpaings",   resp:"S. Petit",    debut:"21/04", fin:"10/05", statut:"en_cours", prio:1, duree:19 },
  { id:7, chId:5, titre:"Préparation supports",       resp:"T. Bernard",  debut:"20/02", fin:"05/03", statut:"fait",     prio:2, duree:13 },
  { id:8, chId:5, titre:"Enduit finition façade",     resp:"K. Simon",    debut:"01/05", fin:"31/05", statut:"en_cours", prio:2, duree:30 },
];
const D_FAC = [
  { id:"FA-001", chId:1, client:"M. Dupont",         mt:28500, statut:"encaissee", date:"15/03/26", ech:"15/04/26", desc:"Situation 1 — Fondations + RDC" },
  { id:"FA-002", chId:2, client:"Mme Martin",        mt:40000, statut:"encaissee", date:"01/04/26", ech:"01/05/26", desc:"Situation 1 — Fondations" },
  { id:"FA-003", chId:5, client:"Synd. Copropriété", mt:18000, statut:"emise",     date:"20/04/26", ech:"20/05/26", desc:"Situation 2 — Enduit façade nord" },
  { id:"FA-004", chId:1, client:"M. Dupont",         mt:22000, statut:"retard",    date:"10/04/26", ech:"10/05/26", desc:"Situation 2 — Gros œuvre R+1" },
  { id:"FA-005", chId:3, client:"M. Leroy",          mt:21340, statut:"encaissee", date:"05/03/26", ech:"05/04/26", desc:"Solde final — réception" },
];
const D_EQ = [
  { id:1, nom:"Jean Dupont",   fn:"Conducteur travaux", tel:"06 12 34 56 78", chIds:[1,2], statut:"present", tauxH:45, qual:"N4" },
  { id:2, nom:"Marc Lefebvre",fn:"Chef de chantier",   tel:"06 23 45 67 89", chIds:[1,5], statut:"present", tauxH:40, qual:"N3" },
  { id:3, nom:"Ali Benali",   fn:"Maçon qualifié",     tel:"06 34 56 78 90", chIds:[1],   statut:"retard",  tauxH:35, qual:"N2" },
  { id:4, nom:"Karim Diallo", fn:"Gros oeuvre",        tel:"06 45 67 89 01", chIds:[2],   statut:"present", tauxH:33, qual:"N2" },
  { id:5, nom:"T. Bernard",   fn:"Façadier",           tel:"06 67 89 01 23", chIds:[5],   statut:"present", tauxH:36, qual:"N3" },
  { id:6, nom:"Kevin Simon",  fn:"Peintre",            tel:"06 89 01 23 45", chIds:[5],   statut:"absent",  tauxH:32, qual:"N2" },
];
const D_MSG = [
  { id:1, chId:1, auteur:"M. Lefebvre", role:"chef",    txt:"Dalle coulée ce matin, RAS. Début plomberie demain 7h.",   h:"08:32", d:"16/05" },
  { id:2, chId:1, auteur:"A. Benali",   role:"employe", txt:"OK chef. Matériel rangé.",                                 h:"08:45", d:"16/05" },
  { id:3, chId:1, auteur:"J. Dupont",   role:"admin",   txt:"Visite client vendredi 9h — confirmez disponibilité SVP.", h:"09:10", d:"16/05" },
  { id:4, chId:5, auteur:"T. Bernard",  role:"chef",    txt:"Rupture stock blanc cassé. Commande urgente.",              h:"14:20", d:"16/05" },
  { id:5, chId:5, auteur:"J. Dupont",   role:"admin",   txt:"Commande passée. Livraison demain 7h.",                    h:"14:35", d:"16/05" },
];
const D_AV = [
  { id:1, chId:1, ref:"AV-001", titre:"Douche à l'italienne",      desc:"Remplacement baignoire par douche extra-plate 80x80.", mt:2800, statut:"signe",  dc:"20/04/26", ds:"22/04/26", par:"M. Dupont" },
  { id:2, chId:1, ref:"AV-002", titre:"Peinture couloir d'entrée", desc:"Peinture couloir non prévu au marché initial.",        mt:650,  statut:"attente", dc:"10/05/26", ds:"",         par:"" },
  { id:3, chId:5, ref:"AV-001", titre:"Traitement hydrofuge",      desc:"Application hydrofuge façade nord.",                   mt:1200, statut:"signe",  dc:"15/03/26", ds:"17/03/26", par:"Synd. Copropriété" },
];
const D_HEURES = [
  { id:1,  nom:"A. Benali",   chId:1, date:"2026-05-19", arr:"07:30", dep:"17:00", pause:45, desc:"Coffrage dalle RDC",        val:true,  panier:true,  trajet:true,  zone:1 },
  { id:2,  nom:"M. Lefebvre", chId:1, date:"2026-05-19", arr:"07:00", dep:"17:30", pause:60, desc:"Supervision + réunion MOA", val:true,  panier:true,  trajet:true,  zone:2 },
  { id:3,  nom:"T. Bernard",  chId:5, date:"2026-05-19", arr:"08:00", dep:"16:00", pause:45, desc:"Enduit façade nord C1",     val:true,  panier:true,  trajet:false, zone:1 },
  { id:4,  nom:"K. Simon",    chId:5, date:"2026-05-19", arr:"08:30", dep:"16:30", pause:45, desc:"Préparation supports est",  val:true,  panier:true,  trajet:false, zone:1 },
  { id:5,  nom:"A. Benali",   chId:1, date:"2026-05-20", arr:"07:30", dep:"17:00", pause:45, desc:"Coulage dalle béton RDC",   val:true,  panier:true,  trajet:true,  zone:1 },
  { id:6,  nom:"M. Lefebvre", chId:1, date:"2026-05-20", arr:"07:00", dep:"18:00", pause:60, desc:"Contrôle + coord.",         val:true,  panier:true,  trajet:true,  zone:2 },
  { id:7,  nom:"T. Bernard",  chId:5, date:"2026-05-20", arr:"08:00", dep:"16:00", pause:45, desc:"Enduit façade nord C2",     val:true,  panier:true,  trajet:false, zone:1 },
  { id:8,  nom:"K. Diallo",   chId:2, date:"2026-05-20", arr:"07:00", dep:"16:00", pause:45, desc:"Élévation murs R+1",        val:true,  panier:true,  trajet:true,  zone:3 },
  { id:9,  nom:"A. Benali",   chId:1, date:"2026-05-21", arr:"07:30", dep:"12:00", pause:0,  desc:"Décoffrage dalle ½J",       val:true  },
  { id:10, nom:"M. Lefebvre", chId:1, date:"2026-05-21", arr:"07:00", dep:"17:00", pause:60, desc:"Plomberie SDB nord",        val:true  },
  { id:11, nom:"K. Diallo",   chId:2, date:"2026-05-21", arr:"07:00", dep:"16:00", pause:45, desc:"Murs + chaînage horiz.",    val:true  },
  { id:12, nom:"K. Simon",    chId:5, date:"2026-05-21", arr:"08:00", dep:"16:30", pause:45, desc:"Enduit façade est finit.",  val:false },
  { id:13, nom:"A. Benali",   chId:1, date:"2026-05-22", arr:"07:30", dep:"17:00", pause:45, desc:"Carrelage RDC démarrage",   val:false },
  { id:14, nom:"M. Lefebvre", chId:1, date:"2026-05-22", arr:"07:00", dep:"17:00", pause:60, desc:"Plomberie SDB raccords",    val:false },
  { id:15, nom:"T. Bernard",  chId:5, date:"2026-05-22", arr:"08:00", dep:"17:00", pause:45, desc:"Ravalement sud démarrage",  val:false },
  { id:16, nom:"K. Diallo",   chId:2, date:"2026-05-22", arr:"07:00", dep:"15:30", pause:45, desc:"Pose linteaux R+1",         val:false },
  { id:17, nom:"A. Benali",   chId:1, date:"2026-05-23", arr:"07:30", dep:"16:00", pause:45, desc:"Carrelage RDC 60%",         val:false },
  { id:18, nom:"M. Lefebvre", chId:1, date:"2026-05-23", arr:"07:00", dep:"16:30", pause:60, desc:"Plomberie SDB terminée",    val:false },
  { id:19, nom:"T. Bernard",  chId:5, date:"2026-05-23", arr:"08:00", dep:"16:00", pause:45, desc:"Ravalement sud finition",   val:false },
  { id:20, nom:"K. Simon",    chId:5, date:"2026-05-23", arr:"08:30", dep:"15:00", pause:30, desc:"Retouches + nettoyage",     val:false },
  { id:21, nom:"A. Benali",   chId:1, date:"2026-05-24", arr:"07:30", dep:"12:00", pause:0,  desc:"Carrelage RDC finition",    val:false },
  { id:22, nom:"M. Lefebvre", chId:1, date:"2026-05-24", arr:"07:00", dep:"12:30", pause:0,  desc:"Visite client + PV",        val:false },
  { id:23, nom:"A. Benali",   chId:1, date:"2026-05-29", arr:"07:30", dep:"17:00", pause:45, desc:"Pose carrelage cuisine",     val:false, panier:true, trajet:true, zone:1 },
  { id:24, nom:"M. Lefebvre", chId:1, date:"2026-05-29", arr:"07:00", dep:"18:00", pause:60, desc:"Coordination + réception",  val:false, panier:true, trajet:true, zone:2 },
  { id:25, nom:"T. Bernard",  chId:5, date:"2026-05-29", arr:"08:00", dep:"16:30", pause:45, desc:"Finition ravalement est",   val:false, panier:true, trajet:false,zone:1 },
];
const D_PUNCH = [
  { id:1, chId:1, ref:"RES-001", titre:"Fissure angle mur cuisine",   desc:"Fissure verticale 15cm jonction mur/plafond.",     corps:"Maçonnerie", prio:1, statut:"encours", sig:"M. Lefebvre", date:"10/05/26", clos:"",         ass:"A. Benali"   },
  { id:2, chId:1, ref:"RES-002", titre:"Carrelage décollé SDB",       desc:"3 carreaux décollés zone douche. Risque de chute.", corps:"Carrelage",  prio:1, statut:"ouvert",  sig:"M. Dupont",   date:"14/05/26", clos:"",         ass:"A. Benali"   },
  { id:3, chId:1, ref:"RES-003", titre:"Joint silicone non conforme", desc:"Discontinuités joint baignoire sur 80cm.",          corps:"Plomberie",  prio:2, statut:"clos",    sig:"M. Lefebvre", date:"08/05/26", clos:"12/05/26", ass:"M. Lefebvre" },
  { id:4, chId:5, ref:"RES-001", titre:"Teinte façade non conforme",  desc:"Couleur enduit dévie du RAL validé.",               corps:"Façade",     prio:1, statut:"ouvert",  sig:"J. Dupont",   date:"15/05/26", clos:"",         ass:"T. Bernard"  },
];
const D_RAPPORTS = [
  { id:1, chId:1, date:"16/05/26", auteur:"M. Lefebvre", meteo:"Ensoleillé 22°C", av:"Dalle RDC coulée. Plomberie nord démarrée.", incidents:"RAS",                              presences:["M. Lefebvre","A. Benali"] },
  { id:2, chId:5, date:"16/05/26", auteur:"T. Bernard",  meteo:"Couvert 18°C",   av:"Enduit finition 60% zone nord.",             incidents:"Rupture stock blanc cassé",         presences:["T. Bernard","K. Simon"] },
  { id:3, chId:2, date:"15/05/26", auteur:"K. Diallo",   meteo:"Ensoleillé 20°C",av:"Murs R+1. Chaînage posé.",                   incidents:"RAS",                              presences:["K. Diallo","S. Petit"] },
];
// Annuaire fournisseurs & services d'urgence
const D_FOURNISSEURS = [
  { id:1, nom:"Point P",          tel:"3616",           cat:"materiaux",   url:"https://www.pointp.fr" },
  { id:2, nom:"Cedeo",            tel:"3633",           cat:"plomberie",   url:"https://www.cedeo.fr"  },
  { id:3, nom:"Weber",            tel:"01 41 85 25 25", cat:"enduits",     url:"https://www.weber.fr"  },
  { id:4, nom:"BigMat",           tel:"0811 888 111",   cat:"materiaux",   url:"https://www.bigmat.fr" },
  { id:5, nom:"Rexel",            tel:"0800 600 700",   cat:"electricite", url:"https://www.rexel.fr"  },
  { id:6, nom:"Kiloutou",         tel:"3645",           cat:"location",    url:"https://www.kiloutou.fr"},
  { id:7, nom:"Loxam",            tel:"0811 105 500",   cat:"location",    url:"https://www.loxam.fr"  },
  { id:8, nom:"Brico Dépôt Pro",  tel:"0800 011 011",   cat:"materiaux",   url:""  },
  { id:9, nom:"Socoda",           tel:"03 83 36 42 00", cat:"bois",        url:"" },
  {id:10, nom:"Sonepar",          tel:"3655",           cat:"electricite", url:"" },
];
const URGENCES=[
  {l:"SAMU",       n:"15",           e:"🚑", c:"#DC2626"},
  {l:"Pompiers",   n:"18",           e:"🚒", c:"#EA580C"},
  {l:"Police",     n:"17",           e:"👮", c:"#1D4ED8"},
  {l:"Urg. Europ.",n:"112",          e:"🆘", c:"#7C3AED"},
  {l:"CARSAT",     n:"09 71 10 77 00",e:"⚕", c:"#0891B2"},
  {l:"Insp. Trav.",n:"0801 200 212", e:"📋", c:"#059669"},
];

const D_INCIDENTS = [
  { id:1, chId:1, ref:"INC-001", type:"securite", desc:"Échelle non sécurisée. Mise en conformité effectuée.", prio:1, statut:"traite", sig:"M. Lefebvre", date:"12/05/26", screen:"chantiers", ts:1715500000000 },
  { id:2, chId:5, ref:"INC-002", type:"retard",   desc:"Livraison enduit reportée de 3 jours par Weber.", prio:2, statut:"ouvert",  sig:"T. Bernard",  date:"26/05/26", screen:"commandes", ts:1716700000000, refCmd:3, fournisseurId:3, bloquant:false },
  { id:3, chId:1, ref:"INC-003", type:"materiel", desc:"Bétonnière en panne — moteur grillé.", prio:1, statut:"ouvert", sig:"A. Benali", date:"26/05/26", screen:"chantiers", ts:1716710000000, bloquant:true },
];
const D_DEVIS = [
  { id:1, ref:"DEV-2026-001", client:"M. Dupont",    objet:"Rénovation Villa Dupont — Marché principal",
    date:"15/02/26", validite:"15/03/26", statut:"accepte",
    lots:[
      {nom:"Lot 1 — Maçonnerie", lignes:[{desc:"Démolition cloisons existantes",unite:"m2",qte:45,pu:28},{desc:"Coulage dalle béton armé RDC",unite:"m2",qte:62,pu:85},{desc:"Élévation murs parpaings R+1",unite:"m2",qte:38,pu:65}]},
      {nom:"Lot 2 — Plomberie",  lignes:[{desc:"Alimentation eau SDB + cuisine",unite:"ml",qte:35,pu:42},{desc:"Évacuation EP/EU PVC",unite:"ml",qte:28,pu:38},{desc:"Pose receveur douche extra-plate",unite:"u",qte:1,pu:850}]},
      {nom:"Lot 3 — Peinture",   lignes:[{desc:"Peinture intérieure 2 couches",unite:"m2",qte:180,pu:18},{desc:"Enduit lissé plafonds",unite:"m2",qte:65,pu:25}]},
    ],
    remise:0, tva:20,
  },
  { id:2, ref:"DEV-2026-002", client:"Mme Martin",   objet:"Extension Pavillon Martin — Gros œuvre",
    date:"10/03/26", validite:"10/04/26", statut:"accepte",
    lots:[
      {nom:"Lot 1 — Fondations", lignes:[{desc:"Terrassement fouilles en rigoles",unite:"m3",qte:18,pu:45},{desc:"Béton de propreté",unite:"m3",qte:3,pu:120},{desc:"Semelles filantes béton armé",unite:"ml",qte:24,pu:85}]},
      {nom:"Lot 2 — Élévation",  lignes:[{desc:"Murs parpaings 20cm",unite:"m2",qte:95,pu:68},{desc:"Chaînage horizontal béton",unite:"ml",qte:36,pu:42},{desc:"Linteaux préfabriqués",unite:"u",qte:6,pu:120}]},
    ],
    remise:2, tva:20,
  },
  { id:3, ref:"DEV-2026-003", client:"Famille Brun", objet:"Aménagement Cuisine — Électricité et Plomberie",
    date:"01/05/26", validite:"01/06/26", statut:"envoye",
    lots:[
      {nom:"Lot 1 — Électricité",lignes:[{desc:"Tableau divisionnaire cuisine",unite:"u",qte:1,pu:680},{desc:"Prises plan de travail",unite:"u",qte:6,pu:85},{desc:"Éclairage LED encastré",unite:"u",qte:8,pu:65}]},
      {nom:"Lot 2 — Plomberie",  lignes:[{desc:"Raccordement évier double bac",unite:"u",qte:1,pu:320},{desc:"Alimentation lave-vaisselle",unite:"u",qte:1,pu:180},{desc:"Évacuation sous évier",unite:"u",qte:1,pu:150}]},
    ],
    remise:0, tva:20,
  },
  { id:4, ref:"DEV-2026-004", client:"Mme Lefèvre", objet:"Réfection SDB — Devis non retenu",
    date:"20/04/26", validite:"20/05/26", statut:"refuse",
    lots:[{nom:"Lot 1 — SDB complète",lignes:[{desc:"Dépose carrelage existant",unite:"m2",qte:12,pu:22},{desc:"Étanchéité SPEC",unite:"m2",qte:12,pu:35},{desc:"Carrelage sol et murs",unite:"m2",qte:28,pu:55}]}],
    remise:0, tva:20,
  },
];
const D_COMMANDES = [
  { id:1, ref:"CMD-001", chId:1, fournisseur:"Point P",        objet:"Parpaings 20x20x50 + ciment", mt:2840, statut:"livree",  date:"05/03/26", livraison:"10/03/26", validePar:"J. Dupont"  },
  { id:2, ref:"CMD-002", chId:1, fournisseur:"Cedeo",          objet:"Receveur douche + colonne",    mt:1420, statut:"livree",  date:"01/05/26", livraison:"05/05/26", validePar:"M. Lefebvre"},
  { id:3, ref:"CMD-003", chId:5, fournisseur:"Weber",          objet:"Enduit monocouche blanc cassé", mt:980,  statut:"commandee",date:"16/05/26", livraison:"17/05/26", validePar:"J. Dupont"  },
  { id:4, ref:"CMD-004", chId:1, fournisseur:"BigMat",         objet:"Carrelage 60x60 grès cérame",  mt:1650, statut:"commandee",date:"20/05/26", livraison:"23/05/26", validePar:"J. Dupont"  },
  { id:5, ref:"CMD-005", chId:2, fournisseur:"Point P",        objet:"Linteaux préfabriqués x6",     mt:720,  statut:"livree",  date:"15/04/26", livraison:"18/04/26", validePar:"K. Diallo"  },
  { id:6, ref:"CMD-006", chId:1, fournisseur:"Rexel",          objet:"Câblage + disjoncteurs cuisine",mt:560,  statut:"attente", date:"22/05/26", livraison:"",         validePar:""           },
];
const D_PLANNING_EQ = [
  { id:1, nom:"Jean Dupont",   sem:[{j:"Lun",chId:1},{j:"Mar",chId:1},{j:"Mer",chId:2},{j:"Jeu",chId:1},{j:"Ven",chId:null}] },
  { id:2, nom:"Marc Lefebvre",sem:[{j:"Lun",chId:1},{j:"Mar",chId:1},{j:"Mer",chId:5},{j:"Jeu",chId:5},{j:"Ven",chId:1}] },
  { id:3, nom:"Ali Benali",   sem:[{j:"Lun",chId:1},{j:"Mar",chId:1},{j:"Mer",chId:1},{j:"Jeu",chId:1},{j:"Ven",chId:1}] },
  { id:4, nom:"Karim Diallo", sem:[{j:"Lun",chId:2},{j:"Mar",chId:2},{j:"Mer",chId:2},{j:"Jeu",chId:2},{j:"Ven",chId:null}] },
  { id:5, nom:"T. Bernard",   sem:[{j:"Lun",chId:5},{j:"Mar",chId:5},{j:"Mer",chId:5},{j:"Jeu",chId:5},{j:"Ven",chId:5}] },
  { id:6, nom:"Kevin Simon",  sem:[{j:"Lun",chId:null},{j:"Mar",chId:null},{j:"Mer",chId:null},{j:"Jeu",chId:null},{j:"Ven",chId:null}] },
];
const D_CONGES = [
  { id:1, nom:"Kevin Simon",  type:"conge",  debut:"19/05/26", fin:"23/05/26", jours:5, statut:"valide",  motif:"Congés annuels" },
  { id:2, nom:"Ali Benali",   type:"maladie",debut:"26/05/26", fin:"27/05/26", jours:2, statut:"attente", motif:"Certificat médical" },
  { id:3, nom:"T. Bernard",   type:"conge",  debut:"02/06/26", fin:"06/06/26", jours:5, statut:"attente", motif:"Congés famille" },
  { id:4, nom:"Karim Diallo", type:"rtt",    debut:"30/05/26", fin:"30/05/26", jours:1, statut:"valide",  motif:"RTT" },
];
// Notes rapides par chantier (mémos terrain)
const D_NOTES = [
  { id:1, chId:1, auteur:"M. Lefebvre", txt:"Vérifier dosage béton zone nord demain matin avec A. Benali.", ts:1716720000000, date:"26/05/26" },
  { id:2, chId:5, auteur:"T. Bernard",  txt:"Client syndic veut RDV photo façade terminée avant vendredi.", ts:1716710000000, date:"26/05/26" },
];

const D_AGENDA = [
  { id:1, date:"23/05/26", heure:"09:00", titre:"Visite client M. Dupont",    chId:1, type:"visite",  duree:60, lieu:"Chantier Villa Dupont" },
  { id:2, date:"23/05/26", heure:"14:00", titre:"Réunion copropriété Moreau", chId:5, type:"reunion", duree:90, lieu:"Syndic — 22 bd Haussmann" },
  { id:3, date:"25/05/26", heure:"08:30", titre:"Réception livraison BigMat", chId:1, type:"livraison",duree:30, lieu:"Chantier Villa Dupont" },
  { id:4, date:"26/05/26", heure:"10:00", titre:"Rendez-vous prospect Morel", chId:null,type:"prospect",duree:45, lieu:"Bureau" },
  { id:5, date:"27/05/26", heure:"09:00", titre:"Contrôle échafaudage",       chId:5, type:"securite",duree:60, lieu:"Chantier Moreau" },
  { id:6, date:"28/05/26", heure:"14:00", titre:"Point avancement Martin",    chId:2, type:"reunion", duree:45, lieu:"Chantier Martin" },
];
const D_CLIENTS = [
  { id:1, nom:"M. Dupont",         tel:"06 11 22 33 44", email:"dupont@mail.fr",    adresse:"12 rue des Roses, Paris 16e",  statut:"client",   ca:85000, nbChantiers:1, note:"Client fidèle — recommande" },
  { id:2, nom:"Mme Martin",        tel:"06 22 33 44 55", email:"martin@mail.fr",    adresse:"8 allée des Pins, Versailles", statut:"client",   ca:120000,nbChantiers:1, note:"" },
  { id:3, nom:"M. Leroy",          tel:"06 33 44 55 66", email:"leroy@mail.fr",     adresse:"5 rue du Moulin, Lyon 3e",     statut:"termine",  ca:22000, nbChantiers:1, note:"PV réception OK" },
  { id:4, nom:"Famille Brun",      tel:"06 44 55 66 77", email:"brun@mail.fr",      adresse:"3 rue Nationale, Bordeaux",    statut:"client",   ca:18500, nbChantiers:1, note:"Chantier pas encore démarré" },
  { id:5, nom:"Synd. Copropriété", tel:"06 55 66 77 88", email:"syndic@moreau.fr",  adresse:"22 bd Haussmann, Paris 9e",    statut:"client",   ca:56000, nbChantiers:1, note:"Réunion copro régulière" },
  { id:6, nom:"M. Morel",          tel:"06 66 77 88 99", email:"morel@mail.fr",     adresse:"15 rue Victor Hugo, Créteil",  statut:"prospect", ca:0,     nbChantiers:0, note:"A appelé le 22/05 — veut devis SDB" },
  { id:7, nom:"Mme Lefèvre",       tel:"06 77 88 99 00", email:"lefevre@mail.fr",   adresse:"8 rue Pasteur, Vincennes",     statut:"perdu",    ca:0,     nbChantiers:0, note:"Devis refusé — trop cher" },
];
const D_SIT = [
  { id:1, chId:1, ref:"SIT-001", num:1, titre:"Situation n°1 — Mars 2026",  av:30, mt:25500, statut:"encaissee", date:"31/03/26", ech:"30/04/26", desc:"Fondations + gros œuvre RDC" },
  { id:2, chId:1, ref:"SIT-002", num:2, titre:"Situation n°2 — Avril 2026", av:55, mt:22000, statut:"encaissee", date:"30/04/26", ech:"30/05/26", desc:"Maçonnerie R+1 + charpente" },
  { id:3, chId:1, ref:"SIT-003", num:3, titre:"Situation n°3 — Mai 2026",   av:68, mt:11000, statut:"emise",     date:"20/05/26", ech:"20/06/26", desc:"Plomberie SDB + carrelage" },
  { id:4, chId:5, ref:"SIT-001", num:1, titre:"Situation n°1 — Mars 2026",  av:25, mt:14000, statut:"encaissee", date:"31/03/26", ech:"30/04/26", desc:"Échafaudage + supports" },
  { id:5, chId:5, ref:"SIT-002", num:2, titre:"Situation n°2 — Mai 2026",   av:52, mt:16200, statut:"emise",     date:"20/05/26", ech:"20/06/26", desc:"Enduit façade nord et est" },
];

const EUR  = n => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n||0);
const PCT  = (a,b) => b>0?Math.round(a/b*100):0;
const INI  = n => (n||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const parseFrDate = s => {
  if (!s) return null;
  const p = String(s).split("/");
  if (p.length !== 3) return null;
  const d = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  let y = parseInt(p[2], 10);
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
};
const syncEquipeChantier = (setEquipe, chId, eqIds) => {
  if (!eqIds) return;
  setEquipe(p => p.map(m => {
    const ids = [...(m.chIds || [])];
    const want = eqIds.includes(m.id);
    const has = ids.includes(chId);
    if (want && !has) return { ...m, chIds: [...ids, chId] };
    if (!want && has) return { ...m, chIds: ids.filter(id => id !== chId) };
    return m;
  }));
};
const calcH = h => {
  if(!h.arr||!h.dep) return 0;
  const [ah,am]=h.arr.split(":").map(Number);
  const [dh,dm]=h.dep.split(":").map(Number);
  return Math.max(0,Math.round(((dh*60+dm)-(ah*60+am)-(h.pause||0))/6)/10);
};
const calcCoutsMO = (chId, heures, equipe) => {
  const h = heures.filter(x => x.chId === chId);
  const totalH = Math.round(h.reduce((s, x) => s + calcH(x), 0) * 10) / 10;
  const coutMO = Math.round(h.reduce((s, x) => {
    const m = equipe.find(e => e.nom === x.nom);
    const tx = m ? (m.tauxH || 35) : 35;
    const hj = calcH(x);
    // Majorations légales BTP : 25% sur les 8 premières HS, 50% au-delà de 43h/sem
    // Pour une journée on utilise le taux de base (calcul hebdo dans HeuresScreen)
    return s + hj * tx;
  }, 0));
  return { totalH, coutMO };
};
const calcMargeChantier = (c, heures, equipe, commandes) => {
  const { totalH, coutMO } = calcCoutsMO(c.id, heures, equipe);
  const coutMat = c.dep || 0; // dépenses matériaux saisies manuellement
  const coutCmds = commandes.filter(x => x.chId === c.id && x.statut === "livree").reduce((s, x) => s + (x.mt || 0), 0);
  const coutTotal = coutMO + Math.max(coutMat, coutCmds); // on prend le max (évite les doublons)
  const margeReelle = c.budget - coutTotal;
  const margeP = c.budget > 0 ? Math.round(margeReelle / c.budget * 100) : 0;
  return { totalH, coutMO, coutMat, coutTotal, margeReelle, margeP };
};
const isRetard = fin => {
  if (!fin) return false;
  const p = String(fin).split("/");
  if (p.length < 2) return false;
  const d = parseInt(p[0], 10);
  const m = parseInt(p[1], 10) - 1;
  let y = p.length >= 3 ? parseInt(p[2], 10) : new Date().getFullYear();
  if (y < 100) y += 2000;
  const dt = new Date(y, m, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(dt.getTime()) && dt < today;
};
const calcHS = (h,base=35) => {
  const t=calcH(h);
  if(t<=base/5) return {normal:t,sup25:0,sup50:0};
  const sup=t-base/5;
  return {normal:base/5,sup25:Math.min(sup,2),sup50:Math.max(0,sup-2)};
};
const APP_THEMES = [
  { id:"ocean",   name:"Océan",    emoji:"🌊", desc:"Bleu pro — défaut",        swatch:["#F0F4F8","#2563EB"] },
  { id:"forest",  name:"Forêt",    emoji:"🌲", desc:"Vert chantier & nature",   swatch:["#F0F7F4","#059669"] },
  { id:"sunset",  name:"Sunset",   emoji:"🌅", desc:"Chaud & énergique",        swatch:["#FFF8F0","#EA580C"] },
  { id:"terra",   name:"Terra",    emoji:"🧱", desc:"Terre & BTP",              swatch:["#FAF6F1","#C2410C"] },
  { id:"slate",   name:"Slate",    emoji:"◻",  desc:"Minimal & sobre",          swatch:["#FAFAFA","#18181B"] },
  { id:"midnight",name:"Midnight", emoji:"🌙", desc:"Mode sombre",              swatch:["#0B1120","#6366F1"] },
];
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root,[data-theme="ocean"]{
  --bg:#F0F4F8;--w:#FFF;--g1:#F8FAFC;--g2:#E2E8F0;--g3:#CBD5E1;--g4:#94A3B8;
  --t1:#0F172A;--t2:#1E293B;--t3:#475569;--t4:#94A3B8;
  --blue:#2563EB;--blue-l:#EFF6FF;--blue-b:#BFDBFE;
  --ok:#059669;--ok-l:#ECFDF5;--ok-b:#A7F3D0;
  --warn:#D97706;--warn-l:#FFFBEB;--warn-b:#FDE68A;
  --err:#DC2626;--err-l:#FEF2F2;--err-b:#FECACA;
  --overlay:rgba(15,23,42,.52);--hdr-ico:#2563EB;
}
[data-theme="forest"]{
  --bg:#F0F7F4;--w:#FFF;--g1:#F4FAF7;--g2:#D1E7DD;--g3:#A3CFBB;--g4:#6B9E82;
  --t1:#1A2E1F;--t2:#2D4A35;--t3:#4A6B54;--t4:#8FA898;
  --blue:#059669;--blue-l:#ECFDF5;--blue-b:#A7F3D0;
  --ok:#0891B2;--ok-l:#ECFEFF;--ok-b:#A5F3FC;
  --warn:#CA8A04;--warn-l:#FEFCE8;--warn-b:#FEF08A;
  --err:#DC2626;--err-l:#FEF2F2;--err-b:#FECACA;
  --overlay:rgba(26,46,31,.45);--hdr-ico:#059669;
}
[data-theme="sunset"]{
  --bg:#FFF8F0;--w:#FFF;--g1:#FFF7ED;--g2:#FED7AA;--g3:#FDBA74;--g4:#FB923C;
  --t1:#431407;--t2:#7C2D12;--t3:#9A3412;--t4:#C2410C;
  --blue:#EA580C;--blue-l:#FFF7ED;--blue-b:#FED7AA;
  --ok:#059669;--ok-l:#ECFDF5;--ok-b:#A7F3D0;
  --warn:#D97706;--warn-l:#FFFBEB;--warn-b:#FDE68A;
  --err:#DC2626;--err-l:#FEF2F2;--err-b:#FECACA;
  --overlay:rgba(67,20,7,.4);--hdr-ico:#EA580C;
}
[data-theme="terra"]{
  --bg:#FAF6F1;--w:#FFF;--g1:#F5EDE4;--g2:#E8D5C4;--g3:#D4B896;--g4:#A89078;
  --t1:#292018;--t2:#443528;--t3:#6B5344;--t4:#9C8575;
  --blue:#C2410C;--blue-l:#FFF7ED;--blue-b:#FDBA74;
  --ok:#15803D;--ok-l:#F0FDF4;--ok-b:#BBF7D0;
  --warn:#B45309;--warn-l:#FFFBEB;--warn-b:#FDE68A;
  --err:#B91C1C;--err-l:#FEF2F2;--err-b:#FECACA;
  --overlay:rgba(41,32,24,.5);--hdr-ico:#C2410C;
}
[data-theme="slate"]{
  --bg:#FAFAFA;--w:#FFF;--g1:#F4F4F5;--g2:#E4E4E7;--g3:#D4D4D8;--g4:#A1A1AA;
  --t1:#09090B;--t2:#18181B;--t3:#52525B;--t4:#A1A1AA;
  --blue:#18181B;--blue-l:#F4F4F5;--blue-b:#D4D4D8;
  --ok:#059669;--ok-l:#ECFDF5;--ok-b:#A7F3D0;
  --warn:#D97706;--warn-l:#FFFBEB;--warn-b:#FDE68A;
  --err:#DC2626;--err-l:#FEF2F2;--err-b:#FECACA;
  --overlay:rgba(9,9,11,.45);--hdr-ico:#18181B;
}
[data-theme="midnight"]{
  --bg:#0B1120;--w:#151D2E;--g1:#1A2438;--g2:#243049;--g3:#374866;--g4:#64748B;
  --t1:#F1F5F9;--t2:#CBD5E1;--t3:#94A3B8;--t4:#64748B;
  --blue:#6366F1;--blue-l:#1E1B4B;--blue-b:#4338CA;
  --ok:#34D399;--ok-l:#064E3B;--ok-b:#059669;
  --warn:#FBBF24;--warn-l:#451A03;--warn-b:#D97706;
  --err:#F87171;--err-l:#450A0A;--err-b:#DC2626;
  --overlay:rgba(0,0,0,.65);--hdr-ico:#6366F1;
}
:root{
  --r:8px;--r2:12px;--sh:0 1px 3px rgba(0,0,0,.07);
  --f:'Inter',-apple-system,sans-serif;
  --sb:env(safe-area-inset-bottom,0px);--st:env(safe-area-inset-top,0px);
}
html,body,#root{height:100%;font-family:var(--f);background:var(--bg);color:var(--t1);overflow:hidden;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;transition:background-color .25s ease,color .25s ease;}
.card,.nav,.btn,.inp,.sh,.fab-r,.fab-b{transition:background-color .2s ease,border-color .2s ease,color .2s ease,box-shadow .2s ease;}
::-webkit-scrollbar{display:none;}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes su{from{transform:translateY(100%)}to{transform:none}}
@keyframes fi{from{opacity:0}to{opacity:1}}
.u0{animation:up .2s ease both}.u1{animation:up .2s .05s ease both}
.u2{animation:up .2s .1s ease both}.u3{animation:up .2s .15s ease both}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:48px;padding:0 20px;border-radius:var(--r2);border:none;cursor:pointer;font-family:var(--f);font-size:15px;font-weight:600;transition:all .12s;white-space:nowrap;-webkit-tap-highlight-color:transparent;}
.btn:active{transform:scale(.96);}.btn:disabled{opacity:.4;pointer-events:none;}
.btn-blue{background:var(--blue);color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.28);}
.btn-ok{background:var(--ok);color:#fff;}.btn-err{background:var(--err);color:#fff;}
.btn-warn{background:var(--warn);color:#fff;}
.btn-out{background:var(--w);color:var(--t2);border:1.5px solid var(--g3);box-shadow:var(--sh);}
.btn-ghost{background:transparent;color:var(--blue);border:none;font-weight:600;}
.btn-sm{min-height:38px;padding:0 14px;font-size:13px;}.btn-xs{min-height:32px;padding:0 11px;font-size:12px;}
.btn-fw{width:100%;}.btn-sq{width:48px;padding:0;}
.inp{width:100%;height:48px;padding:0 14px;background:var(--w);border:1.5px solid var(--g2);border-radius:var(--r2);color:var(--t1);font-family:var(--f);font-size:15px;outline:none;transition:border-color .15s;box-shadow:var(--sh);}
.inp:focus{border-color:var(--blue);}.inp::placeholder{color:var(--t4);}
select.inp{cursor:pointer;}select.inp option{background:var(--w);color:var(--t1);}
.inp-a{height:auto;padding:12px 14px;resize:none;min-height:80px;line-height:1.6;}
.lbl{font-size:11px;font-weight:700;color:var(--t3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;display:block;}
.card{background:var(--w);border-radius:var(--r2);box-shadow:var(--sh);border:1px solid var(--g2);}
.card2{background:var(--g1);border-radius:var(--r2);border:1px solid var(--g2);}
.tap{cursor:pointer;transition:all .12s;}.tap:active{transform:scale(.984);filter:brightness(.97);}
.tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:var(--r);font-size:11px;font-weight:700;}
.tag-ok{background:var(--ok-l);color:var(--ok);border:1px solid var(--ok-b);}
.tag-warn{background:var(--warn-l);color:var(--warn);border:1px solid var(--warn-b);}
.tag-err{background:var(--err-l);color:var(--err);border:1px solid var(--err-b);}
.tag-blue{background:var(--blue-l);color:var(--blue);border:1px solid var(--blue-b);}
.tag-gray{background:var(--g1);color:var(--t3);border:1px solid var(--g3);}
.bar{height:6px;background:var(--g2);border-radius:99px;overflow:hidden;}
.bar4{height:4px;background:var(--g2);border-radius:99px;overflow:hidden;}
.bar-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1);}
.sbg{position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(4px);z-index:500;display:flex;align-items:flex-end;animation:fi .15s ease both;}
.sh{background:var(--w);border-radius:20px 20px 0 0;border-top:1px solid var(--g2);width:100%;max-height:93vh;overflow-y:auto;padding:0 20px calc(28px + var(--sb));animation:su .25s cubic-bezier(.32,0,.1,1) both;box-shadow:0 -8px 32px rgba(0,0,0,.1);}
.drag{width:40px;height:4px;background:var(--g3);border-radius:99px;margin:14px auto 22px;}
.nav{position:fixed;bottom:0;left:0;right:0;background:var(--w);border-top:1.5px solid var(--g2);display:flex;padding:6px 0 calc(6px + var(--sb));z-index:100;box-shadow:0 -2px 12px rgba(0,0,0,.05);}
.nt{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 2px;cursor:pointer;position:relative;transition:color .12s;}
.nt-ico{font-size:22px;line-height:1;}.nt-lbl{font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
.nt-off{color:var(--g4);}.nt-on{color:var(--blue);}
.nt-dot{position:absolute;top:1px;right:calc(50% - 20px);width:8px;height:8px;background:var(--err);border-radius:50%;border:2px solid var(--w);}
.fab{position:fixed;bottom:calc(80px + var(--sb));right:16px;z-index:90;display:flex;flex-direction:column;align-items:center;gap:4px;}
.fab-r{width:56px;height:56px;border-radius:16px;background:var(--err);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 4px 20px rgba(220,38,38,.4);}
.fab-b{width:56px;height:56px;border-radius:16px;background:var(--blue);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 4px 20px rgba(37,99,235,.3);margin-top:8px;}
.fab-r:active,.fab-b:active{transform:scale(.87);}
.fab-lbl{font-size:9px;font-weight:700;color:var(--err);text-transform:uppercase;background:var(--err-l);padding:2px 6px;border-radius:4px;border:1px solid var(--err-b);}
.row{display:flex;justify-content:space-between;align-items:center;}
.col{display:flex;flex-direction:column;}
.gap6{gap:6px}.gap8{gap:8px}.gap10{gap:10px}.gap12{gap:12px}.gap14{gap:14px}.gap16{gap:16px}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 24px;color:var(--t4);}
.sec{font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;}
.div{height:1px;background:var(--g2);}
.sx{display:flex;overflow-x:auto;gap:8px;padding-bottom:2px;}
.av{border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
.theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.theme-card{padding:12px;border-radius:var(--r2);border:2px solid var(--g2);background:var(--w);cursor:pointer;text-align:left;transition:all .15s;font-family:var(--f);}
.theme-card:active{transform:scale(.98);}
.theme-card.on{border-color:var(--blue);background:var(--blue-l);box-shadow:0 0 0 1px var(--blue-b);}
.theme-swatch{display:flex;gap:4px;margin-bottom:8px;}
.theme-swatch span{flex:1;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.06);}
.print-overlay{position:fixed;inset:0;background:var(--overlay);z-index:600;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;}
.print-sheet{background:#fff;border-radius:14px;max-width:680px;width:100%;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;}
.print-doc{color:#111;font-size:14px;line-height:1.5;}
@media print{
  body * {visibility:hidden;}
  .print-overlay,.print-overlay *{visibility:visible;}
  .print-overlay{position:absolute;inset:0;background:#fff;padding:0;display:block;}
  .print-sheet{box-shadow:none;border-radius:0;max-width:100%;}
  .no-print{display:none !important;}
  .print-doc{padding:0 !important;}
}
`;

function Av({ nom, color="#2563EB", size=38 }) {
  return <div className="av" style={{width:size,height:size,background:color+"1A",color,border:"1.5px solid "+color+"33",fontSize:Math.round(size*.32)}}>{INI(nom)}</div>;
}
function PBar({ v, color, h=6 }) {
  const w=Math.min(Math.max(v||0,0),100);
  const c=color||(w>75?"#DC2626":w>50?"#D97706":"#059669");
  return <div className={h===4?"bar4":"bar"}><div className="bar-fill" style={{width:w+"%",background:c}}/></div>;
}
function Tag({ label, type="gray" }) { return <span className={"tag tag-"+type}>{label}</span>; }
function Fld({ label, children }) { return <div className="col gap6"><label className="lbl">{label}</label>{children}</div>; }
function Kpi({ label, value, sub, color="#2563EB", onClick }) {
  return (
    <div className={"card"+(onClick?" tap":"")} style={{padding:"14px 16px",cursor:onClick?"pointer":"default",flex:1}} onClick={onClick}>
      <div style={{fontSize:20,fontWeight:800,color,letterSpacing:"-.02em",lineHeight:1,marginBottom:4}}>{value}</div>
      <div style={{fontSize:12,fontWeight:600,color:"var(--t2)",marginBottom:2}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:"var(--t4)"}}>{sub}</div>}
    </div>
  );
}
function Alert({ msg, type="warn", children }) {
  const cfg={warn:{bg:"var(--warn-l)",bd:"var(--warn-b)",t:"var(--warn)"},err:{bg:"var(--err-l)",bd:"var(--err-b)",t:"var(--err)"},ok:{bg:"var(--ok-l)",bd:"var(--ok-b)",t:"var(--ok)"},blue:{bg:"var(--blue-l)",bd:"var(--blue-b)",t:"var(--blue)"}}[type]||{bg:"var(--warn-l)",bd:"var(--warn-b)",t:"var(--warn)"};
  return <div style={{padding:"12px 14px",background:cfg.bg,border:"1px solid "+cfg.bd,borderRadius:"var(--r2)"}}><div style={{fontSize:12,fontWeight:700,color:cfg.t,marginBottom:children?8:0}}>{msg}</div>{children}</div>;
}

function AddrActions({ adresse, onCopy }) {
  if (!adresse) return null;
  const copy = () => {
    navigator.clipboard?.writeText(adresse).then(() => onCopy?.("Adresse copiée")).catch(() => {});
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      <a href={"https://maps.google.com/?q=" + encodeURIComponent(adresse)} target="_blank" rel="noopener noreferrer" className="btn btn-out btn-xs">Maps</a>
      <a href={"https://waze.com/ul?q=" + encodeURIComponent(adresse)} target="_blank" rel="noopener noreferrer" className="btn btn-out btn-xs">Waze</a>
      <button type="button" className="btn btn-ghost btn-xs" onClick={copy}>Copier</button>
    </div>
  );
}

const METEO_PRESETS = ["☀️ Ensoleillé 22°C", "🌤 Nuageux 18°C", "🌧 Pluie 14°C", "💨 Vent fort 16°C", "❄️ Froid 5°C"];

function Sheet({ title, sub, onClose, footer, children }) {
  return (
    <div className="sbg" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sh">
        <div className="drag"/>
        <div className="row" style={{marginBottom:20}}>
          <div><div style={{fontSize:18,fontWeight:700,color:"var(--t1)"}}>{title}</div>{sub&&<div style={{fontSize:13,color:"var(--t3)",marginTop:3}}>{sub}</div>}</div>
          <button className="btn btn-out btn-sm" onClick={onClose}>Fermer</button>
        </div>
        <div className="col gap16">{children}</div>
        {footer&&<div className="col gap8" style={{marginTop:24}}>{footer}</div>}
      </div>
    </div>
  );
}
function FChantier({ equipe, onClose, onSave }) {
  const [f,setF]=useState({nom:"",client:"",tel:"",corps:"",budget:"",debut:"",fin:"",prio:2,adresse:"",note:"",taux:35,rdv:"",meteo:"",eqIds:[]});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.nom.trim()&&f.client.trim();
  const toggleEq=id=>setF(p=>({...p,eqIds:p.eqIds.includes(id)?p.eqIds.filter(x=>x!==id):[...p.eqIds,id]}));
  return (
    <Sheet title="Nouveau chantier" onClose={onClose} footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave(f);onClose();}}>Créer le chantier</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Désignation"><input className="inp" placeholder="Ex : Rénovation appartement T3..." value={f.nom} onChange={e=>s("nom",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Maître d'ouvrage"><input className="inp" placeholder="Nom du client" value={f.client} onChange={e=>s("client",e.target.value)}/></Fld>
        <Fld label="Téléphone"><input className="inp" type="tel" placeholder="06..." value={f.tel} onChange={e=>s("tel",e.target.value)}/></Fld>
      </div>
      <Fld label="Adresse"><input className="inp" placeholder="N° rue, ville" value={f.adresse} onChange={e=>s("adresse",e.target.value)}/></Fld>
      <Fld label="Corps d'état"><input className="inp" placeholder="Maçonnerie · Plomberie..." value={f.corps} onChange={e=>s("corps",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Budget HT (€)"><input className="inp" type="number" min="0" placeholder="0" value={f.budget} onChange={e=>s("budget",e.target.value)}/></Fld>
        <Fld label="Taux horaire €/h"><input className="inp" type="number" min="0" placeholder="35" value={f.taux} onChange={e=>s("taux",e.target.value)}/></Fld>
        <Fld label="Démarrage"><input className="inp" type="date" value={f.debut} onChange={e=>s("debut",e.target.value)}/></Fld>
        <Fld label="Fin contractuelle"><input className="inp" type="date" value={f.fin} onChange={e=>s("fin",e.target.value)}/></Fld>
        <Fld label="Heure de RDV"><input className="inp" placeholder="07:30" value={f.rdv} onChange={e=>s("rdv",e.target.value)}/></Fld>
        <Fld label="Météo"><input className="inp" placeholder="Ensoleillé 22°C" value={f.meteo} onChange={e=>s("meteo",e.target.value)}/></Fld>
      </div>
      <Fld label="Priorité"><select className="inp" value={f.prio} onChange={e=>s("prio",parseInt(e.target.value))}><option value={1}>Urgent</option><option value={2}>Normal</option><option value={3}>Faible</option></select></Fld>
      <Fld label={"Équipe assignée ("+f.eqIds.length+" sélectionné"+(f.eqIds.length>1?"s":"")+")"}>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {equipe.map(m=>(
            <div key={m.id} onClick={()=>toggleEq(m.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:f.eqIds.includes(m.id)?"var(--blue-l)":"var(--w)",border:"1.5px solid "+(f.eqIds.includes(m.id)?"var(--blue)":"var(--g2)"),borderRadius:"var(--r2)",cursor:"pointer"}}>
              <div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(f.eqIds.includes(m.id)?"var(--blue)":"var(--g3)"),background:f.eqIds.includes(m.id)?"var(--blue)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {f.eqIds.includes(m.id)&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <Av nom={m.nom} color={f.eqIds.includes(m.id)?"#2563EB":"#94A3B8"} size={30}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{m.nom}</div><div style={{fontSize:11,color:"var(--t3)"}}>{m.fn} · {m.qual}</div></div>
            </div>
          ))}
        </div>
      </Fld>
      <Fld label="Note interne"><textarea className="inp inp-a" style={{minHeight:60}} placeholder="Visible uniquement par l'équipe..." value={f.note} onChange={e=>s("note",e.target.value)}/></Fld>
    </Sheet>
  );
}

function FEditChantier({ chantier, equipe, onClose, onSave }) {
  const [f,setF]=useState({...chantier});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const assigned=equipe.filter(m=>m.chIds&&m.chIds.includes(chantier.id)).map(m=>m.id);
  const [eqIds,setEqIds]=useState(assigned);
  const toggleEq=id=>setEqIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  return (
    <Sheet title="Modifier le chantier" onClose={onClose} footer={<><button className="btn btn-blue btn-fw" onClick={()=>{onSave({...f,eqIds});onClose();}}>Enregistrer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Désignation"><input className="inp" value={f.nom||""} onChange={e=>s("nom",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Maître d'ouvrage"><input className="inp" value={f.client||""} onChange={e=>s("client",e.target.value)}/></Fld>
        <Fld label="Téléphone"><input className="inp" value={f.tel||""} onChange={e=>s("tel",e.target.value)}/></Fld>
      </div>
      <Fld label="Adresse"><input className="inp" value={f.adresse||""} onChange={e=>s("adresse",e.target.value)}/></Fld>
      <Fld label="Corps d'état"><input className="inp" value={f.corps||""} onChange={e=>s("corps",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Budget HT (€)"><input className="inp" type="number" value={f.budget||""} onChange={e=>s("budget",parseInt(e.target.value)||0)}/></Fld>
        <Fld label="Dépenses (€)"><input className="inp" type="number" value={f.dep||""} onChange={e=>s("dep",parseInt(e.target.value)||0)}/></Fld>
        <Fld label="Avancement (%)"><input className="inp" type="number" min="0" max="100" value={f.av||""} onChange={e=>s("av",parseInt(e.target.value)||0)}/></Fld>
        <Fld label="Taux horaire €/h"><input className="inp" type="number" value={f.taux||35} onChange={e=>s("taux",parseInt(e.target.value)||35)}/></Fld>
        <Fld label="Démarrage"><input className="inp" value={f.debut||""} onChange={e=>s("debut",e.target.value)}/></Fld>
        <Fld label="Fin contractuelle"><input className="inp" value={f.fin||""} onChange={e=>s("fin",e.target.value)}/></Fld>
        <Fld label="Heure RDV"><input className="inp" value={f.rdv||""} onChange={e=>s("rdv",e.target.value)}/></Fld>
        <Fld label="Météo"><input className="inp" value={f.meteo||""} onChange={e=>s("meteo",e.target.value)}/></Fld>
      </div>
      <Fld label="Statut"><select className="inp" value={f.statut||"planif"} onChange={e=>s("statut",e.target.value)}><option value="planif">Planifié</option><option value="actif">En cours</option><option value="livre">Livré</option></select></Fld>
      <Fld label="Priorité"><select className="inp" value={f.prio||2} onChange={e=>s("prio",parseInt(e.target.value))}><option value={1}>Urgent</option><option value={2}>Normal</option><option value={3}>Faible</option></select></Fld>
      <Fld label={"Équipe assignée ("+eqIds.length+")"}>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {equipe.map(m=>(
            <div key={m.id} onClick={()=>toggleEq(m.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:eqIds.includes(m.id)?"var(--blue-l)":"var(--w)",border:"1.5px solid "+(eqIds.includes(m.id)?"var(--blue)":"var(--g2)"),borderRadius:"var(--r2)",cursor:"pointer"}}>
              <div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(eqIds.includes(m.id)?"var(--blue)":"var(--g3)"),background:eqIds.includes(m.id)?"var(--blue)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {eqIds.includes(m.id)&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <Av nom={m.nom} color={eqIds.includes(m.id)?"#2563EB":"#94A3B8"} size={30}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{m.nom}</div><div style={{fontSize:11,color:"var(--t3)"}}>{m.fn} · {m.qual}</div></div>
            </div>
          ))}
        </div>
      </Fld>
      <Fld label="Note interne"><textarea className="inp inp-a" style={{minHeight:60}} value={f.note||""} onChange={e=>s("note",e.target.value)}/></Fld>
    </Sheet>
  );
}

function FTache({ chantiers, equipe, onClose, onSave }) {
  const [f,setF]=useState({titre:"",chId:"",resp:"",debut:"",fin:"",prio:2});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.titre.trim()&&f.chId;
  const duree=f.debut&&f.fin?Math.max(0,Math.round((new Date(f.fin)-new Date(f.debut))/86400000)):null;
  const chEquipe=f.chId?equipe.filter(m=>m.chIds&&m.chIds.includes(parseInt(f.chId))):equipe;
  return (
    <Sheet title="Nouvelle tâche" onClose={onClose} footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,duree:duree||1,statut:"planif"});onClose();}}>Créer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Désignation"><input className="inp" placeholder="Coulage dalle béton..." value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <Fld label="Chantier"><select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}><option value="">Sélectionner...</option>{chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></Fld>
      <Fld label="Intervenant assigné">
        <select className="inp" value={f.resp} onChange={e=>s("resp",e.target.value)}>
          <option value="">Non assigné</option>
          {chEquipe.map(m=><option key={m.id} value={m.nom}>{m.nom} — {m.fn}</option>)}
        </select>
      </Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Priorité"><select className="inp" value={f.prio} onChange={e=>s("prio",parseInt(e.target.value))}><option value={1}>Urgent</option><option value={2}>Normal</option><option value={3}>Faible</option></select></Fld>
        <Fld label="Durée estimée (j)"><input className="inp" type="number" min="1" placeholder="1" value={duree||""} readOnly style={{background:"var(--g1)"}}/></Fld>
        <Fld label="Début"><input className="inp" type="date" value={f.debut} onChange={e=>s("debut",e.target.value)}/></Fld>
        <Fld label="Fin prévue"><input className="inp" type="date" value={f.fin} onChange={e=>s("fin",e.target.value)}/></Fld>
      </div>
      {duree!==null&&duree>0&&<Alert msg={"Durée calculée : "+duree+" jour"+(duree>1?"s":"")} type="blue"/>}
    </Sheet>
  );
}

function FRapport({ chantiers, equipe, user, defaultChId="", onRememberCh, onClose, onSave }) {
  const [f,setF]=useState({chId:defaultChId?String(defaultChId):"",date:new Date().toLocaleDateString("fr-FR"),auteur:user?.nom||"",meteo:"",av:"",incidents:"RAS",presIds:[]});
  const s=(k,v)=>setF(p=>{const n={...p,[k]:v};if(k==="chId"&&v&&onRememberCh)onRememberCh(parseInt(v));return n;});
  const ok=f.chId&&f.av.trim();
  const chEquipe=f.chId?equipe.filter(m=>m.chIds&&m.chIds.includes(parseInt(f.chId))):equipe;
  const togglePres=nom=>setF(p=>({...p,presIds:p.presIds.includes(nom)?p.presIds.filter(x=>x!==nom):[...p.presIds,nom]}));
  return (
    <Sheet title="Compte-rendu journalier" onClose={onClose} footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,presences:f.presIds});onClose();}}>Enregistrer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Chantier"><select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}><option value="">Sélectionner...</option>{chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Rédacteur"><input className="inp" value={f.auteur} onChange={e=>s("auteur",e.target.value)}/></Fld>
        <Fld label="Météo"><input className="inp" placeholder="Ensoleillé 22°C" value={f.meteo} onChange={e=>s("meteo",e.target.value)}/></Fld>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {METEO_PRESETS.map(m=><button key={m} type="button" onClick={()=>s("meteo",m)} style={{padding:"6px 10px",borderRadius:"var(--r)",border:"1px solid "+(f.meteo===m?"var(--blue)":"var(--g2)"),background:f.meteo===m?"var(--blue-l)":"var(--w)",fontSize:11,fontWeight:600,color:f.meteo===m?"var(--blue)":"var(--t3)",cursor:"pointer",fontFamily:"var(--f)"}}>{m}</button>)}
      </div>
      <Fld label="Avancement des travaux"><textarea className="inp inp-a" placeholder="Travaux réalisés ce jour..." value={f.av} onChange={e=>s("av",e.target.value)}/></Fld>
      <Fld label="Incidents / Observations"><textarea className="inp inp-a" style={{minHeight:60}} placeholder="RAS, ou description..." value={f.incidents} onChange={e=>s("incidents",e.target.value)}/></Fld>
      <Fld label={"Personnel présent ("+f.presIds.length+")"}>
        {chEquipe.length>0&&<button type="button" className="btn btn-out btn-xs" style={{marginBottom:8}} onClick={()=>setF(p=>({...p,presIds:chEquipe.map(m=>m.nom)}))}>Tout présent</button>}
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {chEquipe.map(m=>(
            <div key={m.id} onClick={()=>togglePres(m.nom)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:f.presIds.includes(m.nom)?"var(--ok-l)":"var(--w)",border:"1.5px solid "+(f.presIds.includes(m.nom)?"var(--ok)":"var(--g2)"),borderRadius:"var(--r2)",cursor:"pointer"}}>
              <div style={{width:18,height:18,borderRadius:5,border:"2px solid "+(f.presIds.includes(m.nom)?"var(--ok)":"var(--g3)"),background:f.presIds.includes(m.nom)?"var(--ok)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {f.presIds.includes(m.nom)&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{fontSize:12,fontWeight:600,color:f.presIds.includes(m.nom)?"var(--ok)":"var(--t3)"}}>{m.nom}</span>
            </div>
          ))}
        </div>
      </Fld>
    </Sheet>
  );
}

function FAvenant({ chantiers, onClose, onSave }) {
  const [f,setF]=useState({chId:"",titre:"",desc:"",mt:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.chId&&f.titre.trim()&&parseInt(f.mt)>0;
  return (
    <Sheet title="Nouvel avenant" sub="Travaux supplémentaires au marché" onClose={onClose} footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({chId:parseInt(f.chId),titre:f.titre,desc:f.desc,mt:parseInt(f.mt),ref:"AV-"+String(Date.now()).slice(-3),statut:"attente",dc:new Date().toLocaleDateString("fr-FR"),ds:"",par:""});onClose();}}>Soumettre au MOA</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Alert msg="Un avenant doit être signé par le MOA avant tout commencement des travaux supplémentaires." type="warn"/>
      <Fld label="Chantier"><select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}><option value="">Sélectionner...</option>{chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom} — {c.client}</option>)}</select></Fld>
      <Fld label="Objet de l'avenant"><input className="inp" placeholder="Désignation courte des travaux" value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <Fld label="Description technique"><textarea className="inp inp-a" placeholder="Nature et étendue des travaux supplémentaires..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <Fld label="Montant HT (€)"><input className="inp" type="number" min="0" placeholder="0" value={f.mt} onChange={e=>s("mt",e.target.value)}/></Fld>
      {parseInt(f.mt)>0&&<div style={{padding:"12px 14px",background:"var(--ok-l)",border:"1px solid var(--ok-b)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:"var(--t2)"}}>Montant avenant HT</span><span style={{fontSize:17,fontWeight:800,color:"var(--ok)"}}>{EUR(parseInt(f.mt))}</span></div>}
    </Sheet>
  );
}

function FPunch({ chantiers, equipe, user, defaultChId="", onRememberCh, onClose, onSave }) {
  const [f,setF]=useState({chId:defaultChId?String(defaultChId):"",titre:"",desc:"",corps:"Maçonnerie",prio:1,ass:""});
  const s=(k,v)=>setF(p=>{const n={...p,[k]:v};if(k==="chId"&&v&&onRememberCh)onRememberCh(parseInt(v));return n;});
  const ok=f.chId&&f.titre.trim();
  return (
    <Sheet title="Nouvelle réserve" sub="Défaut ou non-conformité à corriger" onClose={onClose} footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,chId:parseInt(f.chId),ref:"RES-"+String(Date.now()).slice(-3),statut:"ouvert",sig:user?.nom||"",date:new Date().toLocaleDateString("fr-FR"),clos:"",prio:parseInt(f.prio)});onClose();}}>Enregistrer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Chantier"><select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}><option value="">Sélectionner...</option>{chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></Fld>
      <Fld label="Désignation du défaut"><input className="inp" placeholder="Description courte et précise" value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <Fld label="Localisation et détail"><textarea className="inp inp-a" placeholder="Localisation précise, nature du désordre..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Corps d'état"><select className="inp" value={f.corps} onChange={e=>s("corps",e.target.value)}>{["Maçonnerie","Plomberie","Électricité","Carrelage","Peinture","Menuiserie","Façade","Autre"].map(c=><option key={c} value={c}>{c}</option>)}</select></Fld>
        <Fld label="Criticité"><select className="inp" value={f.prio} onChange={e=>s("prio",parseInt(e.target.value))}><option value={1}>Bloquant</option><option value={2}>Majeur</option><option value={3}>Mineur</option></select></Fld>
      </div>
      <Fld label="Attribué à"><select className="inp" value={f.ass} onChange={e=>s("ass",e.target.value)}><option value="">Non attribué</option>{equipe.map(m=><option key={m.id} value={m.nom}>{m.nom} — {m.fn}</option>)}</select></Fld>
    </Sheet>
  );
}

function FIncident({ chantiers, user, ctx, edit, onClose, onSave, onUpdate }) {
  const isEdit=!!edit;
  const [f,setF]=useState(isEdit
    ? {chId:String(edit.chId),type:edit.type||"securite",desc:edit.desc||"",prio:edit.prio||1}
    : {chId:ctx&&ctx.chId?String(ctx.chId):"",type:"securite",desc:"",prio:1});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.chId&&f.desc.trim();
  const types=[{v:"securite",l:"Sécurité",e:"⚠️"},{v:"materiel",l:"Matériel cassé",e:"🔧"},{v:"retard",l:"Retard livraison",e:"📦"},{v:"manque",l:"Manque matériel",e:"📋"},{v:"autre",l:"Autre",e:"💬"}];
  const ctxLabel={chantiers:"depuis Chantiers",taches:"depuis Tâches",heures:"depuis Planning heures",punch:"depuis Punch list",commandes:"depuis Commandes",home:"depuis l'Accueil",planningEq:"depuis Planning équipe"}[ctx&&ctx.screen];
  return (
    <Sheet title={isEdit?"Modifier l'incident":"Signaler un incident"} sub={!isEdit&&ctxLabel?ctxLabel:undefined} onClose={onClose}
      footer={<>
        {isEdit
          ? <button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onUpdate(edit.id,{chId:parseInt(f.chId),type:f.type,desc:f.desc,prio:f.prio});onClose();}}>Enregistrer les modifications</button>
          : <button className="btn btn-err btn-fw" disabled={!ok} onClick={()=>{onSave({chId:parseInt(f.chId),type:f.type,desc:f.desc,prio:f.prio,ref:"INC-"+String(Date.now()).slice(-3),statut:"ouvert",sig:user?.nom||"",date:new Date().toLocaleDateString("fr-FR"),screen:ctx&&ctx.screen?ctx.screen:"home"});onClose();}}>Signaler maintenant</button>}
        <button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button>
      </>}>
      <Fld label="Chantier"><select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}><option value="">Sélectionner...</option>{chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></Fld>
      <Fld label="Type d'incident"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{types.map(t=><button key={t.v} type="button" onClick={()=>s("type",t.v)} style={{padding:"12px 8px",background:f.type===t.v?"var(--err-l)":"var(--w)",border:"1.5px solid "+(f.type===t.v?"var(--err)":"var(--g2)"),borderRadius:"var(--r2)",cursor:"pointer",textAlign:"center",fontFamily:"var(--f)"}}><div style={{fontSize:20,marginBottom:4}}>{t.e}</div><div style={{fontSize:12,fontWeight:600,color:f.type===t.v?"var(--err)":"var(--t2)"}}>{t.l}</div></button>)}</div></Fld>
      <Fld label="Description rapide"><textarea className="inp inp-a" placeholder="Décrivez brièvement l'incident..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <Fld label="Niveau d'urgence"><div style={{display:"flex",gap:8}}>{[{v:1,l:"Danger",c:"var(--err)"},{v:2,l:"Urgent",c:"var(--warn)"},{v:3,l:"Normal",c:"var(--ok)"}].map(u=><button key={u.v} type="button" onClick={()=>s("prio",u.v)} style={{flex:1,padding:"10px 4px",background:f.prio===u.v?u.c+"18":"var(--w)",border:"1.5px solid "+(f.prio===u.v?u.c:"var(--g2)"),borderRadius:"var(--r2)",cursor:"pointer",fontSize:12,fontWeight:700,color:f.prio===u.v?u.c:"var(--t3)",fontFamily:"var(--f)"}}>{u.l}</button>)}</div></Fld>
    </Sheet>
  );
}

function FDevis({ onClose, onSave }) {
  const [f,setF]=useState(()=>({ref:"DEV-2026-"+String(Date.now()).slice(-3),client:"",objet:"",date:new Date().toISOString().split("T")[0],validite:"",tva:20,remise:0}));
  const [lots,setLots]=useState([{nom:"Lot 1",lignes:[{desc:"",unite:"u",qte:1,pu:0}]}]);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const addLot=()=>setLots(p=>[...p,{nom:"Lot "+(p.length+1),lignes:[{desc:"",unite:"u",qte:1,pu:0}]}]);
  const addLigne=(li)=>setLots(p=>p.map((l,i)=>i===li?{...l,lignes:[...l.lignes,{desc:"",unite:"u",qte:1,pu:0}]}:l));
  const setLotNom=(li,v)=>setLots(p=>p.map((l,i)=>i===li?{...l,nom:v}:l));
  const setLigne=(li,lj,k,v)=>setLots(p=>p.map((l,i)=>i===li?{...l,lignes:l.lignes.map((lg,j)=>j===lj?{...lg,[k]:v}:lg)}:l));
  const totalHT=lots.reduce((s,l)=>s+l.lignes.reduce((ss,lg)=>ss+(lg.qte||0)*(lg.pu||0),0),0);
  const remise=Math.round(totalHT*(f.remise||0)/100);
  const netHT=totalHT-remise;
  const tvaM=Math.round(netHT*(f.tva||20)/100);
  const ttc=netHT+tvaM;
  const ok=f.client.trim()&&f.objet.trim()&&totalHT>0;
  return (
    <Sheet title="Créer un devis" sub="Chiffrage par lots" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,lots,statut:"brouillon"});onClose();}}>Créer le devis</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="N° Devis"><input className="inp" value={f.ref} onChange={e=>s("ref",e.target.value)}/></Fld>
        <Fld label="Date"><input className="inp" type="date" value={f.date} onChange={e=>s("date",e.target.value)}/></Fld>
      </div>
      <Fld label="Client"><input className="inp" placeholder="Nom du client ou prospect" value={f.client} onChange={e=>s("client",e.target.value)}/></Fld>
      <Fld label="Objet du devis"><input className="inp" placeholder="Ex : Rénovation SDB complète" value={f.objet} onChange={e=>s("objet",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <Fld label="TVA %"><input className="inp" type="number" value={f.tva} onChange={e=>s("tva",parseInt(e.target.value)||0)}/></Fld>
        <Fld label="Remise %"><input className="inp" type="number" value={f.remise} onChange={e=>s("remise",parseInt(e.target.value)||0)}/></Fld>
        <Fld label="Validité"><input className="inp" type="date" value={f.validite} onChange={e=>s("validite",e.target.value)}/></Fld>
      </div>
      {/* Lots */}
      {lots.map((lot,li)=>(
        <div key={li} style={{padding:"14px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
          <Fld label={"Nom du lot "+(li+1)}><input className="inp" value={lot.nom} onChange={e=>setLotNom(li,e.target.value)}/></Fld>
          {lot.lignes.map((lg,lj)=>(
            <div key={lj} style={{display:"grid",gridTemplateColumns:"1fr 50px 50px 60px",gap:6,marginTop:8}}>
              <input className="inp" style={{height:38,fontSize:12}} placeholder="Désignation" value={lg.desc} onChange={e=>setLigne(li,lj,"desc",e.target.value)}/>
              <input className="inp" style={{height:38,fontSize:12,textAlign:"center"}} placeholder="Qté" type="number" value={lg.qte||""} onChange={e=>setLigne(li,lj,"qte",parseInt(e.target.value)||0)}/>
              <select className="inp" style={{height:38,fontSize:10,padding:"0 4px"}} value={lg.unite} onChange={e=>setLigne(li,lj,"unite",e.target.value)}>
                {["u","m2","ml","m3","kg","h","forf"].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
              <input className="inp" style={{height:38,fontSize:12,textAlign:"right"}} placeholder="PU €" type="number" value={lg.pu||""} onChange={e=>setLigne(li,lj,"pu",parseFloat(e.target.value)||0)}/>
            </div>
          ))}
          <button className="btn btn-ghost btn-xs" style={{marginTop:8}} onClick={()=>addLigne(li)}>+ Ajouter une ligne</button>
        </div>
      ))}
      <button className="btn btn-out btn-sm" onClick={addLot}>+ Ajouter un lot</button>
      {/* Récap */}
      {totalHT>0&&(
        <div style={{padding:"14px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)"}}>
          <div className="row" style={{marginBottom:4}}><span style={{fontSize:12,color:"var(--t2)"}}>Total HT</span><span style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{EUR(totalHT)}</span></div>
          {f.remise>0&&<div className="row" style={{marginBottom:4}}><span style={{fontSize:12,color:"var(--ok)"}}>Remise {f.remise}%</span><span style={{fontSize:13,fontWeight:600,color:"var(--ok)"}}>-{EUR(remise)}</span></div>}
          <div className="row" style={{marginBottom:4}}><span style={{fontSize:12,color:"var(--t2)"}}>TVA {f.tva}%</span><span style={{fontSize:13,fontWeight:600,color:"var(--t3)"}}>{EUR(tvaM)}</span></div>
          <div className="row" style={{paddingTop:6,borderTop:"1px solid var(--blue-b)"}}><span style={{fontSize:14,fontWeight:700,color:"var(--blue)"}}>Total TTC</span><span style={{fontSize:18,fontWeight:800,color:"var(--blue)"}}>{EUR(ttc)}</span></div>
        </div>
      )}
    </Sheet>
  );
}

function FConge({ equipe, user, onClose, onSave }) {
  const isAdmin=user&&(user.role==="admin"||user.role==="chef");
  const [f,setF]=useState({nom:isAdmin?"":user?.nom||"",type:"conge",debut:"",fin:"",motif:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const jours=f.debut&&f.fin?Math.max(1,Math.round((new Date(f.fin)-new Date(f.debut))/86400000)+1):0;
  const ok=f.nom&&f.debut&&f.fin;
  return (
    <Sheet title="Demande de congé" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,jours,statut:"attente"});onClose();}}>Soumettre la demande</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      {isAdmin
        ? <Fld label="Collaborateur">
            <select className="inp" value={f.nom} onChange={e=>s("nom",e.target.value)}>
              <option value="">Sélectionner...</option>
              {equipe.map(m=><option key={m.id} value={m.nom}>{m.nom} — {m.fn}</option>)}
            </select>
          </Fld>
        : <div style={{padding:"10px 14px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)",fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:4}}>Demande pour : {user?.nom}</div>
      }
      <Fld label="Type">
        <select className="inp" value={f.type} onChange={e=>s("type",e.target.value)}>
          <option value="conge">Congés payés</option>
          <option value="rtt">RTT</option>
          <option value="maladie">Maladie</option>
          <option value="sans_solde">Sans solde</option>
        </select>
      </Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Du"><input className="inp" type="date" value={f.debut} onChange={e=>s("debut",e.target.value)}/></Fld>
        <Fld label="Au"><input className="inp" type="date" value={f.fin} onChange={e=>s("fin",e.target.value)}/></Fld>
      </div>
      {jours>0&&<Alert msg={jours+" jour"+(jours>1?"s":"")+" demandé"+(jours>1?"s":"")} type="blue"/>}
      <Fld label="Motif"><input className="inp" placeholder="Optionnel" value={f.motif} onChange={e=>s("motif",e.target.value)}/></Fld>
    </Sheet>
  );
}

function FDevisEdit({ devis, chantiers, onClose, onSave }) {
  const [f,setF]=useState({client:devis.client||"",objet:devis.objet||"",validite:devis.validite||"",tva:devis.tva||20,remise:devis.remise||0});
  const [lots,setLots]=useState(JSON.parse(JSON.stringify(devis.lots||[])));
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));
  const addLot=()=>setLots(p=>[...p,{nom:"Lot "+(p.length+1),lignes:[{desc:"",unite:"u",qte:1,pu:0}]}]);
  const addLigne=li=>setLots(p=>p.map((l,i)=>i===li?{...l,lignes:[...l.lignes,{desc:"",unite:"u",qte:1,pu:0}]}:l));
  const updLot=(li,k,v)=>setLots(p=>p.map((l,i)=>i===li?{...l,[k]:v}:l));
  const updLigne=(li,gi,k,v)=>setLots(p=>p.map((l,i)=>i===li?{...l,lignes:l.lignes.map((g,j)=>j===gi?{...g,[k]:k==="qte"||k==="pu"?parseFloat(v)||0:v}:g)}:l));
  const delLigne=(li,gi)=>setLots(p=>p.map((l,i)=>i===li?{...l,lignes:l.lignes.filter((_,j)=>j!==gi)}:l));
  const delLot=li=>setLots(p=>p.filter((_,i)=>i!==li));
  const totalHT=lots.reduce((s,l)=>s+l.lignes.reduce((ss,g)=>ss+(g.qte||0)*(g.pu||0),0),0);
  const remiseM=Math.round(totalHT*(f.remise||0)/100);
  const netHT=totalHT-remiseM;
  const tvaM=Math.round(netHT*(f.tva||20)/100);
  const ttc=netHT+tvaM;
  return (
    <div style={{position:"fixed",inset:0,background:"var(--w)",zIndex:200,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button className="btn btn-out btn-sm" onClick={onClose}>✕ Annuler</button>
        <div style={{flex:1,fontWeight:700,fontSize:14}}>Modifier le devis</div>
        <button className="btn btn-blue btn-sm" onClick={()=>onSave({...f,lots,tva:parseInt(f.tva),remise:parseFloat(f.remise)||0})}>Enregistrer</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",paddingBottom:40}}>
        {/* Infos générales */}
        <div className="sec">Informations générales</div>
        <div className="card" style={{padding:"16px",marginBottom:16}}>
          <Fld label="Client"><input className="inp" value={f.client} onChange={e=>sf("client",e.target.value)}/></Fld>
          <Fld label="Objet du devis"><input className="inp" value={f.objet} onChange={e=>sf("objet",e.target.value)}/></Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <Fld label="Validité"><input className="inp" type="date" value={f.validite} onChange={e=>sf("validite",e.target.value)}/></Fld>
            <Fld label="TVA %"><input className="inp" type="number" value={f.tva} onChange={e=>sf("tva",parseInt(e.target.value)||20)}/></Fld>
            <Fld label="Remise %"><input className="inp" type="number" min="0" max="100" value={f.remise} onChange={e=>sf("remise",parseFloat(e.target.value)||0)}/></Fld>
          </div>
        </div>
        {/* Lots */}
        <div className="row" style={{marginBottom:12}}><div className="sec" style={{margin:0}}>Lots ({lots.length})</div><button className="btn btn-blue btn-sm" onClick={addLot}>+ Ajouter un lot</button></div>
        {lots.map((lot,li)=>{
          const lotTotal=lot.lignes.reduce((s,g)=>s+(g.qte||0)*(g.pu||0),0);
          return (
            <div key={li} className="card" style={{padding:"14px 16px",marginBottom:12,border:"1px solid var(--g2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <input className="inp" style={{flex:1,fontWeight:700}} value={lot.nom} onChange={e=>updLot(li,"nom",e.target.value)} placeholder="Nom du lot"/>
                <span style={{fontSize:13,fontWeight:800,color:"var(--blue)",flexShrink:0}}>{EUR(lotTotal)}</span>
                {lots.length>1&&<button onClick={()=>delLot(li)} style={{background:"none",border:"none",color:"var(--err)",cursor:"pointer",fontSize:18,flexShrink:0}}>×</button>}
              </div>
              {/* En-tête tableau */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 55px 60px 70px 28px",gap:4,padding:"4px 0",borderBottom:"1.5px solid var(--g2)",marginBottom:4}}>
                {["Désignation","Qté","P.U. HT","Total",""].map((h,i)=><span key={i} style={{fontSize:9,fontWeight:700,color:"var(--t4)",textTransform:"uppercase",textAlign:i>1?"right":"left"}}>{h}</span>)}
              </div>
              {lot.lignes.map((g,gi)=>(
                <div key={gi} style={{display:"grid",gridTemplateColumns:"1fr 55px 60px 70px 28px",gap:4,padding:"4px 0",borderBottom:"1px solid var(--g2)",alignItems:"center"}}>
                  <input className="inp" style={{fontSize:12,padding:"4px 6px"}} value={g.desc} onChange={e=>updLigne(li,gi,"desc",e.target.value)} placeholder="Description"/>
                  <input className="inp" style={{fontSize:12,padding:"4px 4px",textAlign:"center"}} type="number" min="0" value={g.qte} onChange={e=>updLigne(li,gi,"qte",e.target.value)}/>
                  <input className="inp" style={{fontSize:12,padding:"4px 4px",textAlign:"right"}} type="number" min="0" value={g.pu} onChange={e=>updLigne(li,gi,"pu",e.target.value)}/>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--t1)",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{EUR((g.qte||0)*(g.pu||0))}</span>
                  <button onClick={()=>delLigne(li,gi)} style={{background:"none",border:"none",color:"var(--err)",cursor:"pointer",fontSize:16}}>×</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:"100%"}} onClick={()=>addLigne(li)}>+ Ligne</button>
            </div>
          );
        })}
        {/* Récap flottant */}
        <div className="card" style={{padding:"14px 16px",background:"var(--blue-l)",border:"1px solid var(--blue-b)"}}>
          {[{l:"Total HT",v:EUR(totalHT)},{l:"Remise "+f.remise+"%",v:"-"+EUR(remiseM)},{l:"Net HT",v:EUR(netHT),b:true},{l:"TVA "+f.tva+"%",v:EUR(tvaM)},{l:"TOTAL TTC",v:EUR(ttc),b:true,big:true}].map(r=>(
            <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--blue-bd)"}}>
              <span style={{fontSize:r.big?14:12,fontWeight:r.b?700:400,color:"var(--t2)"}}>{r.l}</span>
              <span style={{fontSize:r.big?20:14,fontWeight:r.b?800:600,color:r.big?"var(--blue)":"var(--t1)"}}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FAgenda({ chantiers, equipe, onClose, onSave }) {
  const [f,setF]=useState({date:"",heure:"",titre:"",chId:"",type:"reunion",duree:60,lieu:"",pour:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.date&&f.titre.trim();
  return (
    <Sheet title="Nouvel événement" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,id:Date.now()});onClose();}}>Ajouter</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Titre"><input className="inp" placeholder="Visite client, réunion chantier..." value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Date"><input className="inp" type="date" value={f.date} onChange={e=>s("date",e.target.value)}/></Fld>
        <Fld label="Heure"><input className="inp" type="time" value={f.heure} onChange={e=>s("heure",e.target.value)}/></Fld>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Type">
          <select className="inp" value={f.type} onChange={e=>s("type",e.target.value)}>
            <option value="visite">Visite client</option>
            <option value="reunion">Réunion</option>
            <option value="livraison">Livraison</option>
            <option value="prospect">Prospect</option>
            <option value="securite">Contrôle sécurité</option>
            <option value="autre">Autre</option>
          </select>
        </Fld>
        <Fld label="Durée (min)"><input className="inp" type="number" value={f.duree} onChange={e=>s("duree",parseInt(e.target.value)||0)}/></Fld>
      </div>
      <Fld label="Participant (équipe)">
        <select className="inp" value={f.pour} onChange={e=>s("pour",e.target.value)}>
          <option value="">Tout le monde / Non assigné</option>
          {(equipe||[]).map(m=><option key={m.id} value={m.nom}>{m.nom} — {m.fn}</option>)}
        </select>
      </Fld>
      <Fld label="Chantier lié">
        <select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}>
          <option value="">Aucun</option>
          {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Fld>
      <Fld label="Lieu"><input className="inp" placeholder="Adresse ou chantier" value={f.lieu} onChange={e=>s("lieu",e.target.value)}/></Fld>
    </Sheet>
  );
}

function FCommande({ chantiers, fournisseurs, defaultChId="", onRememberCh, onClose, onSave }) {
  const [f,setF]=useState({chId:defaultChId?String(defaultChId):"",fournisseur:"",fournisseurId:"",objet:"",mt:"",livraison:"",urgent:false});
  const s=(k,v)=>setF(p=>{const n={...p,[k]:v};if(k==="chId"&&v&&onRememberCh)onRememberCh(parseInt(v));return n;});
  const ok=f.chId&&f.fournisseur.trim()&&f.objet.trim();
  const annuaire=fournisseurs?.length?fournisseurs:D_FOURNISSEURS;
  const selFourn=f.fournisseurId?annuaire.find(x=>x.id===parseInt(f.fournisseurId)):null;
  const cats=[...new Set(annuaire.map(x=>x.cat))];
  const catLabel={materiaux:"Matériaux",plomberie:"Plomberie",electricite:"Électricité",location:"Location",enduits:"Enduits",bois:"Bois"};
  return (
    <Sheet title="Nouvelle commande" sub="Matériaux ou fournitures" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,chId:parseInt(f.chId),mt:parseInt(f.mt)||0,ref:"CMD-"+String(Date.now()).slice(-3),statut:"commandee",date:new Date().toLocaleDateString("fr-FR"),validePar:""});onClose();}}>Passer la commande</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Chantier">
        <select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}>
          <option value="">Sélectionner...</option>
          {chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Fld>
      <Fld label="Fournisseur">
        <select className="inp" value={f.fournisseurId} onChange={e=>{const fourn=annuaire.find(x=>x.id===parseInt(e.target.value));s("fournisseurId",e.target.value);if(fourn)s("fournisseur",fourn.nom);}}>
          <option value="">Choisir dans l'annuaire...</option>
          {cats.map(cat=>(
            <optgroup key={cat} label={catLabel[cat]||cat}>
              {annuaire.filter(x=>x.cat===cat).map(x=><option key={x.id} value={x.id}>{x.nom} — {x.tel}</option>)}
            </optgroup>
          ))}
        </select>
        {!f.fournisseurId&&<input className="inp" style={{marginTop:6}} placeholder="Ou saisir manuellement..." value={f.fournisseur} onChange={e=>s("fournisseur",e.target.value)}/>}
        {selFourn&&<div style={{display:"flex",alignItems:"center",gap:10,marginTop:8,padding:"10px 12px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)"}}>
          <span style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{selFourn.nom}</span>
          <a href={"tel:"+selFourn.tel.replace(/\s/g,"")} style={{marginLeft:"auto"}}><button className="btn btn-blue btn-xs">📞 {selFourn.tel}</button></a>
        </div>}
      </Fld>
      <Fld label="Désignation de la commande"><input className="inp" placeholder="Parpaings 20x20, ciment Portland..." value={f.objet} onChange={e=>s("objet",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Montant HT (€) — optionnel"><input className="inp" type="number" min="0" placeholder="0" value={f.mt} onChange={e=>s("mt",e.target.value)}/></Fld>
        <Fld label="Livraison prévue"><input className="inp" type="date" value={f.livraison} onChange={e=>s("livraison",e.target.value)}/></Fld>
      </div>
      <button type="button" onClick={()=>s("urgent",!f.urgent)} style={{width:"100%",padding:"11px",borderRadius:"var(--r2)",border:"1.5px solid "+(f.urgent?"var(--err)":"var(--g2)"),background:f.urgent?"var(--err-l)":"var(--w)",cursor:"pointer",fontWeight:700,fontSize:13,color:f.urgent?"var(--err)":"var(--t3)",fontFamily:"var(--f)"}}>
        {f.urgent?"🚨 COMMANDE URGENTE — priorité expresse":"Marquer comme urgente"}
      </button>
    </Sheet>
  );
}

function FHeures({ chantiers, equipe, user, heures=[], defaultChId="", onRememberCh, onClose, onSave }) {
  const isChef=user.role==="chef"||user.role==="admin";
  const [f,setF]=useState({
    nom: isChef?"":user.nom,
    chId: defaultChId?String(defaultChId):"", date:new Date().toISOString().split("T")[0],
    arr:"07:30", dep:"17:00", pause:45, desc:"",
    panier:true, trajet:false, zone:0,
  });
  const s=(k,v)=>setF(p=>{const n={...p,[k]:v};if(k==="chId"&&v&&onRememberCh)onRememberCh(parseInt(v));return n;});
  const hT=calcH({arr:f.arr,dep:f.dep,pause:f.pause});
  const hWarn=hT>12;
  const ok=f.nom&&f.chId&&f.arr&&f.dep&&hT>0;
  const repeatYesterday=()=>{
    const today=new Date().toISOString().split("T")[0];
    const last=heures.filter(h=>h.nom===(f.nom||user.nom)&&h.date<today).sort((a,b)=>b.date.localeCompare(a.date))[0];
    if(!last)return;
    setF(p=>({...p,chId:String(last.chId),arr:last.arr,dep:last.dep,pause:last.pause??45,desc:last.desc||"",panier:!!last.panier,trajet:!!last.trajet,zone:last.zone||0,date:today}));
  };
  return (
    <Sheet title="Saisir des heures" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,chId:parseInt(f.chId),id:Date.now(),val:false});onClose();}}>Enregistrer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      {isChef&&<Fld label="Collaborateur"><select className="inp" value={f.nom} onChange={e=>s("nom",e.target.value)}><option value="">Sélectionner...</option>{equipe.map(m=><option key={m.id} value={m.nom}>{m.nom} — {m.fn}</option>)}</select></Fld>}
      <Fld label="Chantier"><select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}><option value="">Sélectionner...</option>{chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></Fld>
      <button type="button" className="btn btn-out btn-sm btn-fw" style={{marginBottom:10}} onClick={repeatYesterday}>↩ Répéter la dernière saisie</button>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Date"><input className="inp" type="date" value={f.date} onChange={e=>s("date",e.target.value)}/></Fld>
        <Fld label="Pause (min)"><input className="inp" type="number" min="0" step="15" value={f.pause} onChange={e=>s("pause",parseInt(e.target.value)||0)}/></Fld>
        <Fld label="Heure arrivée"><input className="inp" type="time" value={f.arr} onChange={e=>s("arr",e.target.value)}/></Fld>
        <Fld label="Heure départ"><input className="inp" type="time" value={f.dep} onChange={e=>s("dep",e.target.value)}/></Fld>
      </div>
      {hT>0&&<div style={{padding:"10px 14px",background:hWarn?"var(--warn-l)":"var(--blue-l)",border:"1px solid "+(hWarn?"var(--warn-b)":"var(--blue-bd)"),borderRadius:"var(--r2)",textAlign:"center",marginBottom:4}}>
        <span style={{fontSize:18,fontWeight:800,color:hWarn?"var(--warn)":"var(--blue)"}}>{hT}h</span>
        <span style={{fontSize:12,color:"var(--t3)",marginLeft:6}}>net de pause</span>
        {hWarn&&<div style={{fontSize:11,color:"var(--warn)",marginTop:3}}>⚠ Plus de 12h — vérifier les horaires</div>}
      </div>}
      <Fld label="Description / chantier"><input className="inp" placeholder="Coulage dalle, plomberie RDC..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <div className="sec">Variables de paie</div>
      <div style={{display:"flex",gap:8}}>
        {[{k:"panier",l:"Panier repas"},{k:"trajet",l:"Indemnité trajet"}].map(v=>(
          <button key={v.k} type="button" onClick={()=>s(v.k,!f[v.k])} style={{flex:1,padding:"10px",borderRadius:"var(--r2)",border:"1.5px solid "+(f[v.k]?"var(--blue)":"var(--g2)"),background:f[v.k]?"var(--blue-l)":"var(--w)",cursor:"pointer",fontSize:12,fontWeight:700,color:f[v.k]?"var(--blue)":"var(--t3)",fontFamily:"var(--f)"}}>{f[v.k]?"✓ ":""}{v.l}</button>
        ))}
      </div>
      <Fld label="Zone (0 = pas de zone)"><input className="inp" type="number" min="0" max="5" value={f.zone||0} onChange={e=>s("zone",parseInt(e.target.value)||0)}/></Fld>
    </Sheet>
  );
}

function FSituation({ chantiers, onClose, onSave }) {
  const [f,setF]=useState({chId:"",titre:"",av:"",mt:"",desc:"",date:new Date().toLocaleDateString("fr-FR"),ech:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ch=f.chId?chantiers.find(c=>c.id===parseInt(f.chId)):null;
  const ok=f.chId&&parseInt(f.mt)>0&&f.titre.trim();
  return (
    <Sheet title="Nouvelle situation de travaux" sub="Facturation d'avancement" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({chId:parseInt(f.chId),ref:"SIT-"+String(Date.now()).slice(-3),num:(chantiers.find(c=>c.id===parseInt(f.chId))?.nom||""),titre:f.titre,av:parseInt(f.av)||0,mt:parseInt(f.mt),statut:"emise",date:f.date,ech:f.ech,desc:f.desc});onClose();}}>Émettre la situation</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Chantier"><select className="inp" value={f.chId} onChange={e=>s("chId",e.target.value)}><option value="">Sélectionner...</option>{chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom} — {c.client}</option>)}</select></Fld>
      <Fld label="Intitulé"><input className="inp" placeholder="Situation n°X — Description" value={f.titre} onChange={e=>s("titre",e.target.value)}/></Fld>
      <Fld label="Description des travaux facturés"><textarea className="inp inp-a" style={{minHeight:60}} placeholder="Nature des travaux, localisation..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Avancement (%)"><input className="inp" type="number" min="0" max="100" placeholder="0" value={f.av} onChange={e=>s("av",e.target.value)}/></Fld>
        <Fld label="Montant HT (€)"><input className="inp" type="number" min="0" placeholder="0" value={f.mt} onChange={e=>s("mt",e.target.value)}/></Fld>
        <Fld label="Date d'émission"><input className="inp" type="date" value={f.date} onChange={e=>s("date",e.target.value)}/></Fld>
        <Fld label="Échéance paiement"><input className="inp" type="date" value={f.ech} onChange={e=>s("ech",e.target.value)}/></Fld>
      </div>
      {parseInt(f.mt)>0&&ch&&<Alert msg={"Solde restant après cette situation : "+EUR(Math.max(0,ch.budget-parseInt(f.mt)))} type="blue"/>}
    </Sheet>
  );
}

function FClient({ onClose, onSave }) {
  const [f,setF]=useState({nom:"",tel:"",email:"",adresse:"",statut:"prospect",note:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.nom.trim();
  return (
    <Sheet title="Nouveau contact" sub="Client ou prospect" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({...f,ca:0,nbChantiers:0});onClose();}}>Ajouter</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Nom / Raison sociale"><input className="inp" placeholder="M. Martin, SCI Dupont..." value={f.nom} onChange={e=>s("nom",e.target.value)}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Téléphone"><input className="inp" type="tel" placeholder="06..." value={f.tel} onChange={e=>s("tel",e.target.value)}/></Fld>
        <Fld label="Email"><input className="inp" type="email" placeholder="email@..." value={f.email} onChange={e=>s("email",e.target.value)}/></Fld>
      </div>
      <Fld label="Adresse"><input className="inp" placeholder="N° rue, ville" value={f.adresse} onChange={e=>s("adresse",e.target.value)}/></Fld>
      <Fld label="Statut">
        <select className="inp" value={f.statut} onChange={e=>s("statut",e.target.value)}>
          <option value="prospect">Prospect</option>
          <option value="client">Client</option>
        </select>
      </Fld>
      <Fld label="Note"><input className="inp" placeholder="Premier contact, source..." value={f.note} onChange={e=>s("note",e.target.value)}/></Fld>
    </Sheet>
  );
}

function PrintModal({ doc, chantiers, user, onClose }) {
  if (!doc) return null;
  const { type, data: d } = doc;
  const today = new Date().toLocaleDateString("fr-FR");
  const ch = d?.chId != null ? chantiers?.find(c => c.id === parseInt(d.chId)) : null;
  const print = () => window.print();
  const share = async (text) => {
    if (navigator.share) await navigator.share({ title: "BuildEasy", text });
  };
  const email = (subject, body) => {
    window.location.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  };
  const whatsapp = (text) => window.open("https://wa.me/?text=" + encodeURIComponent(text));
  const docRef = d?.ref || d?.id || type;
  const shareTxt = () => "Document BuildEasy — " + type + " " + docRef;

  const calcDevis = dev => {
    let totalHT = 0;
    (dev?.lots || []).forEach(lot => (lot.lignes || []).forEach(l => { totalHT += (l.qte || 0) * (l.pu || 0); }));
    const remise = Math.round(totalHT * (dev?.remise || 0) / 100);
    const netHT = totalHT - remise;
    const tvaM = Math.round(netHT * (dev?.tva || 20) / 100);
    return { totalHT, remise, netHT, tva: tvaM, ttc: netHT + tvaM };
  };

  const th = { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em", padding: "8px 6px", borderBottom: "2px solid #e2e8f0" };
  const td = { fontSize: 12, padding: "7px 6px", borderBottom: "1px solid #f1f5f9", color: "#334155" };

  const DocHeader = ({ title, sub }) => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, paddingBottom: 16, borderBottom: "2px solid #2563EB" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#2563EB", letterSpacing: "-.02em" }}>BuildEasy</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Gestion de chantier BTP</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
        <div>{today}</div>
        {user?.nom && <div style={{ marginTop: 4 }}>{user.nom} — {ROLES[user.role]?.label}</div>}
      </div>
    </div>
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{sub}</div>}
    </div>
  </>
  );

  const renderBody = () => {
    if (type === "devis" && d) {
      const st = calcDevis(d);
      return (
        <>
          <DocHeader title={"DEVIS " + (d.ref || "")} sub={d.objet} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[{ l: "Client", v: d.client }, { l: "Date", v: d.date }, { l: "Validité", v: d.validite }, { l: "TVA", v: (d.tva || 20) + " %" }].map(x => (
              <div key={x.l} style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{x.l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{x.v || "—"}</div>
              </div>
            ))}
          </div>
          {(d.lots || []).map((lot, li) => {
            const lotTotal = (lot.lignes || []).reduce((s, l) => s + (l.qte || 0) * (l.pu || 0), 0);
            return (
              <div key={li} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{lot.nom}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#2563EB" }}>{EUR(lotTotal)}</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left" }}>Désignation</th>
                      <th style={{ ...th, textAlign: "center" }}>Qté</th>
                      <th style={{ ...th, textAlign: "right" }}>P.U. HT</th>
                      <th style={{ ...th, textAlign: "right" }}>Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lot.lignes || []).map((l, j) => (
                      <tr key={j}>
                        <td style={td}>{l.desc}</td>
                        <td style={{ ...td, textAlign: "center" }}>{l.qte} {l.unite}</td>
                        <td style={{ ...td, textAlign: "right" }}>{l.pu} €</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{EUR((l.qte || 0) * (l.pu || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "2px solid #e2e8f0" }}>
            {[
              { l: "Total HT brut", v: EUR(st.totalHT) },
              (d.remise || 0) > 0 && { l: "Remise " + d.remise + " %", v: "-" + EUR(st.remise), c: "#059669" },
              { l: "Net HT", v: EUR(st.netHT), bold: true },
              { l: "TVA " + (d.tva || 20) + " %", v: EUR(st.tva) },
              { l: "TOTAL TTC", v: EUR(st.ttc), big: true },
            ].filter(Boolean).map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: r.big ? 14 : 13, fontWeight: r.bold ? 700 : 400, color: r.c || "#475569" }}>{r.l}</span>
                <span style={{ fontSize: r.big ? 18 : 14, fontWeight: r.big || r.bold ? 800 : 600, color: r.c || "#0f172a" }}>{r.v}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 24 }}>Devis valable jusqu'au {d.validite || "—"}. Bon pour accord.</p>
        </>
      );
    }
    if (type === "facture" && d) {
      const ttc = Math.round((d.mt || 0) * 1.2);
      const tva = Math.round((d.mt || 0) * 0.2);
      return (
        <>
          <DocHeader title={"FACTURE " + (d.id || d.ref || "")} sub={d.desc || ch?.nom} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[{ l: "Client", v: d.client }, { l: "Chantier", v: ch?.nom }, { l: "Date d'émission", v: d.date }, { l: "Échéance", v: d.ech }].map(x => (
              <div key={x.l} style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{x.l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{x.v || "—"}</div>
              </div>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Description</th>
                <th style={{ ...th, textAlign: "right" }}>Montant HT</th>
                <th style={{ ...th, textAlign: "right" }}>TVA 20 %</th>
                <th style={{ ...th, textAlign: "right" }}>TTC</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>{d.desc || "Travaux"}</td>
                <td style={{ ...td, textAlign: "right" }}>{EUR(d.mt)}</td>
                <td style={{ ...td, textAlign: "right" }}>{EUR(tva)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{EUR(ttc)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ textAlign: "right", fontSize: 18, fontWeight: 800, color: "#2563EB" }}>TOTAL TTC : {EUR(ttc)}</div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 20 }}>Règlement par virement ou chèque à réception de facture.</p>
        </>
      );
    }
    if (type === "heures" && d) {
      const rows = d.heures || [];
      const totalH = rows.reduce((s, h) => s + (h.total ?? calcH(h)), 0);
      return (
        <>
          <DocHeader title="FEUILLE D'HEURES" sub={(d.nom || "") + " — " + (d.periode || "")} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date", "Arrivée", "Départ", "Pause", "Total", "Panier", "Trajet"].map(h => (
                  <th key={h} style={{ ...th, textAlign: h === "Date" ? "left" : "center" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => (
                <tr key={i}>
                  <td style={td}>{h.date}</td>
                  <td style={{ ...td, textAlign: "center" }}>{h.arr || "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}>{h.dep || "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}>{(h.pause || 0)} min</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{Math.round((h.total ?? calcH(h)) * 10) / 10}h</td>
                  <td style={{ ...td, textAlign: "center" }}>{h.panier ? "Oui" : "Non"}</td>
                  <td style={{ ...td, textAlign: "center" }}>{h.trajet ? "Oui" : "Non"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, fontSize: 15, fontWeight: 800, color: "#2563EB" }}>Total période : {Math.round(totalH * 10) / 10} h</div>
        </>
      );
    }
    if (type === "rapport" && d) {
      return (
        <>
          <DocHeader title="RAPPORT DE CHANTIER" sub={d.chantier || ch?.nom} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[{ l: "Date", v: d.date }, { l: "Rédacteur", v: d.redacteur || d.auteur }, { l: "Météo", v: d.meteo }, { l: "Effectif", v: (d.effectif ?? d.presences?.length ?? 0) + " personnes" }].map(x => (
              <div key={x.l} style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{x.l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{x.v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Travaux réalisés</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#334155", whiteSpace: "pre-wrap" }}>{d.travaux || d.av || "—"}</div>
          </div>
          {d.incidents && d.incidents !== "RAS" && (
            <div style={{ marginBottom: 16, padding: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", marginBottom: 6 }}>Incidents / remarques</div>
              <div style={{ fontSize: 13, color: "#92400e" }}>{d.incidents}</div>
            </div>
          )}
          {d.presences?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Présences</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {d.presences.map(p => (
                  <span key={p} style={{ fontSize: 12, padding: "4px 10px", background: "#f1f5f9", borderRadius: 6, color: "#475569" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </>
      );
    }
    return <p style={{ color: "#64748b" }}>Document non reconnu.</p>;
  };

  return (
    <div className="print-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="print-sheet">
        <div className="no-print" style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: "#0f172a", minWidth: 120 }}>Aperçu document</div>
          <button type="button" className="btn btn-blue btn-sm" onClick={print}>🖨 Imprimer / PDF</button>
          {typeof navigator !== "undefined" && navigator.share && (
            <button type="button" className="btn btn-out btn-sm" onClick={() => share(shareTxt())}>📤 Partager</button>
          )}
          <button type="button" className="btn btn-out btn-sm" onClick={() => email("BuildEasy — " + type + " " + docRef, shareTxt())}>✉️ Email</button>
          <button type="button" className="btn btn-out btn-sm" onClick={() => whatsapp(shareTxt())}>💬 WhatsApp</button>
          <button type="button" className="btn btn-out btn-sm" onClick={onClose}>Fermer</button>
        </div>
        <div className="print-doc" style={{ padding: "32px 36px" }}>
          {renderBody()}
        </div>
      </div>
    </div>
  );
}

function FFacture({ chantiers, devis, onClose, onSave }) {
  const [f,setF]=useState({chId:"",client:"",mt:"",desc:"",ech:"",fromDevis:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.chId&&f.client.trim()&&parseInt(f.mt)>0;
  const ch=f.chId?chantiers.find(c=>c.id===parseInt(f.chId)):null;
  const devisAcceptes=(devis||[]).filter(d=>d.statut==="accepte");
  const selectDevis=id=>{
    const d=devisAcceptes.find(x=>x.id===parseInt(id));
    if(d){
      let totalHT=0;
      (d.lots||[]).forEach(l=>l.lignes.forEach(li=>{totalHT+=(li.qte||0)*(li.pu||0);}));
      const remise=Math.round(totalHT*(d.remise||0)/100);
      const netHT=totalHT-remise;
      const tvaM=Math.round(netHT*(d.tva||20)/100);
      setF(p=>({...p,fromDevis:id,client:d.client,mt:String(netHT+tvaM),desc:"Facture depuis "+d.ref+" — "+d.objet}));
    }
  };
  return (
    <Sheet title="Nouvelle facture" sub="Émission d'une facture client" onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave({id:"FA-"+String(Date.now()).slice(-4),chId:parseInt(f.chId),client:f.client,mt:parseInt(f.mt),statut:"emise",date:new Date().toLocaleDateString("fr-FR"),ech:f.ech||"",desc:f.desc});onClose();}}>Émettre la facture</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      {devisAcceptes.length>0&&(
        <Fld label="Depuis un devis accepté (optionnel)">
          <select className="inp" value={f.fromDevis} onChange={e=>selectDevis(e.target.value)}>
            <option value="">Facture libre</option>
            {devisAcceptes.map(d=><option key={d.id} value={d.id}>{d.ref} — {d.client} — {d.objet}</option>)}
          </select>
        </Fld>
      )}
      <Fld label="Chantier">
        <select className="inp" value={f.chId} onChange={e=>{s("chId",e.target.value);const c=chantiers.find(x=>x.id===parseInt(e.target.value));if(c&&!f.client)s("client",c.client);}}>
          <option value="">Sélectionner...</option>
          {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Client"><input className="inp" value={f.client} onChange={e=>s("client",e.target.value)}/></Fld>
        <Fld label="Montant TTC (€)"><input className="inp" type="number" min="0" placeholder="0" value={f.mt} onChange={e=>s("mt",e.target.value)}/></Fld>
      </div>
      <Fld label="Description"><input className="inp" placeholder="Situation n°X, acompte, solde..." value={f.desc} onChange={e=>s("desc",e.target.value)}/></Fld>
      <Fld label="Échéance"><input className="inp" type="date" value={f.ech} onChange={e=>s("ech",e.target.value)}/></Fld>
      {parseInt(f.mt)>0&&(
        <div style={{padding:"12px 14px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,color:"var(--t2)"}}>Montant facture</span>
          <span style={{fontSize:18,fontWeight:800,color:"var(--blue)"}}>{EUR(parseInt(f.mt))}</span>
        </div>
      )}
    </Sheet>
  );
}

function LoginScreen({ onLogin }) {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [mdp,setMdp]=useState("");
  const [mdp2,setMdp2]=useState("");
  const [nom,setNom]=useState("");
  const [entreprise,setEntreprise]=useState("");
  const [err,setErr]=useState("");
  const [info,setInfo]=useState("");
  const [load,setLoad]=useState(false);
  const [showMdp,setShowMdp]=useState(false);

  const login = async () => {
    setErr(""); setInfo(""); setLoad(true);
    const emailNorm = email.trim().toLowerCase();
    if (DEMO_AUTH) {
      const local = COMPTES.find(c => c.email === emailNorm && c.mdp === mdp);
      if (local) { onLogin({ ...local, isLocal: true, chIds: local.chIds || [] }); setLoad(false); return; }
    }
    if (!isSupabaseConfigured) {
      setErr("Connexion cloud indisponible. Utilisez un compte démo ou configurez Supabase.");
      setLoad(false);
      return;
    }
    try {
      const appUser = await signInWithEmail(email, mdp);
      onLogin(appUser);
    } catch {
      setErr("Email ou mot de passe incorrect");
    } finally {
      setLoad(false);
    }
  };

  const signup = async () => {
    setErr(""); setInfo(""); setLoad(true);
    if (!nom.trim() || !entreprise.trim()) { setErr("Nom et entreprise requis"); setLoad(false); return; }
    if (mdp.length < 8) { setErr("Mot de passe : 8 caractères minimum"); setLoad(false); return; }
    if (mdp !== mdp2) { setErr("Les mots de passe ne correspondent pas"); setLoad(false); return; }
    if (!isSupabaseConfigured) { setErr("Inscription cloud indisponible"); setLoad(false); return; }
    try {
      const { user, needsEmailConfirmation } = await signUpWithEmail({ email, password: mdp, nom, entreprise });
      if (needsEmailConfirmation) {
        setInfo("Compte créé ! Vérifiez votre email pour confirmer, puis connectez-vous.");
        setMode("login");
      } else if (user) {
        onLogin(user);
      }
    } catch (e) {
      setErr(e?.message?.includes("already") ? "Cet email est déjà utilisé" : (e?.message || "Inscription impossible"));
    } finally {
      setLoad(false);
    }
  };

  const forgot = async () => {
    setErr(""); setInfo(""); setLoad(true);
    if (!email.trim()) { setErr("Indiquez votre email"); setLoad(false); return; }
    if (!isSupabaseConfigured) { setErr("Réinitialisation indisponible"); setLoad(false); return; }
    try {
      await resetPassword(email);
      setInfo("Email de réinitialisation envoyé — consultez votre boîte mail.");
    } catch {
      setErr("Impossible d'envoyer l'email");
    } finally {
      setLoad(false);
    }
  };

  const quick=(c)=>{ if(!DEMO_AUTH) return; onLogin({ ...c, isLocal: true, chIds: c.chIds || [] }); };

  const demoRiches=COMPTES.filter(c=>!c.vierge);
  const demoVierges=COMPTES.filter(c=>c.vierge);
  const roleIco={admin:"👔",chef:"👷",employe:"🦺",client:"👤"};
  const roleLabel={admin:"Gérant",chef:"Chef de chantier",employe:"Compagnon",client:"Client MOA"};

  return (
    <div style={{minHeight:"100vh",overflowY:"auto",background:"var(--bg)",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"40px 24px 32px",textAlign:"center",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:14}}>
          <div style={{width:40,height:40,background:"var(--blue)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(37,99,235,.3)"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <span style={{fontSize:24,fontWeight:800,color:"var(--t1)",letterSpacing:"-.03em"}}>BuildEasy</span>
        </div>
        <div style={{fontSize:13,color:"var(--t3)"}}>Logiciel de gestion BTP</div>
      </div>

      <div style={{padding:"24px",maxWidth:480,margin:"0 auto",width:"100%",display:"flex",flexDirection:"column",gap:20}}>

        {/* Connexion / Inscription */}
        <div className="card" style={{padding:"20px"}}>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[{id:"login",l:"Connexion"},{id:"signup",l:"Créer un compte"}].map(t=>(
              <button key={t.id} type="button" onClick={()=>{setMode(t.id);setErr("");setInfo("");}} style={{flex:1,padding:"10px",borderRadius:"var(--r2)",border:"1.5px solid "+(mode===t.id?"var(--blue)":"var(--g2)"),background:mode===t.id?"var(--blue-l)":"var(--w)",color:mode===t.id?"var(--blue)":"var(--t3)",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"var(--f)"}}>{t.l}</button>
            ))}
          </div>

          {mode==="signup"&&(
            <>
              <input className="inp" style={{marginBottom:10}} placeholder="Nom de l'entreprise" value={entreprise} onChange={e=>setEntreprise(e.target.value)}/>
              <input className="inp" style={{marginBottom:10}} placeholder="Votre nom" value={nom} onChange={e=>setNom(e.target.value)}/>
            </>
          )}

          <input className="inp" style={{marginBottom:10}} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(mode==="signup"?signup():login())}/>
          <div style={{position:"relative",marginBottom:mode==="signup"?10:err||info?10:14}}>
            <input className="inp" type={showMdp?"text":"password"} placeholder="Mot de passe" value={mdp} onChange={e=>setMdp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(mode==="signup"?signup():login())} style={{paddingRight:44}}/>
            <button type="button" onClick={()=>setShowMdp(!showMdp)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--t4)"}}>
              {showMdp?"🙈":"👁"}
            </button>
          </div>

          {mode==="signup"&&(
            <input className="inp" style={{marginBottom:err||info?10:14}} type={showMdp?"text":"password"} placeholder="Confirmer le mot de passe" value={mdp2} onChange={e=>setMdp2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&signup()}/>
          )}

          {err&&<div style={{padding:"8px 12px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:"var(--r2)",fontSize:12,color:"var(--err)",fontWeight:600,marginBottom:12}}>{err}</div>}
          {info&&<div style={{padding:"8px 12px",background:"var(--ok-l)",border:"1px solid #BBF7D0",borderRadius:"var(--r2)",fontSize:12,color:"var(--ok)",fontWeight:600,marginBottom:12}}>{info}</div>}

          {mode==="login"?(
            <>
              <button className="btn btn-blue btn-fw" onClick={login} disabled={!email||!mdp||load}>
                {load?"Connexion...":"Se connecter"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm btn-fw" style={{marginTop:10}} onClick={forgot} disabled={!email||load}>
                Mot de passe oublié ?
              </button>
            </>
          ):(
            <button className="btn btn-ok btn-fw" onClick={signup} disabled={!email||!mdp||!mdp2||!nom||!entreprise||load}>
              {load?"Création...":"Créer mon compte"}
            </button>
          )}

          {mode==="signup"&&<div style={{fontSize:11,color:"var(--t4)",marginTop:12,lineHeight:1.5}}>14 jours d'essai · Plan Starter · Données isolées par entreprise</div>}
        </div>

        {DEMO_AUTH&&(
        <>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{flex:1,height:1,background:"var(--g2)"}}/>
            <div style={{padding:"4px 12px",background:"var(--ok-l)",border:"1px solid #BBF7D0",borderRadius:99,fontSize:11,fontWeight:700,color:"var(--ok)",whiteSpace:"nowrap"}}>Comptes à donner aux prospects</div>
            <div style={{flex:1,height:1,background:"var(--g2)"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {demoVierges.map(c=>(
              <div key={c.id} className="card tap" style={{padding:"14px 16px",cursor:"pointer",border:"1.5px solid #BBF7D0",background:"var(--ok-l)"}} onClick={()=>quick(c)}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:"var(--ok)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,flexShrink:0}}>
                    {c.id-9}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:800,color:"var(--t1)"}}>{c.email}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{padding:"2px 8px",background:"var(--ok)",color:"#fff",borderRadius:99,fontSize:10,fontWeight:800}}>Gérant · Application vierge</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--ok)"}}>Mot de passe</div>
                    <div style={{fontSize:15,fontWeight:900,color:"var(--t1)",letterSpacing:".02em"}}>buildeasy</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:"var(--t4)",textAlign:"center",marginTop:8,lineHeight:1.5}}>
            Ces comptes démarrent avec une application 100% vierge — idéal pour que vos prospects explorent librement depuis le premier chantier.
          </div>
        </div>

        {/* Comptes démo riches — pour les présentations internes */}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{flex:1,height:1,background:"var(--g2)"}}/>
            <div style={{padding:"4px 12px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:99,fontSize:11,fontWeight:700,color:"var(--blue)",whiteSpace:"nowrap"}}>Démo enrichie — présentation interne</div>
            <div style={{flex:1,height:1,background:"var(--g2)"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {demoRiches.map(c=>(
              <div key={c.id} className="card tap" style={{padding:"14px 16px",cursor:"pointer"}} onClick={()=>quick(c)}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:c.role==="admin"?"var(--blue)":c.role==="chef"?"var(--ok)":c.role==="employe"?"var(--warn)":"#7C3AED",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                    {roleIco[c.role]}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:2}}>{c.nom}</div>
                    <div style={{fontSize:12,color:"var(--t3)"}}>{roleLabel[c.role]||c.role} · {c.email}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:11,color:"var(--t4)"}}>Mot de passe</div>
                    <div style={{fontSize:13,fontWeight:700,color:"var(--t2)",fontFamily:"monospace"}}>{c.mdp}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </>
        )}

        <div style={{textAlign:"center",fontSize:11,color:"var(--t4)",paddingBottom:20}}>
          BuildEasy © 2026 · contact@buildeasy.eu
        </div>
      </div>
    </div>
  );
}


function HomeScreen({ user, perms, data, onNav, onSheet, onUpdCh, onNotify }) {
  const { chantiers,taches,factures,avenants,punch,equipe,incidents,heures,agenda,conges,commandes } = data;
  const role=ROLES[user.role];
  const myCh=user.role==="admin"?chantiers:chantiers.filter(c=>chIdsOf(user).includes(c.id));
  const actifs=myCh.filter(c=>c.statut==="actif");
  const scopedFactures=user.role==="admin"?factures:factures.filter(f=>chIdsOf(user).includes(f.chId));
  const retards=perms.montants?scopedFactures.filter(f=>f.statut==="retard"):[];
  const encaisse=scopedFactures.filter(f=>f.statut==="encaissee").reduce((s,f)=>s+f.mt,0);
  const avAtt=avenants.filter(a=>a.statut==="attente"&&(user.role==="admin"||chIdsOf(user).includes(a.chId)));
  const punchOuv=punch.filter(p=>p.statut!=="clos"&&(user.role==="admin"||chIdsOf(user).includes(p.chId)));
  const incOuv=incidents.filter(i=>i.statut==="ouvert"&&(user.role==="admin"||chIdsOf(user).includes(i.chId)));
  const myTaches=taches.filter(t=>(user.role==="admin"||chIdsOf(user).includes(t.chId))&&t.statut!=="fait");
  const monCh=myCh.find(c=>c.statut==="actif");
  const todayStr=new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"}).replace(/\//g,"/");
  const todayISO=new Date().toISOString().split("T")[0];
  const agendaToday=(agenda||[]).filter(e=>e.date===todayStr);
  const myEquipe=user.role==="admin"?equipe:(equipe||[]).filter(m=>(m.chIds||[]).some(id=>chIdsOf(user).includes(id)));
  const congesAtt=(conges||[]).filter(c=>c.statut==="attente"&&(user.role==="admin"||myEquipe.some(m=>m.nom===c.nom)));
  const cmdEnCours=(commandes||[]).filter(c=>(c.statut==="commandee"||c.statut==="attente")&&(user.role==="admin"||chIdsOf(user).includes(c.chId)));
  const livraisonsJour=cmdEnCours.filter(c=>c.livraison===todayStr);
  const heuresAujourdhui=(heures||[]).some(h=>h.nom===user.nom&&h.date===todayISO);
  const heuresNonSaisies=myEquipe.filter(m=>m.statut!=="absent"&&!(heures||[]).some(h=>h.nom===m.nom&&h.date===todayISO));
  const totalMasseSalariale=actifs.reduce((s,c)=>{
    const h=(heures||[]).filter(x=>x.chId===c.id).reduce((ss,x)=>ss+calcH(x),0);
    return s+Math.round(h*(c.taux||35));
  },0);
  const tIco={visite:"👤",reunion:"📅",livraison:"📦",prospect:"💼",securite:"⛑️",autre:"📌"};

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"18px 20px 16px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div className="row">
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Av nom={user.nom} color={role.color} size={44}/>
            <div><div style={{fontSize:16,fontWeight:700,color:"var(--t1)"}}>Bonjour, {user.nom.split(" ")[0]}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{role.label} · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div></div>
          </div>
          {((perms.montants&&retards.length>0)||(perms.incidents&&incOuv.length>0))&&<div style={{padding:"5px 10px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:"var(--r)"}}><span style={{fontSize:11,fontWeight:700,color:"var(--err)"}}>⚠ {(perms.montants?retards.length:0)+(perms.incidents?incOuv.length:0)} alerte{((perms.montants?retards.length:0)+(perms.incidents?incOuv.length:0))>1?"s":""}</span></div>}
        </div>
      </div>
      <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:20}}>

        {/* ── MA JOURNÉE — Résumé condensé pour gérant ET chef ── */}
        {(user.role==="admin"||user.role==="chef")&&(
          <div className="u0">
            <div className="sec">Ma journée</div>
            <div className="card" style={{padding:"16px",borderLeft:"4px solid var(--blue)"}}>
              {/* Agenda du jour */}
              {agendaToday.length>0?(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Programme du jour</div>
                  {agendaToday.map(e=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid var(--g2)"}}>
                      <span style={{fontSize:16}}>{tIco[e.type]||"📌"}</span>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{e.heure} — {e.titre}</div>{e.lieu&&<div style={{fontSize:11,color:"var(--t4)"}}>📍 {e.lieu}</div>}</div>
                      <span style={{fontSize:11,color:"var(--t4)"}}>{e.duree}min</span>
                    </div>
                  ))}
                </div>
              ):<div style={{fontSize:13,color:"var(--t4)",marginBottom:12}}>Aucun rendez-vous prévu aujourd'hui</div>}
              {/* Résumé rapide */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[
                  {l:"Chantiers actifs",v:actifs.length+"",c:"var(--blue)"},
                  {l:"Tâches urgentes", v:myTaches.filter(t=>t.prio===1).length+"",c:myTaches.filter(t=>t.prio===1).length>0?"var(--err)":"var(--ok)"},
                  {l:"Heures non saisies",v:heuresNonSaisies.length+" pers.",c:heuresNonSaisies.length>0?"var(--warn)":"var(--ok)"},
                  {l:"Congés à valider",v:congesAtt.length+"",c:congesAtt.length>0?"var(--warn)":"var(--ok)"},
                  {l:"Livraisons attendues",v:cmdEnCours.length+"",c:cmdEnCours.length>0?"var(--blue)":"var(--t4)"},
                  ...(perms.montants?[{l:"Factures en retard",v:retards.length+"",c:retards.length>0?"var(--err)":"var(--ok)"}]:[]),
                ].map(m=>(
                  <div key={m.l} style={{padding:"8px 10px",background:"var(--g1)",borderRadius:"var(--r)",border:"1px solid var(--g2)"}}>
                    <div style={{fontSize:16,fontWeight:800,color:m.c,marginBottom:2}}>{m.v}</div>
                    <div style={{fontSize:10,color:"var(--t4)"}}>{m.l}</div>
                  </div>
                ))}
              </div>
              {/* Alertes condensées */}
              {heuresNonSaisies.length>0&&(
                <div style={{marginTop:10,padding:"8px 10px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)"}}>
                  ⚠ Heures non saisies : {heuresNonSaisies.map(m=>m.nom.split(" ")[0]).join(", ")}
                </div>
              )}
              {livraisonsJour.length>0&&(
                <div style={{marginTop:10,padding:"8px 10px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--blue)"}}>
                  📦 Livraison{livraisonsJour.length>1?"s":""} aujourd'hui : {livraisonsJour.map(c=>c.fournisseur.split(" ")[0]).join(", ")}
                  <button className="btn btn-ghost btn-xs" style={{marginLeft:8}} onClick={()=>onNav("commandes")}>Voir →</button>
                </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{marginTop:10}} onClick={()=>onNav("agenda")}>Voir l'agenda complet →</button>
            </div>
          </div>
        )}

        {/* ── Chantier du jour (compagnon / chef) ── */}
        {(user.role==="employe"||user.role==="chef")&&monCh&&(
          <div className="u0">
            <div className="sec">Chantier du jour</div>
            <div className="card" style={{padding:"18px",borderLeft:"4px solid var(--blue)"}}>
              <div className="row" style={{marginBottom:12}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:4}}>{monCh.nom}</div>
                  <a href={"https://maps.google.com/?q="+encodeURIComponent(monCh.adresse||"")} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                    <div style={{fontSize:13,color:"var(--blue)",marginBottom:4}}>📍 {monCh.adresse} →</div>
                  </a>
                  <AddrActions adresse={monCh.adresse} onCopy={onNotify}/>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {monCh.rdv&&<div style={{padding:"4px 10px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r)",fontSize:12,fontWeight:600,color:"var(--blue)"}}>🕐 RDV {monCh.rdv}</div>}
                    {monCh.meteo&&monCh.meteo!=="—"&&<div style={{padding:"4px 10px",background:"var(--g1)",border:"1px solid var(--g2)",borderRadius:"var(--r)",fontSize:12,color:"var(--t3)"}}>🌤 {monCh.meteo}</div>}
                  </div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:30,fontWeight:900,color:"var(--blue)",letterSpacing:"-.02em",lineHeight:1}}>{monCh.av}%</div>
                  <div style={{fontSize:10,color:"var(--t4)",marginTop:2}}>avancement</div>
                </div>
              </div>
              <PBar v={monCh.av} h={6}/>
              {/* MAJ rapide avancement — chef/admin */}
              {perms.modCh&&onUpdCh&&monCh.av<100&&(
                <div style={{display:"flex",gap:6,marginTop:10,alignItems:"center"}}>
                  <span style={{fontSize:11,color:"var(--t4)",flexShrink:0}}>Avancement :</span>
                  {[-5,+5,+10].map(d=>(
                    <button key={d} onClick={()=>onUpdCh(monCh.id,"av",Math.min(100,Math.max(0,(monCh.av||0)+d)))} style={{flex:1,padding:"7px 4px",borderRadius:"var(--r)",border:"1px solid var(--g2)",background:"var(--g1)",cursor:"pointer",fontWeight:700,fontSize:12,color:d>0?"var(--ok)":"var(--err)",fontFamily:"var(--f)"}}>
                      {d>0?"+":""}{d}%
                    </button>
                  ))}
                  <button onClick={()=>onUpdCh(monCh.id,"av",100)} style={{flex:1,padding:"7px 4px",borderRadius:"var(--r)",border:"1px solid var(--ok)",background:"var(--ok-l)",cursor:"pointer",fontWeight:700,fontSize:11,color:"var(--ok)",fontFamily:"var(--f)"}}>
                    100%
                  </button>
                </div>
              )}
              {monCh.note&&<div style={{marginTop:10,padding:"8px 12px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)",fontWeight:600}}>⚠ {monCh.note}</div>}
              {myTaches.filter(t=>t.chId===monCh.id).length>0&&(
                <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--g2)"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Mes tâches du jour</div>
                  {myTaches.filter(t=>t.chId===monCh.id).slice(0,4).map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--g2)"}}>
                      <div style={{width:20,height:20,borderRadius:6,border:"2px solid "+(t.statut==="fait"?"var(--ok)":t.statut==="en_cours"?"var(--blue)":"var(--g3)"),background:t.statut==="fait"?"var(--ok)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {t.statut==="fait"&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        {t.statut==="en_cours"&&<div style={{width:6,height:6,background:"var(--blue)",borderRadius:"50%"}}/>}
                      </div>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{t.titre}</div><div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>{t.resp} · {t.debut} → {t.fin}</div></div>
                      {t.prio===1&&<Tag label="Urgent" type="err"/>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Saisie heures rapide (compagnon / chef) ── */}
        {perms.heures&&monCh&&!heuresAujourdhui&&(user.role==="employe"||user.role==="chef")&&(
          <div className="u0">
            <div className="card" style={{padding:"14px 16px",borderLeft:"4px solid var(--ok)",display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:26}}>⏱</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>Heures du jour</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>Pas encore saisies pour aujourd'hui</div>
              </div>
              <button className="btn btn-ok btn-sm" onClick={()=>onSheet("heure",{defaultChId:monCh.id})}>Saisir</button>
            </div>
          </div>
        )}

        {/* ── KPIs gérant enrichis ── */}
        {user.role==="admin"&&(
          <div className="u1">
            <div className="sec">Vue d'ensemble</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <Kpi label="Chantiers actifs" value={actifs.length} sub={"sur "+chantiers.length+" total"} color="var(--blue)" onClick={()=>onNav("chantiers")}/>
              <Kpi label="Encaissé" value={EUR(encaisse)} sub={retards.length>0?retards.length+" retard(s)":"À jour"} color={retards.length>0?"var(--err)":"var(--ok)"}/>
              <Kpi label="Avenants en attente" value={avAtt.length} sub="signature MOA requise" color={avAtt.length>0?"var(--warn)":"var(--t4)"} onClick={()=>onNav("avenants")}/>
              <Kpi label="Réserves ouvertes" value={punchOuv.length} sub="punch list active" color={punchOuv.length>0?"var(--err)":"var(--ok)"} onClick={()=>onNav("punch")}/>
            </div>
            {/* Budget global + Masse salariale */}
            <div className="card" style={{padding:"14px 16px"}}>
              <div className="row" style={{marginBottom:8}}><span style={{fontSize:13,fontWeight:600,color:"var(--t2)"}}>Budget global actifs</span><span style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{EUR(actifs.reduce((s,c)=>s+c.budget,0))}</span></div>
              <div className="row" style={{marginBottom:6}}><span style={{fontSize:12,color:"var(--t4)"}}>Dépenses engagées</span><span style={{fontSize:12,fontWeight:600,color:"var(--warn)"}}>{EUR(actifs.reduce((s,c)=>s+c.dep,0))}</span></div>
              <PBar v={PCT(actifs.reduce((s,c)=>s+c.dep,0),actifs.reduce((s,c)=>s+c.budget,1))} h={6}/>
              <div className="row" style={{marginTop:8}}><span style={{fontSize:12,color:"var(--t4)"}}>Marge brute estimée</span><span style={{fontSize:13,fontWeight:700,color:"var(--ok)"}}>{EUR(actifs.reduce((s,c)=>s+calcMargeChantier(c,heures,equipe,commandes).margeReelle,0))}</span></div>
              <div className="div" style={{margin:"10px 0"}}/>
              <div className="row"><span style={{fontSize:12,color:"var(--t4)"}}>Coût masse salariale total</span><span style={{fontSize:13,fontWeight:700,color:"var(--blue)"}}>{EUR(totalMasseSalariale)}</span></div>
            </div>
          </div>
        )}

        {/* ── Alertes critiques ── */}
        {perms.montants&&retards.length>0&&<div className="u1"><Alert msg={"⚠ "+retards.length+" facture"+(retards.length>1?"s en retard":" en retard")} type="err">{retards.map(f=><div key={f.id} className="row" style={{padding:"5px 0",borderBottom:"1px solid var(--err-b)"}}><span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>{f.client}</span><span style={{fontSize:13,fontWeight:700,color:"var(--err)"}}>{EUR(f.mt)}</span></div>)}<button className="btn btn-out btn-sm" style={{marginTop:10,width:"100%"}} onClick={()=>onNav("finances")}>Gérer →</button></Alert></div>}
        {perms.incidents&&incOuv.length>0&&<div className="u1"><Alert msg={"⚠ "+incOuv.length+" incident"+(incOuv.length>1?"s non traités":" non traité")} type="err">{incOuv.slice(0,2).map(i=>{const ch=chantiers.find(c=>c.id===i.chId);return <div key={i.id} style={{fontSize:12,color:"var(--t2)",padding:"3px 0"}}>{i.ref} · {ch?.nom?.split(" ").slice(0,3).join(" ")||"—"}</div>;})}<button className="btn btn-out btn-sm" style={{marginTop:10,width:"100%"}} onClick={()=>onNav("incidents")}>Traiter →</button></Alert></div>}
        {user.role==="client"&&avAtt.filter(a=>chIdsOf(user).includes(a.chId)).length>0&&<div className="u1"><Alert msg="Avenants en attente de signature" type="warn">{avAtt.filter(a=>chIdsOf(user).includes(a.chId)).map(a=><div key={a.id} className="row" style={{padding:"5px 0",borderBottom:"1px solid var(--warn-b)"}}><span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>{a.titre}</span><span style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{EUR(a.mt)}</span></div>)}<button className="btn btn-warn btn-sm" style={{marginTop:10,width:"100%"}} onClick={()=>onNav("avenants")}>Signer →</button></Alert></div>}

        {/* ── Équipe chef enrichie ── */}
        {user.role==="chef"&&(
          <div className="u2">
            <div className="sec">Équipe aujourd'hui</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"Présents",v:myEquipe.filter(m=>m.statut==="present").length,c:"var(--ok)"},{l:"Retards",v:myEquipe.filter(m=>m.statut==="retard").length,c:"var(--warn)"},{l:"Absents",v:myEquipe.filter(m=>m.statut==="absent").length,c:"var(--err)"}].map((m,i)=><div key={i} className="card" style={{padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:m.c,marginBottom:3}}>{m.v}</div><div style={{fontSize:11,color:"var(--t3)"}}>{m.l}</div></div>)}
            </div>
            {myEquipe.filter(m=>m.statut==="retard").length>0&&(
              <Alert msg="En retard" type="warn">
                {myEquipe.filter(m=>m.statut==="retard").map(m=>(
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <Av nom={m.nom} color="var(--warn)" size={28}/>
                    <span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>{m.nom} — {m.fn}</span>
                    {m.tel&&perms.tels&&<a href={"tel:"+m.tel} style={{marginLeft:"auto"}}><button className="btn btn-out btn-xs">Appeler</button></a>}
                  </div>
                ))}
              </Alert>
            )}
          </div>
        )}

        {/* ── Chantiers actifs ── */}
        {actifs.length>0&&(
          <div className="u2">
            <div className="row" style={{marginBottom:10}}><div className="sec" style={{margin:0}}>Chantiers en cours</div><button className="btn-ghost btn" style={{minHeight:32,fontSize:12,padding:"0 8px"}} onClick={()=>onNav("chantiers")}>Voir tout →</button></div>
            <div className="col gap10">
              {actifs.slice(0,3).map(c=>{
                const p=PCT(c.dep,c.budget);
                return (
                  <div key={c.id} className="card" style={{padding:"16px",borderLeft:"3px solid "+(c.prio===1?"var(--err)":c.prio===2?"var(--warn)":"var(--ok)")}}>
                    <div className="row" style={{marginBottom:10}}>
                      <div style={{flex:1,paddingRight:12}}><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{c.client} · Fin {c.fin}</div></div>
                      <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:22,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{c.av}%</div>{perms.montants&&<div style={{fontSize:11,color:p>75?"var(--err)":p>50?"var(--warn)":"var(--ok)",marginTop:2}}>Budget {p}%</div>}</div>
                    </div>
                    <PBar v={c.av} h={6}/>
                    {c.note&&<div style={{marginTop:8,padding:"6px 10px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)",fontWeight:500}}>⚠ {c.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Client — son chantier ── */}
        {user.role==="client"&&myCh.map(c=>(
          <div key={c.id} className="card u2" style={{padding:"16px"}}>
            <div style={{fontSize:15,fontWeight:700,color:"var(--t1)",marginBottom:4}}>{c.nom}</div>
            <div style={{fontSize:12,color:"var(--t3)",marginBottom:10}}>📍 {c.adresse} · Fin {c.fin}</div>
            <div className="row" style={{marginBottom:6}}><span style={{fontSize:13,color:"var(--t3)"}}>Avancement physique</span><span style={{fontSize:13,fontWeight:700,color:"var(--blue)"}}>{c.av}%</span></div>
            <PBar v={c.av} h={8}/>
            {perms.montants&&<div className="row" style={{marginTop:10}}><span style={{fontSize:12,color:"var(--t3)"}}>Marché HT</span><span style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{EUR(c.budget)}</span></div>}
          </div>
        ))}

        {/* ── Actions rapides ── */}
        <div className="u3">
          <div className="sec">Actions rapides</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {perms.rapport&&<div role="button" tabIndex={0} aria-label="Compte-rendu" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("rapport")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onSheet("rapport"))}><div style={{fontSize:24,marginBottom:8}}>📋</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Compte-rendu</div><div style={{fontSize:12,color:"var(--t3)"}}>Rapport journalier</div></div>}
            {perms.chat&&<div role="button" tabIndex={0} aria-label="Messagerie" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onNav("chat")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onNav("chat"))}><div style={{fontSize:24,marginBottom:8}}>💬</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Messagerie</div><div style={{fontSize:12,color:"var(--t3)"}}>Chat chantier</div></div>}
            {perms.gPunch&&<div role="button" tabIndex={0} aria-label="Réserves" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onNav("punch")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onNav("punch"))}><div style={{fontSize:24,marginBottom:8}}>🔧</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Réserves</div><div style={{fontSize:12,color:"var(--t3)"}}>{punchOuv.length} ouvertes</div></div>}
            {perms.creerCh&&<div role="button" tabIndex={0} aria-label="Nouveau chantier" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("chantier")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onSheet("chantier"))}><div style={{fontSize:24,marginBottom:8}}>🏗</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Nouveau chantier</div><div style={{fontSize:12,color:"var(--t3)"}}>Créer un dossier</div></div>}
            {perms.creerAv&&<div role="button" tabIndex={0} aria-label="Avenant" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("avenant")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onSheet("avenant"))}><div style={{fontSize:24,marginBottom:8}}>📄</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Avenant</div><div style={{fontSize:12,color:"var(--t3)"}}>Travaux supplémentaires</div></div>}
            {perms.montants&&<div role="button" tabIndex={0} aria-label="Nouveau devis" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("devis")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onSheet("devis"))}><div style={{fontSize:24,marginBottom:8}}>📝</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Nouveau devis</div><div style={{fontSize:12,color:"var(--t3)"}}>Chiffrer un projet</div></div>}
            {perms.heures&&<div role="button" tabIndex={0} aria-label="Saisir mes heures" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onSheet("heure",monCh?{defaultChId:monCh.id}:undefined)} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onSheet("heure",monCh?{defaultChId:monCh.id}:undefined))}><div style={{fontSize:24,marginBottom:8}}>⏱</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Saisir mes heures</div><div style={{fontSize:12,color:"var(--t3)"}}>Pointage du jour</div></div>}
            {perms.heures&&<div role="button" tabIndex={0} aria-label="Planning heures" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onNav("heures")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onNav("heures"))}><div style={{fontSize:24,marginBottom:8}}>📊</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Planning heures</div><div style={{fontSize:12,color:"var(--t3)"}}>Semaine équipe</div></div>}
            <div role="button" tabIndex={0} aria-label="Agenda" className="card tap" style={{padding:"16px",cursor:"pointer"}} onClick={()=>onNav("agenda")} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onNav("agenda"))}><div style={{fontSize:24,marginBottom:8}}>📅</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:3}}>Agenda</div><div style={{fontSize:12,color:"var(--t3)"}}>{agendaToday.length} événement{agendaToday.length>1?"s":""} aujourd'hui</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
function ChantiersScreen({ user, perms, chantiers, taches, equipe, heures, commandes, notes, onSave, onNav, onAddNote, onDelNote, onNotify }) {
  const [q,setQ]=useState("");
  const [f,setF]=useState("tous");
  const [selId,setSelId]=useState(null);
  const [showEdit,setShowEdit]=useState(false);
  const [noteTxt,setNoteTxt]=useState("");
  const visible=(user.role==="admin"?chantiers:chantiers.filter(c=>chIdsOf(user).includes(c.id))).filter(c=>(f==="tous"||c.statut===f)&&(c.nom+(c.client||"")).toLowerCase().includes(q.toLowerCase()));
  const getStats=c=>{
    const ct=taches.filter(t=>t.chId===c.id);
    const ce=equipe.filter(m=>m.chIds&&m.chIds.includes(c.id));
    const {totalH,coutMO,coutMat,coutTotal,margeReelle,margeP}=calcMargeChantier(c,heures,equipe,commandes||[]);
    const p=PCT(coutTotal,c.budget);
    return {ct,ce,totalH,coutMO,coutMat,coutTotal,marge:margeReelle,margeP,p,tFait:ct.filter(t=>t.statut==="fait").length,tEnCours:ct.filter(t=>t.statut==="en_cours").length};
  };
  const sel=selId?chantiers.find(c=>c.id===selId):null;
  const stats=sel?getStats(sel):null;

  if(sel&&stats) return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      {showEdit&&<FEditChantier chantier={sel} equipe={equipe} onClose={()=>setShowEdit(false)} onSave={f=>{onSave(f);setShowEdit(false);}}/>}
      <div style={{padding:"12px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:10}}>
        <button className="btn btn-out btn-sm" onClick={()=>setSelId(null)}>← Retour</button>
        <div style={{flex:1,fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel.nom}</div>
        {perms.modCh&&<button className="btn btn-blue btn-sm" onClick={()=>setShowEdit(true)}>Modifier</button>}
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        <div className="card u0" style={{padding:"16px",borderLeft:"4px solid "+(sel.prio===1?"var(--err)":sel.prio===2?"var(--warn)":"var(--ok)")}}>
          <div className="row" style={{marginBottom:12}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Tag label={sel.statut==="actif"?"En cours":sel.statut==="livre"?"Livré":"Planifié"} type={sel.statut==="actif"?"blue":sel.statut==="livre"?"ok":"gray"}/>
              {sel.corps&&<Tag label={sel.corps} type="gray"/>}
            </div>
            <div style={{fontSize:28,fontWeight:900,color:"var(--blue)",letterSpacing:"-.02em"}}>{sel.av}%</div>
          </div>
          <PBar v={sel.av} h={8}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
            {[{l:"Maître d'ouvrage",v:sel.client||"—",ico:"👤"},{l:"Téléphone",v:sel.tel||"—",ico:"📞",lien:"tel:"+sel.tel,copy:sel.tel},{l:"Adresse",v:sel.adresse||"—",ico:"📍",lien:sel.adresse?"https://maps.google.com/?q="+encodeURIComponent(sel.adresse):null,addr:sel.adresse},{l:"Heure de RDV",v:sel.rdv||"—",ico:"🕐"},{l:"Démarrage",v:sel.debut||"—",ico:"📅"},{l:"Fin contractuelle",v:sel.fin||"—",ico:"🏁"},{l:"Météo",v:sel.meteo||"—",ico:"🌤"},{l:"Corps d'état",v:sel.corps||"—",ico:"🔧"}].map(item=>(
              <div key={item.l} style={{padding:"10px 12px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
                <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{item.ico} {item.l}</div>
                {item.lien&&!item.addr?<a href={item.lien} target={item.lien.startsWith("http")?"_blank":undefined} rel="noopener noreferrer" style={{textDecoration:"none"}}><div style={{fontSize:13,fontWeight:600,color:"var(--blue)"}}>{item.v}</div></a>:item.copy?<div style={{display:"flex",alignItems:"center",gap:6}}><a href={item.lien} style={{textDecoration:"none"}}><div style={{fontSize:13,fontWeight:600,color:"var(--blue)"}}>{item.v}</div></a><button type="button" className="btn btn-ghost btn-xs" onClick={()=>navigator.clipboard?.writeText(item.copy).then(()=>onNotify?.("Téléphone copié")).catch(()=>{})}>Copier</button></div>:<div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{item.v}</div>}
                {item.addr&&<AddrActions adresse={item.addr} onCopy={onNotify}/>}
              </div>
            ))}
          </div>
          {sel.note&&<div style={{marginTop:12,padding:"8px 12px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)",fontWeight:500}}>⚠ {sel.note}</div>}
        </div>
        {perms.montants&&(
          <div className="card u1" style={{padding:"16px"}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:12}}>Financier</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[{l:"Marché HT",v:EUR(sel.budget),c:"var(--t1)"},{l:"Mat. & Fournitures",v:EUR(stats.coutMat),c:stats.coutMat/sel.budget>0.6?"var(--warn)":"var(--t2)"},{l:"Main d'oeuvre",v:EUR(stats.coutMO),c:"var(--blue)"},{l:"Coût total",v:EUR(stats.coutTotal),c:stats.coutTotal>sel.budget?"var(--err)":"var(--t1)"},{l:"Marge réelle",v:EUR(stats.marge),c:stats.marge>=0?"var(--ok)":"var(--err)"},{l:"Taux de marge",v:stats.margeP+"%",c:stats.margeP>20?"var(--ok)":stats.margeP>10?"var(--warn)":"var(--err)"}].map(m=>(
                <div key={m.l} style={{padding:"10px 12px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
                  <div style={{fontSize:10,color:"var(--t4)",marginBottom:3}}>{m.l}</div>
                  <div style={{fontSize:16,fontWeight:800,color:m.c}}>{m.v}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{marginBottom:5}}><span style={{fontSize:12,color:"var(--t3)"}}>Consommation budget</span><span style={{fontSize:12,fontWeight:700,color:stats.p>75?"var(--err)":stats.p>50?"var(--warn)":"var(--ok)"}}>{stats.p}%</span></div>
            <PBar v={stats.p} color={stats.p>75?"#DC2626":stats.p>50?"#D97706":"#059669"} h={6}/>
          </div>
        )}
        <div className="card u2" style={{padding:"16px"}}>
          <div className="row" style={{marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Équipe assignée</div><Tag label={stats.ce.length+" intervenant"+(stats.ce.length>1?"s":"")} type="blue"/></div>
          {stats.ce.length===0&&<div style={{fontSize:13,color:"var(--t4)",textAlign:"center",padding:"12px 0"}}>Aucun membre assigné</div>}
          {stats.ce.map((m,i)=>{
            const mH=heures.filter(h=>h.chId===sel.id&&h.nom===m.nom).reduce((s,h)=>s+calcH(h),0);
            const sc={present:"var(--ok)",retard:"var(--warn)",absent:"var(--err)"}[m.statut]||"var(--g4)";
            return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--g2)"}}>
                <div style={{position:"relative"}}><Av nom={m.nom} color={["#2563EB","#0891B2","#059669","#D97706","#7C3AED"][i%5]} size={38}/><div style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:sc,border:"2px solid var(--w)"}}/></div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{m.nom}</div><div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{m.fn} · {m.qual||""} · {m.tauxH||35}€/h</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:"var(--blue)"}}>{Math.round(mH*10)/10}h</div>{perms.montants&&<div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>{EUR(Math.round(mH*(m.tauxH||35)))}</div>}</div>
              </div>
            );
          })}
          <div style={{marginTop:12,padding:"10px 14px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)"}}>
            <div className="row"><span style={{fontSize:13,color:"var(--t2)",fontWeight:600}}>Total heures chantier</span><span style={{fontSize:15,fontWeight:800,color:"var(--blue)"}}>{Math.round(stats.totalH*10)/10}h</span></div>
            {perms.montants&&<div className="row" style={{marginTop:5}}><span style={{fontSize:13,color:"var(--t2)",fontWeight:600}}>Coût main d'œuvre estimé</span><span style={{fontSize:15,fontWeight:800,color:"var(--blue)"}}>{EUR(stats.coutMO)}</span></div>}
          </div>
        </div>
        <div className="card u3" style={{padding:"16px"}}>
          <div className="row" style={{marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Tâches</div><div style={{display:"flex",gap:6}}><Tag label={stats.tFait+" terminées"} type="ok"/><Tag label={stats.tEnCours+" en cours"} type="blue"/></div></div>
          {stats.ct.length===0&&<div style={{fontSize:13,color:"var(--t4)",textAlign:"center",padding:"12px 0"}}>Aucune tâche</div>}
          {stats.ct.map(t=>{
            const sc={fait:"var(--ok)",en_cours:"var(--blue)",planif:"var(--g3)"}[t.statut];
            return (
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--g2)"}}>
                <div style={{width:20,height:20,borderRadius:6,border:"2px solid "+sc,background:t.statut==="fait"?sc:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {t.statut==="fait"&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  {t.statut==="en_cours"&&<div style={{width:6,height:6,background:"var(--blue)",borderRadius:"50%"}}/>}
                </div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:t.statut==="fait"?"var(--t4)":"var(--t1)",textDecoration:t.statut==="fait"?"line-through":"none"}}>{t.titre}</div><div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>{t.resp} · {t.debut} → {t.fin} · {t.duree}j</div></div>
                {t.prio===1&&<Tag label="Urgent" type="err"/>}
              </div>
            );
          })}
        </div>

        {/* Navigation rapide vers les modules de ce chantier */}
        {onNav&&(
          <div className="u3">
            <div className="sec">Accès rapide</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {perms.taches&&<div className="card tap" style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>onNav&&onNav("taches",sel.id)}><div style={{fontSize:18,marginBottom:4}}>✅</div><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Tâches</div><div style={{fontSize:11,color:"var(--t3)"}}>{stats.ct.length} tâche{stats.ct.length>1?"s":""}</div></div>}
              {perms.chat&&<div className="card tap" style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>onNav&&onNav("chat",sel.id)}><div style={{fontSize:18,marginBottom:4}}>💬</div><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Messages</div><div style={{fontSize:11,color:"var(--t3)"}}>Chat chantier</div></div>}
              {perms.heures&&<div className="card tap" style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>onNav&&onNav("heures",sel.id)}><div style={{fontSize:18,marginBottom:4}}>⏱</div><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Heures</div><div style={{fontSize:11,color:"var(--t3)"}}>{Math.round(stats.totalH)}h saisies</div></div>}
              {perms.rapports&&<div className="card tap" style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>onNav&&onNav("rapports",sel.id)}><div style={{fontSize:18,marginBottom:4}}>📋</div><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Rapports</div><div style={{fontSize:11,color:"var(--t3)"}}>Comptes-rendus</div></div>}
              {perms.punch&&<div className="card tap" style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>onNav&&onNav("punch",sel.id)}><div style={{fontSize:18,marginBottom:4}}>🔧</div><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Réserves</div><div style={{fontSize:11,color:"var(--t3)"}}>Punch list</div></div>}
              {perms.avenants&&<div className="card tap" style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>onNav&&onNav("avenants",sel.id)}><div style={{fontSize:18,marginBottom:4}}>📄</div><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>Avenants</div><div style={{fontSize:11,color:"var(--t3)"}}>Travaux sup.</div></div>}
            </div>
          </div>
        )}

        {/* Notes rapides du chantier */}
        {(perms.rapport||perms.modCh)&&(
          <div className="u3">
            <div className="row" style={{marginBottom:10}}>
              <div className="sec" style={{margin:0}}>📌 Notes rapides</div>
              <span style={{fontSize:11,color:"var(--t4)"}}>{(notes||[]).filter(n=>n.chId===sel.id).length} note(s)</span>
            </div>
            {/* Saisie */}
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input
                className="inp" style={{flex:1,fontSize:13}}
                placeholder="Mémo rapide, observation, rappel..."
                value={noteTxt}
                onChange={e=>setNoteTxt(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&noteTxt.trim()&&onAddNote){onAddNote({chId:sel.id,auteur:user.nom,txt:noteTxt.trim()});setNoteTxt("");}}}
              />
              <button className="btn btn-blue btn-sm" disabled={!noteTxt.trim()} onClick={()=>{if(noteTxt.trim()&&onAddNote){onAddNote({chId:sel.id,auteur:user.nom,txt:noteTxt.trim()});setNoteTxt("");}}}>+</button>
            </div>
            {/* Liste */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {(notes||[]).filter(n=>n.chId===sel.id).sort((a,b)=>b.ts-a.ts).map(n=>(
                <div key={n.id} style={{padding:"10px 12px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r2)",display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>📌</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:"var(--t1)",lineHeight:1.5}}>{n.txt}</div>
                    <div style={{fontSize:10,color:"var(--t4)",marginTop:4}}>{n.auteur} · {n.date}</div>
                  </div>
                  {(n.auteur===user.nom||user.role==="admin")&&onDelNote&&(
                    <button onClick={()=>onDelNote(n.id)} style={{background:"none",border:"none",color:"var(--t4)",cursor:"pointer",fontSize:18,flexShrink:0,lineHeight:1}}>×</button>
                  )}
                </div>
              ))}
              {(notes||[]).filter(n=>n.chId===sel.id).length===0&&(
                <div style={{textAlign:"center",padding:"14px",color:"var(--t4)",fontSize:12}}>Aucune note — ajoutez un mémo rapide</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"16px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",position:"sticky",top:0,zIndex:10}}>
        <input className="inp" placeholder="Rechercher un chantier..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:10}}/>
        <div className="sx">{[["tous","Tous"],["actif","En cours"],["planif","Planifié"],["livre","Livré"]].map(([v,l])=><button key={v} onClick={()=>setF(v)} style={{padding:"7px 16px",borderRadius:"var(--r)",border:"1.5px solid "+(f===v?"var(--blue)":"var(--g2)"),background:f===v?"var(--blue-l)":"var(--w)",color:f===v?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>{l}</button>)}</div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>🏗</div><p style={{fontSize:14,fontWeight:600}}>Aucun chantier</p></div>}
        {visible.map((c,i)=>{
          const st=getStats(c);
          return (
            <div key={c.id} className="card tap u0" style={{padding:"16px",borderLeft:"4px solid "+(c.prio===1?"var(--err)":c.prio===2?"var(--warn)":"var(--ok)"),animationDelay:i*.04+"s",cursor:"pointer"}} onClick={()=>setSelId(c.id)}>
              <div className="row" style={{marginBottom:10}}>
                <div style={{flex:1,paddingRight:12,minWidth:0}}><div style={{fontSize:15,fontWeight:700,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{c.client||"—"} · {c.adresse||"—"}</div></div>
                <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:22,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{c.av}%</div><Tag label={c.statut==="actif"?"En cours":c.statut==="livre"?"Livré":"Planifié"} type={c.statut==="actif"?"blue":c.statut==="livre"?"ok":"gray"}/></div>
              </div>
              <PBar v={c.av} h={6}/>
              <div className="row" style={{marginTop:10,fontSize:11,color:"var(--t4)"}}><span>📅 {c.debut||"—"} → {c.fin||"—"}</span><span>✅ {st.tFait}/{st.ct.length} · 👷 {st.ce.length} · ⏱ {Math.round(st.totalH)}h</span></div>
              {perms.montants&&<div className="row" style={{marginTop:6}}><span style={{fontSize:12,color:"var(--t3)"}}>Budget {st.p}%</span><span style={{fontSize:12,fontWeight:700,color:st.marge>=0?"var(--ok)":"var(--err)"}}>Marge {EUR(st.marge)}</span></div>}
              {c.note&&<div style={{marginTop:8,padding:"6px 10px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r)",fontSize:12,color:"var(--warn)",fontWeight:500}}>⚠ {c.note}</div>}
              <div style={{marginTop:10,fontSize:12,color:"var(--blue)",fontWeight:600}}>Voir le détail →</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TachesScreen({ user, perms, taches, chantiers, equipe, onEditT, onSheet, initialChFilter }) {
  const [f,setF]=useState("tous");
  const [chF,setChF]=useState(initialChFilter?String(initialChFilter):"tous");
  useEffect(()=>{if(initialChFilter)setChF(String(initialChFilter));},[initialChFilter]);
  const [q,setQ]=useState("");
  const [moi,setMoi]=useState(user.role==="chef"); // chef voit ses tâches par défaut
  const [selId,setSelId]=useState(null);
  const [editId,setEditId]=useState(null);
  const [editF,setEditF]=useState({});
  const base=(user.role==="admin"?taches:taches.filter(t=>chIdsOf(user).includes(t.chId)));
  const baseMoi=moi?base.filter(t=>t.resp&&(t.resp===user.nom||t.resp.includes(user.nom.split(" ")[0]))):base;
  const visible=baseMoi.filter(t=>(f==="tous"||t.statut===f)&&(chF==="tous"||t.chId===parseInt(chF))&&(q===""||t.titre.toLowerCase().includes(q.toLowerCase())||(t.resp||"").toLowerCase().includes(q.toLowerCase())));
  const sc={fait:"var(--ok)",en_cours:"var(--blue)",planif:"var(--t4)"};
  const fait=baseMoi.filter(t=>t.statut==="fait").length;
  const enC=baseMoi.filter(t=>t.statut==="en_cours").length;
  const plan=baseMoi.filter(t=>t.statut==="planif").length;
  const pctGlobal=baseMoi.length>0?Math.round(fait/baseMoi.length*100):0;

  const sel=selId?taches.find(t=>t.id===selId):null;
  if(sel){
    const ch=chantiers.find(c=>c.id===sel.chId);
    const assignee=equipe?.find(m=>m.nom===sel.resp||m.nom.includes(sel.resp));
    const c=sc[sel.statut]||"var(--t4)";
    const isEd=editId===sel.id;
    return (
      <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
        <div style={{padding:"12px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:10}}>
          <button className="btn btn-out btn-sm" onClick={()=>{setSelId(null);setEditId(null);}}>← Retour</button>
          <div style={{flex:1,fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel.titre}</div>
          {perms.modT&&<button className="btn btn-blue btn-sm" onClick={()=>{if(isEd){Object.entries(editF).forEach(([k,v])=>onEditT(sel.id,k,v));setEditId(null);}else{setEditId(sel.id);setEditF({...sel});}}}>{isEd?"Enregistrer":"Modifier"}</button>}
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {isEd?(
            <div className="card u0" style={{padding:"16px",borderLeft:"3px solid var(--blue)"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--blue)",marginBottom:14}}>Modifier la tâche</div>
              <div className="col gap12">
                <Fld label="Désignation"><input className="inp" value={editF.titre||""} onChange={e=>setEditF(p=>({...p,titre:e.target.value}))}/></Fld>
                <Fld label="Intervenant assigné">
                  <select className="inp" value={editF.resp||""} onChange={e=>setEditF(p=>({...p,resp:e.target.value}))}>
                    <option value="">Non assigné</option>
                    {equipe.map(m=><option key={m.id} value={m.nom}>{m.nom} — {m.fn}</option>)}
                  </select>
                </Fld>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Fld label="Début"><input className="inp" value={editF.debut||""} onChange={e=>setEditF(p=>({...p,debut:e.target.value}))}/></Fld>
                  <Fld label="Fin prévue"><input className="inp" value={editF.fin||""} onChange={e=>setEditF(p=>({...p,fin:e.target.value}))}/></Fld>
                  <Fld label="Priorité">
                    <select className="inp" value={editF.prio||2} onChange={e=>setEditF(p=>({...p,prio:parseInt(e.target.value)}))}>
                      <option value={1}>Urgent</option><option value={2}>Normal</option><option value={3}>Faible</option>
                    </select>
                  </Fld>
                  <Fld label="Statut">
                    <select className="inp" value={editF.statut||"planif"} onChange={e=>setEditF(p=>({...p,statut:e.target.value}))}>
                      <option value="planif">Planifié</option><option value="en_cours">En cours</option><option value="fait">Terminé</option>
                    </select>
                  </Fld>
                </div>
                <button className="btn btn-out btn-fw" onClick={()=>setEditId(null)}>Annuler</button>
              </div>
            </div>
          ):(
            <>
              <div className="card u0" style={{padding:"16px",borderLeft:"4px solid "+c}}>
                <div className="row" style={{marginBottom:12}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Tag label={sel.statut==="fait"?"Terminé":sel.statut==="en_cours"?"En cours":"Planifié"} type={sel.statut==="fait"?"ok":sel.statut==="en_cours"?"blue":"gray"}/>
                    {sel.prio===1&&<Tag label="Urgent" type="err"/>}
                    {sel.prio===3&&<Tag label="Faible" type="gray"/>}
                  </div>
                </div>
                <div style={{fontSize:18,fontWeight:700,color:"var(--t1)",marginBottom:12}}>{sel.titre}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{l:"Chantier",v:ch?.nom||"—",ico:"🏗"},{l:"Intervenant",v:sel.resp||"Non assigné",ico:"👷"},{l:"Début",v:sel.debut||"—",ico:"📅"},{l:"Fin prévue",v:sel.fin||"—",ico:"🏁"},{l:"Durée",v:(sel.duree||"—")+"j",ico:"⏱"},{l:"Priorité",v:sel.prio===1?"Urgent":sel.prio===3?"Faible":"Normal",ico:"🔺"}].map(item=>(
                    <div key={item.l} style={{padding:"10px 12px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
                      <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{item.ico} {item.l}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{item.v}</div>
                    </div>
                  ))}
                </div>
                {assignee&&(
                  <div style={{marginTop:12,display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)"}}>
                    <Av nom={assignee.nom} color="#2563EB" size={34}/>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{assignee.nom}</div><div style={{fontSize:11,color:"var(--t3)"}}>{assignee.fn} · {assignee.qual}</div></div>
                    {assignee.tel&&perms.tels&&<a href={"tel:"+assignee.tel}><button className="btn btn-out btn-xs">Appeler</button></a>}
                  </div>
                )}
              </div>
              {perms.modT&&(
                <div className="card u1" style={{padding:"16px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:10}}>Changer le statut</div>
                  <div style={{display:"flex",gap:8}}>
                    {[["planif","📋 Planifié","var(--t4)"],["en_cours","🔨 En cours","var(--blue)"],["fait","✅ Terminé","var(--ok)"]].map(([sv,sl,col])=>(
                      <button key={sv} onClick={()=>onEditT(sel.id,"statut",sv)} style={{flex:1,padding:"12px 6px",borderRadius:"var(--r2)",border:"2px solid "+(sel.statut===sv?col:"var(--g2)"),background:sel.statut===sv?col+"1A":"var(--w)",color:sel.statut===sv?col:"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .12s"}}>{sl}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div className="card" style={{padding:"12px 14px",marginBottom:10,border:"none",boxShadow:"none",background:"var(--g1)"}}>
          <div className="row" style={{marginBottom:6}}><span style={{fontSize:12,fontWeight:600,color:"var(--t2)"}}>Progression globale</span><span style={{fontSize:14,fontWeight:800,color:"var(--ok)"}}>{pctGlobal}%</span></div>
          <PBar v={pctGlobal} h={6}/>
          <div style={{fontSize:11,color:"var(--t4)",marginTop:5}}>{fait} terminée{fait>1?"s":""} sur {base.length} tâche{base.length>1?"s":""}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {[{l:"Terminées",v:fait,c:"var(--ok)",ff:"fait"},{l:"En cours",v:enC,c:"var(--blue)",ff:"en_cours"},{l:"Planifiées",v:plan,c:"var(--t4)",ff:"planif"}].map((m,i)=>(
            <div key={i} onClick={()=>setF(f===m.ff?"tous":m.ff)} style={{textAlign:"center",padding:"8px 4px",background:f===m.ff?m.c+"1A":"var(--g1)",borderRadius:"var(--r2)",border:"1.5px solid "+(f===m.ff?m.c:"var(--g2)"),cursor:"pointer"}}>
              <div style={{fontSize:18,fontWeight:800,color:m.c}}>{m.v}</div>
              <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase"}}>{m.l}</div>
            </div>
          ))}
        </div>
        <input className="inp" style={{height:38,fontSize:13,marginBottom:8}} placeholder="Rechercher une tâche ou un intervenant..." value={q} onChange={e=>setQ(e.target.value)}/>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <select className="inp" style={{height:36,fontSize:12,flex:1}} value={chF} onChange={e=>setChF(e.target.value)}>
            <option value="tous">Tous les chantiers</option>
            {chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button onClick={()=>setMoi(!moi)} style={{flexShrink:0,padding:"0 12px",height:36,borderRadius:"var(--r)",border:"1.5px solid "+(moi?"var(--blue)":"var(--g2)"),background:moi?"var(--blue-l)":"var(--w)",color:moi?"var(--blue)":"var(--t3)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"var(--f)",whiteSpace:"nowrap"}}>👤 Mes tâches</button>
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>✅</div><p style={{fontSize:14,fontWeight:600}}>Aucune tâche</p></div>}
        {visible.map((t,i)=>{
          const ch=chantiers.find(c=>c.id===t.chId);
          const c=sc[t.statut]||"var(--t4)";
          const assignee=equipe?.find(m=>m.nom===t.resp||m.nom.includes(t.resp));
          return (
            <div key={t.id} className="card tap u0" style={{padding:"14px 16px",borderLeft:"3px solid "+c,animationDelay:i*.04+"s",cursor:"pointer"}} onClick={()=>setSelId(t.id)}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,paddingRight:12}}>
                  {assignee?<Av nom={assignee.nom} color={c==="var(--ok)"?"#059669":c==="var(--blue)"?"#2563EB":"#94A3B8"} size={32}/>:<div style={{width:32,height:32,borderRadius:"var(--r)",background:"var(--g1)",border:"1px dashed var(--g3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"var(--t4)",flexShrink:0}}>?</div>}
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:t.statut==="fait"?"var(--t4)":"var(--t1)",textDecoration:t.statut==="fait"?"line-through":"none"}}>{t.titre}</div>
                    <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"}</div>
                    <div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>👷 {t.resp||"Non assigné"} · {t.debut} → {t.fin}</div>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                  <Tag label={t.statut==="fait"?"Terminé":t.statut==="en_cours"?"En cours":"Planifié"} type={t.statut==="fait"?"ok":t.statut==="en_cours"?"blue":"gray"}/>
                  {t.prio===1&&<Tag label="Urgent" type="err"/>}
                  {t.statut!=="fait"&&isRetard(t.fin)&&<Tag label="En retard" type="err"/>}
                </div>
              </div>
              {perms.modT&&(
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  {[["planif","Planifié"],["en_cours","En cours"],["fait","Terminé"]].map(([sv,sl])=>(
                    <button key={sv} onClick={e=>{e.stopPropagation();onEditT(t.id,"statut",sv);}} style={{flex:1,height:34,borderRadius:"var(--r)",border:"1.5px solid "+(t.statut===sv?c:"var(--g2)"),background:t.statut===sv?c+"1A":"var(--w)",color:t.statut===sv?c:"var(--t3)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .12s"}}>{sl}</button>
                  ))}
                </div>
              )}
              <div style={{marginTop:8,fontSize:12,color:"var(--blue)",fontWeight:600}}>Voir le détail →</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function FinancesScreen({ user, perms, factures, chantiers, heures, equipe, commandes, onSheet, onChangeStatut, onPrint }) {
  if(!perms.finances) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p></div>;
  const [chF,setChF]=useState("tous");
  const myCh=visibleChantiers(user, chantiers);
  const baseFactures=filterByChAccess(user, factures);
  const vis=chF==="tous"?baseFactures:baseFactures.filter(f=>f.chId===parseInt(chF));
  const total=vis.reduce((s,f)=>s+f.mt,0);
  const enc=vis.filter(f=>f.statut==="encaissee").reduce((s,f)=>s+f.mt,0);
  const att=vis.filter(f=>f.statut==="emise").reduce((s,f)=>s+f.mt,0);
  const ret=vis.filter(f=>f.statut==="retard").reduce((s,f)=>s+f.mt,0);
  const sfM={encaissee:{l:"Encaissée",t:"ok"},emise:{l:"Émise",t:"blue"},retard:{l:"En retard",t:"err"}};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        {onSheet&&<button className="btn btn-blue btn-fw" style={{marginBottom:10}} onClick={()=>onSheet("facture")}>+ Nouvelle facture</button>}
        <select className="inp" style={{height:38,fontSize:13,marginBottom:10}} value={chF} onChange={e=>setChF(e.target.value)}>
          <option value="tous">Tous les chantiers</option>
          {myCh.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{l:"Total facturé",v:EUR(total),c:"var(--t1)"},{l:"Encaissé",v:EUR(enc),c:"var(--ok)"},{l:"En attente",v:EUR(att),c:"var(--blue)"},{l:"En retard",v:EUR(ret),c:ret>0?"var(--err)":"var(--t4)"}].map((m,i)=>(
            <div key={i} className="card" style={{padding:"12px 14px"}}><div style={{fontSize:18,fontWeight:800,color:m.c,letterSpacing:"-.02em",marginBottom:2}}>{m.v}</div><div style={{fontSize:11,color:"var(--t3)"}}>{m.l}</div></div>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {ret>0&&<Alert msg={"⚠ "+EUR(ret)+" en retard — relancer les clients"} type="err"/>}
        {/* CA par chantier */}
        {chF==="tous"&&(
          <div>
            <div className="sec">CA par chantier</div>
            {myCh.filter(c=>baseFactures.some(f=>f.chId===c.id)).map(c=>{
              const cFac=baseFactures.filter(f=>f.chId===c.id);
              const cEnc=cFac.filter(f=>f.statut==="encaissee").reduce((s,f)=>s+f.mt,0);
              const cTotal=cFac.reduce((s,f)=>s+f.mt,0);
              return (
                <div key={c.id} className="card" style={{padding:"12px 14px",marginBottom:6}}>
                  <div className="row" style={{marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{c.nom.split(" ").slice(0,3).join(" ")}</span>
                    <span style={{fontSize:14,fontWeight:800,color:"var(--ok)"}}>{EUR(cEnc)}</span>
                  </div>
                  <PBar v={PCT(cEnc,c.budget)} h={4}/>
                  <div className="row" style={{marginTop:4}}><span style={{fontSize:11,color:"var(--t4)"}}>{cFac.length} facture{cFac.length>1?"s":""}</span><span style={{fontSize:11,color:"var(--t4)"}}>Facturé {EUR(cTotal)} / {EUR(c.budget)}</span></div>
                </div>
              );
            })}
          </div>
        )}
        {/* Rentabilité globale */}
        {chF==="tous"&&perms.montants&&(()=>{
          const actifs=myCh.filter(c=>c.statut==="actif");
          const budgetT=actifs.reduce((s,c)=>s+c.budget,0);
          const coutMOT=actifs.reduce((s,c)=>s+calcCoutsMO(c.id,heures,equipe).coutMO,0);
          const coutMatT=actifs.reduce((s,c)=>s+Math.max(c.dep||0,commandes.filter(x=>x.chId===c.id&&x.statut==="livree").reduce((ss,x)=>ss+(x.mt||0),0)),0);
          const coutTotal=coutMOT+coutMatT;
          const margeG=budgetT-coutTotal;
          const margeP=PCT(margeG,budgetT);
          return (
            <div className="card" style={{padding:"14px 16px",borderLeft:"3px solid "+(margeG>=0?"var(--ok)":"var(--err)")}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:10}}>Rentabilité globale — Chantiers actifs</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                {[{l:"Budget total",v:EUR(budgetT),c:"var(--t1)"},{l:"Coût MO réel",v:EUR(coutMOT),c:"var(--blue)"},{l:"Coût matériaux",v:EUR(coutMatT),c:"var(--warn)"},{l:"Marge réelle",v:EUR(margeG),c:margeG>=0?"var(--ok)":"var(--err)"}].map((m,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"8px 4px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}><div style={{fontSize:14,fontWeight:800,color:m.c}}>{m.v}</div><div style={{fontSize:10,color:"var(--t4)",marginTop:2}}>{m.l}</div></div>
                ))}
              </div>
              <div className="row" style={{marginBottom:5}}><span style={{fontSize:12,color:"var(--t3)"}}>Taux de marge global</span><span style={{fontSize:15,fontWeight:800,color:margeP>15?"var(--ok)":margeP>5?"var(--warn)":"var(--err)"}}>{margeP}%</span></div>
              <PBar v={PCT(coutTotal,budgetT)} color={PCT(coutTotal,budgetT)>80?"#DC2626":PCT(coutTotal,budgetT)>60?"#D97706":"#059669"} h={6}/>
            </div>
          );
        })()}
        <div className="sec">Détail des factures</div>
        {vis.length===0&&<div className="empty"><p style={{fontSize:14,fontWeight:600}}>Aucune facture</p></div>}
        {/* Trésorerie prévisionnelle 30 jours */}
        {chF==="tous"&&perms.montants&&(()=>{
          const encaisse=baseFactures.filter(f=>f.statut==="encaissee").reduce((s,f)=>s+f.mt,0);
          const aRecevoir=baseFactures.filter(f=>f.statut==="emise"||f.statut==="retard").reduce((s,f)=>s+f.mt,0);
          const previsionnelle=encaisse+aRecevoir;
          return (
            <div className="card" style={{padding:"14px 16px",borderLeft:"3px solid var(--blue)"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:10}}>Trésorerie prévisionnelle 30j</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                {[{l:"Encaissé",v:EUR(encaisse),c:"var(--ok)"},{l:"À recevoir",v:EUR(aRecevoir),c:"var(--blue)"},{l:"Prévisionnel",v:EUR(previsionnelle),c:"var(--t1)"}].map((m,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"8px 4px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
                    <div style={{fontSize:13,fontWeight:800,color:m.c}}>{m.v}</div>
                    <div style={{fontSize:9,color:"var(--t4)",textTransform:"uppercase",marginTop:2}}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {vis.map((f,i)=>{
          const sf=sfM[f.statut]||{l:f.statut,t:"gray"};
          const ch=chantiers.find(c=>c.id===f.chId);
          return (
            <div key={f.id} className="card u0" style={{padding:"14px 16px",marginBottom:6,animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--t4)",marginBottom:3}}>{f.id}</div>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--t1)"}}>{EUR(f.mt)}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"} · {f.client}</div>
                  {f.desc&&<div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>{f.desc}</div>}
                </div>
                <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <Tag label={sf.l} type={sf.t}/>
                  <div style={{fontSize:11,color:"var(--t4)"}}>Éch. {f.ech}</div>
                  {onPrint&&(
                    <button className="btn btn-out btn-xs"
                      onClick={()=>onPrint({type:"facture",data:f})}>
                      📄 PDF
                    </button>
                  )}
                </div>
              </div>
              {onChangeStatut&&f.statut!=="encaissee"&&(
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  {f.statut==="emise"&&<button className="btn btn-warn btn-xs" style={{flex:1}} onClick={()=>onChangeStatut(f.id,"retard")}>Marquer en retard</button>}
                  <button className="btn btn-ok btn-xs" style={{flex:1}} onClick={()=>onChangeStatut(f.id,"encaissee")}>Marquer encaissée</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatScreen({ user, perms, messages, chantiers, onSend, onSheet, initialChId }) {
  if(!perms.chat) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const myCh=(user.role==="admin"?chantiers:chantiers.filter(c=>chIdsOf(user).includes(c.id))).filter(c=>c.statut!=="livre");
  const [chId,setChId]=useState(()=>String(initialChId||myCh[0]?.id||""));
  useEffect(()=>{if(initialChId)setChId(String(initialChId));},[initialChId]);
  const [txt,setTxt]=useState("");
  const ref=useRef(null);
  const msgs=messages.filter(m=>m.chId===parseInt(chId));
  const ch=chantiers.find(c=>c.id===parseInt(chId));
  const rc={admin:"#2563EB",chef:"#0891B2",employe:"#059669",client:"#D97706"};
  useEffect(()=>{ ref.current?.scrollIntoView({behavior:"smooth"}); },[msgs.length,chId]);
  const send=()=>{const t=txt.trim();if(!t||!chId)return;onSend({chId:parseInt(chId),auteur:user.nom,role:user.role,txt:t,h:new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),d:new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})});setTxt("");};
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"12px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",flexShrink:0}}>
        <select className="inp" style={{height:40,fontSize:13}} value={chId} onChange={e=>setChId(e.target.value)}>{myCh.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select>
        {ch&&<div style={{fontSize:11,color:"var(--t4)",marginTop:6}}>📍 {ch.adresse}</div>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
        {msgs.length===0&&<div className="empty"><div style={{fontSize:40}}>💬</div><p style={{fontSize:13}}>Aucun message sur ce chantier</p></div>}
        {msgs.map((m,i)=>{
          const isMe=m.auteur===user.nom;
          const col=rc[m.role]||"#94A3B8";
          const showD=i===0||m.d!==msgs[i-1]?.d;
          return (
            <div key={m.id}>
              {showD&&<div style={{textAlign:"center",margin:"4px 0"}}><span style={{fontSize:10,fontWeight:600,color:"var(--t4)",background:"var(--g1)",padding:"3px 10px",borderRadius:99,border:"1px solid var(--g2)"}}>{m.d}</span></div>}
              <div style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",gap:3}}>
                {!isMe&&<span style={{fontSize:10,fontWeight:700,color:col,marginLeft:4}}>{m.auteur} · {ROLES[m.role]?.label}</span>}
                <div style={{maxWidth:"78%",padding:"10px 13px",fontSize:14,lineHeight:1.5,borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",background:isMe?"var(--blue)":"var(--w)",color:isMe?"#fff":"var(--t1)",border:isMe?"none":"1px solid var(--g2)",boxShadow:"var(--sh)"}}>{m.txt}</div>
                <span style={{fontSize:10,color:"var(--t4)",margin:isMe?"0 4px 0 0":"0 0 0 4px"}}>{m.h}</span>
              </div>
            </div>
          );
        })}
        <div ref={ref}/>
      </div>
      {perms.msg&&<div style={{padding:"12px 16px",borderTop:"1px solid var(--g2)",display:"flex",gap:8,background:"var(--w)",paddingBottom:"calc(12px + var(--sb) + 72px)"}}>
        {perms.incidents&&<button className="btn btn-out btn-sq" style={{height:42,width:42,flexShrink:0,borderColor:"var(--err-b)"}} onClick={()=>onSheet&&onSheet("incident")} title="Signaler un incident"><span style={{fontSize:18}}>⚠️</span></button>}
        <input className="inp" style={{flex:1,height:42,fontSize:14}} placeholder="Message…" value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
        <button className="btn btn-blue btn-sq" style={{height:42,width:42}} onClick={send} disabled={!txt.trim()||!chId}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>}
    </div>
  );
}

function AvenantsScreen({ user, perms, avenants, chantiers, onValider, onSheet }) {
  if(!perms.avenants) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const visible=user.role==="client"?avenants.filter(a=>chIdsOf(user).includes(a.chId)):avenants;
  const sfM={signe:{l:"Signé",t:"ok"},attente:{l:"En attente",t:"warn"},refuse:{l:"Refusé",t:"err"}};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
        {perms.creerAv&&onSheet&&<button className="btn btn-blue btn-fw" onClick={()=>onSheet("avenant")}>+ Nouvel avenant</button>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{l:"Signés",v:EUR(visible.filter(a=>a.statut==="signe").reduce((s,a)=>s+a.mt,0)),c:"var(--ok)"},{l:"En attente",v:EUR(visible.filter(a=>a.statut==="attente").reduce((s,a)=>s+a.mt,0)),c:"var(--warn)"}].map((m,i)=><div key={i} className="card" style={{padding:"14px 16px"}}><div style={{fontSize:20,fontWeight:800,color:m.c,marginBottom:3}}>{m.v}</div><div style={{fontSize:12,color:"var(--t3)"}}>{m.l}</div></div>)}
        </div>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>📄</div><p style={{fontSize:14,fontWeight:600}}>Aucun avenant</p></div>}
        {visible.map((a,i)=>{
          const sf=sfM[a.statut]||{l:a.statut,t:"gray"};
          const ch=chantiers.find(c=>c.id===a.chId);
          return (
            <div key={a.id} className="card u0" style={{padding:"16px",animationDelay:i*.05+"s"}}>
              <div className="row" style={{marginBottom:8}}>
                <div style={{flex:1,paddingRight:12}}><div style={{fontSize:10,color:"var(--t4)",marginBottom:4,fontWeight:600}}>{a.ref}</div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{a.titre}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:4}}>{ch?.nom||"—"} · Créé le {a.dc}</div></div>
                <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:800,color:"var(--t1)",marginBottom:5}}>{EUR(a.mt)}</div><Tag label={sf.l} type={sf.t}/></div>
              </div>
              {a.desc&&<div style={{padding:"10px 12px",background:"var(--g1)",border:"1px solid var(--g2)",borderRadius:"var(--r2)",fontSize:13,color:"var(--t2)",lineHeight:1.5,marginBottom:8}}>{a.desc}</div>}
              {a.ds&&<div style={{fontSize:11,color:"var(--t4)"}}>Signé le {a.ds} par {a.par}</div>}
              {a.statut==="attente"&&perms.valAv&&<div style={{display:"flex",gap:8,marginTop:12}}><button className="btn btn-ok btn-sm" style={{flex:1}} onClick={()=>onValider(a.id,"signe",user.nom)}>Signer</button><button className="btn btn-err btn-sm" style={{flex:1}} onClick={()=>onValider(a.id,"refuse",user.nom)}>Refuser</button></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeuresScreen({ user, perms, heures, chantiers, equipe, onValider, onSheet, onPrint }) {
  if(!perms.heures) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const today=new Date();
  const [off,setOff]=useState(0);
  const getLundi=o=>{const d=new Date(today);const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day)+o*7);d.setHours(0,0,0,0);return d;};
  const lundi=getLundi(off);
  const JOURS=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const sem=JOURS.map((_,i)=>{const d=new Date(lundi);d.setDate(lundi.getDate()+i);return d;});
  const iso=d=>d.toISOString().split("T")[0];
  const todayIso=iso(today);
  const vis=user.role==="employe"
    ? heures.filter(h=>h.nom===user.nom)
    : user.role==="chef"
      ? heures.filter(h=>chIdsOf(user).some(cid=>h.chId===cid))
      : heures;
  const parJ=sem.map(d=>({date:d,iso:iso(d),entries:vis.filter(h=>h.date===iso(d)),total:vis.filter(h=>h.date===iso(d)).reduce((s,h)=>s+calcH(h),0)}));
  const totalS=parJ.reduce((s,j)=>s+j.total,0);
  const maxH=Math.max(...parJ.map(j=>j.total),1);
  const [sel,setSel]=useState(todayIso);
  const detail=vis.filter(h=>h.date===sel);
  const nonVal=vis.filter(h=>!h.val).length;
  const fmtS=()=>{const fin=new Date(lundi);fin.setDate(lundi.getDate()+6);const f=d=>d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});return f(lundi)+" – "+f(fin);};
  return (
    <div style={{paddingBottom:100,height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",flexShrink:0}}>
        {onSheet&&<button className="btn btn-blue btn-fw" style={{marginBottom:10}} onClick={()=>onSheet("heure")}>+ Saisir des heures</button>}
        {onPrint&&(
          <button className="btn btn-out btn-sm" style={{marginBottom:10}}
            onClick={()=>onPrint({
              type:"heures",
              data:{
                nom:user.nom,
                periode:fmtS(),
                heures:parJ.flatMap(j=>j.entries.map(h=>({...h,date:j.iso,total:calcH(h)})))
              }
            })}>
            📄 PDF
          </button>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Semaine",v:Math.round(totalS*10)/10+"h",c:"var(--blue)"},{l:"Saisies",v:vis.length,c:"var(--t1)"},{l:"À valider",v:nonVal,c:nonVal>0?"var(--warn)":"var(--ok)"}].map((m,i)=><div key={i} style={{textAlign:"center",padding:"10px 6px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}><div style={{fontSize:18,fontWeight:800,color:m.c,marginBottom:2}}>{m.v}</div><div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em"}}>{m.l}</div></div>)}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        <div className="card" style={{padding:"16px"}}>
          <div className="row" style={{marginBottom:14}}>
            <button className="btn btn-out btn-sm" onClick={()=>setOff(o=>o-1)}>← Préc.</button>
            <div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{fmtS()}</div>{off!==0&&<button style={{fontSize:11,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",marginTop:4,fontFamily:"var(--f)",fontWeight:600}} onClick={()=>setOff(0)}>Aujourd'hui</button>}</div>
            <button className="btn btn-out btn-sm" onClick={()=>setOff(o=>o+1)}>Suiv. →</button>
          </div>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80}}>
            {parJ.map((j,i)=>{
              const isT=j.iso===todayIso,isS=j.iso===sel;
              const bH=Math.max(j.total>0?(j.total/maxH)*68:2,2);
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}} onClick={()=>setSel(j.iso)}>
                  <span style={{fontSize:10,fontWeight:600,color:j.total>0?"var(--t2)":"var(--t4)"}}>{j.total>0?Math.round(j.total*10)/10+"h":""}</span>
                  <div style={{width:"100%",height:bH+"px",background:isS?"var(--blue)":isT?"var(--blue-b)":"var(--g2)",borderRadius:"4px 4px 0 0",transition:"all .2s"}}/>
                  <span style={{fontSize:10,fontWeight:isS||isT?700:400,color:isS?"var(--blue)":isT?"var(--t2)":"var(--t4)"}}>{JOURS[i]}</span>
                  <span style={{fontSize:9,color:"var(--t4)"}}>{j.date.getDate()}</span>
                </div>
              );
            })}
          </div>
          <div className="div" style={{margin:"12px 0 10px"}}/>
          <div className="row"><span style={{fontSize:12,color:"var(--t3)"}}>Total semaine</span><span style={{fontSize:18,fontWeight:800,color:"var(--blue)"}}>{Math.round(totalS*10)/10}<span style={{fontSize:12,fontWeight:400,color:"var(--t4)",marginLeft:3}}>h</span></span></div>
          {/* Récap par collaborateur : coût + heures sup avec majorations réelles */}
          {user.role!=="employe"&&(
            <div style={{marginTop:10}}>
              {[...new Set(parJ.flatMap(j=>j.entries).map(h=>h.nom))].map(nom=>{
                const hSem=parJ.flatMap(j=>j.entries.filter(h=>h.nom===nom)).reduce((s,h)=>s+calcH(h),0);
                const m=equipe?.find(e=>e.nom===nom);
                const tx=m?.tauxH||35;
                // Heures supplémentaires BTP : >7h/j, base 35h/sem
                const baseJ=7; // base légale journalière
                const hs=calcHS({arr:"07:00",dep:"07:00",pause:0},baseJ); // on utilise calcHS en mode semaine
                const hNorm=Math.min(hSem,35);
                const hSup25=Math.max(0,Math.min(hSem-35,8)); // 25% pour les 8 premières heures sup
                const hSup50=Math.max(0,hSem-43);             // 50% au-delà
                const coutNorm=Math.round(hNorm*tx);
                const coutSup25=Math.round(hSup25*tx*1.25);
                const coutSup50=Math.round(hSup50*tx*1.50);
                const coutTotal=coutNorm+coutSup25+coutSup50;
                return (
                  <div key={nom} style={{padding:"8px 0",borderBottom:"1px solid var(--g2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Av nom={nom} color="#2563EB" size={24}/>
                      <span style={{flex:1,fontSize:12,color:"var(--t1)",fontWeight:600}}>{nom.split(" ")[0]}</span>
                      <span style={{fontSize:12,color:"var(--t3)"}}>{Math.round(hSem*10)/10}h</span>
                      {hSup25>0&&<Tag label={"+"+Math.round(hSup25*10)/10+"h/25%"} type="warn"/>}
                      {hSup50>0&&<Tag label={"+"+Math.round(hSup50*10)/10+"h/50%"} type="err"/>}
                      <span style={{fontSize:12,fontWeight:800,color:hSup25>0?"var(--warn)":"var(--blue)"}}>{EUR(coutTotal)}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:2}}>
                <span style={{fontSize:11,color:"var(--t4)"}}>Masse salariale semaine</span>
                <span style={{fontSize:13,fontWeight:800,color:"var(--t1)"}}>
                  {EUR([...new Set(parJ.flatMap(j=>j.entries).map(h=>h.nom))].reduce((tot,nom)=>{
                    const hSem=parJ.flatMap(j=>j.entries.filter(h=>h.nom===nom)).reduce((s,h)=>s+calcH(h),0);
                    const tx=equipe?.find(e=>e.nom===nom)?.tauxH||35;
                    const hN=Math.min(hSem,35);
                    const h25=Math.max(0,Math.min(hSem-35,8));
                    const h50=Math.max(0,hSem-43);
                    return tot+Math.round(hN*tx)+Math.round(h25*tx*1.25)+Math.round(h50*tx*1.5);
                  },0))}
                </span>
              </div>
            </div>
          )}
          {nonVal>0&&user.role!=="employe"&&(
            <button className="btn btn-ok btn-sm btn-fw" style={{marginTop:10}} onClick={()=>vis.filter(h=>!h.val).forEach(h=>onValider(h.id))}>Valider toute la semaine ({nonVal} en attente)</button>
          )}
        </div>
        <div>
          <div className="row" style={{marginBottom:10}}><div className="sec" style={{margin:0}}>{new Date(sel+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div></div>
          {detail.length===0?<div className="card" style={{padding:"24px",textAlign:"center"}}><p style={{fontSize:13,color:"var(--t4)"}}>Aucune activité ce jour</p></div>:detail.map((h,i)=>{
            const hT=calcH(h);
            const ch=chantiers.find(c=>c.id===h.chId);
            return (
              <div key={h.id} className="card u0" style={{padding:"14px 16px",marginBottom:8,borderLeft:"3px solid "+(h.val?"var(--ok)":"var(--warn)"),animationDelay:i*.04+"s"}}>
                <div className="row" style={{marginBottom:8}}>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{h.nom}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{hT}<span style={{fontSize:12,fontWeight:400,color:"var(--t4)",marginLeft:2}}>h</span></div><Tag label={h.val?"Validé":"En attente"} type={h.val?"ok":"warn"}/></div>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:h.desc?8:0}}>
                  {[{l:"Arrivée",v:h.arr},{l:"Départ",v:h.dep},{l:"Pause",v:h.pause+"min"}].map(item=><div key={item.l} style={{flex:1,padding:"7px",background:"var(--g1)",borderRadius:"var(--r)",textAlign:"center",border:"1px solid var(--g2)"}}><div style={{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums",color:"var(--t1)"}}>{item.v}</div><div style={{fontSize:9,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:2}}>{item.l}</div></div>)}
                </div>
                {h.desc&&<div style={{fontSize:12,color:"var(--t2)"}}>{h.desc}</div>}
                {/* Variables de paie */}
                <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                  {h.panier&&<Tag label="Panier" type="blue"/>}
                  {h.trajet&&<Tag label="Trajet" type="blue"/>}
                  {h.zone&&<Tag label={"Zone "+h.zone} type="gray"/>}
                </div>
                {!h.val&&user.role!=="employe"&&<button className="btn btn-ok btn-sm btn-fw" style={{marginTop:8}} onClick={()=>onValider(h.id)}>Valider cette journée</button>}
              </div>
            );
          })}
        </div>
        {parJ.filter(j=>j.iso!==sel&&j.entries.length>0).length>0&&(
          <div>
            <div className="sec">Autres jours de la semaine</div>
            {parJ.filter(j=>j.iso!==sel&&j.entries.length>0).map(j=>(
              <div key={j.iso} className="card tap" style={{padding:"12px 16px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setSel(j.iso)}>
                <div><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{new Date(j.iso+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric"})}</div><div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>{j.entries.length} saisie{j.entries.length>1?"s":""}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18,fontWeight:800,color:"var(--blue)"}}>{j.total}<span style={{fontSize:12,fontWeight:400,color:"var(--t4)",marginLeft:2}}>h</span></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function PunchScreen({ user, perms, punch, chantiers, onUpdate }) {
  if(!perms.punch) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const [f,setF]=useState("tous");
  const visible=(user.role==="admin"?punch:punch.filter(p=>chIdsOf(user).includes(p.chId))).filter(p=>f==="tous"||p.statut===f);
  const sfM={ouvert:{l:"Ouvert",t:"err",c:"var(--err)"},encours:{l:"En cours",t:"warn",c:"var(--warn)"},clos:{l:"Clos",t:"ok",c:"var(--ok)"}};
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
        <div className="sx">{[["tous","Toutes"],["ouvert","Ouvertes"],["encours","En cours"],["clos","Closes"]].map(([v,l])=><button key={v} onClick={()=>setF(v)} style={{padding:"7px 14px",borderRadius:"var(--r)",border:"1.5px solid "+(f===v?"var(--blue)":"var(--g2)"),background:f===v?"var(--blue-l)":"var(--w)",color:f===v?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>{l}</button>)}</div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>🎉</div><p style={{fontSize:14,fontWeight:600}}>Aucune réserve</p></div>}
        {visible.map((p,i)=>{
          const sf=sfM[p.statut]||sfM.ouvert;
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
              <div style={{fontSize:11,color:"var(--t4)",marginBottom:perms.gPunch&&p.statut!=="clos"?10:0}}>
                Signalé le {p.date} · {p.ass?"Attribué à "+p.ass:"Non attribué"}{p.clos?" · Clos le "+p.clos:""}
              </div>
              {perms.gPunch&&p.statut!=="clos"&&(
                <div style={{display:"flex",gap:8}}>
                  {p.statut==="ouvert"&&(
                    <button className="btn btn-warn btn-sm" style={{flex:1,background:"var(--warn-l)",border:"1px solid var(--warn-b)",color:"var(--warn)"}} onClick={()=>onUpdate(p.id,"encours")}>
                      ▶ Prendre en charge
                    </button>
                  )}
                  {p.statut==="encours"&&(
                    <button className="btn btn-ok btn-sm" style={{flex:1,background:"var(--ok-l)",border:"1px solid #BBF7D0",color:"var(--ok)"}} onClick={()=>onUpdate(p.id,"clos")}>
                      ✓ Clore la réserve
                    </button>
                  )}
                  {p.statut==="ouvert"&&(
                    <button className="btn btn-out btn-sm" style={{flex:1}} onClick={()=>onUpdate(p.id,"clos")}>
                      Clore directement
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SituationsScreen({ user, perms, situations, chantiers, onSave, onChangeStatut, onSheet }) {
  if(!perms.situations) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14}}>Accès non disponible</p></div>;
  const visible=user.role==="client"?situations.filter(s=>chIdsOf(user).includes(s.chId)):situations;
  const sfM={encaissee:{l:"Encaissée",t:"ok"},emise:{l:"Émise",t:"blue"},retard:{l:"En retard",t:"err"}};
  const totalEnc=visible.filter(s=>s.statut==="encaissee").reduce((t,s)=>t+s.mt,0);
  const totalEm=visible.filter(s=>s.statut==="emise").reduce((t,s)=>t+s.mt,0);
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        {perms.montants&&onSheet&&<button className="btn btn-blue btn-fw" style={{marginBottom:10}} onClick={()=>onSheet("situation")}>+ Nouvelle situation de travaux</button>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div className="card" style={{padding:"12px"}}><div style={{fontSize:18,fontWeight:800,color:"var(--ok)",marginBottom:2}}>{EUR(totalEnc)}</div><div style={{fontSize:11,color:"var(--t3)"}}>Encaissé</div></div>
          <div className="card" style={{padding:"12px"}}><div style={{fontSize:18,fontWeight:800,color:"var(--blue)",marginBottom:2}}>{EUR(totalEm)}</div><div style={{fontSize:11,color:"var(--t3)"}}>En attente</div></div>
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {chantiers.filter(c=>visible.some(s=>s.chId===c.id)).map(c=>{
          const sits=visible.filter(s=>s.chId===c.id).sort((a,b)=>a.num-b.num);
          const totalCh=sits.reduce((t,s)=>t+s.mt,0);
          const pctCh=PCT(totalCh,c.budget);
          return (
            <div key={c.id} className="card u0" style={{padding:"16px"}}>
              <div className="row" style={{marginBottom:12}}>
                <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"var(--t1)"}}>{c.nom}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>Marché HT : {EUR(c.budget)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:800,color:pctCh>90?"var(--warn)":"var(--ok)"}}>{pctCh}%</div><div style={{fontSize:10,color:"var(--t4)"}}>facturé</div></div>
              </div>
              <PBar v={pctCh} color={pctCh>90?"#DC2626":pctCh>60?"#D97706":"#059669"} h={6}/>
              <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
                {sits.map(sit=>{
                  const sf=sfM[sit.statut]||{l:sit.statut,t:"gray"};
                  return (
                    <div key={sit.id} style={{padding:"12px 14px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)",borderLeft:"3px solid "+(sit.statut==="encaissee"?"var(--ok)":sit.statut==="emise"?"var(--blue)":"var(--err)")}}>
                      <div className="row" style={{marginBottom:5}}>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{sit.titre}</div>{sit.desc&&<div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>{sit.desc}</div>}<div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>Avancement {sit.av}% · Émise le {sit.date}{sit.ech?" · Éch. "+sit.ech:""}</div></div>
                        <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}><div style={{fontSize:16,fontWeight:800,color:"var(--t1)"}}>{EUR(sit.mt)}</div><Tag label={sf.l} type={sf.t}/></div>
                      </div>
                      {onChangeStatut&&sit.statut!=="encaissee"&&perms.montants&&(
                        <div style={{display:"flex",gap:6,marginTop:8}}>
                          {sit.statut==="emise"&&<button className="btn btn-warn btn-xs" style={{flex:1}} onClick={()=>onChangeStatut(sit.id,"retard")}>En retard</button>}
                          <button className="btn btn-ok btn-xs" style={{flex:1}} onClick={()=>onChangeStatut(sit.id,"encaissee")}>Encaissée</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:12,padding:"10px 14px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:"var(--t2)",fontWeight:500}}>Solde restant à facturer</span>
                <span style={{fontSize:15,fontWeight:800,color:"var(--blue)"}}>{EUR(Math.max(0,c.budget-totalCh))}</span>
              </div>
            </div>
          );
        })}
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>📊</div><p style={{fontSize:14,fontWeight:600}}>Aucune situation</p></div>}
      </div>
    </div>
  );
}

function IncidentsScreen({ user, perms, incidents, chantiers, commandes, equipe, onUpdate, onEdit, onCancel, onNav, onSheet }) {
  if(!perms.incidents) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p></div>;
  const [filtre,setFiltre]=useState("ouvert");
  const base=user.role==="admin"?incidents:incidents.filter(i=>chIdsOf(user).includes(i.chId));
  const vis=base.filter(i=>filtre==="tous"?true:i.statut===filtre).sort((a,b)=>(a.statut==="ouvert"?0:1)-(b.statut==="ouvert"?0:1)||(a.prio||3)-(b.prio||3)||(b.ts||0)-(a.ts||0));
  const nbOuv=base.filter(i=>i.statut==="ouvert").length;
  const nbTraite=base.filter(i=>i.statut==="traite").length;
  const sfM={ouvert:{l:"Ouvert",t:"err",c:"var(--err)"},traite:{l:"Traité",t:"ok",c:"var(--ok)"}};
  const tL={securite:"Sécurité",materiel:"Matériel",retard:"Retard livraison",manque:"Manque matériel",autre:"Autre"};
  const tE={securite:"⚠️",materiel:"🔧",retard:"📦",manque:"📋",autre:"💬"};
  const scrL={chantiers:"Chantiers",taches:"Tâches",heures:"Planning heures",punch:"Punch list",commandes:"Commandes",home:"Accueil",planningEq:"Planning équipe"};
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div className="card" style={{padding:"12px",textAlign:"center",borderLeft:"3px solid var(--err)"}}><div style={{fontSize:20,fontWeight:800,color:"var(--err)"}}>{nbOuv}</div><div style={{fontSize:11,color:"var(--t3)"}}>Ouvert{nbOuv>1?"s":""}</div></div>
          <div className="card" style={{padding:"12px",textAlign:"center",borderLeft:"3px solid var(--ok)"}}><div style={{fontSize:20,fontWeight:800,color:"var(--ok)"}}>{nbTraite}</div><div style={{fontSize:11,color:"var(--t3)"}}>Traité{nbTraite>1?"s":""}</div></div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{v:"ouvert",l:"Ouverts"},{v:"traite",l:"Traités"},{v:"tous",l:"Tous"}].map(t=>(
            <button key={t.v} onClick={()=>setFiltre(t.v)} style={{flex:1,padding:"8px",borderRadius:"var(--r2)",border:"1.5px solid "+(filtre===t.v?"var(--blue)":"var(--g2)"),background:filtre===t.v?"var(--blue)":"var(--w)",color:filtre===t.v?"#fff":"var(--t3)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"var(--f)"}}>{t.l}</button>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {vis.length===0&&<div className="empty"><div style={{fontSize:48}}>✅</div><p style={{fontSize:14,fontWeight:600}}>Aucun incident {filtre==="ouvert"?"ouvert":filtre==="traite"?"traité":""}</p></div>}
        {vis.map((inc,i)=>{
          const sf=sfM[inc.statut]||sfM.ouvert;
          const ch=chantiers.find(c=>c.id===inc.chId);
          const pc=inc.prio===1?"var(--err)":inc.prio===2?"var(--warn)":"var(--ok)";
          const canManage=user.role==="admin"||user.role==="chef"||inc.sig===user.nom;
          return (
            <div key={inc.id} className="card u0" style={{padding:"14px 16px",borderLeft:"3px solid "+sf.c,animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:10,color:"var(--t4)",marginBottom:3,fontWeight:600}}>{tE[inc.type]} {inc.ref} · {tL[inc.type]||inc.type}{inc.screen&&scrL[inc.screen]?" · signalé depuis "+scrL[inc.screen]:""}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{inc.desc}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{ch?.nom||"—"} · {inc.date} · par {inc.sig}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <Tag label={sf.l} type={sf.t}/>
                  <div style={{fontSize:11,fontWeight:700,color:pc,marginTop:5}}>{inc.prio===1?"Danger":inc.prio===2?"Urgent":"Normal"}</div>
                </div>
              </div>
              {inc.statut==="ouvert"&&canManage&&(
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button className="btn btn-ok btn-sm" style={{flex:1}} onClick={()=>onUpdate(inc.id,"traite")}>✓ Traité</button>
                  {onEdit&&<button className="btn btn-out btn-sm" onClick={()=>onEdit(inc)}>Modifier</button>}
                  {onCancel&&<button className="btn btn-out btn-sm" style={{borderColor:"var(--err-b)",color:"var(--err)"}} onClick={()=>onCancel(inc)}>Annuler</button>}
                </div>
              )}
              <IncidentActions inc={inc} commandes={commandes} equipe={equipe} user={user} onUpdInc={(id,changes)=>onUpdate(id,changes)} onNav={onNav} onSheet={onSheet}/>
              {inc.statut==="traite"&&canManage&&onUpdate&&(
                <button className="btn btn-out btn-sm btn-fw" style={{marginTop:8}} onClick={()=>onUpdate(inc.id,"ouvert")}>Rouvrir l'incident</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RapportsScreen({ user, rapports, chantiers, onPrint }) {
  const [chF,setChF]=useState("tous");
  const base=user.role==="admin"?rapports:rapports.filter(r=>chIdsOf(user).includes(parseInt(r.chId)));
  const vis=chF==="tous"?base:base.filter(r=>parseInt(r.chId)===parseInt(chF));
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <select className="inp" style={{height:38,fontSize:13}} value={chF} onChange={e=>setChF(e.target.value)}>
          <option value="tous">Tous les chantiers</option>
          {chantiers.filter(c=>base.some(r=>parseInt(r.chId)===c.id)).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {vis.length===0&&<div className="empty"><div style={{fontSize:48}}>📋</div><p style={{fontSize:14,fontWeight:600}}>Aucun compte-rendu</p></div>}
        {vis.map((r,i)=>{
          const ch=chantiers.find(c=>c.id===parseInt(r.chId));
          return (
            <div key={r.id} className="card u0" style={{padding:"16px",animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:8}}>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{ch?.nom||"—"}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{r.auteur} · {r.date}{r.meteo?" · "+r.meteo:""}</div></div>
                {onPrint&&(
                  <button className="btn btn-out btn-xs"
                    onClick={()=>onPrint({type:"rapport",data:{...r,chantier:ch?.nom,redacteur:r.auteur,travaux:r.av,effectif:r.presences?.length||0}})}>
                    📄 PDF
                  </button>
                )}
              </div>
              <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.55,marginBottom:r.incidents&&r.incidents!=="RAS"?10:0}}>{r.av}</div>
              {r.incidents&&r.incidents!=="RAS"&&<Alert msg={r.incidents} type="warn"/>}
              {r.presences?.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>{r.presences.map(p=><Tag key={p} label={p} type="gray"/>)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlusScreen({ user, perms, data, onNav, onLogout, onUpdEq, themeId, setThemeId, onResetDemo }) {
  const { equipe, rapports, chantiers, incidents, taches, devis, commandes, heures, conges, agenda, punch, avenants, factures, plan, planId, setPlanId, hasFeat } = data;
  const scoped = (rows, key = "chId") => filterByChAccess(user, rows, key);
  const myCh = visibleChantiers(user, chantiers);
  const incOuv = scoped(incidents).filter(i=>i.statut==="ouvert");
  const punchOuv = scoped(punch).filter(p=>p.statut!=="clos");
  const avAtt = scoped(avenants).filter(a=>a.statut==="attente");
  const hNonVal = scoped(heures||[]).filter(h=>!h.val);
  const retards = scoped(factures||[]).filter(f=>f.statut==="retard");
  const devisAtt = scoped(devis||[]).filter(d=>d.statut==="envoye"||d.statut==="brouillon");
  const cmdEnCours = scoped(commandes||[]).filter(c=>c.statut==="commandee"||c.statut==="attente");
  const congesAtt = (conges||[]).filter(c=>c.statut==="attente");
  const HF = hasFeat || (()=>true); // fallback si plan absent

  const mods = [
    perms.montants    && { id:"devis",      ico:"📝", l:"Devis",               sub:devisAtt.length>0 ? devisAtt.length+" en attente" : "Tous traités",         badge:devisAtt.length,  bt:devisAtt.length>0?"warn":"ok",  feat:"devis" },
    (perms.montants || perms.creerCmd) && { id:"commandes",  ico:"📦", l:"Commandes",            sub:cmdEnCours.length>0 ? cmdEnCours.length+" en cours" : "Tout livré",         badge:cmdEnCours.length, bt:cmdEnCours.length>0?"warn":"ok", feat:"commandes" },
    perms.equipe      && { id:"planningEq", ico:"👷", l:"Planning équipe",      sub:"Affectation semaine",                                                      badge:0, feat:"planningEq" },
    perms.equipe      && { id:"agenda",     ico:"📅", l:"Agenda",               sub:"Rendez-vous et événements",                                                badge:0, feat:"agenda" },
    perms.equipe      && { id:"conges",     ico:"🏖", l:"Congés",               sub:congesAtt.length>0 ? congesAtt.length+" à valider" : "Aucune demande",      badge:congesAtt.length, bt:congesAtt.length>0?"warn":"ok", feat:"conges" },
    perms.montants    && { id:"clients",    ico:"👤", l:"Fichier clients / CRM",sub:"Contacts et prospects",                                                    badge:0, feat:"clients" },
    perms.equipe      && { id:"fournisseurs",ico:"📦", l:"Annuaire fournisseurs", sub:(data.fournisseurs||[]).length+" contacts · Appel direct",                  badge:0, feat:"agenda" },
    perms.avenants    && { id:"avenants",   ico:"📄", l:"Avenants",             sub:avAtt.length>0 ? avAtt.length+" en attente" : "Tous signés",                badge:avAtt.length,    bt:avAtt.length>0?"warn":"ok", feat:"avenants" },
    perms.heures      && { id:"heures",     ico:"\u23F1",    l:"Planning heures",      sub:hNonVal.length>0 ? hNonVal.length+" à valider" : "Tout validé",             badge:hNonVal.length,  bt:hNonVal.length>0?"warn":"ok", feat:"heures" },
    perms.punch       && { id:"punch",      ico:"🔧", l:"Punch list",           sub:punchOuv.length>0 ? punchOuv.length+" ouverte(s)" : "Tout clos",            badge:punchOuv.length, bt:punchOuv.length>0?"err":"ok", feat:"punch" },
    perms.finances    && { id:"finances",   ico:"💶", l:"Finances",             sub:retards.length>0 ? retards.length+" en retard" : "À jour",                  badge:retards.length,  bt:retards.length>0?"err":"ok", feat:"factures" },
    perms.situations  && { id:"situations", ico:"📊", l:"Situations de travaux",sub:"Facturation progressive",                                                  badge:0, feat:"situations" },
    perms.rapports    && { id:"rapports",   ico:"📋", l:"Comptes-rendus",       sub:rapports.length+" rapport"+(rapports.length>1?"s":""),                      badge:0, feat:"rapports" },
    perms.incidents   && { id:"incidents",  ico:"\u26A0",    l:"Incidents",            sub:incOuv.length>0 ? incOuv.length+" non traité(s)" : "Aucun incident",        badge:incOuv.length,   bt:incOuv.length>0?"err":"ok", urgent:incOuv.length>0, feat:"incidents" },
  ].filter(Boolean).map(m=>({...m, lock:!HF(m.feat)}));

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:20}}>

        {user.role==="admin"&&(
          <div>
            <div className="sec">Résumé</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[
                {l:"Chantiers", v:myCh.filter(c=>c.statut==="actif").length, c:"var(--blue)"},
                {l:"Tâches",    v:scoped(taches).filter(t=>t.statut!=="fait").length,      c:scoped(taches).filter(t=>t.prio===1&&t.statut!=="fait").length>0?"var(--err)":"var(--t1)"},
                {l:"Équipe",    v:equipe.filter(m=>m.statut==="present").length+"/"+equipe.length, c:"var(--ok)"},
              ].map((m,i)=>(
                <div key={i} className="card" style={{padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:800,color:m.c,marginBottom:2}}>{m.v}</div>
                  <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase"}}>{m.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="sec">Modules</div>
          <div className="col gap6">
            {mods.map(item=>{
              const badgeColor = item.bt==="err"?"var(--err)":item.bt==="warn"?"var(--warn)":"var(--blue)";
              if(item.lock){
                return (
                  <div key={item.id} className="card" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14,opacity:.7,border:"1px dashed var(--g3)",background:"var(--g1)",cursor:"pointer"}} onClick={()=>{const el=document.getElementById("mon-abonnement");if(el)el.scrollIntoView({behavior:"smooth"});}}>
                    <div style={{width:42,height:42,background:"var(--g2)",borderRadius:"var(--r2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,filter:"grayscale(1)"}}>{item.ico}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--t2)"}}>{item.l}</div>
                      <div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>Disponible avec le plan Pro</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:99}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      <span style={{fontSize:10,fontWeight:700,color:"var(--blue)"}}>PRO</span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} role="button" tabIndex={0} aria-label={item.l} className="card tap" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",border:item.urgent?"1.5px solid var(--err-b)":"1px solid var(--g2)"}} onClick={()=>onNav(item.id)} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),onNav(item.id))}>
                  <div style={{width:42,height:42,background:item.urgent?"var(--err-l)":"var(--blue-l)",borderRadius:"var(--r2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,position:"relative"}}>
                    {item.ico}
                    {item.badge>0&&(
                      <div style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,background:badgeColor,color:"#fff",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",border:"2px solid var(--w)"}}>{item.badge}</div>
                    )}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:item.urgent?"var(--err)":"var(--t1)"}}>{item.l}</div>
                    <div style={{fontSize:12,color:item.urgent?"var(--err)":"var(--t3)",marginTop:2}}>{item.sub}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              );
            })}
          </div>
        </div>

        {perms.equipe&&(
          <div>
            <div className="row" style={{marginBottom:10}}>
              <div className="sec" style={{margin:0}}>Équipe ({equipe.length})</div>
              <div style={{display:"flex",gap:4}}>
                <Tag label={equipe.filter(m=>m.statut==="present").length+" présents"} type="ok"/>
                {equipe.filter(m=>m.statut!=="present").length>0&&<Tag label={equipe.filter(m=>m.statut!=="present").length+" absent(s)"} type="err"/>}
              </div>
            </div>
            <div className="col gap8">
              {equipe.map((m,i)=>{
                const dc={present:"var(--ok)",retard:"var(--warn)",absent:"var(--err)"}[m.statut]||"var(--g4)";
                const mCh=chantiers.filter(c=>m.chIds&&m.chIds.includes(c.id)&&c.statut==="actif");
                const cols=["#2563EB","#0891B2","#059669","#D97706","#7C3AED"];
                return (
                  <div key={m.id} className="card" style={{padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{position:"relative"}}>
                        <Av nom={m.nom} color={cols[i%5]} size={40}/>
                        <div style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:dc,border:"2px solid var(--w)"}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.nom}</div>
                        <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{m.fn} · {m.qual||""} · {m.tauxH||35}€/h</div>
                        {mCh.length>0&&<div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>📍 {mCh.map(c=>c.nom.split(" ").slice(0,2).join(" ")).join(", ")}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                        <Tag label={m.statut==="present"?"Présent":m.statut==="retard"?"En retard":"Absent"} type={m.statut==="present"?"ok":m.statut==="retard"?"warn":"err"}/>
                        {m.tel&&perms.tels&&<a href={"tel:"+m.tel}><button className="btn btn-out btn-xs">📞</button></a>}
                      </div>
                    </div>
                    {onUpdEq&&perms.equipe&&(
                      <div style={{display:"flex",gap:5,marginTop:8,paddingTop:8,borderTop:"1px solid var(--g2)"}}>
                        {[{v:"present",l:"Présent",c:"var(--ok)"},{v:"retard",l:"Retard",c:"var(--warn)"},{v:"absent",l:"Absent",c:"var(--err)"}].map(st=>(
                          <button key={st.v} onClick={()=>onUpdEq(m.id,st.v)} style={{flex:1,height:30,borderRadius:"var(--r)",border:"1.5px solid "+(m.statut===st.v?st.c:"var(--g2)"),background:m.statut===st.v?st.c+"18":"transparent",color:m.statut===st.v?st.c:"var(--t4)",fontFamily:"var(--f)",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                            {st.l}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {user.role==="admin"&&plan&&(
          <div id="mon-abonnement">
            <div className="sec">Mon abonnement</div>
            <div className="card" style={{padding:"18px",border:"1.5px solid var(--blue-b)",background:"var(--blue-l)"}}>
              <div className="row" style={{marginBottom:14}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:17,fontWeight:800,color:"var(--t1)"}}>{plan.nom}</span>
                    <span style={{padding:"2px 9px",background:"var(--blue)",color:"#fff",fontSize:10,fontWeight:800,borderRadius:99,textTransform:"uppercase"}}>Actif</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{plan.desc}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:800,color:"var(--blue)",letterSpacing:"-.02em"}}>{plan.prix}€</div>
                  <div style={{fontSize:10,color:"var(--t4)"}}>/mois HT</div>
                </div>
              </div>
              {/* Jauges de limites */}
              {(() => {
                const nbUsers=equipe.length;
                const nbChActifs=chantiers.filter(c=>c.statut==="actif").length;
                const limU=plan.maxUsers, limC=plan.maxChantiers;
                const pctU=limU===Infinity?0:Math.min(100,Math.round(nbUsers/limU*100));
                const pctC=limC===Infinity?0:Math.min(100,Math.round(nbChActifs/limC*100));
                const Row=({label,used,lim,pct})=>(
                  <div style={{marginBottom:10}}>
                    <div className="row" style={{marginBottom:4}}>
                      <span style={{fontSize:12,color:"var(--t2)",fontWeight:500}}>{label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:pct>=100?"var(--err)":"var(--t1)"}}>{used}{lim===Infinity?"":" / "+lim}{lim===Infinity?" · illimité":""}</span>
                    </div>
                    {lim!==Infinity&&<div style={{height:6,background:"var(--g2)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:pct>=100?"var(--err)":pct>=80?"var(--warn)":"var(--blue)",borderRadius:99,transition:"width .3s"}}/></div>}
                  </div>
                );
                return (<div style={{background:"var(--w)",borderRadius:"var(--r2)",padding:"14px",marginBottom:12}}>
                  <Row label="Utilisateurs" used={nbUsers} lim={limU} pct={pctU}/>
                  <Row label="Chantiers actifs" used={nbChActifs} lim={limC} pct={pctC}/>
                </div>);
              })()}
              {/* Sélecteur de plan (démo) */}
              <div style={{fontSize:11,color:"var(--t4)",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}}>Changer de formule</div>
              <div style={{display:"flex",gap:6}}>
                {["starter","pro","entreprise"].map(pid=>{
                  const p=PLANS[pid];
                  const active=planId===pid;
                  return (
                    <button key={pid} onClick={()=>setPlanId&&setPlanId(pid)} style={{flex:1,padding:"10px 6px",borderRadius:"var(--r2)",border:active?"1.5px solid var(--blue)":"1.5px solid var(--g2)",background:active?"var(--blue)":"var(--w)",cursor:"pointer",fontFamily:"var(--f)",transition:"all .15s"}}>
                      <div style={{fontSize:12,fontWeight:800,color:active?"#fff":"var(--t1)"}}>{p.nom}</div>
                      <div style={{fontSize:10,color:active?"rgba(255,255,255,.8)":"var(--t4)",marginTop:1}}>{p.prix}€/mois</div>
                    </button>
                  );
                })}
              </div>
              <div style={{fontSize:10,color:"var(--t4)",marginTop:10,textAlign:"center"}}>
                {isStripeConfigured ? (
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                    <button type="button" className="btn btn-blue btn-sm btn-fw" onClick={async()=>{
                      const url=stripeCheckoutUrl(planId);
                      if(!url)return;
                      const {data:{session}}=await supabase.auth.getSession();
                      const r=await fetch(url,{headers:{Authorization:`Bearer ${session?.access_token}`}});
                      const j=await r.json();
                      if(j.url)window.location.href=j.url;
                    }}>S'abonner via Stripe</button>
                    <button type="button" className="btn btn-ghost btn-sm btn-fw" onClick={async()=>{
                      const url=stripePortalUrl();
                      if(!url)return;
                      const {data:{session}}=await supabase.auth.getSession();
                      const r=await fetch(url,{headers:{Authorization:`Bearer ${session?.access_token}`}});
                      const j=await r.json();
                      if(j.url)window.location.href=j.url;
                    }}>Gérer mon abonnement</button>
                  </div>
                ) : "Démo — configurez Stripe (voir supabase/STRIPE.md)"}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="sec">Apparence</div>
          <div className="theme-grid">
            {APP_THEMES.map(th=>(
              <button key={th.id} type="button" className={"theme-card"+(themeId===th.id?" on":"")} onClick={()=>setThemeId&&setThemeId(th.id)}>
                <div className="theme-swatch">
                  <span style={{background:th.swatch[0]}}/>
                  <span style={{background:th.swatch[1]}}/>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{th.emoji} {th.name}</div>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{th.desc}</div>
              </button>
            ))}
          </div>
        </div>

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
          {onResetDemo&&user.role==="admin"&&(
            <button className="btn btn-out btn-fw" style={{marginTop:8,borderColor:"var(--warn-b)",color:"var(--warn)"}} onClick={onResetDemo}>Réinitialiser les données démo</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   DEVIS — Création, lots, transformation en chantier
═══════════════════════════════════════ */
function DevisScreen({ user, perms, devis, chantiers, onAddDevis, onConvertDevis, onChangeStatut, onEditDevis, onPrint }) {
  if(!perms.montants) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p></div>;
  const [selId,setSelId] = useState(null);
  const [showEdit,setShowEdit] = useState(false);
  const setSel = id => { setSelId(id); setShowEdit(false); };
  const sfM = {brouillon:{l:"Brouillon",t:"gray"},envoye:{l:"Envoyé",t:"blue"},accepte:{l:"Accepté",t:"ok"},refuse:{l:"Refusé",t:"err"}};

  const calcDevis = d => {
    let totalHT = 0;
    (d.lots||[]).forEach(lot => lot.lignes.forEach(l => { totalHT += (l.qte||0)*(l.pu||0); }));
    const remise = Math.round(totalHT * (d.remise||0) / 100);
    const netHT = totalHT - remise;
    const tvaM = Math.round(netHT * (d.tva||20) / 100);
    return { totalHT, remise, netHT, tva: tvaM, ttc: netHT + tvaM, nbLots: (d.lots||[]).length, nbLignes: (d.lots||[]).reduce((s,l)=>s+l.lignes.length,0) };
  };

  const sel = selId ? devis.find(d=>d.id===selId) : null;
  const stats = sel ? calcDevis(sel) : null;

  // Détail devis
  // Détail devis + sheet édition
  if (showEdit && sel) return <FDevisEdit devis={sel} chantiers={chantiers} onClose={()=>setShowEdit(false)} onSave={d=>{onEditDevis&&onEditDevis(sel.id,d);setShowEdit(false);}}/>;

  if (sel && stats) return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"12px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:10}}>
        <button className="btn btn-out btn-sm" onClick={()=>setSelId(null)}>← Retour</button>
        <div style={{flex:1,fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel.ref}</div>
        {(sel.statut==="brouillon"||sel.statut==="envoye")&&perms.montants&&(
          <button className="btn btn-out btn-sm" onClick={()=>setShowEdit(true)}>✏ Éditer</button>
        )}
        {perms.montants&&(
          <button className="btn btn-out btn-sm" onClick={()=>{const d={...sel,ref:"DEV-COPY-"+String(Date.now()).slice(-3),statut:"brouillon",date:new Date().toLocaleDateString("fr-FR")};onAddDevis(d);}}>Dupliquer</button>
        )}
        {sel.statut==="accepte"&&!chantiers.find(c=>c.client===sel.client&&c.budget>0)&&(
          <button className="btn btn-ok btn-sm" onClick={()=>onConvertDevis(sel)}>Créer le chantier</button>
        )}
        {onPrint&&(
          <button className="btn btn-out btn-sm"
            onClick={()=>onPrint({type:"devis",data:sel})}>
            📄 PDF
          </button>
        )}
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {/* En-tête */}
        <div className="card u0" style={{padding:"16px"}}>
          <div className="row" style={{marginBottom:8}}>
            <Tag label={sfM[sel.statut]?.l||sel.statut} type={sfM[sel.statut]?.t||"gray"}/>
            <span style={{fontSize:11,color:"var(--t4)"}}>{sel.ref}</span>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:6}}>{sel.objet}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
            {[{l:"Client",v:sel.client},{l:"Date",v:sel.date},{l:"Validité",v:sel.validite},{l:"TVA",v:sel.tva+"%"}].map(item=>(
              <div key={item.l} style={{padding:"8px 10px",background:"var(--g1)",borderRadius:"var(--r)",border:"1px solid var(--g2)"}}>
                <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{item.l}</div>
                <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{item.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lots détaillés */}
        {(sel.lots||[]).map((lot,li)=>{
          const lotTotal = lot.lignes.reduce((s,l)=>(s+(l.qte||0)*(l.pu||0)),0);
          return (
            <div key={li} className="card u1" style={{padding:"16px",animationDelay:li*.05+"s"}}>
              <div className="row" style={{marginBottom:10}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{lot.nom}</div>
                <span style={{fontSize:14,fontWeight:800,color:"var(--blue)"}}>{EUR(lotTotal)}</span>
              </div>
              {/* En-tête tableau */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 50px 60px 70px",gap:4,padding:"6px 0",borderBottom:"1.5px solid var(--g2)",marginBottom:4}}>
                <span style={{fontSize:10,fontWeight:700,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em"}}>Désignation</span>
                <span style={{fontSize:10,fontWeight:700,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",textAlign:"center"}}>Qté</span>
                <span style={{fontSize:10,fontWeight:700,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",textAlign:"right"}}>P.U. HT</span>
                <span style={{fontSize:10,fontWeight:700,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",textAlign:"right"}}>Total HT</span>
              </div>
              {lot.lignes.map((l,j)=>(
                <div key={j} style={{display:"grid",gridTemplateColumns:"1fr 50px 60px 70px",gap:4,padding:"6px 0",borderBottom:"1px solid var(--g2)"}}>
                  <span style={{fontSize:12,color:"var(--t2)"}}>{l.desc}</span>
                  <span style={{fontSize:12,color:"var(--t3)",textAlign:"center"}}>{l.qte} {l.unite}</span>
                  <span style={{fontSize:12,color:"var(--t3)",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{l.pu}€</span>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--t1)",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{EUR((l.qte||0)*(l.pu||0))}</span>
                </div>
              ))}
            </div>
          );
        })}

        {/* Récapitulatif */}
        <div className="card u2" style={{padding:"16px"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:12}}>Récapitulatif</div>
          {[
            {l:"Total HT brut", v:EUR(stats.totalHT)},
            sel.remise>0&&{l:"Remise "+sel.remise+"%", v:"-"+EUR(stats.remise), c:"var(--ok)"},
            {l:"Net HT", v:EUR(stats.netHT), bold:true},
            {l:"TVA "+sel.tva+"%", v:EUR(stats.tva)},
            {l:"TOTAL TTC", v:EUR(stats.ttc), bold:true, big:true},
          ].filter(Boolean).map(r=>(
            <div key={r.l} className="row" style={{padding:"6px 0",borderBottom:"1px solid var(--g2)"}}>
              <span style={{fontSize:r.big?14:13,fontWeight:r.bold?700:400,color:r.c||"var(--t2)"}}>{r.l}</span>
              <span style={{fontSize:r.big?18:14,fontWeight:r.bold?800:600,color:r.c||"var(--t1)"}}>{r.v}</span>
            </div>
          ))}
        </div>

        {sel.statut==="accepte"&&(
          <Alert msg="Ce devis a été accepté par le client." type="ok"/>
        )}
        {sel.statut==="refuse"&&(
          <Alert msg="Ce devis a été refusé par le client." type="err"/>
        )}
        {sel.statut==="brouillon"&&onChangeStatut&&(
          <button className="btn btn-blue btn-fw" onClick={()=>onChangeStatut(sel.id,"envoye")}>Marquer comme envoyé au client</button>
        )}
        {sel.statut==="envoye"&&onChangeStatut&&(
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-ok" style={{flex:1}} onClick={()=>onChangeStatut(sel.id,"accepte")}>Client accepte</button>
            <button className="btn btn-err" style={{flex:1}} onClick={()=>onChangeStatut(sel.id,"refuse")}>Client refuse</button>
          </div>
        )}
      </div>
    </div>
  );

  // Liste devis
  const totalAccepte = devis.filter(d=>d.statut==="accepte").reduce((s,d)=>s+calcDevis(d).netHT,0);
  const totalEnvoye = devis.filter(d=>d.statut==="envoye").reduce((s,d)=>s+calcDevis(d).netHT,0);
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div className="card" style={{padding:"12px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"var(--blue)"}}>{devis.length}</div><div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",marginTop:2}}>Total</div></div>
          <div className="card" style={{padding:"12px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"var(--ok)"}}>{EUR(totalAccepte)}</div><div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",marginTop:2}}>Acceptés</div></div>
          <div className="card" style={{padding:"12px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"var(--warn)"}}>{EUR(totalEnvoye)}</div><div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",marginTop:2}}>En attente</div></div>
        </div>

        <div className="sec">Tous les devis</div>
        {devis.map((d,i)=>{
          const st = calcDevis(d);
          const sf = sfM[d.statut]||{l:d.statut,t:"gray"};
          return (
            <div key={d.id} className="card tap u0" style={{padding:"16px",cursor:"pointer",animationDelay:i*.04+"s"}} onClick={()=>setSel(d.id)}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:10,color:"var(--t4)",fontWeight:600,marginBottom:3}}>{d.ref} · {d.date}</div>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{d.objet}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{d.client} · {st.nbLots} lot{st.nbLots>1?"s":""} · {st.nbLignes} ligne{st.nbLignes>1?"s":""}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:17,fontWeight:800,color:"var(--t1)",marginBottom:5}}>{EUR(st.ttc)}</div>
                  <Tag label={sf.l} type={sf.t}/>
                </div>
              </div>
              <div style={{fontSize:11,color:"var(--t4)",marginTop:4}}>Net HT {EUR(st.netHT)} · TVA {EUR(st.tva)}</div>
              <div style={{marginTop:8,fontSize:12,color:"var(--blue)",fontWeight:600}}>Voir le détail →</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   COMMANDES FOURNISSEURS
═══════════════════════════════════════ */
function CommandesScreen({ user, perms, commandes, chantiers, fournisseurs, onAddCmd, onReception, onSheet }) {
  if(!perms.montants && !perms.creerCmd) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p></div>;
  const [chF,setChF]=useState("tous");
  const [q,setQ]=useState("");
  const sfM = {attente:{l:"En attente",t:"warn"},commandee:{l:"Commandée",t:"blue"},livree:{l:"Livrée",t:"ok"},annulee:{l:"Annulée",t:"err"}};
  const base = user.role==="admin"?commandes:commandes.filter(c=>chIdsOf(user).includes(c.chId));
  const visible = base
    .filter(c=>chF==="tous"||c.chId===parseInt(chF))
    .filter(c=>!q||c.objet.toLowerCase().includes(q.toLowerCase())||c.fournisseur.toLowerCase().includes(q.toLowerCase()));
  const totalCmd = perms.montants ? visible.reduce((s,c)=>s+c.mt,0) : 0;
  const totalLivre = perms.montants ? visible.filter(c=>c.statut==="livree").reduce((s,c)=>s+c.mt,0) : 0;
  const enCours = visible.filter(c=>c.statut==="commandee"||c.statut==="attente");
  const findFourn=nom=>(fournisseurs||D_FOURNISSEURS).find(f=>f.nom.toLowerCase()===nom.toLowerCase());

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        {onSheet&&<button className="btn btn-blue btn-fw" style={{marginBottom:8}} onClick={()=>onSheet("commande")}>+ Nouvelle commande</button>}
        <input className="inp" style={{height:38,fontSize:13,marginBottom:8}} placeholder="Rechercher par objet ou fournisseur..." value={q} onChange={e=>setQ(e.target.value)}/>
        <select className="inp" style={{height:36,fontSize:12,marginBottom:10}} value={chF} onChange={e=>setChF(e.target.value)}>
          <option value="tous">Tous les chantiers</option>
          {chantiers.filter(c=>c.statut!=="livre").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {l:"Total achats",v:perms.montants?EUR(totalCmd):"—",c:"var(--t1)"},
            {l:"Livré",       v:perms.montants?EUR(totalLivre):"—",c:"var(--ok)"},
            {l:"En cours",    v:enCours.length+" cmd",c:enCours.length>0?"var(--warn)":"var(--t4)"},
          ].map((m,i)=>(
            <div key={i} style={{textAlign:"center",padding:"10px 4px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
              <div style={{fontSize:16,fontWeight:800,color:m.c,marginBottom:2}}>{m.v}</div>
              <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase"}}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {enCours.length>0&&<Alert msg={enCours.length+" commande"+(enCours.length>1?"s":"")+" en attente de livraison"} type="warn"/>}
        {visible.length===0&&<div className="empty"><div style={{fontSize:48}}>📦</div><p style={{fontSize:14,fontWeight:600}}>Aucune commande</p></div>}
        {visible.map((c,i)=>{
          const sf = sfM[c.statut]||{l:c.statut,t:"gray"};
          const ch = chantiers.find(x=>x.id===c.chId);
          const fourn = findFourn(c.fournisseur);
          return (
            <div key={c.id} className="card u0" style={{padding:"14px 16px",animationDelay:i*.04+"s",borderLeft:"3px solid "+(c.statut==="livree"?"var(--ok)":c.statut==="commandee"?"var(--blue)":c.statut==="annulee"?"var(--err)":"var(--warn)")}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{fontSize:10,color:"var(--t4)",fontWeight:600,marginBottom:3}}>{c.ref} · {c.date}{c.urgent&&<span style={{marginLeft:6,padding:"1px 7px",background:"var(--err-l)",color:"var(--err)",borderRadius:99,fontWeight:800,fontSize:9}}>URGENT</span>}</div>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{c.objet}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{c.fournisseur} · {ch?.nom?.split(" ").slice(0,3).join(" ")||"—"}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  {perms.montants&&c.mt>0&&<div style={{fontSize:16,fontWeight:800,color:"var(--t1)",marginBottom:5}}>{EUR(c.mt)}</div>}
                  <Tag label={sf.l} type={sf.t}/>
                </div>
              </div>
              <div style={{fontSize:11,color:"var(--t4)",marginBottom:8}}>
                {c.validePar?"Validé par "+c.validePar:"En attente de validation"}
                {c.livraison?" · Livraison prévue "+c.livraison:""}
              </div>
              <div style={{display:"flex",gap:8}}>
                {fourn&&fourn.tel&&(
                  <a href={"tel:"+fourn.tel.replace(/\s/g,"")} style={{flex:1,textDecoration:"none"}}>
                    <button className="btn btn-out btn-sm btn-fw" style={{width:"100%"}}>📞 Appeler {fourn.nom}</button>
                  </a>
                )}
                {c.statut==="commandee"&&onReception&&(
                  <button className="btn btn-ok btn-sm" style={{flex:1}} onClick={()=>onReception(c.id)}>✓ Réceptionné</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   PLANNING ÉQUIPE — Qui est où cette semaine
═══════════════════════════════════════ */
function PlanningEqScreen({ user, perms, planningEq, chantiers, equipe, heures, onEdit, onValiderH }) {
  const JOURS   = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const JFULL   = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
  const COLS    = ["#2563EB","#0891B2","#059669","#D97706","#7C3AED","#DC2626","#EA580C"];
  const [off,setOff]    = useState(0);
  const [selMem,setSelMem] = useState(null); // membre sélectionné (objet)
  const today = new Date();
  const getLundi = o => {
    const d = new Date(today);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + o * 7);
    d.setHours(0,0,0,0);
    return d;
  };
  const lundi = getLundi(off);
  const iso = d => d.toISOString().split("T")[0];
  const fmtSem = () => {
    const fin = new Date(lundi);
    fin.setDate(lundi.getDate() + 6);
    const f = d => d.toLocaleDateString("fr-FR", {day:"numeric", month:"short"});
    return f(lundi) + " - " + f(fin);
  };
  const sem = JOURS.map((_, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    return d;
  });
  const canEdit = perms.equipe && (user.role === "admin" || user.role === "chef");
  const actifs  = chantiers.filter(c => c.statut === "actif");

  // ── Vue détail d'un employé ──
  if (selMem) {
    const m      = selMem;
    const plann  = planningEq.find(p => p.id === m.id);
    const semArr = plann ? plann.sem : [];
    const ci     = equipe.indexOf(m);
    const color  = COLS[ci % COLS.length];
    const hSem   = heures ? heures.filter(h => h.nom === m.nom && sem.some(d => iso(d) === h.date)) : [];
    const totalH = hSem.reduce((s, h) => s + calcH(h), 0);
    const hNonV  = hSem.filter(h => !h.val).length;
    const tx     = m.tauxH || 35;
    const hSup   = Math.max(0, totalH - 35);
    const cout   = Math.round(Math.min(totalH, 35) * tx + Math.max(0, Math.min(hSup, 8)) * tx * 1.25 + Math.max(0, hSup - 8) * tx * 1.5);

    return (
      <div style={{paddingBottom:100, overflowY:"auto", height:"100%"}}>
        {/* Header employé */}
        <div style={{padding:"14px 20px", background:"var(--w)", borderBottom:"1px solid var(--g2)", position:"sticky", top:0, zIndex:10}}>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <button className="btn btn-out btn-sm" onClick={() => setSelMem(null)}>← Équipe</button>
            <Av nom={m.nom} color={color} size={38}/>
            <div style={{flex:1}}>
              <div style={{fontSize:15, fontWeight:800, color:"var(--t1)", letterSpacing:"-.01em"}}>{m.nom}</div>
              <div style={{fontSize:12, color:"var(--t3)", marginTop:2}}>{m.fn} · {tx}€/h</div>
            </div>
            {m.tel && <a href={"tel:" + m.tel}><button className="btn btn-blue btn-sm">📞</button></a>}
          </div>
        </div>

        <div style={{padding:"16px 20px", display:"flex", flexDirection:"column", gap:16}}>

          {/* KPIs semaine */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
            {[
              {l:"Heures sem.", v: Math.round(totalH * 10) / 10 + "h", c:"var(--blue)"},
              {l:"Heures sup.",  v: hSup > 0 ? "+" + Math.round(hSup * 10) / 10 + "h" : "—", c: hSup > 0 ? "var(--warn)" : "var(--t4)"},
              {l:"Coût estimé", v: EUR(cout), c:"var(--t1)"},
            ].map((k, i) => (
              <div key={i} className="card" style={{padding:"10px", textAlign:"center"}}>
                <div style={{fontSize:17, fontWeight:800, color:k.c, marginBottom:2}}>{k.v}</div>
                <div style={{fontSize:10, color:"var(--t4)", textTransform:"uppercase", letterSpacing:".05em"}}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* Planning semaine */}
          <div>
            <div className="row" style={{marginBottom:10}}>
              <div className="sec" style={{margin:0}}>Planning — {fmtSem()}</div>
              <div style={{display:"flex", gap:4}}>
                <button className="btn btn-out btn-xs" onClick={() => setOff(o => o - 1)}>Préc.</button>
                <button className="btn btn-out btn-xs" onClick={() => setOff(o => o + 1)}>Suiv.</button>
              </div>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {sem.map((d, ji) => {
                const entry   = semArr[ji] || {chId: null};
                const chId    = entry.chId || null;
                const ch      = chId ? chantiers.find(c => c.id === chId) : null;
                const isToday = iso(d) === iso(today);
                const hJour   = heures ? heures.filter(h => h.nom === m.nom && h.date === iso(d)) : [];
                const hJ      = hJour.reduce((s, h) => s + calcH(h), 0);
                return (
                  <div key={ji} className="card" style={{padding:"12px 14px", borderTop:"1px solid var(--g2)", borderRight:"1px solid var(--g2)", borderBottom:"1px solid var(--g2)", borderLeft:"3px solid " + (isToday ? "var(--blue)" : ch ? COLS[actifs.indexOf(ch) % COLS.length] : "var(--g2)"), background: isToday ? "var(--blue-l)" : "var(--w)"}}>
                    <div style={{display:"flex", alignItems:"center", gap:10}}>
                      <div style={{width:36, textAlign:"center"}}>
                        <div style={{fontSize:10, fontWeight:700, color: isToday ? "var(--blue)" : "var(--t4)", textTransform:"uppercase"}}>{JOURS[ji]}</div>
                        <div style={{fontSize:13, fontWeight:800, color: isToday ? "var(--blue)" : "var(--t2)"}}>{d.getDate()}</div>
                      </div>
                      <div style={{flex:1}}>
                        {canEdit ? (
                          <select
                            className="inp"
                            style={{height:34, fontSize:12, fontWeight:ch ? 700 : 400, color: ch ? (COLS[actifs.indexOf(ch) % COLS.length]) : "var(--t4)"}}
                            value={chId || ""}
                            onChange={e => onEdit && onEdit(m.id, ji, e.target.value ? parseInt(e.target.value) : null)}
                          >
                            <option value="">— Repos / Absent</option>
                            {actifs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                          </select>
                        ) : (
                          <div style={{fontSize:13, fontWeight:ch ? 700 : 400, color: ch ? "var(--t1)" : "var(--t4)"}}>
                            {ch ? ch.nom : "Repos"}
                          </div>
                        )}
                      </div>
                      {hJ > 0 && (
                        <div style={{textAlign:"right", flexShrink:0}}>
                          <div style={{fontSize:14, fontWeight:800, color:"var(--blue)"}}>{Math.round(hJ * 10) / 10}h</div>
                          <div style={{fontSize:9, color:"var(--t4)"}}>saisies</div>
                        </div>
                      )}
                    </div>
                    {/* Détail heures du jour */}
                    {hJour.length > 0 && (
                      <div style={{marginTop:8, paddingTop:8, borderTop:"1px solid var(--g2)"}}>
                        {hJour.map((h, hi) => (
                          <div key={hi} style={{display:"flex", alignItems:"center", gap:8, fontSize:11, color:"var(--t3)", marginBottom:hi < hJour.length - 1 ? 4 : 0}}>
                            <Tag label={h.val ? "Validé" : "En attente"} type={h.val ? "ok" : "warn"}/>
                            <span>{h.arr} → {h.dep} (pause {h.pause}min)</span>
                            {h.desc && <span style={{color:"var(--t4)"}}>· {h.desc}</span>}
                            {!h.val && canEdit && onValiderH && (
                              <button className="btn btn-ok btn-xs" style={{marginLeft:"auto"}} onClick={() => onValiderH(h.id)}>✓</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Variables de paie */}
          {hSem.length > 0 && (
            <div>
              <div className="sec">Variables de paie — cette semaine</div>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <div className="card" style={{padding:"10px 14px", display:"flex", gap:8, alignItems:"center"}}>
                  <span style={{fontSize:13}}>🍽</span>
                  <div><div style={{fontSize:13, fontWeight:700, color:"var(--t1)"}}>{hSem.filter(h => h.panier).length} paniers</div><div style={{fontSize:10, color:"var(--t4)"}}>jours avec indemnité repas</div></div>
                </div>
                <div className="card" style={{padding:"10px 14px", display:"flex", gap:8, alignItems:"center"}}>
                  <span style={{fontSize:13}}>🚗</span>
                  <div><div style={{fontSize:13, fontWeight:700, color:"var(--t1)"}}>{hSem.filter(h => h.trajet).length} trajets</div><div style={{fontSize:10, color:"var(--t4)"}}>jours avec indemnité trajet</div></div>
                </div>
                {hSem.some(h => h.zone > 0) && (
                  <div className="card" style={{padding:"10px 14px", display:"flex", gap:8, alignItems:"center"}}>
                    <span style={{fontSize:13}}>📍</span>
                    <div><div style={{fontSize:13, fontWeight:700, color:"var(--t1)"}}>Zone {Math.max(...hSem.filter(h=>h.zone).map(h=>h.zone))}</div><div style={{fontSize:10, color:"var(--t4)"}}>prime d'éloignement</div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation en masse */}
          {hNonV > 0 && canEdit && onValiderH && (
            <button className="btn btn-ok btn-fw" onClick={() => hSem.filter(h => !h.val).forEach(h => onValiderH(h.id))}>
              Valider toutes les heures de la semaine ({hNonV} en attente)
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Vue liste équipe ──
  return (
    <div style={{paddingBottom:100, overflowY:"auto", height:"100%"}}>
      <div style={{padding:"14px 20px", background:"var(--w)", borderBottom:"1px solid var(--g2)", position:"sticky", top:0, zIndex:10}}>
        <div className="row" style={{marginBottom:0}}>
          <button className="btn btn-out btn-sm" onClick={() => setOff(o => o - 1)}>Préc.</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:13, fontWeight:700, color:"var(--t1)"}}>{fmtSem()}</div>
            {off !== 0 && <button style={{fontSize:11, color:"var(--blue)", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--f)", fontWeight:600}} onClick={() => setOff(0)}>Cette semaine</button>}
          </div>
          <button className="btn btn-out btn-sm" onClick={() => setOff(o => o + 1)}>Suiv.</button>
        </div>
      </div>

      <div style={{padding:"16px 20px", display:"flex", flexDirection:"column", gap:10}}>
        <div style={{padding:"10px 14px", background:"var(--blue-l)", border:"1px solid var(--blue-b)", borderRadius:"var(--r2)", fontSize:12, color:"var(--blue)", fontWeight:600}}>
          Cliquez sur un membre pour modifier son planning et valider ses heures.
        </div>

        {equipe.map((m, mi) => {
          const plann   = planningEq.find(p => p.id === m.id);
          const semArr  = plann ? plann.sem : [];
          const color   = COLS[mi % COLS.length];
          const dc      = {present:"var(--ok)", retard:"var(--warn)", absent:"var(--err)"}[m.statut] || "var(--g4)";
          const hSem    = heures ? heures.filter(h => h.nom === m.nom && sem.some(d => iso(d) === h.date)) : [];
          const totalH  = hSem.reduce((s, h) => s + calcH(h), 0);
          const hNonV   = hSem.filter(h => !h.val).length;
          const jours   = semArr.filter(s => s && s.chId).length;

          return (
            <div key={m.id} className="card tap" style={{padding:"16px", cursor:"pointer"}} onClick={() => setSelMem(m)}>
              <div style={{display:"flex", alignItems:"center", gap:12, marginBottom: jours > 0 ? 12 : 0}}>
                <div style={{position:"relative"}}>
                  <Av nom={m.nom} color={color} size={42}/>
                  <div style={{position:"absolute", bottom:0, right:0, width:11, height:11, borderRadius:"50%", background:dc, border:"2px solid var(--w)"}}/>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:800, color:"var(--t1)", letterSpacing:"-.01em"}}>{m.nom}</div>
                  <div style={{fontSize:12, color:"var(--t3)", marginTop:2}}>{m.fn} · {m.tauxH || 35}€/h</div>
                </div>
                <div style={{textAlign:"right", flexShrink:0}}>
                  {totalH > 0 && <div style={{fontSize:15, fontWeight:800, color:"var(--blue)"}}>{Math.round(totalH * 10) / 10}h</div>}
                  {hNonV > 0 && <Tag label={hNonV + " à valider"} type="warn"/>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              {/* Mini planning semaine */}
              {jours > 0 && (
                <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3}}>
                  {sem.map((d, ji) => {
                    const entry = semArr[ji] || {chId:null};
                    const ch    = entry.chId ? chantiers.find(c => c.id === entry.chId) : null;
                    const col   = ch ? COLS[actifs.indexOf(ch) % COLS.length] : "var(--g2)";
                    return (
                      <div key={ji} style={{padding:"4px 2px", borderRadius:5, background: ch ? col + "18" : "var(--g1)", border:"1px solid " + (ch ? col + "40" : "var(--g2)"), textAlign:"center"}}>
                        <div style={{fontSize:8, fontWeight:700, color:"var(--t4)"}}>{JOURS[ji][0]}</div>
                        <div style={{fontSize:7, fontWeight:800, color: ch ? col : "var(--g3)", marginTop:1, lineHeight:1.2}}>
                          {ch ? ch.nom.split(" ")[0].slice(0,5) : "-"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function CongesScreen({ user, perms, conges, onValider, onSheet }) {
  const sfM={valide:{l:"Validé",t:"ok"},attente:{l:"En attente",t:"warn"},refuse:{l:"Refusé",t:"err"}};
  const tM={conge:"Congés payés",rtt:"RTT",maladie:"Maladie",sans_solde:"Sans solde"};
  const totalJ=conges.filter(c=>c.statut!=="refuse").reduce((s,c)=>s+c.jours,0);
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Validés",v:conges.filter(c=>c.statut==="valide").length,c:"var(--ok)"},{l:"En attente",v:conges.filter(c=>c.statut==="attente").length,c:"var(--warn)"},{l:"Jours total",v:totalJ+"j",c:"var(--blue)"}].map((m,i)=>(
            <div key={i} className="card" style={{padding:"12px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:m.c}}>{m.v}</div><div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",marginTop:2}}>{m.l}</div></div>
          ))}
        </div>
        {(user.role==="admin"||user.role==="chef"||user.role==="employe")&&<button className="btn btn-blue btn-fw" onClick={()=>onSheet("conge")}>+ Demander un congé</button>}
        <div className="sec">Demandes</div>
        {conges.length===0&&<div className="empty"><p style={{fontSize:14,fontWeight:600}}>Aucune demande</p></div>}
        {conges.map((c,i)=>{
          const sf=sfM[c.statut]||{l:c.statut,t:"gray"};
          return (
            <div key={c.id} className="card u0" style={{padding:"14px 16px",borderLeft:"3px solid "+(c.statut==="valide"?"var(--ok)":c.statut==="attente"?"var(--warn)":"var(--err)"),animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{c.nom}</div><div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>{tM[c.type]||c.type} · {c.jours} jour{c.jours>1?"s":""}</div><div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>Du {c.debut} au {c.fin}</div>{c.motif&&<div style={{fontSize:11,color:"var(--t4)",marginTop:1}}>{c.motif}</div>}</div>
                <Tag label={sf.l} type={sf.t}/>
              </div>
              {c.statut==="attente"&&(user.role==="admin"||user.role==="chef")&&(
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button className="btn btn-ok btn-sm" style={{flex:1}} onClick={()=>onValider(c.id,"valide")}>Valider</button>
                  <button className="btn btn-err btn-sm" style={{flex:1}} onClick={()=>onValider(c.id,"refuse")}>Refuser</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaScreen({ user, perms, agenda, chantiers, equipe, onSheet, onDel }) {
  if(!perms.equipe) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p></div>;
  const today=new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"}).replace(/\//g,"/");
  const tIco={visite:"👤",reunion:"📅",livraison:"📦",prospect:"💼",securite:"⛑️",autre:"📌"};
  const tCol={visite:"var(--blue)",reunion:"var(--ok)",livraison:"var(--warn)",prospect:"#7C3AED",securite:"var(--err)",autre:"var(--t3)"};
  const sorted=[...agenda].sort((a,b)=>(a.date+a.heure).localeCompare(b.date+b.heure));
  const groupes={};
  sorted.forEach(e=>{if(!groupes[e.date])groupes[e.date]=[];groupes[e.date].push(e);});
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        <button className="btn btn-blue btn-fw" onClick={()=>onSheet("agenda")}>+ Nouvel événement</button>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {Object.keys(groupes).length===0&&<div className="empty"><p style={{fontSize:14,fontWeight:600}}>Aucun événement</p></div>}
        {Object.entries(groupes).map(([date,evts])=>{
          const isToday=date===today;
          return (
            <div key={date}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700,color:isToday?"var(--blue)":"var(--t3)",textTransform:"uppercase",letterSpacing:".06em"}}>{date}</div>
                {isToday&&<Tag label="Aujourd'hui" type="blue"/>}
              </div>
              {evts.map((e,i)=>{
                const ch=e.chId?chantiers.find(c=>c.id===parseInt(e.chId)):null;
                const col=tCol[e.type]||"var(--t3)";
                return (
                  <div key={e.id} className="card u0" style={{padding:"14px 16px",marginBottom:8,borderLeft:"3px solid "+col,animationDelay:i*.04+"s"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:4}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                        <span style={{fontSize:18}}>{tIco[e.type]||"📌"}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{e.titre}</div>
                          <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{e.heure} · {e.duree}min</div>
                        </div>
                      </div>
                      {onDel&&<button onClick={()=>onDel(e.id)} style={{background:"none",border:"none",color:"var(--t4)",cursor:"pointer",fontSize:18,padding:"0 2px",flexShrink:0}} title="Supprimer">×</button>}
                    </div>
                    {e.lieu&&<div style={{fontSize:12,color:"var(--t4)",marginTop:4}}>📍 {e.lieu}</div>}
                    {ch&&<div style={{fontSize:11,color:"var(--blue)",marginTop:3}}>🏗 {ch.nom}</div>}
                    {e.pour&&<div style={{fontSize:11,color:"var(--ok)",marginTop:3}}>👤 {e.pour}</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FFournisseur({ fourn, onClose, onSave }) {
  const cats=[{v:"materiaux",l:"Matériaux"},{v:"plomberie",l:"Plomberie"},{v:"electricite",l:"Électricité"},{v:"location",l:"Location"},{v:"enduits",l:"Enduits"},{v:"bois",l:"Bois"},{v:"autre",l:"Autre"}];
  const [f,setF]=useState(fourn?{...fourn}:{nom:"",tel:"",cat:"materiaux",url:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const ok=f.nom.trim()&&f.tel.trim();
  return (
    <Sheet title={fourn?"Modifier le fournisseur":"Ajouter un fournisseur"} onClose={onClose}
      footer={<><button className="btn btn-blue btn-fw" disabled={!ok} onClick={()=>{onSave(f);onClose();}}>Enregistrer</button><button className="btn btn-out btn-fw" onClick={onClose}>Annuler</button></>}>
      <Fld label="Nom du fournisseur"><input className="inp" placeholder="Point P, Cedeo..." value={f.nom} onChange={e=>s("nom",e.target.value)}/></Fld>
      <Fld label="Téléphone (appel direct)"><input className="inp" type="tel" placeholder="3616 ou 01 xx xx xx xx" value={f.tel} onChange={e=>s("tel",e.target.value)}/></Fld>
      <Fld label="Catégorie"><select className="inp" value={f.cat} onChange={e=>s("cat",e.target.value)}>{cats.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}</select></Fld>
      <Fld label="Site web (optionnel)"><input className="inp" type="url" placeholder="https://..." value={f.url||""} onChange={e=>s("url",e.target.value)}/></Fld>
    </Sheet>
  );
}

function FournisseursScreen({ user, perms, fournisseurs, commandes, onAdd, onEdit, onDel }) {
  if(!perms.equipe) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p></div>;
  const [selCat,setSelCat]=useState("tous");
  const [q,setQ]=useState("");
  const [editF,setEditF]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const catLabel={materiaux:"Matériaux",plomberie:"Plomberie",electricite:"Électricité",location:"Location",enduits:"Enduits",bois:"Bois",autre:"Autre"};
  const catIco={materiaux:"🧱",plomberie:"🔵",electricite:"⚡",location:"🏗",enduits:"🪣",bois:"🪵",autre:"📦"};
  const cats=["tous",...[...new Set(fournisseurs.map(f=>f.cat))]];
  const vis=fournisseurs
    .filter(f=>selCat==="tous"||f.cat===selCat)
    .filter(f=>!q||f.nom.toLowerCase().includes(q.toLowerCase()));
  const nbCmds=f=>commandes.filter(c=>c.fournisseur===f.nom).length;

  if(showAdd||editF) return <FFournisseur fourn={editF} onClose={()=>{setShowAdd(false);setEditF(null);}} onSave={f=>editF?onEdit(editF.id,f):onAdd(f)}/>;

  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      {/* En-tête + recherche */}
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)",position:"sticky",top:0,zIndex:10}}>
        <input className="inp" style={{height:38,fontSize:13,marginBottom:8}} placeholder="Rechercher un fournisseur..." value={q} onChange={e=>setQ(e.target.value)}/>
        <div className="sx">
          {cats.map(c=>(
            <button key={c} onClick={()=>setSelCat(c)} style={{padding:"7px 14px",borderRadius:"var(--r)",border:"1.5px solid "+(selCat===c?"var(--blue)":"var(--g2)"),background:selCat===c?"var(--blue-l)":"var(--w)",color:selCat===c?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
              {c==="tous"?"Tous":catLabel[c]||c}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {user.role==="admin"&&<button className="btn btn-blue btn-fw" onClick={()=>setShowAdd(true)}>+ Ajouter un fournisseur</button>}
        {vis.length===0&&<div className="empty"><div style={{fontSize:48}}>📦</div><p style={{fontSize:14,fontWeight:600}}>Aucun fournisseur</p></div>}
        {vis.map((f,i)=>{
          const nc=nbCmds(f);
          return (
            <div key={f.id} className="card u0" style={{padding:"16px",animationDelay:i*.04+"s"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:44,height:44,borderRadius:"var(--r2)",background:"var(--blue-l)",border:"1px solid var(--blue-b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                  {catIco[f.cat]||"📦"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:15,fontWeight:700,color:"var(--t1)"}}>{f.nom}</span>
                    <span style={{padding:"2px 8px",background:"var(--g1)",border:"1px solid var(--g2)",borderRadius:99,fontSize:10,fontWeight:600,color:"var(--t3)"}}>{catLabel[f.cat]||f.cat}</span>
                  </div>
                  {nc>0&&<div style={{fontSize:12,color:"var(--t3)",marginBottom:6}}>📦 {nc} commande{nc>1?"s":""} passée{nc>1?"s":""}</div>}
                  {f.url&&<a href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--blue)",textDecoration:"none"}}>🌐 Site web →</a>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <a href={"tel:"+f.tel.replace(/\s/g,"")} style={{flex:1,textDecoration:"none"}}>
                  <button className="btn btn-blue btn-sm btn-fw" style={{width:"100%"}}>📞 {f.tel}</button>
                </a>
                {user.role==="admin"&&<>
                  <button className="btn btn-out btn-sm" onClick={()=>setEditF(f)}>Modifier</button>
                  <button className="btn btn-out btn-sm" style={{borderColor:"var(--err-b)",color:"var(--err)"}} onClick={()=>onDel(f.id)}>Suppr.</button>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClientsScreen({ user, perms, clients, onSheet }) {
  if(!perms.montants) return <div className="empty" style={{paddingTop:80}}><p style={{fontSize:14,fontWeight:600}}>Accès restreint</p></div>;
  const [q,setQ]=useState("");
  const [f,setF]=useState("tous");
  const visible=clients.filter(c=>(f==="tous"||c.statut===f)&&(c.nom+c.email+(c.note||"")).toLowerCase().includes(q.toLowerCase()));
  const sfM={client:{l:"Client",t:"ok"},prospect:{l:"Prospect",t:"blue"},termine:{l:"Terminé",t:"gray"},perdu:{l:"Perdu",t:"err"}};
  const totalCA=clients.filter(c=>c.statut==="client").reduce((s,c)=>s+c.ca,0);
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%"}}>
      <div style={{padding:"14px 20px",background:"var(--w)",borderBottom:"1px solid var(--g2)"}}>
        {onSheet&&<button className="btn btn-blue btn-fw" style={{marginBottom:10}} onClick={()=>onSheet("client")}>+ Nouveau contact</button>}
        <input className="inp" placeholder="Rechercher un client ou prospect..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:10}}/>
        <div className="sx">{[["tous","Tous"],["client","Clients"],["prospect","Prospects"],["termine","Terminés"],["perdu","Perdus"]].map(([v,l])=><button key={v} onClick={()=>setF(v)} style={{padding:"7px 14px",borderRadius:"var(--r)",border:"1.5px solid "+(f===v?"var(--blue)":"var(--g2)"),background:f===v?"var(--blue-l)":"var(--w)",color:f===v?"var(--blue)":"var(--t3)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>{l}</button>)}</div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:4}}>
          {[{l:"Clients",v:clients.filter(c=>c.statut==="client").length,c:"var(--ok)"},{l:"Prospects",v:clients.filter(c=>c.statut==="prospect").length,c:"var(--blue)"},{l:"CA total",v:EUR(totalCA),c:"var(--t1)"}].map((m,i)=>(
            <div key={i} className="card" style={{padding:"10px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:m.c,marginBottom:2}}>{m.v}</div><div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase"}}>{m.l}</div></div>
          ))}
        </div>
        {visible.length===0&&<div className="empty"><p style={{fontSize:14,fontWeight:600}}>Aucun résultat</p></div>}
        {visible.map((c,i)=>{
          const sf=sfM[c.statut]||{l:c.statut,t:"gray"};
          return (
            <div key={c.id} className="card u0" style={{padding:"14px 16px",animationDelay:i*.04+"s"}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                  <Av nom={c.nom} color={sf.t==="ok"?"#059669":sf.t==="blue"?"#2563EB":"#94A3B8"} size={38}/>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{c.nom}</div>
                    <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{c.tel}{c.email?" · "+c.email:""}</div>
                  </div>
                </div>
                <Tag label={sf.l} type={sf.t}/>
              </div>
              {c.adresse&&<div style={{fontSize:11,color:"var(--t4)",marginBottom:4}}>📍 {c.adresse}</div>}
              <div className="row" style={{fontSize:12}}>
                <span style={{color:"var(--t4)"}}>{c.nbChantiers} chantier{c.nbChantiers>1?"s":""}</span>
                {c.ca>0&&<span style={{fontWeight:700,color:"var(--ok)"}}>{EUR(c.ca)}</span>}
              </div>
              {c.note&&<div style={{fontSize:11,color:"var(--t3)",marginTop:6,padding:"6px 10px",background:"var(--g1)",borderRadius:"var(--r)",border:"1px solid var(--g2)"}}>{c.note}</div>}
              <div style={{display:"flex",gap:8,marginTop:10}}>
                {c.tel&&<a href={"tel:"+c.tel} style={{flex:1,textDecoration:"none"}}><button className="btn btn-out btn-sm btn-fw">📞 Appeler</button></a>}
                {c.email&&<a href={"mailto:"+c.email} style={{flex:1,textDecoration:"none"}}><button className="btn btn-out btn-sm btn-fw">✉️ Email</button></a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IncidentActions({ inc, commandes, equipe, user, onNav, onSheet, onUpdInc, fournisseurs }) {
  const [open,setOpen]=useState(inc?.prio===1);
  const [timerStr,setTimerStr]=useState("");
  const annuaire=fournisseurs?.length?fournisseurs:D_FOURNISSEURS;

  useEffect(()=>{
    if(!inc||inc.statut==="traite") return;
    const tick=()=>{
      const openedAt=parseFrDate(inc.date)??inc.ts??Date.now();
      const minsOpen=Math.max(0,Math.round((Date.now()-openedAt)/60000));
      setTimerStr(minsOpen<60?minsOpen+"min":minsOpen<1440?Math.floor(minsOpen/60)+"h"+((minsOpen%60>0)?Math.round(minsOpen%60)+"min":""):Math.floor(minsOpen/1440)+"j");
    };
    tick();
    const id=setInterval(tick,60000);
    return()=>clearInterval(id);
  },[inc?.date,inc?.ts,inc?.statut]);

  if(!inc||inc.statut==="traite") return null;

  const relCmd=commandes&&inc.refCmd?commandes.find(c=>c.id===inc.refCmd):null;
  const relFournisseur=inc.fournisseurId?annuaire.find(f=>f.id===inc.fournisseurId):
    relCmd?annuaire.find(f=>f.nom.toLowerCase()===relCmd.fournisseur.toLowerCase()):null;
  const chefContact=equipe?equipe.find(m=>m.fn&&m.fn.toLowerCase().includes("chef")):null;
  const conducteur=equipe?equipe.find(m=>m.fn&&(m.fn.toLowerCase().includes("conducteur")||m.fn.toLowerCase().includes("gérant"))):null;

  const BtnCall=({label,tel,color,icon})=>(
    <a href={"tel:"+tel.replace(/\s/g,"")} style={{display:"flex",flex:1,flexDirection:"column",alignItems:"center",gap:5,padding:"12px 6px",borderRadius:"var(--r2)",background:color+"18",border:"1.5px solid "+color+"40",cursor:"pointer",textDecoration:"none",minWidth:0}}>
      <span style={{fontSize:22}}>{icon}</span>
      <span style={{fontSize:11,fontWeight:800,color:color,letterSpacing:"-.01em"}}>{tel}</span>
      <span style={{fontSize:9,color:"var(--t3)",textAlign:"center",lineHeight:1.3}}>{label}</span>
    </a>
  );

  // Contenu selon type
  const renderContent=()=>{
    if(inc.type==="securite") return (
      <div>
        <div style={{display:"flex",gap:8,padding:"10px 14px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:"var(--r2)",marginBottom:12,alignItems:"center"}}>
          <span style={{fontSize:22}}>🛑</span>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:"var(--err)"}}>Protocole sécurité</div>
            <div style={{fontSize:11,color:"var(--err)",opacity:.8}}>Sécuriser la zone · Éloigner le personnel · Appeler</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {URGENCES.slice(0,4).map(u=><BtnCall key={u.n} label={u.l} tel={u.n} color={u.c} icon={u.e}/>)}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {URGENCES.slice(4).map(u=><BtnCall key={u.n} label={u.l} tel={u.n} color={u.c} icon={u.e}/>)}
          {conducteur&&conducteur.tel&&<BtnCall label={conducteur.nom.split(" ")[0]} tel={conducteur.tel} color="var(--blue)" icon="📞"/>}
        </div>
        <button onClick={()=>onUpdInc&&onUpdInc(inc.id,{bloquant:!inc.bloquant})} style={{width:"100%",padding:"11px",borderRadius:"var(--r2)",border:"1.5px solid "+(inc.bloquant?"var(--err)":"var(--g2)"),background:inc.bloquant?"var(--err)":"var(--w)",color:inc.bloquant?"#fff":"var(--t2)",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"var(--f)",transition:"all .15s"}}>
          {inc.bloquant?"🔴 CHANTIER ARRÊTÉ — Reprendre":"⛔ Arrêter le chantier"}
        </button>
      </div>
    );

    if(inc.type==="retard") return (
      <div>
        <div style={{marginBottom:10,padding:"8px 12px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:"var(--r2)",fontSize:12,color:"var(--warn)",fontWeight:600}}>
          📦 Livraison bloquée — chaque heure de retard coûte de l'argent
        </div>
        {relFournisseur&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"var(--t4)",textTransform:"uppercase",fontWeight:700,letterSpacing:".06em",marginBottom:6}}>Contacter le fournisseur</div>
            <div style={{display:"flex",gap:8}}>
              <BtnCall label={relFournisseur.nom} tel={relFournisseur.tel} color="var(--blue)" icon="📞"/>
              {relCmd&&<div style={{flex:1,padding:"12px",background:"var(--g1)",border:"1px solid var(--g2)",borderRadius:"var(--r2)"}}>
                <div style={{fontSize:10,color:"var(--t4)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>Commande liée</div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{relCmd.ref}</div>
                <div style={{fontSize:11,color:"var(--t3)"}}>{relCmd.objet}</div>
                <div style={{fontSize:11,color:"var(--warn)",fontWeight:600}}>Prévue {relCmd.livraison||"—"}</div>
              </div>}
            </div>
          </div>
        )}
        {!relFournisseur&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"var(--t4)",textTransform:"uppercase",fontWeight:700,letterSpacing:".06em",marginBottom:6}}>Fournisseurs matériaux</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {annuaire.filter(f=>f.cat==="materiaux").map(f=><BtnCall key={f.id} label={f.nom} tel={f.tel} color="var(--blue)" icon="📞"/>)}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          {onNav&&<button className="btn btn-out btn-sm" style={{flex:1}} onClick={()=>onNav("commandes")}>Voir les commandes →</button>}
          {onSheet&&user&&(user.role==="admin"||user.role==="chef")&&<button className="btn btn-blue btn-sm" style={{flex:1}} onClick={()=>onSheet("commande")}>Commander une alternative</button>}
        </div>
      </div>
    );

    if(inc.type==="materiel") return (
      <div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"var(--t4)",textTransform:"uppercase",fontWeight:700,letterSpacing:".06em",marginBottom:6}}>Location de remplacement</div>
          <div style={{display:"flex",gap:8}}>
            {annuaire.filter(f=>f.cat==="location").map(f=><BtnCall key={f.id} label={f.nom} tel={f.tel} color="var(--ok)" icon="🏗"/>)}
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"var(--t4)",textTransform:"uppercase",fontWeight:700,letterSpacing:".06em",marginBottom:6}}>SAV matériel & fabricants</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <BtnCall label="SAV Husqvarna" tel="0800 918 900" color="var(--warn)" icon="🔧"/>
            <BtnCall label="SAV Hilti" tel="0800 888 081" color="var(--warn)" icon="🔧"/>
            <BtnCall label="SAV Makita" tel="01 60 93 84 11" color="var(--warn)" icon="🔧"/>
          </div>
        </div>
        <button onClick={()=>onUpdInc&&onUpdInc(inc.id,{bloquant:!inc.bloquant})} style={{width:"100%",padding:"11px",borderRadius:"var(--r2)",border:"1.5px solid "+(inc.bloquant?"var(--err)":"var(--g2)"),background:inc.bloquant?"var(--err)":"var(--w)",color:inc.bloquant?"#fff":"var(--t2)",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--f)"}}>
          {inc.bloquant?"🔴 Chantier arrêté — Reprendre":"⛔ Marquer chantier arrêté"}
        </button>
      </div>
    );

    if(inc.type==="manque") return (
      <div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"var(--t4)",textTransform:"uppercase",fontWeight:700,letterSpacing:".06em",marginBottom:6}}>Commander immédiatement</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {annuaire.filter(f=>["materiaux","plomberie","electricite"].includes(f.cat)).map(f=><BtnCall key={f.id} label={f.nom} tel={f.tel} color="var(--blue)" icon="📞"/>)}
          </div>
        </div>
        {onSheet&&<button className="btn btn-blue btn-sm btn-fw" onClick={()=>onSheet("commande")}>+ Créer une commande urgente</button>}
      </div>
    );

    // Autre
    return (
      <div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {chefContact&&chefContact.tel&&<BtnCall label={chefContact.nom.split(" ")[0]} tel={chefContact.tel} color="var(--blue)" icon="👷"/>}
          {conducteur&&conducteur.tel&&conducteur.id!==chefContact?.id&&<BtnCall label={conducteur.nom.split(" ")[0]} tel={conducteur.tel} color="var(--ink)" icon="📞"/>}
          <BtnCall label="Urgences" tel="112" color="var(--err)" icon="🆘"/>
        </div>
      </div>
    );
  };

  return (
    <div style={{marginTop:10,borderTop:"1px solid var(--g2)",paddingTop:10}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:open?10:0,cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,fontWeight:700,color:"var(--blue)"}}>Actions de résolution</span>
          {timerStr&&<span style={{padding:"2px 8px",background:"var(--warn-l)",border:"1px solid var(--warn-b)",borderRadius:99,fontSize:10,color:"var(--warn)",fontWeight:700}}>Ouvert depuis {timerStr}</span>}
          {inc.bloquant&&<span style={{padding:"2px 8px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:99,fontSize:10,color:"var(--err)",fontWeight:800}}>⛔ CHANTIER ARRÊTÉ</span>}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" style={{transform:open?"rotate(90deg)":"none",transition:"transform .2s"}}><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      {open&&renderContent()}
    </div>
  );
}

function IncidentBanner({ incidents, chantiers, screen, chId, user, onEdit, onCancel, onTreat, onUpdInc, commandes, equipe, fournisseurs, onNav, onSheet, perms }) {
  // Incidents ouverts pertinents pour cet écran/contexte
  const typeLabels={securite:"Sécurité",materiel:"Matériel cassé",retard:"Retard livraison",manque:"Manque matériel",autre:"Autre"};
  const typeIcos={securite:"⚠️",materiel:"🔧",retard:"📦",manque:"📋",autre:"💬"};
  let vis=incidents.filter(i=>i.statut==="ouvert");
  // filtre par rôle
  if(user&&user.role!=="admin") vis=vis.filter(i=>chIdsOf(user).includes(i.chId));
  // filtre par écran de signalement (l'incident apparaît là où il a été créé)
  if(screen) vis=vis.filter(i=>(i.screen||"home")===screen);
  // filtre par contexte chantier si fourni
  if(chId) vis=vis.filter(i=>i.chId===chId);
  // tri : danger d'abord, puis récents
  vis=vis.sort((a,b)=>(a.prio||3)-(b.prio||3)||(b.ts||0)-(a.ts||0));
  if(vis.length===0) return null;
  const prioColor=p=>p===1?"var(--err)":p===2?"var(--warn)":"var(--ok)";
  const prioLabel=p=>p===1?"Danger":p===2?"Urgent":"Normal";
  return (
    <div style={{padding:"12px 20px 0"}}>
      {vis.map(inc=>{
        const ch=chantiers.find(c=>c.id===inc.chId);
        const pc=prioColor(inc.prio);
        const canManage=user&&(user.role==="admin"||user.role==="chef"||inc.sig===user.nom);
        return (
          <div key={inc.id} className="card u0" style={{padding:"12px 14px",marginBottom:8,background:inc.prio===1?"var(--err-l)":"var(--w)",border:"1px solid "+(inc.prio===1?"var(--err-b)":"var(--g2)"),borderLeft:"3px solid "+pc}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{fontSize:18,flexShrink:0,marginTop:1}}>{typeIcos[inc.type]||"⚠️"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{typeLabels[inc.type]||"Incident"}</span>
                  <span style={{padding:"1px 7px",borderRadius:99,fontSize:9,fontWeight:800,color:"#fff",background:pc}}>{prioLabel(inc.prio)}</span>
                  <span style={{fontSize:10,color:"var(--t4)"}}>{inc.ref}</span>
                </div>
                <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.5}}>{inc.desc}</div>
                <div style={{fontSize:10,color:"var(--t4)",marginTop:3}}>{ch?.nom?.split(" ").slice(0,3).join(" ")||"—"} · signalé par {inc.sig||"?"} · {inc.date}</div>
                {canManage&&(
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    {onTreat&&<button className="btn btn-ok btn-xs" onClick={()=>onTreat(inc.id)}>✓ Traité</button>}
                    {onEdit&&<button className="btn btn-out btn-xs" onClick={()=>onEdit(inc)}>Modifier</button>}
                    {onCancel&&<button className="btn btn-out btn-xs" style={{borderColor:"var(--err-b)",color:"var(--err)"}} onClick={()=>onCancel(inc)}>Annuler</button>}
                  </div>
                )}
                <IncidentActions inc={inc} commandes={commandes} equipe={equipe} user={user} onNav={onNav} onSheet={onSheet} onUpdInc={onUpdInc} fournisseurs={fournisseurs}/>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UpsellScreen({ feat, onBack }) {
  const label=FEAT_LABELS[feat]||"Cette fonctionnalité";
  return (
    <div style={{paddingBottom:100,overflowY:"auto",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{padding:"40px 24px",textAlign:"center",maxWidth:360}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"var(--blue-l)",border:"1.5px solid var(--blue-b)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <div style={{fontSize:20,fontWeight:800,color:"var(--t1)",marginBottom:8,letterSpacing:"-.02em"}}>{label}</div>
        <div style={{fontSize:14,color:"var(--t3)",lineHeight:1.6,marginBottom:24}}>Cette fonctionnalité est disponible avec le plan <strong style={{color:"var(--blue)"}}>Pro</strong>. Passez à Pro pour débloquer le CRM, les avenants, la trésorerie prévisionnelle, le planning d'équipe et bien plus.</div>
        <div style={{background:"var(--blue-l)",border:"1px solid var(--blue-b)",borderRadius:"var(--r2)",padding:"16px",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:4,marginBottom:4}}>
            <span style={{fontSize:28,fontWeight:800,color:"var(--t1)",letterSpacing:"-.03em"}}>149€</span>
            <span style={{fontSize:13,color:"var(--t3)"}}>/mois HT</span>
          </div>
          <div style={{fontSize:12,color:"var(--t3)"}}>Chantiers illimités · 20 utilisateurs · Support 7j/7</div>
        </div>
        <button className="btn btn-blue btn-fw" onClick={onBack} style={{marginBottom:10}}>Passer au plan Pro</button>
        <button className="btn btn-out btn-fw" onClick={onBack}>Retour</button>
        <div style={{fontSize:11,color:"var(--t4)",marginTop:16}}>Démo — changez de plan dans Plus → Mon abonnement</div>
      </div>
    </div>
  );
}

function AppMobile({ user, onLogout, themeId, setThemeId }) {
  const role=ROLES[user.role];
  const perms=PERMS[user.role];
  const isLocal=!!user.isLocal||!user.isSupabase;
  const empty=!!user.vierge;
  const demo=d=>empty?[]:d;
  const defaults=useMemo(()=>({
    chantiers:demo(D_CH), taches:demo(D_TACHES), heures:demo(D_HEURES), commandes:demo(D_COMMANDES),
    devis:demo(D_DEVIS), incidents:demo(D_INCIDENTS), factures:demo(D_FAC), clients:demo(D_CLIENTS),
    equipe:demo(D_EQ), rapports:demo(D_RAPPORTS), messages:demo(D_MSG), avenants:demo(D_AV),
    punch:demo(D_PUNCH), situations:demo(D_SIT), planningEq:demo(D_PLANNING_EQ), conges:demo(D_CONGES),
    agenda:demo(D_AGENDA), notes:demo(D_NOTES), fournisseurs:demo(D_FOURNISSEURS),
  }),[empty]);
  const cloudPrimary=user.isSupabase&&isSupabaseConfigured;
  const hydrated=useMemo(()=>{
    if(cloudPrimary) return {...defaults,_persisted:false,_cloudPrimary:true};
    return loadAppState(user,defaults);
  },[user.id,user.email,user.vierge,cloudPrimary,defaults]);
  const [screen,setScreen]=useState("home");
  const [sheet,setSheet]=useState(null);
  const [printDoc,setPrintDoc]=useState(null);
  const [sbReady,setSbReady]=useState(isLocal||hydrated._persisted);
  const [sbErr,setSbErr]=useState(null);
  const [savedAt,setSavedAt]=useState(hydrated._savedAt||null);
  const [chantiers,setChantiers]=useState(hydrated.chantiers);
  const [taches,setTaches]=useState(hydrated.taches);
  const [heures,setHeures]=useState(hydrated.heures);
  const [commandes,setCommandes]=useState(hydrated.commandes);
  const [devis,setDevis]=useState(hydrated.devis);
  const [incidents,setIncidents]=useState(hydrated.incidents);
  const [factures,setFactures]=useState(hydrated.factures);
  const [clients,setClients]=useState(hydrated.clients);
  const [equipe,setEquipe]=useState(hydrated.equipe);
  const [rapports,setRapports]=useState(hydrated.rapports);
  const [messages,setMessages]=useState(hydrated.messages);
  const [avenants,setAvenants]=useState(hydrated.avenants);
  const [punch,setPunch]=useState(hydrated.punch);
  const [situations,setSituations]=useState(hydrated.situations);
  const [planningEq,setPlanningEq]=useState(hydrated.planningEq);
  const [conges,setConges]=useState(hydrated.conges);
  const [agenda,setAgenda]=useState(hydrated.agenda);
  const [notes,setNotes]=useState(hydrated.notes);
  const [fournisseurs,setFournisseurs]=useState(hydrated.fournisseurs);
  const [planId,setPlanIdRaw]=useState(()=>(user.isSupabase?user.planId:null)||localStorage.getItem("be_plan")||user.planId||"pro");
  const setPlanId=id=>{if(!user.isSupabase)localStorage.setItem("be_plan",id);setPlanIdRaw(id);};

  useEffect(()=>{
    if(isLocal||(hydrated._persisted&&!hydrated._cloudPrimary)) return;
    let cancelled=false;
    (async()=>{
      try{
        if(user.vierge){
          setChantiers([]);setTaches([]);setHeures([]);setCommandes([]);setDevis([]);
          setIncidents([]);setFactures([]);setClients([]);setEquipe([]);setRapports([]);
          setMessages([]);setAvenants([]);setPunch([]);setSituations([]);setPlanningEq([]);
          setConges([]);setAgenda([]);setNotes([]);setFournisseurs([]);
        }else{
          const data=await loadAppDataForUi();
          if(cancelled)return;
          setChantiers(data.chantiers);setTaches(data.taches);setHeures(data.heures);
          setCommandes(data.commandes);setDevis(data.devis);setIncidents(data.incidents);
          setFactures(data.factures);setClients(data.clients);setEquipe(data.equipe);
          setRapports(data.rapports);setMessages(data.messages);setAvenants(data.avenants);
          setPunch(data.punch);setSituations(data.situations);setPlanningEq(data.planningEq);
          setConges(data.conges);setAgenda(data.agenda);setNotes(data.notes);
          setFournisseurs(data.fournisseurs.length?data.fournisseurs:hydrated.fournisseurs);
        }
        if(user.planId)setPlanIdRaw(user.planId);
        if(!cancelled)setSbReady(true);
      }catch(e){
        if(!cancelled){
          const fallback=loadAppState(user,defaults);
          if(fallback._persisted){
            setChantiers(fallback.chantiers);setTaches(fallback.taches);setHeures(fallback.heures);
            setCommandes(fallback.commandes);setDevis(fallback.devis);setIncidents(fallback.incidents);
            setFactures(fallback.factures);setClients(fallback.clients);setEquipe(fallback.equipe);
            setRapports(fallback.rapports);setMessages(fallback.messages);setAvenants(fallback.avenants);
            setPunch(fallback.punch);setSituations(fallback.situations);setPlanningEq(fallback.planningEq);
            setConges(fallback.conges);setAgenda(fallback.agenda);setNotes(fallback.notes);
            setFournisseurs(fallback.fournisseurs);
          }
          setSbReady(true);
        }
      }
    })();
    return()=>{cancelled=true;};
  },[user.id,isLocal,user.vierge,hydrated._persisted,hydrated._cloudPrimary,defaults]);

  useEffect(()=>{
    if(!sbReady)return;
    const t=setTimeout(()=>{
      saveAppState(user,{chantiers,taches,heures,commandes,devis,incidents,factures,clients,equipe,rapports,messages,avenants,punch,situations,planningEq,conges,agenda,notes,fournisseurs});
      setSavedAt(Date.now());
    },500);
    return()=>clearTimeout(t);
  },[sbReady,user,chantiers,taches,heures,commandes,devis,incidents,factures,clients,equipe,rapports,messages,avenants,punch,situations,planningEq,conges,agenda,notes,fournisseurs]);

  const resetDemo=useCallback(()=>{
    if(!window.confirm("Réinitialiser toutes les données de ce compte ?"))return;
    clearAppState(user);
    window.location.reload();
  },[user]);

  const [incCtx,setIncCtx]=useState(null);
  const [editInc,setEditInc]=useState(null);
  const [searchQ,setSearchQ]=useState("");
  const [showSearch,setShowSearch]=useState(false);
  const [showSOS,setShowSOS]=useState(false);
  const [ctxChId,setCtxChId]=useState(null);
  const [sheetOpts,setSheetOpts]=useState(null);
  const [toast,setToast]=useState("");
  const [online,setOnline]=useState(()=>typeof navigator!=="undefined"?navigator.onLine:true);
  const notify=useCallback(msg=>{setToast(msg);setTimeout(()=>setToast(""),2200);},[]);
  const rememberCh=useCallback(chId=>{if(chId)saveLastChId(user,chId);},[user]);
  const resolveDefaultChId=useCallback(()=>String(sheetOpts?.defaultChId||ctxChId||loadLastChId(user)||""),[sheetOpts,ctxChId,user]);
  const navTo=useCallback((scr,chId)=>{if(chId)setCtxChId(chId);setScreen(scr);},[]);
  const openSheet=useCallback((name,opts)=>{setSheetOpts(opts||null);setSheet(name);},[]);
  const closeSheet=useCallback(()=>{setSheet(null);setSheetOpts(null);setEditInc(null);setIncCtx(null);},[]);

  useEffect(()=>{
    const on=()=>setOnline(true);
    const off=()=>setOnline(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);
  const plan=PLANS[planId]||PLANS.pro;
  const hasFeat=f=>plan.feats.includes(f);
  const data={chantiers,taches,factures,equipe,rapports,messages,avenants,heures,punch,incidents,situations,devis,commandes,planningEq,conges,agenda,clients,notes,fournisseurs,plan,planId,setPlanId,hasFeat};

  const addR=f=>{
    if(f.chId)rememberCh(parseInt(f.chId));
    const row={id:Date.now(),chId:parseInt(f.chId)||0,date:f.date||"",auteur:f.auteur||"",meteo:f.meteo||"",av:f.av||"",incidents:f.incidents||"RAS",presences:f.presences||[]};
    setRapports(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertRapport(row,user).catch(()=>{});
  };
  const sendMsg=m=>{
    const row={id:Date.now(),chId:parseInt(m.chId),auteur:m.auteur,role:m.role,txt:m.txt,h:m.h,d:m.d};
    setMessages(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertMessage(row,user).then(created=>setMessages(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const addAv=f=>{
    const row={id:Date.now(),...f,ref:f.ref||"AV-"+String(Date.now()).slice(-3),statut:"attente",dc:f.dc||new Date().toLocaleDateString("fr-FR"),ds:"",par:""};
    setAvenants(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertAvenant(row,user).then(created=>setAvenants(p=>p.map(a=>a.id===row.id?{...a,...created}:a))).catch(()=>{});
  };
  const valAv=(id,s,par)=>{
    setAvenants(p=>p.map(a=>a.id===id?{...a,statut:s,par,ds:new Date().toLocaleDateString("fr-FR")}:a));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateAvenant(id,s,par).catch(()=>{});
  };
  const addP=f=>{
    const row={id:Date.now(),...f,ref:f.ref||"RES-"+String(Date.now()).slice(-3),statut:f.statut||"ouvert",date:f.date||new Date().toLocaleDateString("fr-FR"),clos:""};
    setPunch(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertPunch(row,user).then(created=>setPunch(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const updP=(id,s)=>{
    setPunch(p=>p.map(i=>i.id===id?{...i,statut:s,clos:s==="clos"?new Date().toLocaleDateString("fr-FR"):""}:i));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdatePunch(id,s).catch(()=>{});
  };
  const onAddNote=n=>{
    const row={id:Date.now(),chId:parseInt(n.chId),auteur:n.auteur,txt:n.txt,ts:Date.now(),date:new Date().toLocaleDateString("fr-FR")};
    setNotes(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertNote(row,user).then(created=>setNotes(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onDelNote=id=>{
    setNotes(p=>p.filter(n=>n.id!==id));
    if(cloud.shouldCloudSync(user)) cloud.cloudDeleteNote(id).catch(()=>{});
  };
  const onSaveSituation=f=>{
    const row={id:Date.now(),chId:parseInt(f.chId),ref:f.ref||"SIT-"+String(Date.now()).slice(-3),num:f.num||1,titre:f.titre||"",av:parseInt(f.av)||0,mt:parseInt(f.mt)||0,statut:f.statut||"emise",date:f.date||"",ech:f.ech||"",desc:f.desc||""};
    setSituations(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertSituation(row,user).then(created=>setSituations(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onChangeSituationStatut=(id,s)=>{
    setSituations(p=>p.map(x=>x.id===id?{...x,statut:s}:x));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateSituationStatut(id,s).catch(()=>{});
  };
  const onEditPlanning=(memId,ji,chId)=>{
    setPlanningEq(p=>{
      const next=p.map(m=>m.id!==memId?m:{...m,sem:m.sem.map((d,i)=>i===ji?{...d,chId}:d)});
      if(cloud.shouldCloudSync(user)){
        const m=next.find(x=>x.id===memId);
        if(m) cloud.cloudUpdatePlanningEq(m,user).catch(()=>{});
      }
      return next;
    });
  };
  const onValiderConge=(id,statut)=>{
    setConges(p=>p.map(c=>c.id===id?{...c,statut}:c));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateConge(id,statut).catch(()=>{});
  };
  const onAddConge=f=>{
    const row={id:Date.now(),...f,statut:"attente",jours:Math.max(1,f.jours||1)};
    setConges(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertConge(row,user).then(created=>setConges(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onAddAgenda=f=>{
    const row={id:Date.now(),...f,chId:f.chId?parseInt(f.chId):null};
    setAgenda(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertAgenda(row,user).then(created=>setAgenda(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onDelAgenda=id=>{
    setAgenda(p=>p.filter(a=>a.id!==id));
    if(cloud.shouldCloudSync(user)) cloud.cloudDeleteAgenda(id).catch(()=>{});
  };
  const onAddFournisseur=f=>{
    const row={id:Date.now(),...f};
    setFournisseurs(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertFournisseur(row,user).then(created=>setFournisseurs(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onEditFournisseur=(id,f)=>{
    setFournisseurs(p=>p.map(x=>x.id===id?{...x,...f}:x));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateFournisseur(id,f).catch(()=>{});
  };
  const onDelFournisseur=id=>{
    setFournisseurs(p=>p.filter(x=>x.id!==id));
    if(cloud.shouldCloudSync(user)) cloud.cloudDeleteFournisseur(id).catch(()=>{});
  };
  const onUpdEq=(id,statut)=>{
    setEquipe(p=>p.map(m=>m.id===id?{...m,statut}:m));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateEquipeStatut(id,statut).catch(()=>{});
  };

  const editT=(id,k,v)=>{
    setTaches(p=>p.map(t=>t.id===id?{...t,[k]:v}:t));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateTache(id,k,v).catch(()=>{});
  };
  const addT=f=>{
    const row={id:Date.now(),chId:parseInt(f.chId),titre:f.titre,resp:f.resp||"",debut:f.debut||"",fin:f.fin||"",statut:f.statut||"planif",prio:parseInt(f.prio)||2,duree:Math.max(1,f.duree||1)};
    setTaches(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertTache(row,user).then(created=>setTaches(p=>p.map(t=>t.id===row.id?{...t,...created}:t))).catch(()=>{});
  };
  const valH=id=>{
    setHeures(p=>p.map(h=>h.id===id?{...h,val:true}:h));
    if(cloud.shouldCloudSync(user)) cloud.cloudValidateHeure(id,user.nom).catch(()=>{});
  };
  const onAddHeure=h=>{
    const chId=parseInt(h.chId);
    const dup=heures.some(x=>x.nom===h.nom&&x.date===h.date&&x.chId===chId);
    if(dup&&!window.confirm("Une saisie existe déjà pour ce jour et ce chantier. Enregistrer quand même ?"))return;
    rememberCh(chId);
    const row={...h,id:Date.now(),chId,val:false};
    setHeures(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertHeure(row,user).then(created=>setHeures(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onAddCmd=c=>{
    const row={id:Date.now(),...c,chId:parseInt(c.chId),mt:parseInt(c.mt)||0};
    setCommandes(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertCommande(row,user).then(created=>setCommandes(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onReceptionCmd=id=>{
    const livraison=new Date().toLocaleDateString("fr-FR");
    setCommandes(p=>p.map(c=>c.id===id?{...c,statut:"livree",livraison}:c));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateCommande(id,{statut:"livree",livraison}).catch(()=>{});
  };
  const onAddDevis=d=>{
    const row={id:Date.now(),...d,lots:d.lots||[]};
    setDevis(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertDevis(row,user).then(created=>setDevis(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onChangeDevisStatut=(id,s)=>{
    setDevis(p=>p.map(d=>d.id===id?{...d,statut:s}:d));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateDevisStatut(id,s).catch(()=>{});
  };
  const onEditDevis=(id,changes)=>{
    setDevis(p=>p.map(d=>d.id===id?{...d,...changes}:d));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateDevis(id,changes).catch(()=>{});
  };
  const addInc=f=>{
    const row={id:Date.now(),ts:Date.now(),...f,chId:parseInt(f.chId),desc:f.desc||""};
    setIncidents(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertIncident(row,user).then(created=>setIncidents(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const updInc=(id,changes)=>{
    const patch=typeof changes==="string"?{statut:changes}:changes;
    setIncidents(p=>p.map(i=>i.id===id?{...i,...patch}:i));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateIncident(id,patch).catch(()=>{});
  };
  const delInc=id=>{
    setIncidents(p=>p.filter(i=>i.id!==id));
    if(cloud.shouldCloudSync(user)) cloud.cloudDeleteIncident(id).catch(()=>{});
  };
  const onChangeFactureStatut=(id,s)=>{
    setFactures(p=>p.map(f=>f.id===id?{...f,statut:s}:f));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateFactureStatut(id,s).catch(()=>{});
  };
  const onAddFacture=f=>{
    const row={...f,id:f.id||"FAC-"+Date.now(),chId:parseInt(f.chId),mt:parseInt(f.mt)||0};
    setFactures(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertFacture(row,user).then(created=>setFactures(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const onAddClient=c=>{
    const row={id:Date.now(),...c,ca:parseInt(c.ca)||0,nbChantiers:parseInt(c.nbChantiers)||0};
    setClients(p=>[...p,row]);
    if(cloud.shouldCloudSync(user)) cloud.cloudInsertClient(row,user).then(created=>setClients(p=>p.map(x=>x.id===row.id?{...x,...created}:x))).catch(()=>{});
  };
  const addC=f=>{
    const lim=plan.maxChantiers;
    const actifs=chantiers.filter(c=>c.statut!=="livre").length;
    if(lim!==Infinity&&actifs>=lim){
      alert(`Limite atteinte : ${lim} chantier(s) actif(s) sur le plan ${plan.nom}. Passez au plan Pro.`);
      setScreen("plus");
      return;
    }
    const id=Date.now();
    const row={id,nom:f.nom||"",client:f.client||"",tel:f.tel||"",corps:f.corps||"",statut:"actif",av:0,budget:parseInt(f.budget)||0,dep:0,debut:f.debut||"",fin:f.fin||"",rdv:f.rdv||"",meteo:f.meteo||"—",prio:parseInt(f.prio)||2,note:f.note||"",adresse:f.adresse||"",taux:parseInt(f.taux)||35,equipe:[]};
    setChantiers(p=>[...p,row]);
    syncEquipeChantier(setEquipe,id,f.eqIds);
    if(cloud.shouldCloudSync(user)){
      cloud.cloudInsertChantier(f,user).then(created=>{
        setChantiers(p=>p.map(c=>c.id===id?{...c,...created}:c));
        if(f.eqIds) syncEquipeChantier(setEquipe,created.id,f.eqIds);
      }).catch(()=>{});
    }
  };
  const saveC=f=>{
    const {eqIds,...patch}=f;
    setChantiers(p=>p.map(c=>c.id===f.id?{...c,...patch}:c));
    if(eqIds) syncEquipeChantier(setEquipe,f.id,eqIds);
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateChantier(f.id,patch).catch(()=>{});
  };
  const onUpdCh=(id,k,v)=>{
    setChantiers(p=>p.map(c=>c.id===id?{...c,[k]:v}:c));
    if(cloud.shouldCloudSync(user)) cloud.cloudUpdateChantier(id,{[k]:v}).catch(()=>{});
  };
  const retards=perms.montants?filterByChAccess(user,factures).filter(f=>f.statut==="retard").length:0;
  const avAtt=filterByChAccess(user,avenants).filter(a=>a.statut==="attente").length;
  const punchOuv=filterByChAccess(user,punch).filter(p=>p.statut!=="clos").length;
  const incOuv=perms.incidents?filterByChAccess(user,incidents).filter(i=>i.statut==="ouvert").length:0;
  const tUrgent=filterByChAccess(user,taches).filter(t=>t.statut!=="fait"&&(t.prio===1||isRetard(t.fin))).length;
  const msgCount=filterByChAccess(user,messages).some(m=>m.role!==user.role)?1:0;
  const TABS=[
    {id:"home",    l:"Accueil",  ico:<IcoHome/>},
    perms.chantiers&&{id:"chantiers",l:"Chantiers",ico:<IcoBuild/>},
    perms.taches  &&{id:"taches",  l:"Tâches",   ico:<IcoTask/>,badge:tUrgent},
    perms.chat    &&{id:"chat",    l:"Messages",  ico:<IcoChat/>,badge:screen!=="chat"?msgCount:0},
    {id:"plus",    l:"Plus",     ico:<IcoMore/>,badge:avAtt+punchOuv+incOuv},
  ].filter(Boolean);
  const renderFAB=()=>{
    if(screen==="chat") return null;
    const act={chantiers:perms.creerCh?"chantier":null,taches:perms.creerT?"tache":null,home:perms.rapport?"rapport":null,devis:perms.montants?"devis":null,commandes:perms.creerCmd?"commande":null,conges:perms.equipe?"conge":null,agenda:"agenda",clients:"client",finances:perms.montants?"facture":null,heures:"heure",avenants:perms.creerAv?"avenant":null,punch:perms.gPunch?"punch":null}[screen];
    // Libellé contextuel de l'incident selon l'écran
    const incLabels={chantiers:"Incident chantier",taches:"Bloquer une tâche",heures:"Signaler un retard",punch:"Nouvelle réserve",commandes:"Problème livraison",planningEq:"Absence imprévue"};
    const incLabel=incLabels[screen]||"Incident";
    return (
      <div className="fab">
        {perms.incidents&&<>
          <button className="fab-r" onClick={()=>{setIncCtx({screen,chId:ctxChId||undefined});setEditInc(null);openSheet("incident");}} title={incLabel}>⚠</button>
          <div className="fab-lbl">{incLabel}</div>
        </>}
        {act&&<button className="fab-b" onClick={()=>openSheet(act,ctxChId?{defaultChId:ctxChId}:null)} title="Créer"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>}
      </div>
    );
  };
  const renderScreen=()=>{
    // Gating par abonnement : si l'écran demandé n'est pas inclus dans le plan, afficher l'upsell
    const SCREEN_FEAT={clients:"clients",avenants:"avenants",planningEq:"planningEq",conges:"conges"};
    const reqFeat=SCREEN_FEAT[screen];
    if(reqFeat&&!hasFeat(reqFeat)){
      return <UpsellScreen feat={reqFeat} onBack={()=>setScreen("plus")}/>;
    }
    switch(screen){
      case "home":       return <HomeScreen      user={user} perms={perms} data={data} onNav={navTo} onSheet={openSheet} onUpdCh={onUpdCh} onNotify={notify}/>;
      case "chantiers":  return <ChantiersScreen  user={user} perms={perms} chantiers={chantiers} taches={taches} equipe={equipe} heures={heures} commandes={commandes} notes={notes} onSave={saveC} onNav={navTo} onAddNote={onAddNote} onDelNote={onDelNote} onNotify={notify}/>;
      case "taches":     return <TachesScreen     user={user} perms={perms} taches={taches} chantiers={chantiers} equipe={equipe} onEditT={editT} onSheet={openSheet} initialChFilter={ctxChId}/>;
      case "finances":   return <FinancesScreen   user={user} perms={perms} factures={factures} chantiers={chantiers} heures={heures} equipe={equipe} commandes={commandes} onSheet={openSheet} onChangeStatut={onChangeFactureStatut} onPrint={setPrintDoc}/>;
      case "chat":       return <ChatScreen       user={user} perms={perms} messages={messages} chantiers={chantiers} onSend={sendMsg} onSheet={openSheet} initialChId={ctxChId}/>;
      case "avenants":   return <AvenantsScreen   user={user} perms={perms} avenants={avenants} chantiers={chantiers} onValider={valAv} onSheet={openSheet}/>;
      case "heures":     return <HeuresScreen     user={user} perms={perms} heures={heures} chantiers={chantiers} equipe={equipe} onValider={valH} onSheet={openSheet} onPrint={setPrintDoc}/>;
      case "punch":      return <PunchScreen      user={user} perms={perms} punch={punch} chantiers={chantiers} onUpdate={updP}/>;
      case "situations": return <SituationsScreen user={user} perms={perms} situations={situations} chantiers={chantiers} onSave={onSaveSituation} onChangeStatut={onChangeSituationStatut} onSheet={openSheet}/>;
      case "incidents":  return <IncidentsScreen  user={user} perms={perms} incidents={incidents} chantiers={chantiers} commandes={commandes} equipe={equipe} onUpdate={updInc} onEdit={inc=>{setEditInc(inc);setIncCtx(null);openSheet("incident");}} onCancel={inc=>delInc(inc.id)} onNav={navTo} onSheet={openSheet}/>;
      case "rapports":   return <RapportsScreen   user={user} rapports={rapports} chantiers={chantiers} onPrint={setPrintDoc}/>;
      case "devis":      return <DevisScreen      user={user} perms={perms} devis={devis} chantiers={chantiers} onAddDevis={onAddDevis} onConvertDevis={d=>{const st=d.lots.reduce((s,l)=>s+l.lignes.reduce((ss,li)=>ss+(li.qte||0)*(li.pu||0),0),0);addC({nom:d.objet,client:d.client,budget:st,prio:2});navTo("chantiers");}} onChangeStatut={onChangeDevisStatut} onEditDevis={onEditDevis} onPrint={setPrintDoc}/>;
      case "commandes":  return <CommandesScreen  user={user} perms={perms} commandes={commandes} chantiers={chantiers} fournisseurs={fournisseurs} onAddCmd={onAddCmd} onReception={onReceptionCmd} onSheet={openSheet}/>;
      case "planningEq": return <PlanningEqScreen user={user} perms={perms} planningEq={planningEq} chantiers={chantiers} equipe={equipe} heures={heures} onEdit={onEditPlanning} onValiderH={valH}/>;
      case "conges":     return <CongesScreen     user={user} perms={perms} conges={conges} onValider={onValiderConge} onSheet={openSheet}/>;
      case "agenda":     return <AgendaScreen     user={user} perms={perms} agenda={agenda} chantiers={chantiers} equipe={equipe} onSheet={openSheet} onDel={onDelAgenda}/>;
      case "clients":    return <ClientsScreen    user={user} perms={perms} clients={clients} onSheet={openSheet}/>;
      case "fournisseurs":return <FournisseursScreen user={user} perms={perms} fournisseurs={fournisseurs} commandes={commandes} onAdd={onAddFournisseur} onEdit={onEditFournisseur} onDel={onDelFournisseur}/>;
      case "plus":       return <PlusScreen       user={user} perms={perms} data={data} onNav={setScreen} onLogout={onLogout} onUpdEq={onUpdEq} themeId={themeId} setThemeId={setThemeId} onResetDemo={resetDemo}/>;
      default: return null;
    }
  };
  const searchResults=searchQ.trim().length>1?(()=>{
    const q=searchQ.toLowerCase();
    const r=[];
    const myCh=visibleChantiers(user,chantiers);
    myCh.filter(c=>(c.nom+c.client+c.adresse).toLowerCase().includes(q)).forEach(c=>r.push({type:"Chantier",label:c.nom,sub:c.client,nav:"chantiers",chId:c.id}));
    filterByChAccess(user,taches).filter(t=>(t.titre+t.resp).toLowerCase().includes(q)).forEach(t=>{const ch=chantiers.find(c=>c.id===t.chId);r.push({type:"Tâche",label:t.titre,sub:(ch?.nom||"")+" · "+t.resp,nav:"taches",chId:t.chId});});
    if(isAdmin(user)) equipe.filter(m=>(m.nom+m.fn+m.tel).toLowerCase().includes(q)).forEach(m=>r.push({type:"Équipe",label:m.nom,sub:m.fn+" · "+m.tel,nav:"plus"}));
    filterByChAccess(user,factures||[]).filter(f=>(f.id+f.client+(f.desc||"")).toLowerCase().includes(q)).forEach(f=>r.push({type:"Facture",label:f.id+" — "+EUR(f.mt),sub:f.client,nav:"finances",chId:f.chId}));
    filterByChAccess(user,devis||[]).filter(d=>(d.ref+d.client+d.objet).toLowerCase().includes(q)).forEach(d=>r.push({type:"Devis",label:d.ref+" — "+d.objet,sub:d.client,nav:"devis"}));
    filterByChAccess(user,punch||[]).filter(p=>(p.titre+p.ref+(p.desc||"")).toLowerCase().includes(q)).forEach(p=>{const ch=chantiers.find(c=>c.id===p.chId);r.push({type:"Réserve",label:p.titre,sub:(p.ref||"")+" · "+(ch?.nom||""),nav:"punch",chId:p.chId});});
    filterByChAccess(user,incidents||[]).filter(i=>(i.ref+i.desc).toLowerCase().includes(q)).forEach(i=>{const ch=chantiers.find(c=>c.id===i.chId);r.push({type:"Incident",label:i.ref,sub:i.desc.slice(0,40),nav:"incidents",chId:i.chId});});
    filterByChAccess(user,notes||[]).filter(n=>n.txt.toLowerCase().includes(q)).forEach(n=>{const ch=chantiers.find(c=>c.id===n.chId);r.push({type:"Note",label:n.txt.slice(0,50),sub:(ch?.nom||"")+" · "+n.auteur,nav:"chantiers",chId:n.chId});});
    filterByChAccess(user,commandes||[]).filter(c=>(c.ref+c.objet+c.fournisseur).toLowerCase().includes(q)).forEach(c=>{const ch=chantiers.find(x=>x.id===c.chId);r.push({type:"Commande",label:c.ref+" — "+c.objet,sub:c.fournisseur+" · "+(ch?.nom||""),nav:"commandes",chId:c.chId});});
    if(isAdmin(user)) clients.filter(c=>(c.nom+c.email+c.tel+(c.note||"")).toLowerCase().includes(q)).forEach(c=>r.push({type:"Client",label:c.nom,sub:c.tel,nav:"clients"}));
    return r.slice(0,12);
  })():[];

  if(!sbReady) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",flexDirection:"column",gap:12}}>
      <div style={{fontSize:15,fontWeight:700,color:"var(--t2)"}}>Chargement des données…</div>
    </div>
  );
  if(sbErr) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",flexDirection:"column",gap:12,padding:24,textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:700,color:"var(--err)"}}>Impossible de charger Supabase</div>
      <div style={{fontSize:13,color:"var(--t3)",maxWidth:320}}>{sbErr}</div>
      <button className="btn-p" onClick={onLogout}>Retour connexion</button>
    </div>
  );

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",background:"var(--bg)"}}>
      <div style={{background:"var(--w)",borderBottom:"1px solid var(--g2)",paddingTop:"var(--st)",paddingLeft:20,paddingRight:20,paddingBottom:12,flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,background:"var(--hdr-ico)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span style={{fontSize:16,fontWeight:800,letterSpacing:"-.02em",color:"var(--t1)"}}>BuildEasy</span>
            <span title={online?(savedAt?"En ligne · sauvegardé":"En ligne"):"Hors ligne — données locales"} style={{width:8,height:8,borderRadius:"50%",background:online?"var(--ok)":"var(--warn)",marginLeft:6,flexShrink:0,display:"inline-block"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <button onClick={()=>setShowSearch(true)} style={{width:32,height:32,borderRadius:8,background:"var(--g1)",border:"1px solid var(--g2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            {perms.incidents&&<button onClick={()=>setShowSOS(true)} style={{width:32,height:32,borderRadius:8,background:"var(--err-l)",border:"1px solid var(--err-b)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"var(--err)",fontFamily:"var(--f)"}} title="Urgences &amp; contacts rapides">SOS</button>}
            {(retards>0||incOuv>0)&&<div style={{padding:"4px 10px",background:"var(--err-l)",border:"1px solid var(--err-b)",borderRadius:"var(--r)",fontSize:11,fontWeight:700,color:"var(--err)"}}>⚠ {retards+incOuv}</div>}
            <div style={{padding:"5px 10px",background:role.color+"15",border:"1px solid "+role.color+"33",borderRadius:"var(--r)"}}><span style={{fontSize:11,fontWeight:800,color:role.color}}>{role.abbr}</span></div>
          </div>
        </div>
      </div>
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {perms.incidents&&screen!=="incidents"&&screen!=="chat"&&screen!=="plus"&&screen!=="home"&&(
          <div style={{flexShrink:0,overflowY:"auto",maxHeight:"30%"}}>
            <IncidentBanner
              incidents={incidents}
              chantiers={chantiers}
              commandes={commandes}
              equipe={equipe}
              fournisseurs={fournisseurs}
              screen={screen}
              user={user}
              perms={perms}
              onNav={navTo}
              onSheet={openSheet}
              onTreat={id=>updInc(id,"traite")}
              onEdit={inc=>{setEditInc(inc);setIncCtx(null);openSheet("incident");}}
              onCancel={inc=>delInc(inc.id)}
              onUpdInc={updInc}
            />
          </div>
        )}
        <div style={{flex:1,overflow:"hidden"}}>{renderScreen()}</div>
      </div>
      {renderFAB()}
      <div className="nav">
        {TABS.map(tab=>(
          <div key={tab.id} role="button" tabIndex={0} aria-label={tab.l} aria-current={screen===tab.id?"page":undefined} className={"nt "+(screen===tab.id?"nt-on":"nt-off")} onClick={()=>setScreen(tab.id)} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),setScreen(tab.id))}>
            <div className="nt-ico">{tab.ico}</div>
            <div className="nt-lbl">{tab.l}</div>
            {(tab.badge||0)>0&&<div className="nt-dot"/>}
          </div>
        ))}
      </div>
      {printDoc && <PrintModal doc={printDoc} chantiers={chantiers} user={user} onClose={()=>setPrintDoc(null)}/>}
      {showSOS&&(
        <div className="sbg" onMouseDown={e=>e.target===e.currentTarget&&setShowSOS(false)}>
          <div className="sh" style={{maxHeight:"85vh"}}>
            <div className="drag"/>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:10,background:"var(--err)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff",flexShrink:0}}>SOS</div>
              <div><div style={{fontSize:16,fontWeight:800,color:"var(--t1)"}}>Urgences &amp; contacts rapides</div><div style={{fontSize:12,color:"var(--t3)"}}>Un tap pour appeler directement</div></div>
            </div>

            {/* Numéros d'urgence */}
            <div className="sec">Numéros d'urgence</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {URGENCES.map(u=>(
                <a key={u.n} href={"tel:"+u.n.replace(/\s/g,"")} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:"var(--r2)",background:u.c+"12",border:"1.5px solid "+u.c+"30",textDecoration:"none"}}>
                  <span style={{fontSize:24}}>{u.e}</span>
                  <div>
                    <div style={{fontSize:20,fontWeight:900,color:u.c,letterSpacing:"-.02em",lineHeight:1}}>{u.n}</div>
                    <div style={{fontSize:11,color:"var(--t3)",marginTop:1}}>{u.l}</div>
                  </div>
                </a>
              ))}
            </div>

            {/* Équipe de direction */}
            {equipe.filter(m=>m.fn&&(m.fn.toLowerCase().includes("conducteur")||m.fn.toLowerCase().includes("chef")||m.fn.toLowerCase().includes("gérant"))).length>0&&(
              <>
                <div className="sec">Mon équipe de direction</div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                  {equipe.filter(m=>m.fn&&(m.fn.toLowerCase().includes("conducteur")||m.fn.toLowerCase().includes("chef")||m.fn.toLowerCase().includes("gérant"))).map((m,i)=>(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
                      <Av nom={m.nom} color={["#2563EB","#0891B2","#059669"][i%3]} size={38}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{m.nom}</div>
                        <div style={{fontSize:12,color:"var(--t3)",marginTop:1}}>{m.fn}</div>
                      </div>
                      {m.tel&&<a href={"tel:"+m.tel.replace(/\s/g,"")}><button className="btn btn-blue btn-sm">📞 {m.tel}</button></a>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Fournisseurs par catégorie */}
            <div className="sec">Fournisseurs &amp; prestataires</div>
            {[{cat:"materiaux",l:"Matériaux"},{cat:"plomberie",l:"Plomberie"},{cat:"electricite",l:"Électricité"},{cat:"location",l:"Location matériel"},{cat:"enduits",l:"Enduits &amp; façade"}].map(g=>{
              const items=fournisseurs.filter(f=>f.cat===g.cat);
              if(!items.length) return null;
              return (
                <div key={g.cat} style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:"var(--t4)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{g.l}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {items.map(f=>(
                      <div key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--g1)",borderRadius:"var(--r2)",border:"1px solid var(--g2)"}}>
                        <span style={{fontSize:18}}>{g.cat==="location"?"🏗":g.cat==="securite"?"⚕":"📦"}</span>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{f.nom}</div></div>
                        <a href={"tel:"+f.tel.replace(/\s/g,"")}><button className="btn btn-out btn-xs" style={{fontSize:11,fontWeight:700}}>📞 {f.tel}</button></a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <button className="btn btn-out btn-fw" style={{marginTop:8}} onClick={()=>setShowSOS(false)}>Fermer</button>
          </div>
        </div>
      )}
      {showSearch&&(
        <div className="sbg" onMouseDown={e=>e.target===e.currentTarget&&(setShowSearch(false),setSearchQ(""))}>
          <div className="sh" style={{maxHeight:"80vh"}}>
            <div className="drag"/>
            <div style={{marginBottom:16}}>
              <input className="inp" autoFocus placeholder="Rechercher chantier, client, tâche, facture..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{fontSize:16}}/>
            </div>
            {searchQ.trim().length<2&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--t4)",fontSize:13}}>Tapez au moins 2 caractères</div>}
            {searchQ.trim().length>=2&&searchResults.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--t4)",fontSize:13}}>Aucun résultat pour "{searchQ}"</div>}
            {searchResults.map((r,i)=>(
              <div key={i} className="card tap" style={{padding:"12px 14px",marginBottom:6,cursor:"pointer"}} onClick={()=>{if(r.chId)navTo(r.nav,r.chId);else setScreen(r.nav);setShowSearch(false);setSearchQ("");}}>
                <div className="row">
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,fontWeight:700,color:"var(--blue)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{r.type}</div>
                    <div style={{fontSize:14,fontWeight:600,color:"var(--t1)"}}>{r.label}</div>
                    {r.sub&&<div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{r.sub}</div>}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            ))}
            <button className="btn btn-out btn-fw" style={{marginTop:16}} onClick={()=>{setShowSearch(false);setSearchQ("");}}>Fermer</button>
          </div>
        </div>
      )}
      {sheet==="rapport"  &&perms.rapport    &&<FRapport  chantiers={chantiers} equipe={equipe} user={user} defaultChId={resolveDefaultChId()} onRememberCh={rememberCh} onClose={closeSheet} onSave={addR}/>}
      {sheet==="chantier" &&perms.creerCh    &&<FChantier equipe={equipe} onClose={closeSheet} onSave={addC}/>}
      {sheet==="tache"    &&perms.creerT     &&<FTache    chantiers={chantiers} equipe={equipe} onClose={closeSheet} onSave={addT}/>}
      {sheet==="avenant"  &&perms.creerAv    &&<FAvenant  chantiers={chantiers} onClose={closeSheet} onSave={addAv}/>}
      {sheet==="punch"    &&perms.gPunch     &&<FPunch    chantiers={chantiers} equipe={equipe} user={user} defaultChId={resolveDefaultChId()} onRememberCh={rememberCh} onClose={closeSheet} onSave={addP}/>}
      {sheet==="incident" &&perms.incidents  &&<FIncident chantiers={chantiers} user={user} ctx={incCtx} edit={editInc} onClose={closeSheet} onSave={addInc} onUpdate={updInc}/>}
      {sheet==="devis"    &&perms.montants   &&<FDevis   onClose={closeSheet} onSave={onAddDevis}/>}
      {sheet==="commande" &&(perms.montants||perms.creerCmd)&&<FCommande chantiers={chantiers} fournisseurs={fournisseurs} defaultChId={resolveDefaultChId()} onRememberCh={rememberCh} onClose={closeSheet} onSave={onAddCmd}/>}
      {sheet==="conge"    &&perms.equipe     &&<FConge   equipe={equipe} user={user} onClose={closeSheet} onSave={onAddConge}/>}
      {sheet==="agenda"   &&perms.equipe     &&<FAgenda  chantiers={chantiers} equipe={equipe} onClose={closeSheet} onSave={onAddAgenda}/>}
      {sheet==="client"   &&perms.montants   &&<FClient  onClose={closeSheet} onSave={onAddClient}/>}
      {sheet==="facture"   &&perms.montants   &&<FFacture chantiers={chantiers} devis={devis} onClose={closeSheet} onSave={onAddFacture}/>}
      {sheet==="situation" &&perms.montants   &&<FSituation chantiers={chantiers} onClose={closeSheet} onSave={onSaveSituation}/>}
      {sheet==="heure"     &&perms.heures     &&<FHeures chantiers={chantiers} equipe={equipe} user={user} heures={heures} defaultChId={resolveDefaultChId()} onRememberCh={rememberCh} onClose={closeSheet} onSave={onAddHeure}/>}
      {toast&&<div style={{position:"fixed",bottom:"calc(80px + var(--sb))",left:"50%",transform:"translateX(-50%)",padding:"10px 18px",background:"var(--t1)",color:"#fff",borderRadius:"var(--r2)",fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"var(--sh-lg)",pointerEvents:"none"}}>{toast}</div>}
    </div>
  );
}

const Ico=({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{c}</svg>;
const IcoHome=()=><Ico c={<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}/>;
const IcoBuild=()=><Ico c={<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></>}/>;
const IcoTask=()=><Ico c={<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>}/>;
const IcoChat=()=><Ico c={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>}/>;
const IcoMore=()=><Ico c={<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>}/>;

export default function App() {
  const [user,setUser]=useState(null);
  const [themeId,setThemeId]=useState(()=>localStorage.getItem("be_theme")||"ocean");

  useEffect(()=>{
    document.documentElement.setAttribute("data-theme",themeId);
    localStorage.setItem("be_theme",themeId);
  },[themeId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSessionUser().then((u) => { if (u) setUser(u); });
    return onAuthChange((u) => {
      setUser((prev) => {
        if (u) return u;
        if (prev?.isSupabase) return null;
        return prev;
      });
    });
  }, []);

  const handleLogout=async()=>{
    if (user?.isSupabase) await authSignOut().catch(() => {});
    setUser(null);
  };

  return (
    <>
      <style>{CSS}</style>
      {!user?<LoginScreen onLogin={setUser}/>:<AppMobile key={user.id} user={user} onLogout={handleLogout} themeId={themeId} setThemeId={setThemeId}/>}
    </>
  );
}