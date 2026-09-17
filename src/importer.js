import * as XLSX from "xlsx";
import { mapColumns, n, METIERS } from "./calculs";

export async function readWorkbook(file){
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const raw=XLSX.utils.sheet_to_json(ws,{defval:""});
  const headers=raw.length?Object.keys(raw[0]):[];
  const map=mapColumns(headers);
  const required=["affaire","metier","encouru","budgetDate","budgetAlloue"];
  const missing=required.filter(k=>!map[k]);
  const errors=[];
  const rows=raw.map((r,i)=>{
    const metier=String(r[map.metier]??"").trim();
    const row={
      id:`${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      affaire:String(r[map.affaire]??"").trim(),
      metier,
      encouru:n(r[map.encouru]),
      budgetDate:n(r[map.budgetDate]),
      budgetAlloue:n(r[map.budgetAlloue]),
      date:map.date?toISO(r[map.date]):""
    };
    const e=[];
    if(!row.affaire)e.push("Affaire manquante");
    if(!row.metier)e.push("Métier manquant");
    else if(!METIERS.includes(row.metier))e.push(`Métier inconnu: ${row.metier}`);
    if(row.encouru<0)e.push("Heures consommées négatives");
    if(row.budgetDate<0)e.push("Budget à date négatif");
    if(row.budgetAlloue<0)e.push("Budget alloué négatif");
    if(e.length)errors.push({ligne:i+2,erreurs:e});
    return row;
  });
  return {rows,headers,map,missing,errors,valid:rows.filter((_,i)=>!errors.some(e=>e.ligne===i+2))};
}
function toISO(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v); if(d)return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`}
  const d=new Date(v); return isNaN(d)?String(v||""):d.toISOString().slice(0,10);
}
