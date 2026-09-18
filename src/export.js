import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { fmt1 } from "./calculs";

/* =========================================================
   TELECHARGEMENT
   ========================================================= */

function download(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = u;
  a.download = name;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(u);
  }, 1000);
}


/* =========================================================
   EXPORT EXCEL
   ========================================================= */

export function exportExcel(lignes, total) {

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

    ...lignes.map(x => [
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
    ]),

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

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(data),
    "Pilotage"
  );

  XLSX.writeFile(
    wb,
    "pilotageh_export.xlsx"
  );
}


/* =========================================================
   EXPORT CSV
   ========================================================= */

export function exportCSV(lignes, total) {

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

    ...lignes.map(x => [
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
    ]),

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
      .map(row =>
        row
          .map(c =>
            `"${String(c ?? "").replaceAll('"', '""')}"`
          )
          .join(";")
      )
      .join("\n");

  download(
    new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8"
      }
    ),
    "pilotageh_export.csv"
  );
}


/* =========================================================
   OUTILS PDF
   ========================================================= */

function pdfColor(doc, color) {
  doc.setFillColor(...color);
}

function pdfTextColor(doc, color) {
  doc.setTextColor(...color);
}

function roundedBox(
  doc,
  x,
  y,
  w,
  h,
  fill,
  radius = 2
) {
  pdfColor(doc, fill);

  doc.roundedRect(
    x,
    y,
    w,
    h,
    radius,
    radius,
    "F"
  );
}


function getStatusColor(status) {

  if (status === "vert") {
    return [22, 163, 74];
  }

  if (status === "orange") {
    return [234, 88, 12];
  }

  if (status === "rouge") {
    return [220, 38, 38];
  }

  return [100, 116, 139];
}


function getStatusLabel(status) {

  if (status === "vert") {
    return "FAVORABLE";
  }

  if (status === "orange") {
    return "VIGILANCE";
  }

  if (status === "rouge") {
    return "CRITIQUE";
  }

  return "—";
}


function getMetierColor(metier) {

  const colors = {

    "Mécanique": [37, 99, 235],
    "Fluide": [8, 145, 178],
    "Mesure": [124, 58, 237],
    "Electricité": [202, 138, 4],
    "Contrôle commande": [219, 39, 119],
    "Activité spécifique": [15, 118, 110],
    "Indus Nuc": [220, 38, 38],
    "Indus Conv": [234, 88, 12],
    "Indus Elec": [147, 51, 234],
    "Montage Nuc": [22, 163, 74],
    "Montage Conv": [101, 163, 13],
    "Montage Elec": [5, 150, 105],
    "Architecte": [71, 85, 105],
    "Pilotage": [29, 78, 216],
    "Transverse": [190, 18, 60],
    "MERI": [126, 34, 206],
    "Essais": [15, 118, 110]

  };

  if (colors[metier]) {
    return colors[metier];
  }

  let hash = 0;

  for (
    let i = 0;
    i < String(metier).length;
    i++
  ) {
    hash =
      String(metier).charCodeAt(i) +
      ((hash << 5) - hash);
  }

  const extra = [
    [2, 132, 199],
    [79, 70, 229],
    [192, 38, 211],
    [219, 39, 119],
    [225, 29, 72],
    [234, 88, 12],
    [202, 138, 4],
    [101, 163, 13],
    [22, 163, 74],
    [5, 150, 105],
    [13, 148, 136],
    [8, 145, 178],
    [37, 99, 235]
  ];

  return extra[
    Math.abs(hash) % extra.length
  ];
}


/* =========================================================
   TEXTE MULTILIGNE
   ========================================================= */

function fitText(
  doc,
  text,
  maxWidth,
  fontSize = 7
) {
  doc.setFontSize(fontSize);

  const lines =
    doc.splitTextToSize(
      String(text ?? ""),
      maxWidth
    );

  return lines;
}


/* =========================================================
   BARRES HORIZONTALES PDF
   ========================================================= */

