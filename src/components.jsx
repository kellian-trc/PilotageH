import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, BarChart3, Settings, RefreshCw, ChevronRight, Circle } from "lucide-react";
import { COLORS, STATUS_COLORS, statusLabel, fmt, fmt1, pct, sign } from "./calculs";

export function Layout({children}){
  const nav=[["/","Dashboard",LayoutDashboard],["/imports","Données / Import",Upload],["/analyse","Analyse",BarChart3],["/parametres","Paramètres",Settings]];
  return <div className="app"><aside className="sidebar"><div className="brand"><div className="brandmark">PH</div><div><b>Pilotage Heures</b><small>Contrôle industriel</small></div></div><nav>{nav.map(([to,label,I])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"nav active":"nav"}><I size={17}/>{label}</NavLink>)}</nav><div className="sidefoot">Version autonome<br/><span>Sans Base44</span></div></aside><main className="main">{children}</main></div>
}
export function Card({title,subtitle,children,highlight=false,className=""}){return <section className={`card ${highlight?"highlight":""} ${className}`}><div className="cardhead"><div><h3>{title}</h3>{subtitle&&<small>{subtitle}</small>}</div></div><div className="cardbody">{children}</div></section>}
export function KPI({label,value,unit,sub,kind="slate"}){return <div className={`kpi ${kind}`}><div className="kpi-label">{label}</div><div className="kpi-value">{value}<span>{unit||""}</span></div>{sub&&<div className="kpi-sub">{sub}</div>}</div>}
export function Status({status}){return <span className="status" style={{color:STATUS_COLORS[status],background:`${STATUS_COLORS[status]}15`}}><Circle size={8} fill="currentColor"/>{statusLabel(status)}</span>}
export function Filters({rows,filters,setFilters,showDate=true}){
  const affairs=[...new Set(rows.map(r=>r.affaire).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
  const mets=[...new Set(rows.map(r=>r.metier).filter(Boolean))];
  return <div className="filters">
    <label>Affaire<select value={filters.affaire||""} onChange={e=>setFilters({...filters,affaire:e.target.value})}><option value="">Toutes</option>{affairs.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Métier<select value={filters.metier||""} onChange={e=>setFilters({...filters,metier:e.target.value})}><option value="">Tous</option>{mets.map(x=><option key={x}>{x}</option>)}</select></label>
    {showDate&&<label>Date<select value={filters.date||""} onChange={e=>setFilters({...filters,date:e.target.value})}><option value="">Toutes</option>{[...new Set(rows.map(r=>r.date).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select></label>}
    <button className="btn ghost" onClick={()=>setFilters({})}><RefreshCw size={14}/>Réinitialiser</button>
  </div>
}
export function Table({lignes,total,onDetail=true}){
 const nav=useNavigate();
 return <div className="tablewrap"><table><thead><tr><th>Métier</th><th>Consommé</th><th>Budget à date</th><th>Budget alloué</th><th>Reste</th><th>Conso réelle</th><th>Conso à date</th><th>Écart h</th><th>Écart pts</th><th>Statut</th></tr></thead><tbody>{lignes.map(r=><tr key={r.metier} onDoubleClick={()=>onDetail&&nav(`/metier/${encodeURIComponent(r.metier)}`)}><td><span className="dot" style={{background:COLORS[r.metier]}}></span><b>{r.metier}</b></td><td>{fmt(r.encouru)} h</td><td>{fmt(r.budgetDate)} h</td><td>{fmt(r.budgetAlloue)} h</td><td>{fmt(r.reste)} h</td><td>{pct(r.consoReelle)}</td><td>{pct(r.consoDate)}</td><td className={r.ecartH>0?"bad":r.ecartH<0?"good":""}>{sign(r.ecartH)} h</td><td className={r.ecartPoints>0?"bad":r.ecartPoints<0?"good":""}>{sign(r.ecartPoints)}</td><td><Status status={r.statut}/></td></tr>)}</tbody><tfoot><tr><td><b>TOTAL</b></td><td>{fmt(total.encouru)} h</td><td>{fmt(total.budgetDate)} h</td><td>{fmt(total.budgetAlloue)} h</td><td>{fmt(total.reste)} h</td><td>{pct(total.consoReelle)}</td><td>{pct(total.consoDate)}</td><td>{sign(total.ecartH)} h</td><td>{sign(total.ecartPoints)}</td><td><Status status={total.statut}/></td></tr></tfoot></table><div className="tablehint">Double-cliquez sur une ligne pour ouvrir le détail du métier.</div></div>
}
