import React, { useEffect, useMemo, useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useNavigate,
  useSearchParams
} from "react-router-dom";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from "recharts";

import {
  Upload,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileText,
  Save,
  ArrowLeft
} from "lucide-react";

import { jsPDF } from "jspdf";

import {
  Layout,
  Card,
  KPI,
  Filters,
  Table,
  Status
} from "./components";

import {
  METIERS,
  COLORS,
  synthese,
  distinct,
  fmt,
  fmt1,
  pct,
  sign,
  STATUS_COLORS,
  syncMetiers
} from "./calculs";

import {
  loadData,
  saveData,
  loadSettings,
  saveSettings,
  resetData,
  subscribeToDataChanges
} from "./store";

import { readWorkbook } from "./importer";

import {
  exportExcel,
  exportCSV,
  downloadTemplate
} from "./export";

import {
  signIn,
  getSession,
  subscribeToAuth
} from "./lib/auth";


/* =========================================================
   UTILITAIRES
   ========================================================= */

/**
 * Conversion robuste en nombre.
 *
 * Gère notamment :
 * 1234
 * "1234"
 * "1 234"
 * "1 234,50"
 * "1234,50"
 * "1,234.50"
 * null / undefined / NaN
 */
function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  let str = String(value)
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "");

  if (!str) {
    return 0;
  }

  /*
   * Gestion des formats français.
   *
   * 1.234,56
   * 1 234,56
   * 1234,56
   */
  if (
    str.includes(",") &&
    str.includes(".")
  ) {
    /*
     * Si la virgule est après le point :
     * 1.234,56 => 1234.56
     */
    if (
      str.lastIndexOf(",") >
      str.lastIndexOf(".")
    ) {
      str = str
        .replace(/\./g, "")
        .replace(",", ".");
    } else {
      /*
       * 1,234.56
       */
      str = str.replace(/,/g, "");
    }
  } else if (
    str.includes(",")
  ) {
    str = str.replace(",", ".");
  }

  const n = Number(str);

  return Number.isFinite(n)
    ? n
    : 0;
}


/**
 * Nombre sécurisé pour le PDF.
 */
function safePdfNumber(value) {
  const n = toNumber(value);

  return Number.isFinite(n)
    ? n
    : 0;
}


/**
 * Format heures compact pour PDF.
 */
function pdfHours(value) {
  const n =
    safePdfNumber(value);

  return n.toLocaleString(
    "fr-FR",
    {
      minimumFractionDigits:
        Number.isInteger(n)
          ? 0
          : 1,
      maximumFractionDigits: 1
    }
  );
}


/**
 * Format pourcentage PDF.
 */
function pdfPercent(value) {
  const n =
    safePdfNumber(value);

  return n.toLocaleString(
    "fr-FR",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }
  );
}


/**
 * Format écart avec signe.
 */
function pdfSigned(value) {
  const n =
    safePdfNumber(value);

  if (n > 0) {
    return `+${pdfHours(n)}`;
  }

  if (n < 0) {
    return `-${pdfHours(Math.abs(n))}`;
  }

  return "0";
}


/**
 * Format écart en points.
 */
function pdfSignedPoints(value) {
  const n =
    safePdfNumber(value);

  if (n > 0) {
    return `+${pdfPercent(n)}`;
  }

  if (n < 0) {
    return `-${pdfPercent(Math.abs(n))}`;
  }

  return "0";
}


/**
 * Texte sécurisé.
 */
function pdfSafeText(value, fallback = "—") {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return String(value);
}


/**
 * Conversion hex -> RGB.
 */
function hexToRgb(hex) {
  const clean =
    String(hex || "")
      .replace("#", "")
      .trim();

  if (
    clean.length !== 6 ||
    !/^[0-9a-fA-F]{6}$/.test(
      clean
    )
  ) {
    return [100, 116, 139];
  }

  return [
    parseInt(
      clean.slice(0, 2),
      16
    ),
    parseInt(
      clean.slice(2, 4),
      16
    ),
    parseInt(
      clean.slice(4, 6),
      16
    )
  ];
}


/* =========================================================
   OUTILS DE DESSIN PDF
   ========================================================= */

function pdfText(
  doc,
  text,
  x,
  y,
  options = {}
) {
  const {
    size = 8,
    color = [30, 41, 59],
    bold = false,
    align = "left",
    font = "helvetica"
  } = options;

  doc.setFont(
    font,
    bold
      ? "bold"
      : "normal"
  );

  doc.setFontSize(size);

  doc.setTextColor(
    ...color
  );

  doc.text(
    String(text ?? ""),
    x,
    y,
    {
      align
    }
  );
}


function pdfRect(
  doc,
  x,
  y,
  w,
  h,
  fill,
  radius = 0
) {
  doc.setFillColor(
    ...fill
  );

  if (radius > 0) {
    doc.roundedRect(
      x,
      y,
      w,
      h,
      radius,
      radius,
      "F"
    );
  } else {
    doc.rect(
      x,
      y,
      w,
      h,
      "F"
    );
  }
}


function pdfStrokeRect(
  doc,
  x,
  y,
  w,
  h,
  color = [226, 232, 240],
  radius = 0,
  width = 0.3
) {
  doc.setDrawColor(
    ...color
  );

  doc.setLineWidth(
    width
  );

  if (radius > 0) {
    doc.roundedRect(
      x,
      y,
      w,
      h,
      radius,
      radius,
      "S"
    );
  } else {
    doc.rect(
      x,
      y,
      w,
      h,
      "S"
    );
  }
}


function pdfLine(
  doc,
  x1,
  y1,
  x2,
  y2,
  color = [226, 232, 240],
  width = 0.3
) {
  doc.setDrawColor(
    ...color
  );

  doc.setLineWidth(
    width
  );

  doc.line(
    x1,
    y1,
    x2,
    y2
  );
}


/**
 * Texte dans une largeur donnée.
 */
function pdfFitText(
  doc,
  text,
  x,
  y,
  maxWidth,
  options = {}
) {
  const {
    size = 6,
    color = [30, 41, 59],
    bold = false,
    align = "left"
  } = options;

  doc.setFont(
    "helvetica",
    bold
      ? "bold"
      : "normal"
  );

  doc.setFontSize(
    size
  );

  let result =
    String(text ?? "");

  if (
    doc.getTextWidth(result) >
    maxWidth
  ) {
    while (
      result.length > 3 &&
      doc.getTextWidth(
        `${result.slice(
          0,
          -2
        )}…`
      ) >
        maxWidth
    ) {
      result =
        result.slice(
          0,
          -2
        );
    }

    result =
      `${result}…`;
  }

  pdfText(
    doc,
    result,
    x,
    y,
    {
      size,
      color,
      bold,
      align
    }
  );
}


/* =========================================================
   COULEURS PDF
   ========================================================= */

const PDF_COLORS = {
  navy: [15, 23, 42],
  blue: [37, 99, 235],
  blueDark: [30, 64, 175],
  cyan: [8, 145, 178],

  green: [22, 163, 74],
  greenLight: [220, 252, 231],

  orange: [234, 88, 12],
  orangeLight: [255, 237, 213],

  red: [220, 38, 38],
  redLight: [254, 226, 226],

  slate: [71, 85, 105],
  muted: [100, 116, 139],

  border: [226, 232, 240],
  grid: [241, 245, 249],

  white: [255, 255, 255],
  background: [248, 250, 252],

  header: [30, 41, 59]
};


/* =========================================================
   STATUT PDF
   ========================================================= */

function getStatusColor(
  statut
) {
  if (
    statut === "vert"
  ) {
    return PDF_COLORS.green;
  }

  if (
    statut === "orange"
  ) {
    return PDF_COLORS.orange;
  }

  if (
    statut === "rouge"
  ) {
    return PDF_COLORS.red;
  }

  return PDF_COLORS.muted;
}


function getStatusLight(
  statut
) {
  if (
    statut === "vert"
  ) {
    return PDF_COLORS.greenLight;
  }

  if (
    statut === "orange"
  ) {
    return PDF_COLORS.orangeLight;
  }

  if (
    statut === "rouge"
  ) {
    return PDF_COLORS.redLight;
  }

  return [241, 245, 249];
}


function getStatusLabel(
  statut
) {
  if (
    statut === "vert"
  ) {
    return "Favorable";
  }

  if (
    statut === "orange"
  ) {
    return "Vigilance";
  }

  if (
    statut === "rouge"
  ) {
    return "Dépassement";
  }

  return "Non défini";
}


/* =========================================================
   PDF PROFESSIONNEL — A4 PAYSAGE 1 PAGE
   ========================================================= */