function drawHorizontalBars(
  doc,
  {
    x,
    y,
    width,
    height,
    data,
    value1,
    value2 = null,
    label1,
    label2 = null,
    maxValue = null,
    title,
    percent = false
  }
) {

  const count = data.length;

  if (!count) {
    return;
  }

  const rowHeight =
    height / count;

  const labelWidth =
    Math.min(
      38,
      width * 0.20
    );

  const chartX =
    x + labelWidth;

  const chartWidth =
    width - labelWidth - 4;

  const calculatedMax =
    maxValue ??
    Math.max(
      1,
      ...data.flatMap(r => [
        Number(r[value1]) || 0,
        value2
          ? Number(r[value2]) || 0
          : 0
      ])
    );

  /* Titre */

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  pdfTextColor(doc, [30, 41, 59]);

  doc.text(
    title,
    x,
    y - 4
  );

  /* Lignes */

  data.forEach(
    (r, index) => {

      const rowY =
        y +
        index *
        rowHeight;

      const labelY =
        rowY +
        rowHeight * 0.62;

      doc.setFontSize(
        Math.min(
          6.5,
          Math.max(
            4.5,
            80 / Math.max(1, count)
          )
        )
      );

      doc.setFont("helvetica", "normal");

      pdfTextColor(
        doc,
        [51, 65, 85]
      );

      let label =
        String(
          r.metier ?? ""
        );

      /*
       * Sur beaucoup de métiers,
       * on réduit légèrement la taille
       * plutôt que de couper le nom.
       */

      if (label.length > 20) {
        doc.setFontSize(4.5);
      }

      doc.text(
        label,
        x,
        labelY,
        {
          maxWidth:
            labelWidth - 2
        }
      );

      /* Fond de ligne */

      pdfColor(
        doc,
        [241, 245, 249]
      );

      doc.roundedRect(
        chartX,
        rowY +
          rowHeight * 0.25,
        chartWidth,
        Math.max(
          1.5,
          rowHeight * 0.42
        ),
        1,
        1,
        "F"
      );

      /* Première barre */

      const v1 =
        Math.max(
          0,
          Number(r[value1]) || 0
        );

      const bar1 =
        Math.min(
          chartWidth,
          chartWidth *
            (v1 /
              calculatedMax)
        );

      if (bar1 > 0) {

        pdfColor(
          doc,
          percent
            ? [37, 99, 235]
            : [148, 163, 184]
        );

        doc.roundedRect(
          chartX,
          rowY +
            rowHeight * 0.25,
          bar1,
          Math.max(
            1.5,
            rowHeight * 0.42
          ),
          1,
          1,
          "F"
        );
      }

      /*
       * Deuxième barre :
       * elle est dessinée sous la première
       * pour garder une lecture claire.
       */

      if (value2) {

        const v2 =
          Math.max(
            0,
            Number(r[value2]) || 0
          );

        const bar2 =
          Math.min(
            chartWidth,
            chartWidth *
              (v2 /
                calculatedMax)
          );

        const secondY =
          rowY +
          rowHeight * 0.69;

        pdfColor(
          doc,
          percent
            ? [203, 213, 225]
            : [37, 99, 235]
        );

        doc.roundedRect(
          chartX,
          secondY,
          bar2,
          Math.max(
            1.2,
            rowHeight * 0.18
          ),
          0.8,
          0.8,
          "F"
        );

        /*
         * Valeurs numériques
         */

        doc.setFontSize(4.2);

        pdfTextColor(
          doc,
          [71, 85, 105]
        );

        const display1 =
          percent
            ? `${fmt1(v1)} %`
            : `${fmt1(v1)} h`;

        const display2 =
          percent
            ? `${fmt1(v2)} %`
            : `${fmt1(v2)} h`;

        doc.text(
          display1,
          chartX +
            Math.min(
              chartWidth - 1,
              bar1 + 1
            ),
          rowY +
            rowHeight * 0.49
        );

        doc.text(
          display2,
          chartX +
            Math.min(
              chartWidth - 1,
              bar2 + 1
            ),
          secondY +
            rowHeight * 0.16
        );
      }

      else {

        doc.setFontSize(4.2);

        pdfTextColor(
          doc,
          [71, 85, 105]
        );

        const display =
          percent
            ? `${fmt1(v1)} %`
            : `${fmt1(v1)} h`;

        doc.text(
          display,
          chartX +
            Math.min(
              chartWidth - 1,
              bar1 + 1
            ),
          rowY +
            rowHeight * 0.48
        );
      }

    }
  );


  /*
   * Légende
   */

  const legendY =
    y +
    height +
    3;

  doc.setFontSize(5);

  pdfColor(
    doc,
    percent
      ? [37, 99, 235]
      : [148, 163, 184]
  );

  doc.rect(
    x,
    legendY - 2.2,
    3,
    2,
    "F"
  );

  pdfTextColor(
    doc,
    [71, 85, 105]
  );

  doc.text(
    label1,
    x + 4,
    legendY
  );

  if (label2) {

    pdfColor(
      doc,
      percent
        ? [203, 213, 225]
        : [37, 99, 235]
    );

    doc.rect(
      x + 38,
      legendY - 2.2,
      3,
      2,
      "F"
    );

    pdfTextColor(
      doc,
      [71, 85, 105]
    );

    doc.text(
      label2,
      x + 42,
      legendY
    );
  }
}


