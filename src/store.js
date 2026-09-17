import { METIERS } from "./calculs";
import { supabase } from "./lib/supabaseClient";

const SET = "pilotageh_settings_v2";

export const DEFAULT_SETTINGS = {
  green: 5,
  orange: 10,
  dateAnalyse: new Date().toISOString().slice(0, 10)
};


export async function loadData(){

  const {data,error}=await supabase
    .from("pilotage")
    .select("*")
    .order("affaire",{ascending:true})
    .order("metier",{ascending:true});

  if(error){
    console.error(
      "Erreur chargement Supabase :",
      error
    );

    return [];
  }

  return(data||[]).map(row=>({

    id:row.id,

    affaire:row.affaire,

    metier:row.metier,

    encouru:
      Number(row.heures_consommees)||0,

    budgetDate:
      Number(row.budget_a_date)||0,

    budgetAlloue:
      Number(row.budget_alloue)||0,

    date:row.date||""

  }));
}


export async function saveData(rows){

  /*
   * Remplacement complet des données.
   * Cette fonction est appelée uniquement
   * depuis la zone d'administration.
   */

  const {error:deleteError}=await supabase
    .from("pilotage")
    .delete()
    .not("id","is",null);

  if(deleteError){

    console.error(
      "Erreur suppression Supabase :",
      deleteError
    );

    throw deleteError;
  }


  if(!rows || rows.length===0){

    window.dispatchEvent(
      new Event("pilotageh-data")
    );

    return;
  }


  const dataToInsert=rows.map(row=>({

    affaire:row.affaire,

    metier:row.metier,

    heures_consommees:
      Number(row.encouru)||0,

    budget_a_date:
      Number(row.budgetDate)||0,

    budget_alloue:
      Number(row.budgetAlloue)||0,

    date:
      row.date||null

  }));


  const {error:insertError}=await supabase
    .from("pilotage")
    .insert(dataToInsert);


  if(insertError){

    console.error(
      "Erreur insertion Supabase :",
      insertError
    );

    throw insertError;
  }


  window.dispatchEvent(
    new Event("pilotageh-data")
  );
}


export async function resetData(){

  const {error}=await supabase
    .from("pilotage")
    .delete()
    .not("id","is",null);


  if(error){

    console.error(
      "Erreur suppression Supabase :",
      error
    );

    throw error;
  }


  window.dispatchEvent(
    new Event("pilotageh-data")
  );
}


export function loadSettings(){

  try{

    return{
      ...DEFAULT_SETTINGS,
      ...JSON.parse(
        localStorage.getItem(SET)||"{}"
      )
    };

  }catch{

    return DEFAULT_SETTINGS;

  }
}


export function saveSettings(s){

  localStorage.setItem(
    SET,
    JSON.stringify(s)
  );

  window.dispatchEvent(
    new Event("pilotageh-settings")
  );
}


export function ensureMetier(m){

  return METIERS.includes(m);

}


/*
 * Temps réel Supabase
 *
 * Toute modification dans la table pilotage
 * déclenche un rechargement des données
 * dans les navigateurs connectés.
 */

export function subscribeToDataChanges(){

  const channel=supabase
    .channel("pilotageh-data-changes")

    .on(
      "postgres_changes",
      {
        event:"*",
        schema:"public",
        table:"pilotage"
      },

      payload=>{

        console.log(
          "🔄 Modification Supabase détectée :",
          payload
        );

        window.dispatchEvent(
          new Event("pilotageh-data")
        );

      }
    )

    .subscribe(status=>{

      console.log(
        "📡 Statut Realtime :",
        status
      );

    });


  return()=>{

    supabase.removeChannel(channel);

  };

}