function exportProfessionalPDF(
  lignes,
  total,
  meta = {}
) {
  const doc =
    new jsPDF({
      orientation:
        "landscape",
      unit: "mm",
      format: "a4",
      compress: true
    });

  const PAGE_W = 297;
  const PAGE_H = 210;

  const M = 7;

  const {
    navy,
    blue,
    blueDark,
    cyan,
    green,
    greenLight,
    orange,
    orangeLight,
    red,
    redLight,
    slate,
    muted,
    border,
    grid,
    white,
    background
  } = PDF_COLORS;


  /* =======================================================
     NORMALISATION DES DONNÉES
     ======================================================= */

  const rows =
    Array.isArray(lignes)
      ? lignes.map(
          r => ({
            ...r,

            encouru:
              safePdfNumber(
                r.encouru
              ),

            budgetDate:
              safePdfNumber(
                r.budgetDate
              ),

            budgetAlloue:
              safePdfNumber(
                r.budgetAlloue
              ),

            reste:
              safePdfNumber(
                r.reste
              ),

            consoReelle:
              safePdfNumber(
                r.consoReelle
              ),

            consoDate:
              safePdfNumber(
                r.consoDate
              ),

            ecartH:
              safePdfNumber(
                r.ecartH
              ),

            ecartPoints:
              safePdfNumber(
                r.ecartPoints
              )
          })
        )
      : [];


  const totalSafe = {
    ...total,

    budgetAlloue:
      safePdfNumber(
        total?.budgetAlloue
      ),

    encouru:
      safePdfNumber(
        total?.encouru
      ),

    budgetDate:
      safePdfNumber(
        total?.budgetDate
      ),

    reste:
      safePdfNumber(
        total?.reste
      ),

    consoReelle:
      safePdfNumber(
        total?.consoReelle
      ),

    consoDate:
      safePdfNumber(
        total?.consoDate
      ),

    ecartH:
      safePdfNumber(
        total?.ecartH
      ),

    ecartPoints:
      safePdfNumber(
        total?.ecartPoints
      )
  };


  /* =======================================================
     INFORMATIONS DE CONTEXTE
     ======================================================= */

  const affaire =
    pdfSafeText(
      meta.affaire,
      ""
    );

  const metierFiltre =
    pdfSafeText(
      meta.metier,
      ""
    );

  const dateAnalyse =
    pdfSafeText(
      meta.date,
      "—"
    );


  const contexte =
    affaire
      ? `Affaire : ${affaire}`
      : "Toutes les affaires";

  const contexteMetier =
    metierFiltre
      ? `Métier : ${metierFiltre}`
      : "Tous les métiers";


  /* =======================================================
     INDICATEURS
     ======================================================= */

  const nbVigilance =
    rows.filter(
      r =>
        r.statut ===
          "orange" ||
        r.statut ===
          "rouge"
    ).length;

  const nbRouge =
    rows.filter(
      r =>
        r.statut ===
        "rouge"
    ).length;

  const sortedByGap =
    [...rows].sort(
      (a, b) =>
        b.ecartH -
        a.ecartH
    );

  const topProblem =
    sortedByGap[0];


  /* =======================================================
     FOND
     ======================================================= */

  pdfRect(
    doc,
    0,
    0,
    PAGE_W,
    PAGE_H,
    background
  );


  /* =======================================================
     HEADER
     ======================================================= */

  pdfRect(
    doc,
    0,
    0,
    PAGE_W,
    25,
    navy
  );


  /*
   * Accent graphique
   */
  pdfRect(
    doc,
    0,
    0,
    5,
    25,
    blue
  );


  pdfText(
    doc,
    "PILOTAGE H",
    M + 3,
    9,
    {
      size: 14,
      color: white,
      bold: true
    }
  );


  pdfText(
    doc,
    "RAPPORT DE PILOTAGE DES HEURES",
    M + 3,
    16,
    {
      size: 6.5,
      color: [
        191,
        219,
        254
      ],
      bold: true
    }
  );


  pdfText(
    doc,
    dateAnalyse,
    PAGE_W - M,
    9,
    {
      size: 8,
      color: white,
      bold: true,
      align: "right"
    }
  );


  pdfText(
    doc,
    contexte,
    PAGE_W - M,
    15,
    {
      size: 6.5,
      color: [
        191,
        219,
        254
      ],
      align: "right"
    }
  );


  pdfText(
    doc,
    contexteMetier,
    PAGE_W - M,
    21,
    {
      size: 5.5,
      color: [
        148,
        163,
        184
      ],
      align: "right"
    }
  );


  /* =======================================================
     KPI — 6 CARTES
     ======================================================= */

  const kpiY = 29;
  const kpiH = 19;
  const kpiGap = 3;

  const kpiW =
    (
      PAGE_W -
      2 * M -
      5 * kpiGap
    ) / 6;


  const kpis = [
    {
      label:
        "BUDGET ALLOUÉ",
      value:
        `${pdfHours(
          totalSafe.budgetAlloue
        )} h`,
      color:
        slate
    },

    {
      label:
        "HEURES CONSOMMÉES",
      value:
        `${pdfHours(
          totalSafe.encouru
        )} h`,
      color:
        blue
    },

    {
      label:
        "BUDGET À DATE",
      value:
        `${pdfHours(
          totalSafe.budgetDate
        )} h`,
      color:
        green
    },

    {
      label:
        "ÉCART HEURES",
      value:
        `${pdfSigned(
          totalSafe.ecartH
        )} h`,
      color:
        totalSafe.ecartH > 0
          ? red
          : green
    },

    {
      label:
        "CONSOMMATION",
      value:
        `${pdfPercent(
          totalSafe.consoReelle
        )} %`,
      color:
        orange
    },

    {
      label:
        "ÉCART AU THÉORIQUE",
      value:
        `${pdfSignedPoints(
          totalSafe.ecartPoints
        )} pts`,
      color:
        totalSafe.ecartPoints >
        safePdfNumber(
          meta.orange
        )
          ? red
          : totalSafe.ecartPoints >
            safePdfNumber(
              meta.green
            )
            ? orange
            : green
    }
  ];


  kpis.forEach(
    (
      kpi,
      index
    ) => {
      const x =
        M +
        index *
          (
            kpiW +
            kpiGap
          );


      pdfRect(
        doc,
        x,
        kpiY,
        kpiW,
        kpiH,
        white,
        2
      );


      pdfRect(
        doc,
        x,
        kpiY,
        1.8,
        kpiH,
        kpi.color,
        0.8
      );


      pdfText(
        doc,
        kpi.label,
        x + 5,
        kpiY + 6,
        {
          size: 4.6,
          color: muted,
          bold: true
        }
      );


      pdfText(
        doc,
        kpi.value,
        x + 5,
        kpiY + 14,
        {
          size: 9.5,
          color: navy,
          bold: true
        }
      );
    }
  );


  /* =======================================================
     SECTION TITRE
     ======================================================= */

  const sectionY = 53;

  pdfText(
    doc,
    "SYNTHÈSE DE PILOTAGE",
    M,
    sectionY,
    {
      size: 8,
      color: navy,
      bold: true
    }
  );


  pdfText(
    doc,
    `${rows.length} métier${
      rows.length > 1
        ? "s"
        : ""
    } analysé${
      rows.length > 1
        ? "s"
        : ""
    }`,
    PAGE_W - M,
    sectionY,
    {
      size: 5.5,
      color: muted,
      align: "right"
    }
  );


  /* =======================================================
     TABLEAU + ANALYSE
     ======================================================= */

  const mainY = 57;

  const tableX = M;
  const tableW = 165;

  const analysisX =
    tableX +
    tableW +
    4;

  const analysisW =
    PAGE_W -
    M -
    analysisX;

  const mainH = 66;


  /* =======================================================
     TABLEAU
     ======================================================= */

  pdfRect(
    doc,
    tableX,
    mainY,
    tableW,
    mainH,
    white,
    2
  );


  /*
   * Colonnes
   */
  const cols = [
    {
      label: "Métier",
      width: 34
    },
    {
      label: "Cons.",
      width: 19
    },
    {
      label: "B. date",
      width: 19
    },
    {
      label: "B. alloué",
      width: 20
    },
    {
      label: "Reste",
      width: 19
    },
    {
      label: "Conso.",
      width: 17
    },
    {
      label: "Écart h",
      width: 18
    },
    {
      label: "Écart pts",
      width: 19
    }
  ];


  const headerH = 8;


  pdfRect(
    doc,
    tableX,
    mainY,
    tableW,
    headerH,
    [
      241,
      245,
      249
    ],
    2
  );


  let cx =
    tableX;


  cols.forEach(
    col => {
      pdfText(
        doc,
        col.label,
        cx + 1.5,
        mainY + 5.2,
        {
          size: 4.3,
          color: muted,
          bold: true
        }
      );

      cx +=
        col.width;
    }
  );


  /*
   * Hauteur dynamique.
   *
   * On réserve environ 52 mm au tableau.
   * Même avec beaucoup de métiers, les lignes
   * sont compactées pour rester sur une page.
   */
  const availableRowsH =
    mainH -
    headerH -
    6;

  const maxRowHeight = 4.2;

  const minRowHeight =
    rows.length > 18
      ? 2.65
      : rows.length > 14
        ? 3.05
        : 3.6;

  const calculatedRowH =
    rows.length > 0
      ? Math.min(
          maxRowHeight,
          availableRowsH /
            rows.length
        )
      : minRowHeight;

  const rowH =
    Math.max(
      2.35,
      Math.min(
        calculatedRowH,
        minRowHeight
      )
    );


  const displayRows =
    rows;


  displayRows.forEach(
    (
      r,
      index
    ) => {
      const y =
        mainY +
        headerH +
        index *
          rowH;


      /*
       * Alternance
       */
      if (
        index % 2 === 1
      ) {
        pdfRect(
          doc,
          tableX,
          y,
          tableW,
          rowH,
          [
            248,
            250,
            252
          ]
        );
      }


      let x =
        tableX;


      const values = [
        pdfSafeText(
          r.metier
        ),

        pdfHours(
          r.encouru
        ),

        pdfHours(
          r.budgetDate
        ),

        pdfHours(
          r.budgetAlloue
        ),

        pdfHours(
          r.reste
        ),

        `${pdfPercent(
          r.consoReelle
        )}%`,

        `${pdfSigned(
          r.ecartH
        )}`,

        `${pdfSignedPoints(
          r.ecartPoints
        )}`
      ];


      values.forEach(
        (
          value,
          colIndex
        ) => {

          let color =
            slate;

          let bold =
            colIndex === 0;


          /*
           * Couleur des écarts
           */
          if (
            colIndex === 6
          ) {
            color =
              r.ecartH > 0
                ? red
                : green;

            bold = true;
          }


          if (
            colIndex === 7
          ) {
            color =
              r.ecartPoints >
              0
                ? orange
                : green;

            bold = true;
          }


          if (
            colIndex === 5
          ) {
            color =
              blue;
          }


          pdfFitText(
            doc,
            value,
            x + 1.5,
            y +
              rowH -
              0.9,
            cols[
              colIndex
            ].width -
              3,
            {
              size:
                colIndex ===
                0
                  ? 4.1
                  : 3.8,
              color,
              bold
            }
          );


          x +=
            cols[
              colIndex
            ].width;
        }
      );
    }
  );


  /*
   * Ligne TOTAL
   */
  const totalRowY =
    mainY +
    headerH +
    rows.length *
      rowH;


  if (
    totalRowY +
      rowH <=
    mainY +
      mainH
  ) {

    pdfRect(
      doc,
      tableX,
      totalRowY,
      tableW,
      rowH + 0.5,
      [
        226,
        232,
        240
      ]
    );


    let x =
      tableX;


    const totalValues = [
      "TOTAL",

      pdfHours(
        totalSafe.encouru
      ),

      pdfHours(
        totalSafe.budgetDate
      ),

      pdfHours(
        totalSafe.budgetAlloue
      ),

      pdfHours(
        totalSafe.reste
      ),

      `${pdfPercent(
        totalSafe.consoReelle
      )}%`,

      pdfSigned(
        totalSafe.ecartH
      ),

      pdfSignedPoints(
        totalSafe.ecartPoints
      )
    ];


    totalValues.forEach(
      (
        value,
        colIndex
      ) => {

        const color =
          colIndex === 6
            ? (
                totalSafe.ecartH >
                0
                  ? red
                  : green
              )
            : colIndex === 7
              ? (
                  totalSafe.ecartPoints >
                  0
                    ? orange
                    : green
                )
              : navy;


        pdfFitText(
          doc,
          value,
          x + 1.5,
          totalRowY +
            rowH -
            0.8,
          cols[
            colIndex
          ].width -
            3,
          {
            size: 3.9,
            color,
            bold: true
          }
        );


        x +=
          cols[
            colIndex
          ].width;
      }
    );
  }


  /* =======================================================
     BLOC ANALYSE
     ======================================================= */

  pdfRect(
    doc,
    analysisX,
    mainY,
    analysisW,
    mainH,
    white,
    2
  );


  pdfText(
    doc,
    "ANALYSE DE LA SITUATION",
    analysisX + 5,
    mainY + 8,
    {
      size: 7,
      color: navy,
      bold: true
    }
  );


  pdfLine(
    doc,
    analysisX + 5,
    mainY + 11,
    analysisX +
      analysisW -
      5,
    mainY + 11,
    border,
    0.3
  );


  /*
   * Message principal
   */
  let analysisMessage;


  if (
    totalSafe.ecartH > 0
  ) {
    analysisMessage =
      `La consommation est supérieure au budget à date de ${pdfHours(
        totalSafe.ecartH
      )} h.`;
  } else if (
    totalSafe.ecartH < 0
  ) {
    analysisMessage =
      `La consommation reste inférieure au budget à date de ${pdfHours(
        Math.abs(
          totalSafe.ecartH
        )
      )} h.`;
  } else {
    analysisMessage =
      "La consommation est alignée avec le budget à date.";
  }


  const messageLines =
    doc.splitTextToSize(
      analysisMessage,
      analysisW - 10
    );


  messageLines
    .slice(0, 3)
    .forEach(
      (
        line,
        i
      ) => {
        pdfText(
          doc,
          line,
          analysisX + 5,
          mainY +
            18 +
            i * 4,
          {
            size: 5.6,
            color:
              totalSafe.ecartH >
              0
                ? red
                : green,
            bold: true
          }
        );
      }
    );


  /*
   * Mini KPI analyse
   */
  const miniY =
    mainY + 31;

  const miniGap = 3;

  const miniW =
    (
      analysisW -
      10 -
      2 * miniGap
    ) / 3;


  const mini = [
    {
      label:
        "Conso. réelle",
      value:
        `${pdfPercent(
          totalSafe.consoReelle
        )}%`,
      color:
        blue
    },

    {
      label:
        "Conso. à date",
      value:
        `${pdfPercent(
          totalSafe.consoDate
        )}%`,
      color:
        orange
    },

    {
      label:
        "Écart",
      value:
        `${pdfSignedPoints(
          totalSafe.ecartPoints
        )}`,
      color:
        totalSafe.ecartPoints >
        0
          ? red
          : green
    }
  ];


  mini.forEach(
    (
      item,
      index
    ) => {
      const x =
        analysisX +
        5 +
        index *
          (
            miniW +
            miniGap
          );


      pdfRect(
        doc,
        x,
        miniY,
        miniW,
        17,
        [
          248,
          250,
          252
        ],
        1.5
      );


      pdfText(
        doc,
        item.label,
        x + 3,
        miniY + 5,
        {
          size: 4.1,
          color: muted,
          bold: true
        }
      );


      pdfText(
        doc,
        item.value,
        x + 3,
        miniY + 12.5,
        {
          size: 7.5,
          color: item.color,
          bold: true
        }
      );
    }
  );


  /*
   * Situation métiers
   */
  const situationY =
    mainY + 52;


  pdfText(
    doc,
    `${nbVigilance} métier${
      nbVigilance > 1
        ? "s"
        : ""
    } en vigilance ou dépassement`,
    analysisX + 5,
    situationY,
    {
      size: 5,
      color:
        nbVigilance > 0
          ? orange
          : green,
      bold: true
    }
  );


  if (
    nbRouge > 0
  ) {
    pdfText(
      doc,
      `${nbRouge} dépassement${
        nbRouge > 1
          ? "s"
          : ""
      } identifié${
        nbRouge > 1
          ? "s"
          : ""
      }`,
      analysisX + 5,
      situationY + 6,
      {
        size: 5,
        color: red,
        bold: true
      }
    );
  } else {
    pdfText(
      doc,
      "Aucun dépassement critique identifié",
      analysisX + 5,
      situationY + 6,
      {
        size: 5,
        color: green,
        bold: true
      }
    );
  }


  /*
   * Métier le plus en écart
   */
  if (
    topProblem &&
    topProblem.ecartH > 0
  ) {

    pdfFitText(
      doc,
      `Point d'attention : ${topProblem.metier} (+${pdfHours(
        topProblem.ecartH
      )} h)`,
      analysisX + 5,
      situationY + 12,
      analysisW - 10,
      {
        size: 4.7,
        color: red,
        bold: true
      }
    );
  }


  /* =======================================================
     SECTION GRAPHIQUES
     ======================================================= */

  const chartSectionY =
    128;


  pdfText(
    doc,
    "INDICATEURS PAR MÉTIER",
    M,
    chartSectionY,
    {
      size: 8,
      color: navy,
      bold: true
    }
  );


  pdfText(
    doc,
    "Lecture directe de la consommation et de la trajectoire budgétaire",
    PAGE_W - M,
    chartSectionY,
    {
      size: 5,
      color: muted,
      align: "right"
    }
  );


  /* =======================================================
     FONCTION GRAPHIQUE HORIZONTAL
     ======================================================= */

  function drawHorizontalBarChart({
    x,
    y,
    width,
    height,
    title,
    rows,
    firstKey,
    secondKey,
    firstColor,
    secondColor,
    firstLabel,
    secondLabel
  }) {

    pdfRect(
      doc,
      x,
      y,
      width,
      height,
      white,
      2
    );


    /*
     * Titre
     */
    pdfText(
      doc,
      title,
      x + 5,
      y + 7,
      {
        size: 6.5,
        color: navy,
        bold: true
      }
    );


    /*
     * Légende
     */
    const legendY =
      y + 6;


    doc.setFillColor(
      ...firstColor
    );

    doc.rect(
      x + width - 82,
      legendY - 3,
      3,
      3,
      "F"
    );


    pdfText(
      doc,
      firstLabel,
      x + width - 77,
      legendY,
      {
        size: 4.2,
        color: muted
      }
    );


    doc.setFillColor(
      ...secondColor
    );

    doc.rect(
      x + width - 42,
      legendY - 3,
      3,
      3,
      "F"
    );


    pdfText(
      doc,
      secondLabel,
      x + width - 37,
      legendY,
      {
        size: 4.2,
        color: muted
      }
    );


    /*
     * Zone graphique
     */
    const labelW = 37;

    const left =
      x + labelW;

    const right =
      x + width - 7;

    const top =
      y + 12;

    const bottom =
      y + height - 5;

    const plotW =
      right - left;

    const plotH =
      bottom - top;


    /*
     * Valeurs
     */
    const maxValue =
      Math.max(
        1,
        ...rows.flatMap(
          r => [
            Math.max(
              0,
              safePdfNumber(
                r[firstKey]
              )
            ),

            Math.max(
              0,
              safePdfNumber(
                r[secondKey]
              )
            )
          ]
        )
      );


    /*
     * Échelle agréable.
     */
    const niceMax =
      Math.ceil(
        maxValue /
          (
            maxValue > 1000
              ? 500
              : maxValue > 500
                ? 100
                : maxValue > 100
                  ? 50
                  : maxValue > 20
                    ? 10
                    : 5
          )
      ) *
      (
        maxValue > 1000
          ? 500
          : maxValue > 500
            ? 100
            : maxValue > 100
              ? 50
              : maxValue > 20
                ? 10
                : 5
      );


    const axisMax =
      Math.max(
        niceMax,
        maxValue
      );


    /*
     * Grille
     */
    const gridSteps = 4;


    for (
      let i = 0;
      i <= gridSteps;
      i++
    ) {

      const ratio =
        i /
        gridSteps;

      const gx =
        left +
        plotW *
          ratio;


      pdfLine(
        doc,
        gx,
        top,
        gx,
        bottom,
        grid,
        0.2
      );


      pdfText(
        doc,
        pdfHours(
          axisMax *
            ratio
        ),
        gx,
        top - 1.3,
        {
          size: 3.2,
          color: muted,
          align:
            i === 0
              ? "left"
              : i === gridSteps
                ? "right"
                : "center"
        }
      );
    }


    /*
     * Aucun métier
     */
    if (
      rows.length === 0
    ) {

      pdfText(
        doc,
        "Aucune donnée disponible",
        x +
          width / 2,
        y +
          height / 2,
        {
          size: 6,
          color: muted,
          align: "center"
        }
      );

      return;
    }


    /*
     * Hauteur par métier.
     *
     * Tous les métiers sont rendus.
     */
    const rowH =
      plotH /
      rows.length;


    rows.forEach(
      (
        r,
        index
      ) => {

        const rowY =
          top +
          index *
            rowH;


        /*
         * Ligne de fond très légère
         */
        if (
          index % 2 === 1
        ) {
          pdfRect(
            doc,
            left,
            rowY,
            plotW,
            rowH,
            [
              252,
              252,
              253
            ]
          );
        }


        /*
         * Libellé métier
         */
        pdfFitText(
          doc,
          r.metier,
          x + 2,
          rowY +
            rowH *
              0.64,
          labelW - 5,
          {
            size:
              rows.length > 16
                ? 3.2
                : 3.6,
            color: slate,
            bold: true
          }
        );


        const v1 =
          Math.max(
            0,
            safePdfNumber(
              r[firstKey]
            )
          );

        const v2 =
          Math.max(
            0,
            safePdfNumber(
              r[secondKey]
            )
          );


        /*
         * Deux barres fines.
         */
        const barH =
          Math.max(
            0.75,
            Math.min(
              2.3,
              rowH *
                0.25
            )
          );


        const bar1Y =
          rowY +
          rowH *
            0.12;

        const bar2Y =
          rowY +
          rowH *
            0.55;


        /*
         * Barre 1
         */
        if (
          v1 > 0
        ) {
          doc.setFillColor(
            ...firstColor
          );

          doc.rect(
            left,
            bar1Y,
            plotW *
              (
                v1 /
                axisMax
              ),
            barH,
            "F"
          );
        }


        /*
         * Barre 2
         */
        if (
          v2 > 0
        ) {
          doc.setFillColor(
            ...secondColor
          );

          doc.rect(
            left,
            bar2Y,
            plotW *
              (
                v2 /
                axisMax
              ),
            barH,
            "F"
          );
        }


        /*
         * Valeurs au bout des barres.
         */
        if (
          rowH >= 3
        ) {

          if (
            v1 > 0
          ) {

            const valueX =
              left +
              plotW *
                (
                  v1 /
                  axisMax
                ) +
              1.5;

            pdfText(
              doc,
              pdfHours(v1),
              Math.min(
                valueX,
                right - 1
              ),
              bar1Y +
                barH -
                0.1,
              {
                size:
                  rows.length > 16
                    ? 2.9
                    : 3.2,
                color:
                  firstColor,
                bold: true
              }
            );
          }


          if (
            v2 > 0
          ) {

            const valueX =
              left +
              plotW *
                (
                  v2 /
                  axisMax
                ) +
              1.5;

            pdfText(
              doc,
              pdfHours(v2),
              Math.min(
                valueX,
                right - 1
              ),
              bar2Y +
                barH -
                0.1,
              {
                size:
                  rows.length > 16
                    ? 2.9
                    : 3.2,
                color:
                  secondColor,
                bold: true
              }
            );
          }
        }
      }
    );
  }


  /* =======================================================
     GRAPHIQUE 1
     ======================================================= */

  const chartY =
    chartSectionY + 4;

  const chartGap = 4;

  const chartW =
    (
      PAGE_W -
      2 * M -
      chartGap
    ) / 2;

  const chartH = 68;


  drawHorizontalBarChart({
    x: M,
    y: chartY,
    width: chartW,
    height: chartH,

    title:
      "Budget alloué vs consommé",

    rows,

    firstKey:
      "budgetAlloue",

    secondKey:
      "encouru",

    firstColor:
      [148, 163, 184],

    secondColor:
      blue,

    firstLabel:
      "Budget alloué",

    secondLabel:
      "Consommé"
  });


  /* =======================================================
     GRAPHIQUE 2
     ======================================================= */

  drawHorizontalBarChart({
    x:
      M +
      chartW +
      chartGap,

    y: chartY,

    width: chartW,

    height: chartH,

    title:
      "Consommé vs budget à date",

    rows,

    firstKey:
      "budgetDate",

    secondKey:
      "encouru",

    firstColor:
      [134, 239, 172],

    secondColor:
      cyan,

    firstLabel:
      "Budget à date",

    secondLabel:
      "Consommé"
  });


  /* =======================================================
     BARRE DE SITUATION EN BAS
     ======================================================= */

  const bottomY =
    198;


  /*
   * Ligne de séparation
   */
  pdfLine(
    doc,
    M,
    bottomY - 5,
    PAGE_W - M,
    bottomY - 5,
    border,
    0.3
  );


  pdfText(
    doc,
    "PilotageH · Rapport généré automatiquement",
    M,
    bottomY,
    {
      size: 4.5,
      color: muted
    }
  );


  pdfText(
    doc,
    affaire
      ? `Analyse filtrée : ${affaire}`
      : "Analyse globale",
    PAGE_W / 2,
    bottomY,
    {
      size: 4.5,
      color: muted,
      align: "center"
    }
  );


  pdfText(
    doc,
    `${rows.length} métier${
      rows.length > 1
        ? "s"
        : ""
    }`,
    PAGE_W - M,
    bottomY,
    {
      size: 4.5,
      color: muted,
      align: "right"
    }
  );


  /* =======================================================
     NOM DU FICHIER
     ======================================================= */

  const safeAffaire =
    String(
      affaire ||
        "global"
    )
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9-_]/g,
        "_"
      )
      .slice(
        0,
        50
      );


  const safeMetier =
    String(
      metierFiltre ||
        ""
    )
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9-_]/g,
        "_"
      )
      .slice(
        0,
        30
      );


  const suffix =
    safeMetier
      ? `_${safeMetier}`
      : "";


  doc.save(
    `pilotageh_rapport_${safeAffaire}${suffix}.pdf`
  );
}


