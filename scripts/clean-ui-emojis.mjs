#!/usr/bin/env node
/** Retire les emojis et symboles enfantins de App.jsx */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../src/App.jsx')
let s = readFileSync(file, 'utf8')

const replacements = [
  [/const METEO_PRESETS = \[[^\]]+\];\n/, ''],
  [/const tIco=\{[^}]+\};\n/g, ''],
  [/const tE=\{[^}]+\};\n/g, ''],
  [/const catIco=\{[^}]+\};\n/g, ''],
  [/\{l:"SAMU"[^]]+\];\n/, `const URGENCES=[
  {l:"SAMU",       n:"15",           c:"#DC2626"},
  {l:"Pompiers",   n:"18",           c:"#EA580C"},
  {l:"Police",     n:"17",           c:"#1D4ED8"},
  {l:"Urg. Europ.",n:"112",          c:"#7C3AED"},
  {l:"CARSAT",     n:"09 71 10 77 00",c:"#0891B2"},
  {l:"Insp. Trav.",n:"0801 200 212", c:"#059669"},
];\n`],
  [/ico:"[^"]+",\s*/g, ''],
  [/icon=\{u\.e\}/g, ''],
  [/icon="[^"]+"/g, ''],
  [/e:"[^"]+",\s*/g, ''],
  [/\{f\[v\.k\]\?"✓ ":""\}/g, '{f[v.k]?"· ":""}'],
  [/✓ /g, ''],
  [/✓/g, ''],
  [/⚠ /g, ''],
  [/⚠️/g, ''],
  [/⚠/g, ''],
  [/📍 /g, ''],
  [/📍/g, ''],
  [/🕐 RDV /g, 'RDV '],
  [/🌤 /g, ''],
  [/📦 /g, ''],
  [/📅 /g, ''],
  [/👷 /g, ''],
  [/⏱ /g, ''],
  [/✅ /g, ''],
  [/ →/g, ''],
  [/→/g, ''],
  [/Voir tout →/g, 'Voir tout'],
  [/Voir le détail →/g, 'Voir le détail'],
  [/Gérer →/g, 'Gérer'],
  [/Traiter →/g, 'Traiter'],
  [/Signer →/g, 'Signer'],
  [/🖨 /g, ''],
  [/📤 /g, ''],
  [/✉️ /g, ''],
  [/💬 /g, ''],
  [/📞 /g, ''],
  [/📞/g, ''],
  [/🚨 COMMANDE URGENTE — /g, 'COMMANDE URGENTE — '],
  [/🔴 CHANTIER ARRÊTÉ — /g, 'CHANTIER ARRÊTÉ — '],
  [/⛔ /g, ''],
  [/🛑/g, ''],
  [/✕ /g, ''],
  [/📌 /g, ''],
  [/📌/g, ''],
  [/ico:"👤"[^}]+\}\]\.map/g, '}].map'],
  [/<span style=\{\{fontSize:22\}\}>\{icon\}<\/span>\n/, ''],
  [/<span style=\{\{fontSize:16[^}]+\}\}>\{tIco\[e\.type\]\|\|"📌"\}<\/span>\n/g, '<span className="chip chip-blue" style={{fontSize:10}}>{AGENDA_TYPES[e.type]||"Autre"}</span>\n'],
  [/<span style=\{\{fontSize:18\}\}>\{tIco\[e\.type\]\|\|"📌"\}<\/span>\n/g, '<span className="chip chip-blue" style={{fontSize:10}}>{AGENDA_TYPES[e.type]||"Autre"}</span>\n'],
  [/<span style=\{\{fontSize:16,flexShrink:0\}\}>📌<\/span>\n/g, ''],
  [/<div style=\{\{fontSize:24,marginBottom:8\}\}>[^<]+<\/div>/g, ''],
  [/<div style=\{\{fontSize:18,marginBottom:4\}\}>[^<]+<\/div>/g, ''],
  [/<div style=\{\{fontSize:48\}\}>[^<]+<\/div>/g, '<div className="empty-icon"><ModIcon name="empty" size={28} /></div>'],
  [/<span style=\{\{fontSize:18\}\}>⚠️<\/span>/g, '<IcoAlert size={18} />'],
  [/\[\["planif","📋 Planifié"/g, '[["planif","Planifié"'],
  [/\["en_cours","🔨 En cours"/g, '["en_cours","En cours"'],
  [/\["fait","✅ Terminé"/g, '["fait","Terminé"'],
  [/👤 Mes tâches/g, 'Mes tâches'],
  [/📌 Notes rapides/g, 'Notes rapides'],
  [/Clore la réserve/g, 'Clore la réserve'],
  [/Traité/g, 'Traité'],
  [/Réceptionné/g, 'Réceptionné'],
  [/Appeler /g, 'Appeler '],
  [/🧱/g, ''],
  [/🔵/g, ''],
  [/⚡/g, ''],
  [/🪣/g, ''],
  [/🪵/g, ''],
  [/🏗/g, ''],
  [/🔧/g, ''],
  [/💬/g, ''],
  [/🆘/g, ''],
  [/👮/g, ''],
  [/🚑/g, ''],
  [/🚒/g, ''],
  [/⚕/g, ''],
  [/🔺/g, ''],
  [/🏁/g, ''],
  [/item\.ico\}/g, 'item.id}><ModIcon name={item.id}'],
  [/\{item\.ico\}/g, '<ModIcon name={item.id} />'],
  [/filter:"grayscale\(1\)"\}\}\{item\.ico\}/g, 'filter:"grayscale(1)"}}><ModIcon name={item.id}'],
]

// Fix botched replacement - do item.ico manually later

for (const [from, to] of replacements) {
  s = s.replace(from, to)
}

writeFileSync(file, s)
console.log('App.jsx nettoyé')
