import { syncMetiers } from "./calculs";
import { supabase } from "./lib/supabaseClient";

const SET = "pilotageh_settings_v2";


export const DEFAULT_SETTINGS = {
  green: 5,
  orange: 10,
  dateAnalyse: new Date()
    .toISOString()
    .slice(0, 10)
};


// =========================================================
// CHARGEMENT DES DONNÉES
// =========================================================

export async function loadData() {

  const {
    data,
    error
  } = await supabase
    .from("pilotage")
    .select("*")
    .order("affaire", {
      ascending: true
    })
    .order("metier", {
      ascending: true
    });


  if (error) {

    console.error(
      "Erreur chargement Supabase :",
      error
    );

    return [];
  }


  const rows =
    (data || []).map(row => ({

      id: row.id,

      affaire:
        String(
          row.affaire ?? ""
        ).trim(),

      metier:
        String(
          row.metier ?? ""
        ).trim(),

      encouru:
        Number(
          row.heures_consommees
        ) || 0,

      budgetDate:
        Number(
          row.budget_a_date
        ) || 0,

      budgetAlloue:
        Number(
          row.budget_alloue
        ) || 0,

      date:
        row.date || ""

    }));


  // IMPORTANT :
  // les métiers sont déterminés uniquement
  // à partir des données réellement présentes.
  syncMetiers(rows);


  return rows;
}


// =========================================================
// ENREGISTREMENT DES DONNÉES
// =========================================================

export async function saveData(rows) {

  /*
   * Remplacement complet.
   *
   * Le contenu actuel de Supabase est supprimé,
   * puis remplacé par le nouvel Excel.
   */


  const {
    error: deleteError
  } = await supabase
    .from("pilotage")
    .delete()
    .not("id", "is", null);


  if (deleteError) {

    console.error(
      "Erreur suppression Supabase :",
      deleteError
    );

    throw deleteError;
  }


  // Aucun enregistrement

  if (
    !rows ||
    rows.length === 0
  ) {

    syncMetiers([]);

    window.dispatchEvent(
      new Event(
        "pilotageh-data"
      )
    );

    return;
  }


  // Préparation

  const dataToInsert =
    rows.map(row => ({

      affaire:
        String(
          row.affaire ?? ""
        ).trim(),

      metier:
        String(
          row.metier ?? ""
        ).trim(),

      heures_consommees:
        Number(
          row.encouru
        ) || 0,

      budget_a_date:
        Number(
          row.budgetDate
        ) || 0,

      budget_alloue:
        Number(
          row.budgetAlloue
        ) || 0,

      date:
        row.date || null

    }));


  // Insertion

  const {
    error: insertError
  } = await supabase
    .from("pilotage")
    .insert(
      dataToInsert
    );


  if (insertError) {

    console.error(
      "Erreur insertion Supabase :",
      insertError
    );

    throw insertError;
  }


  // Synchronisation immédiate
  syncMetiers(rows);


  // Notification de l'application
  window.dispatchEvent(
    new Event(
      "pilotageh-data"
    )
  );
}


// =========================================================
// SUPPRESSION
// =========================================================

export async function resetData() {

  const {
    error
  } = await supabase
    .from("pilotage")
    .delete()
    .not("id", "is", null);


  if (error) {

    console.error(
      "Erreur suppression Supabase :",
      error
    );

    throw error;
  }


  syncMetiers([]);


  window.dispatchEvent(
    new Event(
      "pilotageh-data"
    )
  );
}


// =========================================================
// PARAMÈTRES
// =========================================================

export function loadSettings() {

  try {

    return {
      ...DEFAULT_SETTINGS,

      ...JSON.parse(
        localStorage.getItem(
          SET
        ) || "{}"
      )
    };

  } catch {

    return {
      ...DEFAULT_SETTINGS
    };

  }
}


export function saveSettings(s) {

  localStorage.setItem(
    SET,
    JSON.stringify(s)
  );

  window.dispatchEvent(
    new Event(
      "pilotageh-settings"
    )
  );
}


// =========================================================
// TEMPS RÉEL SUPABASE
// =========================================================

export function subscribeToDataChanges() {

  const channel =
    supabase
      .channel(
        "pilotageh-data-changes"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pilotage"
        },
        payload => {

          console.log(
            "🔄 Modification Supabase détectée :",
            payload
          );


          /*
           * useData() écoute cet événement
           * et relance automatiquement loadData().
           */

          window.dispatchEvent(
            new Event(
              "pilotageh-data"
            )
          );

        }
      )
      .subscribe(
        status => {

          console.log(
            "📡 Statut Realtime :",
            status
          );

        }
      );


  return () => {

    supabase.removeChannel(
      channel
    );

  };
}