/* =========================================================
   HOOK GLOBAL DES DONNÉES
   ========================================================= */

function useData() {

  const [rows, setRows] =
    useState([]);

  const [settings, setSettings] =
    useState(
      loadSettings()
    );


  useEffect(() => {

    let mounted = true;


    const load = async () => {

      try {

        const data =
          await loadData();


        if (!mounted) {
          return;
        }


        syncMetiers(
          data
        );


        setRows(
          data
        );

      } catch (
        error
      ) {

        console.error(
          "Erreur chargement des données :",
          error
        );

      }

    };


    load();


    const onData = () => {
      load();
    };


    const onSettings = () => {

      if (mounted) {

        setSettings(
          loadSettings()
        );

      }

    };


    window.addEventListener(
      "pilotageh-data",
      onData
    );


    window.addEventListener(
      "pilotageh-settings",
      onSettings
    );


    const unsubscribeRealtime =
      subscribeToDataChanges();


    return () => {

      mounted = false;


      window.removeEventListener(
        "pilotageh-data",
        onData
      );


      window.removeEventListener(
        "pilotageh-settings",
        onSettings
      );


      if (
        typeof unsubscribeRealtime ===
        "function"
      ) {

        unsubscribeRealtime();

      }

    };

  }, []);


  return {
    rows,
    settings
  };
}


