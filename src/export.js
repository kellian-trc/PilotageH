import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

import {
  fmt1,
  COLORS,
  STATUS_COLORS
} from "./calculs";


// =========================================================
// OUTILS
// =========================================================

function download(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = u;
  a.download = name;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(u);
  }, 1000);
}


/*
 * IMPORTANT POUR jsPDF
 *
 * Intl.NumberFormat("fr-FR") utilise des espaces
 * insécables / espaces fines insécables.
 *
 * Certaines polices standards de jsPDF les interprètent
 * mal et peuvent afficher :
 *
 * 16 /455
 *
 * au lieu de :
 *
 * 16 455
 *
 * On normalise donc tous les séparateurs.
 */

function pdfNumber(value, decimals = 0) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "0";
  }

  const formatted =
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true
    }).format(n);

  return formatted
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ");
}


function pdfPct(value) {
  return `${pdfNumber(value, 1)} %`;
}


function pdfSigned(value, decimals = 0) {
  const n = Number(value) || 0;

  const prefix =
    n > 0
      ? "+"
      : "";

  return `${prefix}${pdfNumber(n, decimals)}`;
}


function safeText(value) {
  return String(value ?? "")
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\r?\n/g, " ");
}


function truncateText(doc, text, maxWidth) {
  const value = safeText(text);

  if (
    doc.getTextWidth(value) <=
    maxWidth
  ) {
    return value;
  }

  let result = value;

  while (
    result.length > 1 &&
    doc.getTextWidth(
      `${result}…`
    ) > maxWidth
  ) {
    result = result.slice(
      0,
      -1
    );
  }

  return `${result}…`;
}


function hexToRgb(hex) {
  const clean =
    String(hex || "")
      .replace("#", "");

  if (clean.length !== 6) {
    return [100, 116, 139];
  }

  return [
    parseInt(
      clean.substring(0, 2),
      16
    ),
    parseInt(
      clean.substring(2, 4),
      16
    ),
    parseInt(
      clean.substring(4, 6),
      16
    )
  ];
}


function setFillHex(doc, hex) {
  const [r, g, b] =
    hexToRgb(hex);

  doc.setFillColor(
    r,
    g,
    b
  );
}


function setTextHex(doc, hex) {
  const [r, g, b] =
    hexToRgb(hex);

  doc.setTextColor(
    r,
    g,
    b
  );
}


function setDrawHex(doc, hex) {
  const [r, g, b] =
    hexToRgb(hex);

  doc.setDrawColor(
    r,
    g,
    b
  );
}


// =========================================================
// EXCEL
// =========================================================

export function exportExcel(
  lignes,
  total
) {

  const data = [

    [
      "Métier",
      "Heures consommées",
      "Budget à date",
      "Budget alloué",
      "Reste à consommer",
      "Conso réelle (%)",
      "Conso à date (%)",
      "Écart (h)",
      "Écart (pts)",
      "Statut"
    ],

    ...lignes.map(
      x => [

        x.metier,
        x.encouru,
        x.budgetDate,
        x.budgetAlloue,
        x.reste,
        fmt1(x.consoReelle),
        fmt1(x.consoDate),
        x.ecartH,
        fmt1(x.ecartPoints),
        x.statut

      ]
    ),

    [
      "TOTAL",
      total.encouru,
      total.budgetDate,
      total.budgetAlloue,
      total.reste,
      fmt1(total.consoReelle),
      fmt1(total.consoDate),
      total.ecartH,
      fmt1(total.ecartPoints),
      total.statut
    ]

  ];


  const wb =
    XLSX.utils.book_new();


  const ws =
    XLSX.utils.aoa_to_sheet(
      data
    );


  /*
   * Largeurs de colonnes
   */

  ws["!cols"] = [

    { wch: 24 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 13 },
    { wch: 12 }

  ];


  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Pilotage"
  );


  XLSX.writeFile(
    wb,
    "pilotageh_export.xlsx"
  );
}


// =========================================================
// CSV
// =========================================================

