import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { fmt1 } from "./calculs";

function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
export function exportExcel(lignes,total){
  const data=[["Métier","Heures consommées","Budget à date","Budget alloué","Reste à consommer","Conso réelle (%)","Conso à date (%)","Écart (h)","Écart (pts)","Statut"],
    ...lignes.map(x=>[x.metier,x.encouru,x.budgetDate,x.budgetAlloue,x.reste,fmt1(x.consoReelle),fmt1(x.consoDate),x.ecartH,fmt1(x.ecartPoints),x.statut]),
    ["TOTAL",total.encouru,total.budgetDate,total.budgetAlloue,total.reste,fmt1(total.consoReelle),fmt1(total.consoDate),total.ecartH,fmt1(total.ecartPoints),total.statut]];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),"Pilotage");
  XLSX.writeFile(wb,"pilotageh_export.xlsx");
}
export function exportCSV(lignes,total){
  const data=[["Métier","Heures consommées","Budget à date","Budget alloué","Reste","Conso réelle (%)","Conso à date (%)","Écart (h)","Écart (pts)","Statut"],
  ...lignes.map(x=>[x.metier,x.encouru,x.budgetDate,x.budgetAlloue,x.reste,fmt1(x.consoReelle),fmt1(x.consoDate),x.ecartH,fmt1(x.ecartPoints),x.statut]),
  ["TOTAL",total.encouru,total.budgetDate,total.budgetAlloue,total.reste,fmt1(total.consoReelle),fmt1(total.consoDate),total.ecartH,fmt1(total.ecartPoints),total.statut]];
  const csv="\uFEFF"+data.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(";")).join("\n");
  download(new Blob([csv],{type:"text/csv;charset=utf-8"}),"pilotageh_export.csv");
}
export function exportPDF(lignes,total,meta={}){
  const doc=new jsPDF({orientation:"landscape"});
  doc.setFontSize(16);doc.text("PilotageH — Pilotage des heures",14,15);
  doc.setFontSize(9);doc.text(`Date d'analyse : ${meta.date||"—"}    Affaires : ${meta.affaires??"—"}`,14,22);
  const headers=["Métier","Consommé","Budget date","Budget alloué","Reste","Conso %","Date %","Écart h","Écart pts","Statut"];
  let y=32; const xs=[12,45,68,92,121,150,170,193,218,246];
  doc.setFont(undefined,"bold");headers.forEach((h,i)=>doc.text(h,xs[i],y));y+=6;doc.setFont(undefined,"normal");
  [...lignes,total].forEach(r=>{if(y>190){doc.addPage();y=18} const vals=[r.metier,r.encouru,r.budgetDate,r.budgetAlloue,r.reste,fmt1(r.consoReelle),fmt1(r.consoDate),r.ecartH,fmt1(r.ecartPoints),r.statut];vals.forEach((v,i)=>doc.text(String(v),xs[i],y));y+=6});
  doc.save("pilotageh_export.pdf");
}
export function downloadTemplate(){
  const data=[["Affaire","Métier","Heures consommées","Budget à date","Budget alloué"],["EXEMPLE","Mécanique",120,150,300]];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),"Alimentation");
  XLSX.writeFile(wb,"modele_alimentation_pilotageh.xlsx");
}