/* =========================================================
   EXPORT PDF — RAPPORT PROFESSIONNEL
   ========================================================= */

export function exportPDF(
  lignes,
  total,
  meta = {}
) {

  const doc =
    new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true
    });

  /*
   * A4 paysage
   *
   * 297 × 210 mm
   */

  const pageWidth = 297;
  const pageHeight = 210;

  const margin = 8;

  const contentWidth =
    pageWidth -
    margin * 2;


  /* =======================================================
     FOND
     ======================================================= */

  pdfColor(
    doc,
    [248, 250, 252]
  );

  doc.rect(
    0,
    0,
    pageWidth,
    pageHeight,
    "F"
  );


  /* =======================================================
     EN-TÊTE
     ======================================================= */

  pdfColor(
    doc,
    [15, 23, 42]
  );

  doc.rect(
    0,
    0,
    pageWidth,
    25,
    "F"
  );


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(17);

  pdfTextColor(
    doc,
    [255, 255, 255]
  );

  doc.text(
    "PILOTAGEH",
    margin,
    10
  );


  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(8);

  doc.text(
    "Rapport de pilotage des heures",
    margin,
    17
  );


  /* Date / affaire */

  doc.setFontSize(7);

  const affaireText =
    meta.affaire
      ? `Affaire : ${meta.affaire}`
      : meta.affaires
        ? `Affaires : ${meta.affaires}`
        : "Toutes les affaires";

  doc.text(
    affaireText,
    pageWidth -
      margin,
    9,
    {
      align: "right"
    }
  );


  doc.text(
    `Date d'analyse : ${
      meta.date || "—"
    }`,
    pageWidth -
      margin,
    16,
    {
      align: "right"
    }
  );


  /* =======================================================
     KPI
     ======================================================= */

  const kpiY = 30;

  const kpiGap = 3;

  const kpiWidth =
    (contentWidth -
      kpiGap * 4) /
    5;

  const kpiHeight = 20;


  const kpis = [

    {
      label: "Budget alloué",
      value:
        `${fmt1(total.budgetAlloue)} h`,
      color:
        [71, 85, 105]
    },

    {
      label: "Heures consommées",
      value:
        `${fmt1(total.encouru)} h`,
      color:
        [37, 99, 235]
    },

    {
      label: "Budget à date",
      value:
        `${fmt1(total.budgetDate)} h`,
      color:
        [22, 163, 74]
    },

    {
      label: "Consommation",
      value:
        `${fmt1(total.consoReelle)} %`,
      color:
        [234, 88, 12]
    },

    {
      label: "Écart au théorique",
      value:
        `${total.ecartPoints > 0 ? "+" : ""}${fmt1(total.ecartPoints)} pts`,
      color:
        getStatusColor(
          total.statut
        )
    }

  ];


  kpis.forEach(
    (kpi, index) => {

      const x =
        margin +
        index *
        (kpiWidth +
          kpiGap);

      roundedBox(
        doc,
        x,
        kpiY,
        kpiWidth,
        kpiHeight,
        [255, 255, 255],
        2
      );

      /*
       * Bande colorée
       */

      pdfColor(
        doc,
        kpi.color
      );

      doc.roundedRect(
        x,
        kpiY,
        2,
        kpiHeight,
        1,
        1,
        "F"
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(5.5);

      pdfTextColor(
        doc,
        [100, 116, 139]
      );

      doc.text(
        kpi.label,
        x + 5,
        kpiY + 6
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(11);

      pdfTextColor(
        doc,
        [15, 23, 42]
      );

      doc.text(
        kpi.value,
        x + 5,
        kpiY + 15
      );
    }
  );


  /* =======================================================
     STATUT GLOBAL
     ======================================================= */

  const statusY =
    kpiY +
    kpiHeight +
    3;

  const statusColor =
    getStatusColor(
      total.statut
    );

  roundedBox(
    doc,
    margin,
    statusY,
    contentWidth,
    8,
    [255, 255, 255],
    2
  );

  pdfColor(
    doc,
    statusColor
  );

  doc.roundedRect(
    margin,
    statusY,
    3,
    8,
    1,
    1,
    "F"
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.5);

  pdfTextColor(
    doc,
    [15, 23, 42]
  );

  doc.text(
    `STATUT GLOBAL : ${getStatusLabel(total.statut)}`,
    margin + 6,
    statusY + 5
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  pdfTextColor(
    doc,
    [71, 85, 105]
  );

  doc.text(
    `Écart consommé / budget à date : ${
      total.ecartH > 0 ? "+" : ""
    }${fmt1(total.ecartH)} h`,
    80,
    statusY + 5
  );

  doc.text(
    `Reste à consommer : ${fmt1(total.reste)} h`,
    190,
    statusY + 5
  );


  /* =======================================================
     TABLEAU + GRAPHIQUES
     ======================================================= */

  const sectionY =
    statusY +
    12;


  /* -------------------------------------------------------
     TABLEAU
     ------------------------------------------------------- */

  const tableX =
    margin;

  const tableWidth =
    106;

  const tableY =
    sectionY;

  const tableHeight =
    106;


  roundedBox(
    doc,
    tableX,
    tableY,
    tableWidth,
    tableHeight,
    [255, 255, 255],
    2
  );


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(8);

  pdfTextColor(
    doc,
    [15, 23, 42]
  );

  doc.text(
    "Synthèse par métier",
    tableX + 5,
    tableY + 7
  );


  /*
   * Colonnes
   */

  const columns = [
    {
      label: "Métier",
      width: 29
    },
    {
      label: "Cons.",
      width: 13
    },
    {
      label: "Bud. date",
      width: 14
    },
    {
      label: "Bud. all.",
      width: 14
    },
    {
      label: "Écart",
      width: 12
    },
    {
      label: "Conso",
      width: 12
    },
    {
      label: "Statut",
      width: 12
    }
  ];


  let cx =
    tableX + 4;

  const headerY =
    tableY + 14;


  pdfColor(
    doc,
    [241, 245, 249]
  );

  doc.rect(
    tableX + 3,
    headerY - 4,
    tableWidth - 6,
    7,
    "F"
  );


  doc.setFontSize(4.5);

  columns.forEach(
    col => {

      doc.setFont(
        "helvetica",
        "bold"
      );

      pdfTextColor(
        doc,
        [71, 85, 105]
      );

      doc.text(
        col.label,
        cx,
        headerY
      );

      cx += col.width;
    }
  );


  /*
   * Lignes du tableau
   *
   * Tous les métiers sont affichés.
   */

  const tableRows = [
    ...lignes,
    total
  ];

  const availableTableHeight =
    tableHeight - 20;

  const rowHeight =
    availableTableHeight /
    Math.max(
      1,
      tableRows.length
    );


  tableRows.forEach(
    (r, index) => {

      const ry =
        headerY +
        5 +
        index *
        rowHeight;

      /*
       * Ligne TOTAL
       */

      if (
        r.metier === "TOTAL"
      ) {

        pdfColor(
          doc,
          [226, 232, 240]
        );

        doc.rect(
          tableX + 3,
          ry - 3,
          tableWidth - 6,
          rowHeight,
          "F"
        );
      }


      cx =
        tableX + 4;

      doc.setFont(
        "helvetica",
        r.metier === "TOTAL"
          ? "bold"
          : "normal"
      );

      doc.setFontSize(
        r.metier === "TOTAL"
          ? 4.5
          : 4.2
      );

      pdfTextColor(
        doc,
        [30, 41, 59]
      );


      /*
       * Métier
       */

      let metierLabel =
        String(
          r.metier
        );

      if (
        metierLabel.length > 18
      ) {
        metierLabel =
          metierLabel.slice(
            0,
            17
          ) + "…";
      }

      doc.text(
        metierLabel,
        cx,
        ry + 1
      );

      cx += columns[0].width;


      /* Consommé */

      doc.text(
        fmt1(r.encouru),
        cx,
        ry + 1
      );

      cx += columns[1].width;


      /* Budget date */

      doc.text(
        fmt1(r.budgetDate),
        cx,
        ry + 1
      );

      cx += columns[2].width;


      /* Budget alloué */

      doc.text(
        fmt1(r.budgetAlloue),
        cx,
        ry + 1
      );

      cx += columns[3].width;


      /* Écart */

      doc.text(
        `${
          r.ecartH > 0
            ? "+"
            : ""
        }${fmt1(r.ecartH)}`,
        cx,
        ry + 1
      );

      cx += columns[4].width;


      /* Conso */

      doc.text(
        `${fmt1(r.consoReelle)}%`,
        cx,
        ry + 1
      );

      cx += columns[5].width;


      /* Statut */

      const color =
        getStatusColor(
          r.statut
        );

      pdfColor(
        doc,
        color
      );

      doc.roundedRect(
        cx,
        ry - 2.5,
        9,
        3.5,
        1,
        1,
        "F"
      );

      doc.setFontSize(3.5);

      pdfTextColor(
        doc,
        [255, 255, 255]
      );

      doc.text(
        getStatusLabel(
          r.statut
        ),
        cx + 4.5,
        ry,
        {
          align: "center"
        }
      );

    }
  );


  /* =======================================================
     GRAPHIQUES
     ======================================================= */

  const graphX =
    tableX +
    tableWidth +
    5;

  const graphWidth =
    pageWidth -
    margin -
    graphX;


  /*
   * Deux graphiques côte à côte.
   */

  const graphGap = 5;

  const graphWidthEach =
    (graphWidth -
      graphGap) /
    2;


  const graphHeight = 62;


  /*
   * Graphique 1
   */

  drawHorizontalBars(
    doc,
    {
      x: graphX,
      y: sectionY + 5,
      width: graphWidthEach,
      height: graphHeight,
      data: lignes,
      value1: "budgetAlloue",
      value2: "encouru",
      label1: "Budget alloué",
      label2: "Consommé",
      title:
        "Budget alloué vs consommé"
    }
  );


  /*
   * Graphique 2
   */

  drawHorizontalBars(
    doc,
    {
      x:
        graphX +
        graphWidthEach +
        graphGap,
      y: sectionY + 5,
      width: graphWidthEach,
      height: graphHeight,
      data: lignes,
      value1: "budgetDate",
      value2: "encouru",
      label1: "Budget à date",
      label2: "Consommé",
      title:
        "Consommé vs budget à date"
    }
  );


  /*
   * Graphique 3 :
   * consommation en %
   */

  const graph3Y =
    sectionY +
    graphHeight +
    17;


  drawHorizontalBars(
    doc,
    {
      x: graphX,
      y: graph3Y,
      width: graphWidth,
      height: 43,
      data: lignes,
      value1: "consoReelle",
      value2: "consoDate",
      label1: "Consommation réelle",
      label2: "Budget à date",
      title:
        "Taux de consommation",
      percent: true,
      maxValue:
        Math.max(
          100,
          ...lignes.map(
            r =>
              Number(
                r.consoReelle
              ) || 0
          ),
          ...lignes.map(
            r =>
              Number(
                r.consoDate
              ) || 0
          )
        )
    }
  );


  /* =======================================================
     ANALYSE
     ======================================================= */

  const analysisX =
    margin;

  const analysisY =
    sectionY +
    tableHeight +
    4;

  const analysisWidth =
    contentWidth;

  const analysisHeight =
    pageHeight -
    analysisY -
    7;


  roundedBox(
    doc,
    analysisX,
    analysisY,
    analysisWidth,
    analysisHeight,
    [255, 255, 255],
    2
  );


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(7);

  pdfTextColor(
    doc,
    [15, 23, 42]
  );

  doc.text(
    "Analyse de pilotage",
    analysisX + 5,
    analysisY + 6
  );


  /*
   * Texte automatique en fonction
   * du résultat du dashboard.
   */

  const ecartH =
    Number(
      total.ecartH
    ) || 0;

  const ecartPts =
    Number(
      total.ecartPoints
    ) || 0;

  const conso =
    Number(
      total.consoReelle
    ) || 0;

  const consoDate =
    Number(
      total.consoDate
    ) || 0;


  let analysisText = "";


  if (ecartH > 0) {

    analysisText =
      `La consommation cumulée est supérieure de ` +
      `${fmt1(Math.abs(ecartH))} h ` +
      `au budget à date. ` +
      `La consommation réelle atteint ` +
      `${fmt1(conso)} % du budget alloué, ` +
      `contre ${fmt1(consoDate)} % selon le budget à date.`;

  } else {

    analysisText =
      `La consommation cumulée est inférieure de ` +
      `${fmt1(Math.abs(ecartH))} h ` +
      `au budget à date. ` +
      `La consommation réelle atteint ` +
      `${fmt1(conso)} % du budget alloué, ` +
      `contre ${fmt1(consoDate)} % selon le budget à date.`;

  }


  const textLines =
    fitText(
      doc,
      analysisText,
      145,
      6
    );


  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(6);

  pdfTextColor(
    doc,
    [71, 85, 105]
  );

  doc.text(
    textLines,
    analysisX + 5,
    analysisY + 12
  );


  /*
   * Petits indicateurs à droite
   */

  const infoX =
    analysisX +
    165;

  const info = [

    [
      "Écart heures",
      `${
        ecartH > 0
          ? "+"
          : ""
      }${fmt1(ecartH)} h`
    ],

    [
      "Écart points",
      `${
        ecartPts > 0
          ? "+"
          : ""
      }${fmt1(ecartPts)} pts`
    ],

    [
      "Reste",
      `${fmt1(total.reste)} h`
    ]

  ];


  info.forEach(
    (item, index) => {

      const ix =
        infoX +
        index * 34;

      doc.setFontSize(4.5);

      pdfTextColor(
        doc,
        [100, 116, 139]
      );

      doc.text(
        item[0],
        ix,
        analysisY + 7
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(7);

      pdfTextColor(
        doc,
        [15, 23, 42]
      );

      doc.text(
        item[1],
        ix,
        analysisY + 13
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

    }
  );


  /* =======================================================
     PIED DE PAGE
     ======================================================= */

  doc.setFontSize(4.5);

  pdfTextColor(
    doc,
    [148, 163, 184]
  );

  doc.text(
    "PilotageH — Rapport généré automatiquement à partir des données d'alimentation",
    margin,
    pageHeight - 3
  );

  doc.text(
    "A4 paysage",
    pageWidth - margin,
    pageHeight - 3,
    {
      align: "right"
    }
  );


  /* =======================================================
     SAUVEGARDE
     ======================================================= */

  doc.save(
    "pilotageh_rapport.pdf"
  );
}


/* =========================================================
   MODÈLE EXCEL
   ========================================================= */

export function downloadTemplate() {

  const data = [
    [
      "Affaire",
      "Métier",
      "Heures consommées",
      "Budget à date",
      "Budget alloué",
      "Date"
    ],

    [
      "EXEMPLE",
      "Mécanique",
      120,
      150,
      300,
      "2026-09-18"
    ]
  ];

  const wb =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(data),
    "Alimentation"
  );

  XLSX.writeFile(
    wb,
    "modele_alimentation_pilotageh.xlsx"
  );
}