export function exportCSV(
  lignes,
  total
) {

  const data = [

    [
      "Métier",
      "Heures consommées",
      "Budget à date",
      "Budget alloué",
      "Reste",
      "Conso réelle (%)",
      "Conso à date (%)",
      "Écart (h)",
      "Écart (pts)",
      "Statut"
    ],

    ...lignes.map(
      x => [

        x.metier,
        x.encouru,
        x.budgetDate,
        x.budgetAlloue,
        x.reste,
        fmt1(x.consoReelle),
        fmt1(x.consoDate),
        x.ecartH,
        fmt1(x.ecartPoints),
        x.statut

      ]
    ),

    [
      "TOTAL",
      total.encouru,
      total.budgetDate,
      total.budgetAlloue,
      total.reste,
      fmt1(total.consoReelle),
      fmt1(total.consoDate),
      total.ecartH,
      fmt1(total.ecartPoints),
      total.statut
    ]

  ];


  const csv =
    "\uFEFF" +
    data
      .map(
        row =>
          row
            .map(
              c =>
                `"${String(c)
                  .replaceAll(
                    '"',
                    '""'
                  )}"`
            )
            .join(";")
      )
      .join("\n");


  download(
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    ),
    "pilotageh_export.csv"
  );
}


// =========================================================
// CARTE KPI PDF
// =========================================================

function drawKpi(
  doc,
  {
    x,
    y,
    w,
    h,
    label,
    value,
    unit = "",
    accent = "#2563eb",
    sub = ""
  }
) {

  /*
   * Fond
   */

  doc.setFillColor(
    255,
    255,
    255
  );

  doc.roundedRect(
    x,
    y,
    w,
    h,
    2.5,
    2.5,
    "F"
  );


  /*
   * Bordure gauche
   */

  setFillHex(
    doc,
    accent
  );

  doc.roundedRect(
    x,
    y,
    2.2,
    h,
    1.1,
    1.1,
    "F"
  );


  /*
   * Label
   */

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.2);

  setTextHex(
    doc,
    "#64748b"
  );

  doc.text(
    safeText(label).toUpperCase(),
    x + 6,
    y + 7
  );


  /*
   * Valeur
   */

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11.5);

  setTextHex(
    doc,
    "#0f172a"
  );

  doc.text(
    safeText(value),
    x + 6,
    y + 15
  );


  /*
   * Unité
   */

  if (unit) {

    const valueWidth =
      doc.getTextWidth(
        safeText(value)
      );

    doc.setFontSize(6.5);

    setTextHex(
      doc,
      "#64748b"
    );

    doc.text(
      safeText(unit),
      x + 7 + valueWidth,
      y + 15
    );

  }


  /*
   * Sous-texte
   */

  if (sub) {

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(5.2);

    setTextHex(
      doc,
      "#94a3b8"
    );

    doc.text(
      safeText(sub),
      x + 6,
      y + h - 4
    );

  }

}


// =========================================================
// TITRE DE SECTION
// =========================================================

function sectionTitle(
  doc,
  title,
  subtitle,
  x,
  y,
  width
) {

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(8.2);

  setTextHex(
    doc,
    "#0f172a"
  );

  doc.text(
    safeText(title),
    x,
    y
  );


  if (subtitle) {

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(5.8);

    setTextHex(
      doc,
      "#64748b"
    );

    doc.text(
      safeText(subtitle),
      x + width,
      y,
      {
        align: "right"
      }
    );

  }

}


// =========================================================
// TABLEAU
// =========================================================