/* =========================================================
   HEADER
   ========================================================= */

function Header({
  title,
  subtitle,
  actions
}) {

  return (
    <div className="pagehead">

      <div>

        <h1>
          {title}
        </h1>

        <p>
          {subtitle}
        </p>

      </div>


      <div className="actions">
        {actions}
      </div>

    </div>
  );
}


/* =========================================================
   GRAPHIQUE MÉTIERS
   ========================================================= */

function MetiersBarChart({
  data,
  bars,
  yAxisUnit
}) {

  const chartWidth =
    Math.max(
      100,
      data.length * 120
    );


  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        paddingBottom: "8px"
      }}
    >

      <div
        style={{
          width:
            `${chartWidth}px`,
          minWidth: "100%",
          height: "300px"
        }}
      >

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 20,
              bottom: 65,
              left: 0
            }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="metier"
              interval={0}
              angle={-25}
              textAnchor="end"
              height={80}
              tick={{
                fontSize: 10
              }}
            />

            <YAxis
              unit={
                yAxisUnit ||
                ""
              }
            />

            <Tooltip />

            {bars.length > 1 && (
              <Legend />
            )}

            {bars.map(
              bar => (
                <Bar
                  key={
                    bar.dataKey
                  }
                  dataKey={
                    bar.dataKey
                  }
                  name={
                    bar.name
                  }
                  fill={
                    bar.fill
                  }
                />
              )
            )}

          </BarChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function Dashboard() {

  const {
    rows,
    settings
  } = useData();


  const [
    searchParams,
    setSearchParams
  ] = useSearchParams();


  const [
    filters,
    setFilters
  ] = useState(
    () => ({
      affaire:
        searchParams.get(
          "affaire"
        ) || "",

      metier:
        searchParams.get(
          "metier"
        ) || "",

      date:
        searchParams.get(
          "date"
        ) || ""
    })
  );


  useEffect(() => {

    const params = {};


    if (
      filters.affaire
    ) {
      params.affaire =
        filters.affaire;
    }


    if (
      filters.metier
    ) {
      params.metier =
        filters.metier;
    }


    if (
      filters.date
    ) {
      params.date =
        filters.date;
    }


    setSearchParams(
      params,
      {
        replace: true
      }
    );

  }, [
    filters,
    setSearchParams
  ]);


  const s =
    useMemo(
      () =>
        synthese(
          rows,
          METIERS,
          filters,
          settings
        ),
      [
        rows,
        filters,
        settings
      ]
    );


  const t =
    s.total;


  const affairs =
    distinct(
      rows,
      "affaire"
    ).length;


  const pieData =
    s.lignes.filter(
      x =>
        x.encouru > 0
    );


  const handlePDF =
    () => {

      exportProfessionalPDF(
        s.lignes,
        t,
        {
          date:
            settings.dateAnalyse,

          affaire:
            filters.affaire ||
            "",

          metier:
            filters.metier ||
            "",

          green:
            settings.green,

          orange:
            settings.orange
        }
      );

    };


  return (
    <>

      <Header
        title="Dashboard de pilotage"
        subtitle={
          `Consommation des heures par métier · ` +
          `${affairs} affaire${
            affairs > 1
              ? "s"
              : ""
          }`
        }
        actions={
          <>

            <button
              className="btn"
              onClick={() =>
                exportExcel(
                  s.lignes,
                  t
                )
              }
            >
              <FileSpreadsheet
                size={15}
              />
              Excel
            </button>


            <button
              className="btn"
              onClick={() =>
                exportCSV(
                  s.lignes,
                  t
                )
              }
            >
              <Download
                size={15}
              />
              CSV
            </button>


            <button
              className="btn"
              onClick={
                handlePDF
              }
            >
              <FileText
                size={15}
              />
              PDF
            </button>

          </>
        }
      />


      <Filters
        rows={rows}
        filters={filters}
        setFilters={
          setFilters
        }
      />


      <div className="kpis">

        <KPI
          label="Budget alloué"
          value={
            fmt(
              t.budgetAlloue
            )
          }
          unit="h"
        />


        <KPI
          label="Heures consommées"
          value={
            fmt(
              t.encouru
            )
          }
          unit="h"
          kind="blue"
        />


        <KPI
          label="Budget à date"
          value={
            fmt(
              t.budgetDate
            )
          }
          unit="h"
          kind="green"
        />


        <KPI
          label="Écart consommé / date"
          value={
            sign(
              t.ecartH
            )
          }
          unit="h"
          kind={
            t.ecartH > 0
              ? "red"
              : "green"
          }
          sub={
            t.ecartH > 0
              ? "au-dessus du budget à date"
              : "sous le budget à date"
          }
        />


        <KPI
          label="Consommation"
          value={
            fmt1(
              t.consoReelle
            )
          }
          unit="%"
          kind="amber"
          sub={
            `budget à date ${fmt1(
              t.consoDate
            )} %`
          }
        />


        <KPI
          label="Écart au théorique"
          value={
            sign(
              t.ecartPoints
            )
          }
          unit="pts"
          kind={
            t.ecartPoints >
            settings.orange
              ? "red"
              : t.ecartPoints >
                settings.green
                ? "amber"
                : "green"
          }
        />

      </div>


      <Table
        lignes={
          s.lignes
        }
        total={t}
        filters={
          filters
        }
      />


      <div className="grid2">

        <Card
          title="Budget alloué vs consommé"
          subtitle="Comparaison par métier"
        >

          <MetiersBarChart
            data={
              s.lignes
            }
            bars={[
              {
                dataKey:
                  "budgetAlloue",
                name:
                  "Budget alloué",
                fill:
                  "#94a3b8"
              },
              {
                dataKey:
                  "encouru",
                name:
                  "Consommé",
                fill:
                  "#2563eb"
              }
            ]}
          />

        </Card>


        <Card
          title="Consommé vs budget à date"
          subtitle="Indicateur principal de pilotage"
          highlight
        >

          <MetiersBarChart
            data={
              s.lignes
            }
            bars={[
              {
                dataKey:
                  "budgetDate",
                name:
                  "Budget à date",
                fill:
                  "#a7f3d0"
              },
              {
                dataKey:
                  "encouru",
                name:
                  "Consommé",
                fill:
                  "#0891b2"
              }
            ]}
          />

        </Card>


        <Card
          title="Taux de consommation"
          subtitle="Consommé / budget alloué"
        >

          <MetiersBarChart
            data={
              s.lignes
            }
            yAxisUnit="%"
            bars={[
              {
                dataKey:
                  "consoReelle",
                name:
                  "Consommation réelle",
                fill:
                  "#2563eb"
              },
              {
                dataKey:
                  "consoDate",
                name:
                  "Budget à date",
                fill:
                  "#cbd5e1"
              }
            ]}
          />

        </Card>


        <Card
          title="Répartition des heures consommées"
          subtitle="Part de chaque métier"
        >

          <ResponsiveContainer
            width="100%"
            height={300}
          >

            <PieChart>

              <Pie
                data={
                  pieData
                }
                dataKey="encouru"
                nameKey="metier"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >

                {pieData.map(
                  (
                    x,
                    index
                  ) => (

                    <Cell
                      key={
                        `${x.metier}-${index}`
                      }
                      fill={
                        COLORS[
                          x.metier
                        ] ||
                        "#64748b"
                      }
                    />

                  )
                )}

              </Pie>

              <Tooltip />

              <Legend />

            </PieChart>

          </ResponsiveContainer>

        </Card>

      </div>

    </>
  );
}


