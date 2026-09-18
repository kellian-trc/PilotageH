import * as XLSX from "xlsx";

import {
  mapColumns,
  n
} from "./calculs";


// =========================================================
// LECTURE DU FICHIER EXCEL
// =========================================================

export async function readWorkbook(
  file
) {

  const buf =
    await file.arrayBuffer();


  const wb =
    XLSX.read(
      buf,
      {
        type: "array",
        cellDates: true
      }
    );


  if (
    !wb.SheetNames.length
  ) {

    throw new Error(
      "Le fichier ne contient aucune feuille."
    );

  }


  const ws =
    wb.Sheets[
      wb.SheetNames[0]
    ];


  const raw =
    XLSX.utils.sheet_to_json(
      ws,
      {
        defval: ""
      }
    );


  if (
    !raw.length
  ) {

    return {

      rows: [],
      headers: [],
      map: {},
      missing: [],
      errors: [],
      valid: []

    };

  }


  const headers =
    Object.keys(
      raw[0]
    );


  const map =
    mapColumns(
      headers
    );


  // =======================================================
  // COLONNES OBLIGATOIRES
  // =======================================================

  const required = [

    "affaire",
    "metier",
    "encouru",
    "budgetDate",
    "budgetAlloue"

  ];


  const missing =
    required.filter(
      key =>
        !map[key]
    );


  const errors = [];


  // =======================================================
  // TRANSFORMATION DES LIGNES
  // =======================================================

  const rows =
    raw.map(
      (r, i) => {

        const metier =
          String(
            r[
              map.metier
            ] ?? ""
          ).trim();


        const row = {

          id:
            `${Date.now()}-${i}-${Math.random()
              .toString(36)
              .slice(2)}`,

          affaire:
            String(
              r[
                map.affaire
              ] ?? ""
            ).trim(),

          metier,

          encouru:
            n(
              r[
                map.encouru
              ]
            ),

          budgetDate:
            n(
              r[
                map.budgetDate
              ]
            ),

          budgetAlloue:
            n(
              r[
                map.budgetAlloue
              ]
            ),

          date:
            map.date
              ? toISO(
                  r[
                    map.date
                  ]
                )
              : ""

        };


        const e = [];


        // =================================================
        // VALIDATION
        // =================================================

        if (
          !row.affaire
        ) {

          e.push(
            "Affaire manquante"
          );

        }


        if (
          !row.metier
        ) {

          e.push(
            "Métier manquant"
          );

        }


        /*
         * Aucun contrôle sur une liste
         * prédéfinie de métiers.
         *
         * Donc :
         *
         * Mécanique       → OK
         * Essais           → OK
         * Robotique        → OK
         * Nouveau métier   → OK
         */


        if (
          row.encouru < 0
        ) {

          e.push(
            "Heures consommées négatives"
          );

        }


        if (
          row.budgetDate < 0
        ) {

          e.push(
            "Budget à date négatif"
          );

        }


        if (
          row.budgetAlloue < 0
        ) {

          e.push(
            "Budget alloué négatif"
          );

        }


        if (
          e.length > 0
        ) {

          errors.push({

            ligne:
              i + 2,

            erreurs:
              e

          });

        }


        return row;

      }
    );


  // =======================================================
  // LIGNES VALIDES
  // =======================================================

  const valid =
    rows.filter(
      (_, i) =>
        !errors.some(
          error =>
            error.ligne ===
            i + 2
        )
    );


  return {

    rows,

    headers,

    map,

    missing,

    errors,

    valid

  };

}


// =========================================================
// CONVERSION DES DATES
// =========================================================

function toISO(
  v
) {

  // -------------------------------------------------------
  // Date Excel déjà convertie
  // -------------------------------------------------------

  if (
    v instanceof Date &&
    !isNaN(v)
  ) {

    return v
      .toISOString()
      .slice(0, 10);

  }


  // -------------------------------------------------------
  // Date Excel sous forme numérique
  // -------------------------------------------------------

  if (
    typeof v ===
    "number"
  ) {

    const d =
      XLSX.SSF.parse_date_code(
        v
      );


    if (d) {

      return `${d.y}-${String(
        d.m
      ).padStart(
        2,
        "0"
      )}-${String(
        d.d
      ).padStart(
        2,
        "0"
      )}`;

    }

  }


  // -------------------------------------------------------
  // Date sous forme de texte
  // -------------------------------------------------------

  if (
    v === null ||
    v === undefined ||
    String(v).trim() === ""
  ) {

    return "";

  }


  const text =
    String(v).trim();


  /*
   * Gestion explicite des formats français :
   *
   * 15/09/2026
   * 15-09-2026
   */

  const fr =
    text.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
    );


  if (fr) {

    const [
      ,
      day,
      month,
      year
    ] = fr;


    return `${year}-${String(
      month
    ).padStart(
      2,
      "0"
    )}-${String(
      day
    ).padStart(
      2,
      "0"
    )}`;

  }


  // -------------------------------------------------------
  // Tentative standard JavaScript
  // -------------------------------------------------------

  const d =
    new Date(
      text
    );


  if (
    isNaN(d)
  ) {

    return text;

  }


  return d
    .toISOString()
    .slice(0, 10);

}