function drawTable(
  doc,
  lignes,
  total,
  x,
  y,
  width
) {

  const rows = [
    ...lignes,
    total
  ];


  /*
   * Largeurs optimisées
   */

  const cols = [
    34, // métier
    17, // consommé
    17, // budget date
    17, // budget alloué
    16, // reste
    17, // conso
    16, // écart h
    16, // écart pts
    18  // statut
  ];


  const scale =
    width /
    cols.reduce(
      (a, b) => a + b,
      0
    );


  const widths =
    cols.map(
      c => c * scale
    );


  const headerHeight = 7;
  const rowHeight = 4.35;


  /*
   * En-tête
   */

  setFillHex(
    doc,
    "#e8eef7"
  );

  doc.roundedRect(
    x,
    y,
    width,
    headerHeight,
    1.5,
    1.5,
    "F"
  );


  const headers = [
    "Métier",
    "Cons.",
    "B. date",
    "B. alloué",
    "Reste",
    "Conso.",
    "Écart h",
    "Écart pts",
    "Statut"
  ];


  let cursorX = x;


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(5.2);

  setTextHex(
    doc,
    "#475569"
  );


  headers.forEach(
    (header, i) => {

      doc.text(
        header,
        cursorX + 2,
        y + 4.5
      );

      cursorX +=
        widths[i];

    }
  );


  /*
   * Lignes
   */

  rows.forEach(
    (r, index) => {

      const rowY =
        y +
        headerHeight +
        index *
          rowHeight;


      /*
       * Alternance de fond
       */

      if (
        index % 2 === 0
      ) {

        setFillHex(
          doc,
          "#f8fafc"
        );

        doc.rect(
          x,
          rowY,
          width,
          rowHeight,
          "F"
        );

      }


      /*
       * Ligne TOTAL
       */

      if (
        r.metier === "TOTAL"
      ) {

        setFillHex(
          doc,
          "#dfe7f2"
        );

        doc.rect(
          x,
          rowY,
          width,
          rowHeight,
          "F"
        );

      }


      const values = [

        r.metier,

        pdfNumber(
          r.encouru
        ),

        pdfNumber(
          r.budgetDate
        ),

        pdfNumber(
          r.budgetAlloue
        ),

        pdfNumber(
          r.reste
        ),

        pdfPct(
          r.consoReelle
        ),

        pdfSigned(
          r.ecartH
        ),

        pdfSigned(
          r.ecartPoints
        ),

        r.statut

      ];


      cursorX = x;


      values.forEach(
        (value, i) => {

          /*
           * Métier
           */

          if (i === 0) {

            doc.setFont(
              "helvetica",
              r.metier === "TOTAL"
                ? "bold"
                : "normal"
            );

            doc.setFontSize(4.7);

            setTextHex(
              doc,
              "#1e293b"
            );

            const text =
              truncateText(
                doc,
                value,
                widths[i] - 4
              );

            doc.text(
              text,
              cursorX + 2,
              rowY + 3
            );

          }


          /*
           * Statut
           */

          else if (
            i === 8
          ) {

            const status =
              safeText(
                value
              );

            const color =
              STATUS_COLORS[
                status
              ] ||
              "#64748b";


            /*
             * Pastille
             */

            setFillHex(
              doc,
              color
            );

            doc.roundedRect(
              cursorX + 2,
              rowY + 1,
              2.2,
              2.2,
              1,
              1,
              "F"
            );


            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(4.3);

            setTextHex(
              doc,
              color
            );

            doc.text(
              status === "vert"
                ? "Favorable"
                : status === "orange"
                  ? "Vigilance"
                  : "Critique",
              cursorX + 5.5,
              rowY + 3
            );

          }


          /*
           * Valeurs numériques
           */

          else {

            doc.setFont(
              "helvetica",
              r.metier === "TOTAL"
                ? "bold"
                : "normal"
            );

            doc.setFontSize(4.5);

            setTextHex(
              doc,
              "#334155"
            );

            doc.text(
              safeText(value),
              cursorX +
                widths[i] -
                2,
              rowY + 3,
              {
                align: "right"
              }
            );

          }


          cursorX +=
            widths[i];

        }
      );

    }
  );


  /*
   * Bordure générale
   */

  setDrawHex(
    doc,
    "#dbe3ee"
  );

  doc.setLineWidth(
    0.25
  );

  doc.roundedRect(
    x,
    y,
    width,
    headerHeight +
      rows.length *
        rowHeight,
    1.5,
    1.5,
    "S"
  );


  return (
    headerHeight +
    rows.length *
      rowHeight
  );

}


// =========================================================
// HISTOGRAMME HORIZONTAL
// =========================================================