/* =========================================================
   LOGIN
   ========================================================= */

function Login() {

  const nav =
    useNavigate();


  const [
    email,
    setEmail
  ] = useState("");


  const [
    password,
    setPassword
  ] = useState("");


  const [
    busy,
    setBusy
  ] = useState(false);


  const [
    error,
    setError
  ] = useState("");


  const handleSubmit =
    async e => {

      e.preventDefault();

      setBusy(true);
      setError("");


      try {

        await signIn(
          email,
          password
        );

        nav(
          "/imports"
        );

      } catch (
        err
      ) {

        console.error(
          "Erreur connexion :",
          err
        );

        setError(
          "E-mail ou mot de passe incorrect."
        );

      } finally {

        setBusy(false);

      }

    };


  return (
    <div className="loginpage">

      <Card
        title="Administration PilotageH"
        subtitle={
          "Connectez-vous pour accéder " +
          "aux fonctions d'administration."
        }
      >

        <form
          onSubmit={
            handleSubmit
          }
          className="loginform"
        >

          <label>
            Adresse e-mail

            <input
              type="email"
              value={
                email
              }
              onChange={
                e =>
                  setEmail(
                    e.target.value
                  )
              }
              placeholder="votre@email.fr"
              required
            />

          </label>


          <label>
            Mot de passe

            <input
              type="password"
              value={
                password
              }
              onChange={
                e =>
                  setPassword(
                    e.target.value
                  )
              }
              placeholder="••••••••"
              required
            />

          </label>


          {error && (
            <div className="notice danger">
              {error}
            </div>
          )}


          <button
            className="btn primary"
            type="submit"
            disabled={
              busy
            }
          >
            {busy
              ? "Connexion…"
              : "Se connecter"}
          </button>


          <button
            type="button"
            className="btn"
            onClick={() =>
              nav("/")
            }
          >
            <ArrowLeft
              size={15}
            />
            Retour au dashboard
          </button>

        </form>

      </Card>

    </div>
  );
}


