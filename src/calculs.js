// =========================================================
// MÉTIERS
// =========================================================

/*
 * Liste historique conservée uniquement comme référence.
 * Elle n'impose PLUS aucun métier à l'application.
 */

export const BASE_METIERS = [
  "Mécanique",
  "Fluide",
  "Mesure",
  "Electricité",
  "Contrôle commande",
  "Activité spécifique",
  "Indus Nuc",
  "Indus Conv",
  "Indus Elec",
  "Montage Nuc",
  "Montage Conv",
  "Montage Elec",
  "Architecte",
  "Pilotage",
  "Transverse",
  "MERI",
  "Essais"
];


/*
 * Liste réellement utilisée par l'application.
 *
 * Elle est mise à jour par syncMetiers().
 */

export let METIERS = [];


/**
 * Synchronise la liste des métiers avec les données.
 *
 * Exemple :
 *
 * Excel :
 * Mécanique
 * Essais
 * Robotique
 *
 * devient :
 *
 * METIERS = [
 *   "Essais",
 *   "Mécanique",
 *   "Robotique"
 * ]
 */

export function syncMetiers(
  rows = []
) {

  const fromData = [
    ...new Set(
      rows
        .map(
          r =>
            String(
              r.metier ?? ""
            ).trim()
        )
        .filter(Boolean)
    )
  ];


  METIERS =
    fromData.sort(
      (a, b) =>
        String(a).localeCompare(
          String(b),
          "fr"
        )
    );


  return METIERS;
}


// =========================================================
// COULEURS
// =========================================================

const BASE_COLORS = {

  "Mécanique": "#2563eb",
  "Fluide": "#0891b2",
  "Mesure": "#7c3aed",
  "Electricité": "#ca8a04",
  "Contrôle commande": "#db2777",
  "Activité spécifique": "#0f766e",
  "Indus Nuc": "#dc2626",
  "Indus Conv": "#ea580c",
  "Indus Elec": "#9333ea",
  "Montage Nuc": "#16a34a",
  "Montage Conv": "#65a30d",
  "Montage Elec": "#059669",
  "Architecte": "#475569",
  "Pilotage": "#1d4ed8",
  "Transverse": "#be123c",
  "MERI": "#7e22ce",
  "Essais": "#0f766e"

};


const EXTRA_COLORS = [

  "#0284c7",
  "#4f46e5",
  "#9333ea",
  "#c026d3",
  "#db2777",
  "#e11d48",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#65a30d",
  "#16a34a",
  "#059669",
  "#0d9488",
  "#0891b2",
  "#2563eb"

];


export function getColor(
  metier
) {

  if (
    BASE_COLORS[metier]
  ) {
    return BASE_COLORS[metier];
  }


  let hash = 0;


  for (
    let i = 0;
    i < String(metier).length;
    i++
  ) {

    hash =
      String(metier)
        .charCodeAt(i) +
      ((hash << 5) - hash);

  }


  return EXTRA_COLORS[
    Math.abs(hash) %
    EXTRA_COLORS.length
  ];
}


export const COLORS =
  new Proxy(
    BASE_COLORS,
    {

      get(
        target,
        property
      ) {

        if (
          typeof property !==
          "string"
        ) {
          return undefined;
        }

        return getColor(
          property
        );

      }

    }
  );


// =========================================================
// COULEURS STATUTS
// =========================================================

export const STATUS_COLORS = {

  vert: "#16a34a",

  orange: "#ea580c",

  rouge: "#dc2626"

};


// =========================================================
// UTILITAIRES
// =========================================================

export function round2(v) {

  return Math.round(
    (Number(v) || 0) * 100
  ) / 100;

}


export function n(v) {

  return Number(
    String(v ?? "")
      .replace(/\s/g, "")
      .replace(",", ".")
  ) || 0;

}


// =========================================================
// STATUT
// =========================================================

export function status(
  ecartPts,
  ecartBudgetAlloue,
  green = 5,
  orange = 10
) {

  /*
   * Dépassement du budget total
   * = critique.
   */

  if (
    ecartBudgetAlloue > 0
  ) {

    return "rouge";

  }


  /*
   * Écart par rapport
   * au budget à date.
   */

  if (
    ecartPts <= green
  ) {

    return "vert";

  }


  if (
    ecartPts <= orange
  ) {

    return "orange";

  }


  return "rouge";

}


export function statusLabel(
  s
) {

  return {

    vert: "Favorable",

    orange: "Vigilance",

    rouge: "Critique"

  }[s] || "—";

}


// =========================================================
// SYNTHÈSE
// =========================================================