function drawHorizontalChart(
  doc,
  {
    title,
    subtitle,
    data,
    x,
    y,
    width,
    height,
    valueA,
    valueB,
    labelA,
    labelB,
    colorA,
    colorB
  }
) {

  /*
   * Carte
   */

  doc.setFillColor(
    255,
    255,
    255
  );

  doc.roundedRect(
    x,
    y,
    width,
    height,
    2.5,
    2.5,
    "F"
  );


  /*
   * Titre
   */

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.8);

  setTextHex(
    doc,
    "#0f172a"
  );

  doc.text(
    safeText(title),
    x + 5,
    y + 7
  );


  /*
   * Sous-titre
   */

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(4.8);

  setTextHex(
    doc,
    "#64748b"
  );

  doc.text(
    safeText(subtitle),
    x + 5,
    y + 11
  );


  /*
   * Légende
   */

  const legendY =
    y + 7;


  const legendX =
    x + width - 58;


  setFillHex(
    doc,
    colorA
  );

  doc.rect(
    legendX,
    legendY - 3,
    3,
    2,
    "F"
  );


  doc.setFontSize(4.3);

  setTextHex(
    doc,
    "#64748b"
  );

  doc.text(
    safeText(labelA),
    legendX + 5,
    legendY - 1.2
  );


  const secondLegendX =
    legendX + 27;


  setFillHex(
    doc,
    colorB
  );

  doc.rect(
    secondLegendX,
    legendY - 3,
    3,
    2,
    "F"
  );


  doc.text(
    safeText(labelB),
    secondLegendX + 5,
    legendY - 1.2
  );


  /*
   * Zone graphique
   */

  const chartX =
    x + 43;

  const chartY =
    y + 15;

  const chartWidth =
    width - 48;

  const chartHeight =
    height - 19;


  /*
   * Tous les métiers
   */

  const rows =
    data || [];


  if (!rows.length) {

    doc.setFontSize(5);

    setTextHex(
      doc,
      "#94a3b8"
    );

    doc.text(
      "Aucune donnée",
      x + 5,
      y + height / 2
    );

    return;

  }


  /*
   * Valeurs
   */

  const allValues =
    rows.flatMap(
      r => [
        Number(
          r[valueA]
        ) || 0,
        Number(
          r[valueB]
        ) || 0
      ]
    );


  const max =
    Math.max(
      1,
      ...allValues.map(
        Math.abs
      )
    );


  /*
   * Grille verticale
   */

  const gridValues =
    [0, 0.25, 0.5, 0.75, 1];


  gridValues.forEach(
    ratio => {

      const gx =
        chartX +
        ratio *
          chartWidth;


      setDrawHex(
        doc,
        "#e2e8f0"
      );

      doc.setLineWidth(
        0.18
      );

      doc.line(
        gx,
        chartY,
        gx,
        chartY +
          chartHeight
      );


      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(3.9);

      setTextHex(
        doc,
        "#94a3b8"
      );


      doc.text(
        pdfNumber(
          max *
            ratio
        ),
        gx,
        chartY - 1.5,
        {
          align: "center"
        }
      );

    }
  );


  /*
   * Hauteur d'une ligne
   *
   * 17 métiers doivent être visibles.
   */

  const rowSpace =
    chartHeight /
    rows.length;


  const barHeight =
    Math.max(
      0.9,
      Math.min(
        1.7,
        rowSpace * 0.27
      )
    );


  rows.forEach(
    (r, index) => {

      const centerY =
        chartY +
        index *
          rowSpace +
        rowSpace / 2;


      /*
       * Nom du métier
       */

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(4.1);

      setTextHex(
        doc,
        "#334155"
      );


      const label =
        truncateText(
          doc,
          r.metier,
          39
        );


      doc.text(
        label,
        x + 4,
        centerY + 1.2
      );


      /*
       * Barres
       */

      const a =
        Number(
          r[valueA]
        ) || 0;

      const b =
        Number(
          r[valueB]
        ) || 0;


      const widthA =
        Math.max(
          0,
          Math.abs(a) /
            max *
            chartWidth
        );


      const widthB =
        Math.max(
          0,
          Math.abs(b) /
            max *
            chartWidth
        );


      /*
       * Barre A
       */

      setFillHex(
        doc,
        colorA
      );

      doc.roundedRect(
        chartX,
        centerY -
          barHeight -
          0.3,
        widthA,
        barHeight,
        0.4,
        0.4,
        "F"
      );


      /*
       * Barre B
       */

      setFillHex(
        doc,
        colorB
      );

      doc.roundedRect(
        chartX,
        centerY +
          0.3,
        widthB,
        barHeight,
        0.4,
        0.4,
        "F"
      );

    }
  );


  /*
   * Bordure
   */

  setDrawHex(
    doc,
    "#e2e8f0"
  );

  doc.setLineWidth(
    0.25
  );

  doc.roundedRect(
    x,
    y,
    width,
    height,
    2.5,
    2.5,
    "S"
  );

}


// =========================================================
// BLOC ANALYSE
// =========================================================