/* =========================================================
   ROUTE PROTÉGÉE
   ========================================================= */

function ProtectedRoute({
  children
}) {

  const nav =
    useNavigate();


  const [
    session,
    setSession
  ] = useState(
    undefined
  );


  useEffect(() => {

    let mounted = true;


    getSession()
      .then(
        s => {

          if (mounted) {
            setSession(
              s
            );
          }

        }
      )
      .catch(
        error => {

          console.error(
            "Erreur récupération session :",
            error
          );

          if (mounted) {
            setSession(
              null
            );
          }

        }
      );


    const authSubscription =
      subscribeToAuth(
        s => {

          if (mounted) {
            setSession(
              s
            );
          }

        }
      );


    return () => {

      mounted = false;


      if (
        authSubscription?.data
          ?.subscription
          ?.unsubscribe
      ) {

        authSubscription
          .data
          .subscription
          .unsubscribe();

      }

    };

  }, []);


  if (
    session ===
    undefined
  ) {

    return (
      <div className="empty">
        Vérification de la connexion…
      </div>
    );

  }


  if (!session) {

    return (
      <LoginRedirect
        nav={nav}
      />
    );

  }


  return children;
}


/* =========================================================
   REDIRECTION LOGIN
   ========================================================= */

function LoginRedirect({
  nav
}) {

  useEffect(() => {

    nav(
      "/login",
      {
        replace: true
      }
    );

  }, [nav]);


  return (
    <div className="empty">
      Redirection vers la connexion…
    </div>
  );
}


/* =========================================================
   IMPORT EXCEL
   ========================================================= */