export function synthese(
  rows,
  metiers = METIERS,
  filtres = {},
  thresholds = {
    green: 5,
    orange: 10
  }
) {

  /*
   * IMPORTANT :
   *
   * On recalcule les métiers directement
   * depuis les lignes reçues.
   *
   * Cela évite qu'un ancien métier reste
   * affiché après un nouvel import.
   */

  const metiersDynamiques = [
    ...new Set(

      rows
        .map(
          r =>
            String(
              r.metier ?? ""
            ).trim()
        )
        .filter(Boolean)

    )

  ].sort(
    (a, b) =>
      String(a).localeCompare(
        String(b),
        "fr"
      )
  );


  // =======================================================
  // FILTRES
  // =======================================================

  const filtered =
    rows.filter(
      r =>

        (
          !filtres.affaire ||
          r.affaire ===
          filtres.affaire
        )

        &&

        (
          !filtres.metier ||
          r.metier ===
          filtres.metier
        )

        &&

        (
          !filtres.date ||
          !r.date ||
          r.date ===
          filtres.date
        )

    );


  // =======================================================
  // CALCUL PAR MÉTIER
  // =======================================================

  const lignes =
    metiersDynamiques.map(
      m => {

        const rs =
          filtered.filter(
            r =>
              r.metier === m
          );


        const encouru =
          rs.reduce(
            (s, r) =>
              s + n(
                r.encouru
              ),
            0
          );


        const budgetDate =
          rs.reduce(
            (s, r) =>
              s + n(
                r.budgetDate
              ),
            0
          );


        const budgetAlloue =
          rs.reduce(
            (s, r) =>
              s + n(
                r.budgetAlloue
              ),
            0
          );


        const consoReelle =
          budgetAlloue > 0
            ? encouru /
              budgetAlloue *
              100
            : 0;


        const consoDate =
          budgetAlloue > 0
            ? budgetDate /
              budgetAlloue *
              100
            : 0;


        const ecartH =
          encouru -
          budgetDate;


        const ecartPoints =
          consoReelle -
          consoDate;


        const ecartBudgetAlloue =
          encouru -
          budgetAlloue;


        return {

          metier: m,

          encouru:
            round2(
              encouru
            ),

          budgetDate:
            round2(
              budgetDate
            ),

          budgetAlloue:
            round2(
              budgetAlloue
            ),

          reste:
            round2(
              budgetAlloue -
              encouru
            ),

          consoReelle:
            round2(
              consoReelle
            ),

          consoDate:
            round2(
              consoDate
            ),

          ecartH:
            round2(
              ecartH
            ),

          ecartPoints:
            round2(
              ecartPoints
            ),

          ecartBudgetAlloue:
            round2(
              ecartBudgetAlloue
            ),

          statut:
            status(
              ecartPoints,
              ecartBudgetAlloue,
              thresholds.green,
              thresholds.orange
            )

        };

      }
    );


  return {

    lignes,

    total:
      aggregate(
        lignes,
        thresholds
      ),

    filtered

  };

}


// =========================================================
// TOTAL
// =========================================================

export function aggregate(
  lignes,
  thresholds = {
    green: 5,
    orange: 10
  }
) {

  const encouru =
    lignes.reduce(
      (s, r) =>
        s + r.encouru,
      0
    );


  const budgetDate =
    lignes.reduce(
      (s, r) =>
        s + r.budgetDate,
      0
    );


  const budgetAlloue =
    lignes.reduce(
      (s, r) =>
        s + r.budgetAlloue,
      0
    );


  const consoReelle =
    budgetAlloue
      ? encouru /
        budgetAlloue *
        100
      : 0;


  const consoDate =
    budgetAlloue
      ? budgetDate /
        budgetAlloue *
        100
      : 0;


  const ecartH =
    encouru -
    budgetDate;


  const ecartPoints =
    consoReelle -
    consoDate;


  const ecartBudgetAlloue =
    encouru -
    budgetAlloue;


  return {

    metier: "TOTAL",

    encouru:
      round2(
        encouru
      ),

    budgetDate:
      round2(
        budgetDate
      ),

    budgetAlloue:
      round2(
        budgetAlloue
      ),

    reste:
      round2(
        budgetAlloue -
        encouru
      ),

    consoReelle:
      round2(
        consoReelle
      ),

    consoDate:
      round2(
        consoDate
      ),

    ecartH:
      round2(
        ecartH
      ),

    ecartPoints:
      round2(
        ecartPoints
      ),

    ecartBudgetAlloue:
      round2(
        ecartBudgetAlloue
      ),

    statut:
      status(
        ecartPoints,
        ecartBudgetAlloue,
        thresholds.green,
        thresholds.orange
      )

  };

}


// =========================================================
// DISTINCT
// =========================================================

export function distinct(
  rows,
  key
) {

  return [

    ...new Set(

      rows
        .map(
          r => r[key]
        )
        .filter(Boolean)

    )

  ].sort(
    (a, b) =>
      String(a).localeCompare(
        String(b),
        "fr"
      )
  );

}


// =========================================================
// FORMATAGE
// =========================================================

export function fmt(v) {

  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0
    }
  ).format(
    Number(v) || 0
  );

}


export function fmt1(v) {

  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 1
    }
  ).format(
    Number(v) || 0
  );

}


export function pct(v) {

  return `${fmt1(v)} %`;

}


export function sign(v) {

  return `${
    v > 0 ? "+" : ""
  }${fmt(v)}`;

}


// =========================================================
// IMPORT EXCEL
// =========================================================

export function normalizeHeader(
  s
) {

  return String(
    s ?? ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]/g,
      ""
    );

}


export const HEADER_ALIASES = {

  affaire: [
    "affaire",
    "projet",
    "projetaffaire"
  ],

  metier: [
    "metier",
    "metieractivite"
  ],

  encouru: [
    "heuresconsommees",
    "heuresconsomme",
    "encouru",
    "consomme",
    "consommation"
  ],

  budgetDate: [
    "budgetadate",
    "budgetdate",
    "budgettheorique",
    "budgetencours",
    "budgeta"
  ],

  budgetAlloue: [
    "budgetalloue",
    "budgettotal",
    "budget",
    "budgetinitial",
    "budgetglobal"
  ],

  date: [
    "date",
    "datedanalyse",
    "dateanalyse",
    "datemaj"
  ]

};


export function mapColumns(
  headers
) {

  const out = {};


  headers.forEach(
    h => {

      const k =
        normalizeHeader(h);


      for (
        const [
          target,
          aliases
        ]
        of Object.entries(
          HEADER_ALIASES
        )
      ) {

        if (
          aliases.includes(k)
        ) {

          out[target] =
            h;

          break;

        }

      }

    }
  );


  return out;

}


// =========================================================
// VALIDATION MÉTIER
// =========================================================

export function ensureMetier(
  m
) {

  return Boolean(
    String(
      m ?? ""
    ).trim()
  );

}