function drawAnalysis(
  doc,
  {
    x,
    y,
    width,
    height,
    total,
    affaire,
    date
  }
) {

  /*
   * Carte
   */

  doc.setFillColor(
    255,
    255,
    255
  );

  doc.roundedRect(
    x,
    y,
    width,
    height,
    2.5,
    2.5,
    "F"
  );


  /*
   * Bandeau titre
   */

  setFillHex(
    doc,
    "#2563eb"
  );

  doc.roundedRect(
    x,
    y,
    3,
    height,
    1.5,
    1.5,
    "F"
  );


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(8);

  setTextHex(
    doc,
    "#0f172a"
  );

  doc.text(
    "ANALYSE DE LA SITUATION",
    x + 8,
    y + 9
  );


  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(5.2);

  setTextHex(
    doc,
    "#64748b"
  );

  doc.text(
    affaire
      ? `Analyse filtrée : ${safeText(
          affaire
        )}`
      : "Analyse globale",
    x + 8,
    y + 15
  );


  doc.text(
    `Date d'analyse : ${safeText(
      date || "—"
    )}`,
    x + 8,
    y + 20
  );


  /*
   * Message principal
   */

  const ecartH =
    Number(
      total.ecartH
    ) || 0;


  const positive =
    ecartH > 0;


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.3);

  setTextHex(
    doc,
    positive
      ? "#dc2626"
      : "#16a34a"
  );


  const message =
    positive
      ? `La consommation cumulée dépasse le budget à date de ${pdfNumber(
          Math.abs(ecartH)
        )} h.`
      : `La consommation cumulée est inférieure au budget à date de ${pdfNumber(
          Math.abs(ecartH)
        )} h.`;


  doc.text(
    safeText(message),
    x + 8,
    y + 30
  );


  /*
   * Séparateur
   */

  setDrawHex(
    doc,
    "#e2e8f0"
  );

  doc.setLineWidth(
    0.3
  );

  doc.line(
    x + 8,
    y + 34,
    x + width - 8,
    y + 34
  );


  /*
   * 3 indicateurs
   */

  const colW =
    (width - 28) / 3;


  const indicators = [

    {
      label:
        "CONSOMMATION RÉELLE",
      value:
        pdfPct(
          total.consoReelle
        ),
      color:
        "#2563eb"
    },

    {
      label:
        "CONSOMMATION À DATE",
      value:
        pdfPct(
          total.consoDate
        ),
      color:
        "#0891b2"
    },

    {
      label:
        "ÉCART THÉORIQUE",
      value:
        pdfSigned(
          total.ecartPoints
        ) + " pts",
      color:
        positive
          ? "#dc2626"
          : "#16a34a"
    }

  ];


  indicators.forEach(
    (item, i) => {

      const ix =
        x +
        8 +
        i *
          (colW + 6);


      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(4.4);

      setTextHex(
        doc,
        "#64748b"
      );

      doc.text(
        item.label,
        ix,
        y + 42
      );


      doc.setFontSize(
        10
      );

      setTextHex(
        doc,
        item.color
      );

      doc.text(
        item.value,
        ix,
        y + 51
      );

    }
  );


  /*
   * Barre de situation
   */

  const barX =
    x + 8;

  const barY =
    y + 60;

  const barW =
    width - 16;

  const barH =
    5;


  /*
   * Fond
   */

  setFillHex(
    doc,
    "#e2e8f0"
  );

  doc.roundedRect(
    barX,
    barY,
    barW,
    barH,
    2.5,
    2.5,
    "F"
  );


  /*
   * Remplissage basé sur consommation
   */

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        Number(
          total.consoReelle
        ) / 100
      )
    );


  setFillHex(
    doc,
    positive
      ? "#dc2626"
      : "#16a34a"
  );


  doc.roundedRect(
    barX,
    barY,
    barW * ratio,
    barH,
    2.5,
    2.5,
    "F"
  );


  /*
   * Informations finales
   */

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(4.7);

  setTextHex(
    doc,
    "#64748b"
  );


  doc.text(
    `${pdfNumber(
      total.encouru
    )} h consommées`,
    x + 8,
    y + 73
  );


  doc.text(
    `Budget à date : ${pdfNumber(
      total.budgetDate
    )} h`,
    x + width / 2,
    y + 73,
    {
      align: "center"
    }
  );


  doc.text(
    `Budget alloué : ${pdfNumber(
      total.budgetAlloue
    )} h`,
    x + width - 8,
    y + 73,
    {
      align: "right"
    }
  );


  /*
   * Bordure
   */

  setDrawHex(
    doc,
    "#e2e8f0"
  );

  doc.setLineWidth(
    0.25
  );

  doc.roundedRect(
    x,
    y,
    width,
    height,
    2.5,
    2.5,
    "S"
  );

}