function Imports() {

  const {
    rows
  } = useData();


  const [
    preview,
    setPreview
  ] = useState(null);


  const [
    busy,
    setBusy
  ] = useState(false);


  const [
    msg,
    setMsg
  ] = useState("");


  const [
    msgType,
    setMsgType
  ] = useState(
    "success"
  );


  const handle =
    async e => {

      const file =
        e.target.files?.[0];


      if (!file) {
        return;
      }


      setBusy(true);
      setMsg("");
      setMsgType(
        "success"
      );


      try {

        const result =
          await readWorkbook(
            file
          );


        setPreview(
          result
        );

      } catch (
        err
      ) {

        console.error(
          "Erreur lecture Excel :",
          err
        );


        setMsg(
          "Erreur de lecture : " +
          err.message
        );


        setMsgType(
          "danger"
        );

      } finally {

        setBusy(false);

        e.target.value =
          "";

      }

    };


  const validate =
    async () => {

      if (!preview) {
        return;
      }


      if (
        preview.missing?.length
      ) {

        setMsg(
          "Impossible d'importer : certaines colonnes obligatoires sont manquantes."
        );


        setMsgType(
          "danger"
        );

        return;

      }


      if (
        !preview.valid?.length
      ) {

        setMsg(
          "Aucune ligne valide à importer."
        );


        setMsgType(
          "danger"
        );

        return;

      }


      setBusy(true);


      try {

        await saveData(
          preview.valid
        );


        setPreview(
          null
        );


        setMsg(
          `${preview.valid.length} ligne(s) importée(s). ` +
          `Les anciennes données ont été remplacées.`
        );


        setMsgType(
          "success"
        );

      } catch (
        err
      ) {

        console.error(
          "Erreur import :",
          err
        );


        setMsg(
          "Erreur lors de l'import : " +
          err.message
        );


        setMsgType(
          "danger"
        );

      } finally {

        setBusy(false);

      }

    };


  return (
    <>

      <Header
        title="Données / Import"
        subtitle={
          "Un seul fichier Excel alimente " +
          "désormais toute l'application."
        }
        actions={

          <button
            className="btn"
            onClick={
              downloadTemplate
            }
          >

            <FileSpreadsheet
              size={15}
            />

            Télécharger le modèle Excel

          </button>

        }
      />


      <div className="importinfo">

        <b>
          Format attendu
        </b>

        <span>
          Affaire
        </span>

        <span>
          Métier
        </span>

        <span>
          Heures consommées
        </span>

        <span>
          Budget à date
        </span>

        <span>
          Budget alloué
        </span>

        <span>
          Date (optionnelle)
        </span>

      </div>


      <Card
        title="Importer le fichier d'alimentation"
        subtitle={
          "Les colonnes sont reconnues automatiquement."
        }
      >

        <label className="drop">

          <Upload
            size={30}
          />

          <b>
            {busy
              ? "Traitement du fichier…"
              : "Cliquez pour sélectionner votre Excel"}
          </b>

          <small>
            .xlsx, .xls ou .csv · un seul fichier
          </small>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={
              handle
            }
          />

        </label>


        {msg && (

          <div
            className={
              `notice ${msgType}`
            }
          >
            {msg}
          </div>

        )}


        {preview && (

          <div className="preview">

            <div className="previewhead">

              <div>

                <b>
                  {
                    preview
                      .valid
                      .length
                  }
                  {" "}ligne(s) valide(s)
                  {" / "}
                  {
                    preview
                      .rows
                      .length
                  }
                </b>


                {preview.missing.length > 0 && (

                  <div className="notice danger">

                    Colonnes manquantes :
                    {" "}
                    {
                      preview
                        .missing
                        .join(
                          ", "
                        )
                    }

                  </div>

                )}


                {preview.errors.length > 0 && (

                  <div className="notice warn">

                    <AlertTriangle
                      size={15}
                    />

                    {" "}
                    {
                      preview
                        .errors
                        .length
                    }
                    {" "}ligne(s) en erreur

                  </div>

                )}

              </div>


              <div>

                <button
                  className="btn"
                  onClick={() =>
                    setPreview(
                      null
                    )
                  }
                >
                  Annuler
                </button>


                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    preview.valid.length === 0 ||
                    preview.missing.length > 0
                  }
                  onClick={
                    validate
                  }
                >

                  <CheckCircle2
                    size={15}
                  />

                  {busy
                    ? "Importation…"
                    : "Remplacer les données"}

                </button>

              </div>

            </div>


            <div className="tablewrap">

              <table>

                <thead>

                  <tr>

                    <th>
                      Affaire
                    </th>

                    <th>
                      Métier
                    </th>

                    <th>
                      Consommé
                    </th>

                    <th>
                      Budget date
                    </th>

                    <th>
                      Budget alloué
                    </th>

                    <th>
                      Date
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {preview.rows
                    .slice(
                      0,
                      100
                    )
                    .map(
                      row => (

                        <tr
                          key={
                            row.id
                          }
                        >

                          <td>
                            {
                              row.affaire
                            }
                          </td>

                          <td>
                            {
                              row.metier
                            }
                          </td>

                          <td>
                            {
                              row.encouru
                            }
                          </td>

                          <td>
                            {
                              row.budgetDate
                            }
                          </td>

                          <td>
                            {
                              row.budgetAlloue
                            }
                          </td>

                          <td>
                            {
                              row.date ||
                              "—"
                            }
                          </td>

                        </tr>

                      )
                    )}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </Card>


      <div className="grid2">

        <Card
          title="Données actuellement chargées"
        >

          <div className="bigstat">

            {
              fmt(
                rows.length
              )
            }

            {" "}

            <small>
              lignes
            </small>

          </div>


          <p className="muted">
            Les données sont centralisées
            dans Supabase.
          </p>

        </Card>


        <Card
          title="Effacer les données"
        >

          <p className="muted">
            Cette action supprime toutes
            les données actuellement chargées.
          </p>


          <button
            className="btn dangerbtn"
            onClick={
              async () => {

                if (
                  !window.confirm(
                    "Supprimer toutes les données ?"
                  )
                ) {
                  return;
                }


                try {

                  await resetData();


                  setMsg(
                    "Données supprimées."
                  );


                  setMsgType(
                    "success"
                  );

                } catch (
                  err
                ) {

                  console.error(
                    "Erreur suppression :",
                    err
                  );


                  setMsg(
                    "Erreur suppression : " +
                    err.message
                  );


                  setMsgType(
                    "danger"
                  );

                }

              }
            }
          >

            <Trash2
              size={15}
            />

            Vider les données

          </button>

        </Card>

      </div>

    </>
  );
}


/* =========================================================
   ANALYSE
   ========================================================= */

function Analyse() {

  const {
    rows,
    settings
  } = useData();


  const [
    filters,
    setFilters
  ] = useState({});


  const [
    metier,
    setMetier
  ] = useState(
    "Tous"
  );


  const s =
    useMemo(
      () =>
        synthese(
          rows,
          METIERS,
          filters,
          settings
        ),
      [
        rows,
        filters,
        settings
      ]
    );


  useEffect(
    () => {

      if (
        metier !== "Tous" &&
        !METIERS.includes(
          metier
        )
      ) {

        setMetier(
          "Tous"
        );

      }

    },
    [
      rows,
      metier
    ]
  );


  const rs =
    metier === "Tous"
      ? s.filtered
      : s.filtered.filter(
          x =>
            x.metier ===
            metier
        );


  const dates =
    [
      ...new Set(
        rs
          .map(
            x =>
              x.date
          )
          .filter(Boolean)
      )
    ].sort();


  let cumul = 0;


  const serie =
    dates.map(
      date => {

        cumul +=
          rs
            .filter(
              x =>
                x.date ===
                date
            )
            .reduce(
              (
                a,
                x
              ) =>
                a +
                safePdfNumber(
                  x.encouru
                ),
              0
            );


        const budgetDate =
          rs
            .filter(
              x =>
                x.date ===
                date
            )
            .reduce(
              (
                a,
                x
              ) =>
                a +
                safePdfNumber(
                  x.budgetDate
                ),
              0
            );


        return {
          date,
          encouru:
            cumul,
          budgetDate
        };

      }
    );


  return (
    <>

      <Header
        title="Analyse"
        subtitle={
          "Analyse des écarts et évolution " +
          "des données importées"
        }
      />


      <Filters
        rows={
          rows
        }
        filters={
          filters
        }
        setFilters={
          setFilters
        }
      />


      <div className="selectbar">

        <b>
          Métier pour l'évolution :
        </b>


        <select
          value={
            metier
          }
          onChange={
            e =>
              setMetier(
                e.target.value
              )
          }
        >

          <option value="Tous">
            Tous
          </option>


          {METIERS.map(
            m => (

              <option
                key={m}
                value={m}
              >
                {m}
              </option>

            )
          )}

        </select>

      </div>


      <Card
        title={
          `Évolution temporelle — ${metier}`
        }
        subtitle={
          "Disponible si la colonne Date est présente " +
          "dans le fichier d'alimentation."
        }
      >

        {serie.length > 0 ? (

          <ResponsiveContainer
            width="100%"
            height={360}
          >

            <LineChart
              data={
                serie
              }
            >

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="date"
              />

              <YAxis />

              <Tooltip />

              <Legend />


              <ReferenceLine
                x={
                  settings.dateAnalyse
                }
                stroke="#94a3b8"
                strokeDasharray="4 4"
              />


              <Line
                dataKey="encouru"
                name="Consommé cumulé"
                stroke="#2563eb"
                strokeWidth={2.5}
              />


              <Line
                dataKey="budgetDate"
                name="Budget à date"
                stroke="#ea580c"
                strokeWidth={2}
                strokeDasharray="5 4"
              />

            </LineChart>

          </ResponsiveContainer>

        ) : (

          <div className="empty">
            Aucune date exploitable
            dans les données importées.
          </div>

        )}

      </Card>


      <div className="grid2">

        <Card
          title="Écart en heures par métier"
        >

          <MetiersBarChart
            data={
              s.lignes
            }
            bars={[
              {
                dataKey:
                  "ecartH",
                name:
                  "Écart (h)",
                fill:
                  "#0891b2"
              }
            ]}
          />

        </Card>


        <Card
          title="Écart en points"
        >

          <MetiersBarChart
            data={
              s.lignes
            }
            bars={[
              {
                dataKey:
                  "ecartPoints",
                name:
                  "Écart (pts)",
                fill:
                  "#7c3aed"
              }
            ]}
          />

        </Card>

      </div>

    </>
  );
}


/* =========================================================
   DETAIL MÉTIER
   ========================================================= */

function Detail() {

  const {
    nom
  } = useParams();


  const metier =
    decodeURIComponent(
      nom
    );


  const nav =
    useNavigate();


  const [
    searchParams
  ] = useSearchParams();


  const {
    rows,
    settings
  } = useData();


  const affaire =
    searchParams.get(
      "affaire"
    ) || "";


  const date =
    searchParams.get(
      "date"
    ) || "";


  const s =
    useMemo(
      () =>
        synthese(
          rows,
          METIERS,
          {
            metier,
            affaire,
            date
          },
          settings
        ),
      [
        rows,
        metier,
        affaire,
        date,
        settings
      ]
    );


  const r =
    s.lignes.find(
      x =>
        x.metier ===
        metier
    );


  if (!r) {

    return (
      <div className="empty">
        Métier introuvable.
      </div>
    );

  }


  const handleBack =
    () => {

      const params =
        new URLSearchParams();


      if (affaire) {
        params.set(
          "affaire",
          affaire
        );
      }


      if (date) {
        params.set(
          "date",
          date
        );
      }


      nav(
        `/?${params.toString()}`
      );

    };


  return (
    <>

      <Header
        title={
          metier
        }
        subtitle={
          `Détail du métier · analyse au ` +
          `${settings.dateAnalyse}` +
          (
            affaire
              ? ` · Affaire : ${affaire}`
              : ""
          )
        }
        actions={

          <button
            className="btn"
            onClick={
              handleBack
            }
          >

            <ArrowLeft
              size={15}
            />

            Retour

          </button>

        }
      />


      <div className="detailtop">

        <Status
          status={
            r.statut
          }
        />

      </div>


      <div className="kpis">

        <KPI
          label="Budget alloué"
          value={
            fmt(
              r.budgetAlloue
            )
          }
          unit="h"
        />


        <KPI
          label="Consommé"
          value={
            fmt(
              r.encouru
            )
          }
          unit="h"
          kind="blue"
        />


        <KPI
          label="Budget à date"
          value={
            fmt(
              r.budgetDate
            )
          }
          unit="h"
          kind="green"
        />


        <KPI
          label="Écart"
          value={
            sign(
              r.ecartH
            )
          }
          unit="h"
          kind={
            r.ecartH > 0
              ? "red"
              : "green"
          }
        />


        <KPI
          label="Conso réelle"
          value={
            fmt1(
              r.consoReelle
            )
          }
          unit="%"
        />


        <KPI
          label="Écart points"
          value={
            sign(
              r.ecartPoints
            )
          }
          unit="pts"
          kind={
            r.ecartPoints >
            settings.orange
              ? "red"
              : r.ecartPoints >
                settings.green
                ? "amber"
                : "green"
          }
        />

      </div>


      <div className="grid2">

        <Card
          title="Jauge de consommation"
        >

          <Gauge
            value={
              r.consoReelle
            }
            color={
              STATUS_COLORS[
                r.statut
              ] ||
              "#64748b"
            }
          />


          <div className="gaugeval">
            {
              pct(
                r.consoReelle
              )
            }
          </div>


          <div className="muted center">
            du budget alloué consommé
          </div>

        </Card>


        <Card
          title="Analyse"
        >

          <div
            className={
              `analysis ${
                r.ecartH > 0
                  ? "badbox"
                  : "goodbox"
              }`
            }
          >

            <b>
              {
                fmt(
                  Math.abs(
                    r.ecartH
                  )
                )
              }{" "}
              h
            </b>


            {
              r.ecartH > 0
                ? " consommées au-dessus du budget à date."
                : " de moins que le budget à date."
            }

          </div>


          <p>

            La consommation réelle
            est de{" "}

            <b>
              {
                pct(
                  r.consoReelle
                )
              }
            </b>

            {" "}contre{" "}

            <b>
              {
                pct(
                  r.consoDate
                )
              }
            </b>

            {" "}du budget alloué
            au titre du budget à date,
            soit{" "}

            <b>
              {
                sign(
                  r.ecartPoints
                )
              } points
            </b>.

          </p>


          <div className="infogrid">

            <span>
              Budget alloué

              <b>
                {
                  fmt(
                    r.budgetAlloue
                  )
                } h
              </b>

            </span>


            <span>
              Budget à date

              <b>
                {
                  fmt(
                    r.budgetDate
                  )
                } h
              </b>

            </span>


            <span>
              Consommé

              <b>
                {
                  fmt(
                    r.encouru
                  )
                } h
              </b>

            </span>


            <span>
              Reste

              <b>
                {
                  fmt(
                    r.reste
                  )
                } h
              </b>

            </span>

          </div>

        </Card>

      </div>

    </>
  );
}


/* =========================================================
   JAUGE
   ========================================================= */

function Gauge({
  value,
  color
}) {

  const v =
    Math.max(
      0,
      Math.min(
        100,
        safePdfNumber(value)
      )
    );


  const a =
    (v / 100) *
      180 -
    90;


  return (
    <svg
      className="gauge"
      viewBox="0 0 180 100"
    >

      <path
        d="M10 90 A80 80 0 0 1 170 90"
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="14"
        strokeLinecap="round"
      />


      <path
        d="M10 90 A80 80 0 0 1 170 90"
        fill="none"
        stroke={
          color ||
          "#64748b"
        }
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={
          `${v / 100 * 251} 251`
        }
      />


      <line
        x1="90"
        y1="90"
        x2={
          90 +
          65 *
            Math.cos(
              a *
                Math.PI /
                180
            )
        }
        y2={
          90 +
          65 *
            Math.sin(
              a *
                Math.PI /
                180
            )
        }
        stroke="#334155"
        strokeWidth="2.5"
      />


      <circle
        cx="90"
        cy="90"
        r="4"
        fill="#334155"
      />

    </svg>
  );
}


/* =========================================================
   PARAMÈTRES
   ========================================================= */

function Parametres() {

  const {
    settings
  } = useData();


  const [
    s,
    setS
  ] = useState(
    settings
  );


  useEffect(
    () => {
      setS(
        settings
      );
    },
    [settings]
  );


  const handleSave =
    () => {

      const green =
        Number(
          s.green
        );

      const orange =
        Number(
          s.orange
        );


      if (
        !Number.isFinite(
          green
        ) ||
        !Number.isFinite(
          orange
        )
      ) {
        return;
      }


      if (
        green < 0 ||
        orange < 0
      ) {
        return;
      }


      if (
        green > orange
      ) {

        alert(
          "Le seuil vert doit être inférieur ou égal au seuil orange."
        );

        return;
      }


      saveSettings({
        ...s,
        green,
        orange
      });

    };


  return (
    <>

      <Header
        title="Paramètres"
        subtitle={
          "Seuils de statut et paramètres " +
          "du pilotage"
        }
      />


      <Card
        title="Seuils des statuts"
      >

        <div className="formgrid">

          <label>

            Seuil vert (≤)

            <input
              type="number"
              step=".5"
              value={
                s.green
              }
              onChange={
                e =>
                  setS({
                    ...s,
                    green:
                      Number(
                        e.target.value
                      )
                  })
              }
            />

            <small>
              Favorable
            </small>

          </label>


          <label>

            Seuil orange (≤)

            <input
              type="number"
              step=".5"
              value={
                s.orange
              }
              onChange={
                e =>
                  setS({
                    ...s,
                    orange:
                      Number(
                        e.target.value
                      )
                  })
              }
            />

            <small>
              Vigilance
            </small>

          </label>


          <label>

            Date d'analyse par défaut

            <input
              type="date"
              value={
                s.dateAnalyse
              }
              onChange={
                e =>
                  setS({
                    ...s,
                    dateAnalyse:
                      e.target.value
                  })
              }
            />

            <small>
              Conservée avec l'application
            </small>

          </label>

        </div>


        <button
          className="btn primary"
          onClick={
            handleSave
          }
        >

          <Save
            size={15}
          />

          Enregistrer

        </button>

      </Card>


      <Card
        title="Métiers suivis"
      >

        <div className="metierlist">

          {METIERS.map(
            (
              m,
              i
            ) => (

              <span
                key={
                  m
                }
              >

                <i
                  style={{
                    background:
                      COLORS[m] ||
                      "#64748b"
                  }}
                />

                {
                  i + 1
                }.{" "}
                {m}

              </span>

            )
          )}

        </div>


        <p className="muted">

          Les métiers sont automatiquement
          détectés à partir des données
          d'alimentation. Pour ajouter ou
          supprimer un métier, modifiez
          simplement la colonne « Métier »
          dans le fichier Excel puis
          réimportez les données.

        </p>

      </Card>


      <Card
        title="Formules"
      >

        <div className="formules">

          <div>

            <b>
              Consommation réelle
            </b>

            <code>
              Heures consommées /
              Budget alloué × 100
            </code>

          </div>


          <div>

            <b>
              Consommation à date
            </b>

            <code>
              Budget à date /
              Budget alloué × 100
            </code>

          </div>


          <div>

            <b>
              Écart heures
            </b>

            <code>
              Heures consommées −
              Budget à date
            </code>

          </div>


          <div>

            <b>
              Écart points
            </b>

            <code>
              Consommation réelle −
              Consommation à date
            </code>

          </div>


          <div>

            <b>
              Reste à consommer
            </b>

            <code>
              Budget alloué −
              Heures consommées
            </code>

          </div>

        </div>

      </Card>

    </>
  );
}


/* =========================================================
   APPLICATION
   ========================================================= */

export default function App() {

  return (
    <BrowserRouter>

      <Layout>

        <Routes>

          <Route
            path="/"
            element={
              <Dashboard />
            }
          />


          <Route
            path="/analyse"
            element={
              <Analyse />
            }
          />


          <Route
            path="/metier/:nom"
            element={
              <Detail />
            }
          />


          <Route
            path="/login"
            element={
              <Login />
            }
          />


          <Route
            path="/imports"
            element={
              <ProtectedRoute>
                <Imports />
              </ProtectedRoute>
            }
          />


          <Route
            path="/parametres"
            element={
              <ProtectedRoute>
                <Parametres />
              </ProtectedRoute>
            }
          />


          <Route
            path="*"
            element={
              <div className="empty">
                Page introuvable.
              </div>
            }
          />

        </Routes>

      </Layout>

    </BrowserRouter>
  );
}