// =========================================================
// EXPORT PDF — RAPPORT PROFESSIONNEL
// =========================================================

export function exportPDF(
  lignes,
  total,
  meta = {}
) {

  /*
   * A4 paysage
   *
   * 297 × 210 mm
   */

  const doc =
    new jsPDF({
      orientation:
        "landscape",
      unit: "mm",
      format: "a4",
      compress: true
    });


  /*
   * IMPORTANT :
   * aucune page supplémentaire.
   */

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();


  /*
   * Reset sécurité typographique
   */

  if (
    typeof doc.setCharSpace ===
    "function"
  ) {
    doc.setCharSpace(0);
  }


  /*
   * =======================================================
   * FOND GLOBAL
   * =======================================================
   */

  doc.setFillColor(
    246,
    248,
    252
  );

  doc.rect(
    0,
    0,
    pageWidth,
    pageHeight,
    "F"
  );


  /*
   * =======================================================
   * HEADER
   * =======================================================
   */

  setFillHex(
    doc,
    "#2563eb"
  );

  doc.rect(
    0,
    0,
    pageWidth,
    22,
    "F"
  );


  /*
   * Titre
   */

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(15);

  doc.setTextColor(
    255,
    255,
    255
  );

  doc.text(
    "PILOTAGE H",
    9,
    9
  );


  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(6.5);

  doc.setTextColor(
    225,
    235,
    255
  );

  doc.text(
    "RAPPORT DE PILOTAGE DES HEURES",
    9,
    15
  );


  /*
   * Informations à droite
   */

  const date =
    meta.date ||
    new Date()
      .toISOString()
      .slice(0, 10);


  const affaire =
    meta.affaire ||
    meta.affaires ||
    "Toutes";


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.5);

  doc.setTextColor(
    255,
    255,
    255
  );


  doc.text(
    safeText(date),
    pageWidth - 9,
    8,
    {
      align: "right"
    }
  );


  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(5.8);

  doc.setTextColor(
    225,
    235,
    255
  );


  doc.text(
    `Affaire : ${safeText(
      affaire
    )}`,
    pageWidth - 9,
    15,
    {
      align: "right"
    }
  );


  /*
   * =======================================================
   * KPI
   * =======================================================
   */

  const marginX = 8;

  const kpiGap = 3;

  const kpiY = 26;

  const kpiH = 23;

  const kpiW =
    (
      pageWidth -
      marginX * 2 -
      kpiGap * 5
    ) / 6;


  const kpis = [

    {
      label:
        "Budget alloué",
      value:
        pdfNumber(
          total.budgetAlloue
        ),
      unit: "h",
      accent:
        "#475569"
    },

    {
      label:
        "Heures consommées",
      value:
        pdfNumber(
          total.encouru
        ),
      unit: "h",
      accent:
        "#2563eb"
    },

    {
      label:
        "Budget à date",
      value:
        pdfNumber(
          total.budgetDate
        ),
      unit: "h",
      accent:
        "#16a34a"
    },

    {
      label:
        "Écart heures",
      value:
        pdfSigned(
          total.ecartH
        ),
      unit: "h",
      accent:
        total.ecartH > 0
          ? "#dc2626"
          : "#16a34a",
      sub:
        total.ecartH > 0
          ? "au-dessus du budget à date"
          : "sous le budget à date"
    },

    {
      label:
        "Consommation",
      value:
        pdfNumber(
          total.consoReelle,
          1
        ),
      unit: "%",
      accent:
        "#ea580c",
      sub:
        `budget à date ${pdfNumber(
          total.consoDate,
          1
        )} %`
    },

    {
      label:
        "Écart théorique",
      value:
        pdfSigned(
          total.ecartPoints
        ),
      unit: "pts",
      accent:
        total.ecartPoints > 10
          ? "#dc2626"
          : total.ecartPoints > 5
            ? "#ea580c"
            : "#16a34a"
    }

  ];


  kpis.forEach(
    (kpi, i) => {

      drawKpi(
        doc,
        {
          ...kpi,
          x:
            marginX +
            i *
              (kpiW +
                kpiGap),
          y: kpiY,
          w: kpiW,
          h: kpiH
        }
      );

    }
  );


  /*
   * =======================================================
   * SECTION SYNTHÈSE
   * =======================================================
   */

  const sectionY =
    54;


  sectionTitle(
    doc,
    "SYNTHÈSE PAR MÉTIER",
    `${lignes.length} métier(s) suivi(s)`,
    marginX,
    sectionY,
    pageWidth -
      marginX * 2
  );


  /*
   * =======================================================
   * TABLEAU + ANALYSE
   * =======================================================
   */

  const contentY =
    sectionY + 4;


  const analysisWidth =
    103;


  const tableWidth =
    pageWidth -
    marginX * 2 -
    analysisWidth -
    4;


  const tableHeight =
    drawTable(
      doc,
      lignes,
      total,
      marginX,
      contentY,
      tableWidth
    );


  drawAnalysis(
    doc,
    {
      x:
        marginX +
        tableWidth +
        4,
      y: contentY,
      width:
        analysisWidth,
      height:
        tableHeight,
      total,
      affaire:
        meta.affaire ||
        (
          meta.affaires &&
          meta.affaires !==
            "Toutes"
            ? meta.affaires
            : ""
        ),
      date
    }
  );


  /*
   * =======================================================
   * HISTOGRAMMES
   * =======================================================
   */

  const chartY =
    contentY +
    tableHeight +
    5;


  const chartGap = 4;


  const chartWidth =
    (
      pageWidth -
      marginX * 2 -
      chartGap
    ) / 2;


  /*
   * Histogramme 1
   */

  drawHorizontalChart(
    doc,
    {
      title:
        "Budget alloué vs consommé",
      subtitle:
        "Comparaison des heures par métier",
      data:
        lignes,
      x:
        marginX,
      y:
        chartY,
      width:
        chartWidth,
      height:
        57,
      valueA:
        "budgetAlloue",
      valueB:
        "encouru",
      labelA:
        "Budget",
      labelB:
        "Consommé",
      colorA:
        "#94a3b8",
      colorB:
        "#2563eb"
    }
  );


  /*
   * Histogramme 2
   */

  drawHorizontalChart(
    doc,
    {
      title:
        "Consommé vs budget à date",
      subtitle:
        "Indicateur principal de pilotage",
      data:
        lignes,
      x:
        marginX +
        chartWidth +
        chartGap,
      y:
        chartY,
      width:
        chartWidth,
      height:
        57,
      valueA:
        "budgetDate",
      valueB:
        "encouru",
      labelA:
        "Budget à date",
      labelB:
        "Consommé",
      colorA:
        "#a7f3d0",
      colorB:
        "#0891b2"
    }
  );


  /*
   * =======================================================
   * FOOTER
   * =======================================================
   */

  const footerY =
    pageHeight - 5;


  setDrawHex(
    doc,
    "#dbe3ee"
  );

  doc.setLineWidth(
    0.25
  );

  doc.line(
    marginX,
    footerY - 3,
    pageWidth -
      marginX,
    footerY - 3
  );


  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(4.5);

  setTextHex(
    doc,
    "#64748b"
  );


  doc.text(
    "PilotageH · Rapport généré automatiquement",
    marginX,
    footerY
  );


  doc.text(
    affaire &&
      affaire !== "Toutes"
      ? `Analyse filtrée : ${safeText(
          affaire
        )}`
      : "Analyse globale",
    pageWidth / 2,
    footerY,
    {
      align: "center"
    }
  );


  doc.text(
    `${lignes.length} métier(s)`,
    pageWidth -
      marginX,
    footerY,
    {
      align: "right"
    }
  );


  /*
   * =======================================================
   * EXPORT
   * =======================================================
   */

  const filename =
    affaire &&
    affaire !== "Toutes"
      ? `pilotageh_rapport_${safeText(
          affaire
        )
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          )}.pdf`
      : "pilotageh_rapport.pdf";


  doc.save(
    filename
  );
}


// =========================================================
// MODÈLE EXCEL
// =========================================================

export function downloadTemplate() {

  const data = [

    [
      "Affaire",
      "Métier",
      "Heures consommées",
      "Budget à date",
      "Budget alloué"
    ],

    [
      "EXEMPLE",
      "Mécanique",
      120,
      150,
      300
    ]

  ];


  const wb =
    XLSX.utils.book_new();


  const ws =
    XLSX.utils.aoa_to_sheet(
      data
    );


  ws["!cols"] = [

    { wch: 20 },
    { wch: 25 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 }

  ];


  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Alimentation"
  );


  XLSX.writeFile(
    wb,
    "modele_alimentation_pilotageh.xlsx"
  );
}