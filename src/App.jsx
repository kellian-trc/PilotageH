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
   OUTILS PDF
   ========================================================= */

function pdfText(doc, text, x, y, options = {}) {
  const {
    size = 8,
    color = [30, 41, 59],
    bold = false,
    align = "left"
  } = options;

  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(String(text ?? ""), x, y, {
    align
  });
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
  doc.setFillColor(...fill);
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


function pdfLine(
  doc,
  x1,
  y1,
  x2,
  y2,
  color = [226, 232, 240],
  width = 0.3
) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(
    x1,
    y1,
    x2,
    y2
  );
}


function hexToRgb(hex) {
  const clean =
    String(hex || "")
      .replace("#", "");

  if (clean.length !== 6) {
    return [100, 116, 139];
  }

  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}


/* =========================================================
   PDF PROFESSIONNEL
   ========================================================= */

function exportProfessionalPDF(
  lignes,
  total,
  meta = {}
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const PAGE_W = 297;
  const PAGE_H = 210;

  const M = 8;

  const blue = [37, 99, 235];
  const dark = [15, 23, 42];
  const text = [30, 41, 59];
  const muted = [100, 116, 139];
  const border = [226, 232, 240];
  const light = [248, 250, 252];
  const green = [22, 163, 74];
  const orange = [234, 88, 12];
  const red = [220, 38, 38];

  /* =======================================================
     PAGE
     ======================================================= */

  doc.setFillColor(
    248,
    250,
    252
  );

  doc.rect(
    0,
    0,
    PAGE_W,
    PAGE_H,
    "F"
  );


  /* =======================================================
     EN-TÊTE
     ======================================================= */

  doc.setFillColor(
    ...blue
  );

  doc.rect(
    0,
    0,
    PAGE_W,
    20,
    "F"
  );

  pdfText(
    doc,
    "PILOTAGE H",
    M,
    9,
    {
      size: 13,
      color: [255, 255, 255],
      bold: true
    }
  );

  pdfText(
    doc,
    "RAPPORT DE PILOTAGE DES HEURES",
    M,
    15,
    {
      size: 7,
      color: [219, 234, 254],
      bold: true
    }
  );

  pdfText(
    doc,
    meta.date || "—",
    PAGE_W - M,
    9,
    {
      size: 8,
      color: [255, 255, 255],
      bold: true,
      align: "right"
    }
  );

  pdfText(
    doc,
    meta.affaire
      ? `Affaire : ${meta.affaire}`
      : "Toutes les affaires",
    PAGE_W - M,
    15,
    {
      size: 7,
      color: [219, 234, 254],
      align: "right"
    }
  );


  /* =======================================================
     KPI
     ======================================================= */

  const kpiY = 24;
  const kpiH = 18;
  const gap = 3;

  const kpiW =
    (PAGE_W - 2 * M - 5 * gap) / 6;

  const kpis = [
    {
      label: "BUDGET ALLOUÉ",
      value: `${fmt(total.budgetAlloue)} h`,
      color: [71, 85, 105]
    },
    {
      label: "HEURES CONSOMMÉES",
      value: `${fmt(total.encouru)} h`,
      color: blue
    },
    {
      label: "BUDGET À DATE",
      value: `${fmt(total.budgetDate)} h`,
      color: green
    },
    {
      label: "ÉCART HEURES",
      value: sign(total.ecartH),
      color:
        total.ecartH > 0
          ? red
          : green
    },
    {
      label: "CONSOMMATION",
      value: `${fmt1(total.consoReelle)} %`,
      color: orange
    },
    {
      label: "ÉCART THÉORIQUE",
      value: `${sign(total.ecartPoints)} pts`,
      color:
        total.ecartPoints >
        (meta.orange ?? 10)
          ? red
          : total.ecartPoints >
            (meta.green ?? 5)
            ? orange
            : green
    }
  ];

  kpis.forEach(
    (kpi, index) => {
      const x =
        M +
        index *
          (kpiW + gap);

      pdfRect(
        doc,
        x,
        kpiY,
        kpiW,
        kpiH,
        [255, 255, 255],
        2
      );

      doc.setFillColor(
        ...kpi.color
      );

      doc.roundedRect(
        x,
        kpiY,
        1.5,
        kpiH,
        0.75,
        0.75,
        "F"
      );

      pdfText(
        doc,
        kpi.label,
        x + 4,
        kpiY + 6,
        {
          size: 5.5,
          color: muted,
          bold: true
        }
      );

      pdfText(
        doc,
        kpi.value,
        x + 4,
        kpiY + 14,
        {
          size: 10,
          color: dark,
          bold: true
        }
      );
    }
  );


  /* =======================================================
     TITRE SECTION PRINCIPALE
     ======================================================= */

  pdfText(
    doc,
    "SYNTHÈSE PAR MÉTIER",
    M,
    48,
    {
      size: 8,
      color: dark,
      bold: true
    }
  );

  pdfText(
    doc,
    `${lignes.length} métier(s) suivi(s)`,
    PAGE_W - M,
    48,
    {
      size: 6,
      color: muted,
      align: "right"
    }
  );


  /* =======================================================
     TABLEAU
     ======================================================= */

  const tableX = M;
  const tableY = 51;
  const tableW = 151;
  const tableH = 74;

  pdfRect(
    doc,
    tableX,
    tableY,
    tableW,
    tableH,
    [255, 255, 255],
    2
  );

  const cols = [
    {
      label: "Métier",
      width: 29
    },
    {
      label: "Cons.",
      width: 18
    },
    {
      label: "B. date",
      width: 18
    },
    {
      label: "B. alloué",
      width: 19
    },
    {
      label: "Reste",
      width: 18
    },
    {
      label: "Conso.",
      width: 17
    },
    {
      label: "Écart h",
      width: 17
    },
    {
      label: "Écart pts",
      width: 17
    },
    {
      label: "Statut",
      width: 18
    }
  ];

  let cx = tableX;

  doc.setFillColor(
    241,
    245,
    249
  );

  doc.rect(
    tableX,
    tableY,
    tableW,
    7,
    "F"
  );

  cols.forEach(
    col => {
      pdfText(
        doc,
        col.label,
        cx + 1.5,
        tableY + 4.7,
        {
          size: 4.5,
          color: muted,
          bold: true
        }
      );

      cx += col.width;
    }
  );


  const rowHeight =
    lignes.length > 18
      ? 3.15
      : 3.55;

  const maxRows =
    Math.floor(
      (tableH - 10) /
        rowHeight
    );

  const displayRows =
    lignes.slice(
      0,
      maxRows
    );

  displayRows.forEach(
    (r, index) => {
      const y =
        tableY +
        7 +
        index *
          rowHeight;

      if (
        index % 2 === 1
      ) {
        doc.setFillColor(
          248,
          250,
          252
        );

        doc.rect(
          tableX,
          y,
          tableW,
          rowHeight,
          "F"
        );
      }

      let x =
        tableX;

      const values = [
        r.metier,
        fmt(r.encouru),
        fmt(r.budgetDate),
        fmt(r.budgetAlloue),
        fmt(r.reste),
        `${fmt1(r.consoReelle)}%`,
        sign(r.ecartH),
        `${sign(r.ecartPoints)}`,
        r.statut
      ];

      values.forEach(
        (value, colIndex) => {

          let color =
            text;

          let bold =
            colIndex === 0;

          if (
            colIndex === 8
          ) {
            color =
              r.statut === "vert"
                ? green
                : r.statut ===
                  "orange"
                  ? orange
                  : red;

            bold = true;
          }

          pdfText(
            doc,
            String(value),
            x + 1.5,
            y + rowHeight - 1,
            {
              size:
                colIndex === 0
                  ? 4.2
                  : 4.0,
              color,
              bold
            }
          );

          x +=
            cols[colIndex]
              .width;
        }
      );
    }
  );


  /* =======================================================
     TOTAL
     ======================================================= */

  const totalY =
    tableY +
    7 +
    displayRows.length *
      rowHeight;

  if (
    totalY <
    tableY +
      tableH -
      2
  ) {
    doc.setFillColor(
      226,
      232,
      240
    );

    doc.rect(
      tableX,
      totalY,
      tableW,
      rowHeight + 1,
      "F"
    );

    let x =
      tableX;

    const values = [
      "TOTAL",
      fmt(total.encouru),
      fmt(total.budgetDate),
      fmt(total.budgetAlloue),
      fmt(total.reste),
      `${fmt1(total.consoReelle)}%`,
      sign(total.ecartH),
      `${sign(total.ecartPoints)}`,
      total.statut
    ];

    values.forEach(
      (value, colIndex) => {

        const color =
          colIndex === 8
            ? (
                total.statut ===
                "vert"
                  ? green
                  : total.statut ===
                    "orange"
                    ? orange
                    : red
              )
            : dark;

        pdfText(
          doc,
          String(value),
          x + 1.5,
          totalY +
            rowHeight,
          {
            size: 4.1,
            color,
            bold: true
          }
        );

        x +=
          cols[colIndex]
            .width;
      }
    );
  }


  /* =======================================================
     ZONE ANALYSE
     ======================================================= */

  const analysisX =
    M + tableW + 4;

  const analysisY = 51;

  const analysisW =
    PAGE_W -
    M -
    analysisX;

  const analysisH = 74;

  pdfRect(
    doc,
    analysisX,
    analysisY,
    analysisW,
    analysisH,
    [255, 255, 255],
    2
  );

  pdfText(
    doc,
    "ANALYSE DE LA SITUATION",
    analysisX + 5,
    analysisY + 8,
    {
      size: 7,
      color: dark,
      bold: true
    }
  );

  pdfLine(
    doc,
    analysisX + 5,
    analysisY + 11,
    analysisX +
      analysisW -
      5,
    analysisY + 11
  );


  let analysisText = "";

  if (
    total.ecartH > 0
  ) {
    analysisText =
      `La consommation cumulée est supérieure ` +
      `au budget à date de ${fmt(
        total.ecartH
      )} h.`;
  } else {
    analysisText =
      `La consommation cumulée reste inférieure ` +
      `au budget à date de ${fmt(
        Math.abs(
          total.ecartH
        )
      )} h.`;
  }


  const lines =
    doc.splitTextToSize(
      analysisText,
      analysisW - 10
    );

  lines.forEach(
    (line, i) => {
      pdfText(
        doc,
        line,
        analysisX + 5,
        analysisY +
          18 +
          i * 4,
        {
          size: 6,
          color: text
        }
      );
    }
  );


  pdfText(
    doc,
    "Consommation réelle",
    analysisX + 5,
    analysisY + 33,
    {
      size: 5.5,
      color: muted
    }
  );

  pdfText(
    doc,
    `${fmt1(
      total.consoReelle
    )} %`,
    analysisX + 5,
    analysisY + 40,
    {
      size: 10,
      color: blue,
      bold: true
    }
  );


  pdfText(
    doc,
    "Consommation à date",
    analysisX + 55,
    analysisY + 33,
    {
      size: 5.5,
      color: muted
    }
  );

  pdfText(
    doc,
    `${fmt1(
      total.consoDate
    )} %`,
    analysisX + 55,
    analysisY + 40,
    {
      size: 10,
      color: orange,
      bold: true
    }
  );


  pdfText(
    doc,
    "Écart",
    analysisX + 105,
    analysisY + 33,
    {
      size: 5.5,
      color: muted
    }
  );

  pdfText(
    doc,
    `${sign(
      total.ecartPoints
    )} pts`,
    analysisX + 105,
    analysisY + 40,
    {
      size: 10,
      color:
        total.ecartPoints > 0
          ? orange
          : green,
      bold: true
    }
  );


  /* =======================================================
     BARRE DE STATUT
     ======================================================= */

  const barX =
    analysisX + 5;

  const barY =
    analysisY + 48;

  const barW =
    analysisW - 10;

  const barH = 6;

  const budget =
    Math.max(
      Number(
        total.budgetAlloue
      ) || 0,
      1
    );

  const consumedRatio =
    Math.max(
      0,
      Math.min(
        1,
        Number(
          total.encouru
        ) /
          budget
      )
    );

  pdfRect(
    doc,
    barX,
    barY,
    barW,
    barH,
    [226, 232, 240],
    2
  );

  pdfRect(
    doc,
    barX,
    barY,
    barW *
      consumedRatio,
    barH,
    total.encouru >
      total.budgetAlloue
      ? red
      : blue,
    2
  );

  pdfText(
    doc,
    `${fmt(
      total.encouru
    )} h consommées / ${fmt(
      total.budgetAlloue
    )} h`,
    barX,
    barY + 12,
    {
      size: 5,
      color: muted
    }
  );


  /* =======================================================
     HISTOGRAMMES
     ======================================================= */

  const chartSectionY =
    129;

  pdfText(
    doc,
    "INDICATEURS PAR MÉTIER",
    M,
    chartSectionY,
    {
      size: 8,
      color: dark,
      bold: true
    }
  );


  /* =======================================================
     CHART 1
     Budget / consommé
     ======================================================= */

  const chartY =
    chartSectionY + 4;

  const chartGap = 4;

  const chartW =
    (PAGE_W -
      2 * M -
      chartGap) /
    2;

  const chartH = 67;


  function drawBarChart(
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
  ) {

    pdfRect(
      doc,
      x,
      y,
      width,
      height,
      [255, 255, 255],
      2
    );

    pdfText(
      doc,
      title,
      x + 5,
      y + 7,
      {
        size: 6.5,
        color: dark,
        bold: true
      }
    );

    /* Légende */

    const legendY =
      y + 6;

    doc.setFillColor(
      ...firstColor
    );

    doc.rect(
      x + width - 62,
      legendY - 3,
      3,
      3,
      "F"
    );

    pdfText(
      doc,
      firstLabel,
      x + width - 57,
      legendY,
      {
        size: 4.5,
        color: muted
      }
    );

    doc.setFillColor(
      ...secondColor
    );

    doc.rect(
      x + width - 31,
      legendY - 3,
      3,
      3,
      "F"
    );

    pdfText(
      doc,
      secondLabel,
      x + width - 26,
      legendY,
      {
        size: 4.5,
        color: muted
      }
    );


    const left =
      x + 31;

    const right =
      x + width - 5;

    const top =
      y + 12;

    const bottom =
      y + height - 7;

    const plotW =
      right - left;

    const plotH =
      bottom - top;


    const maxValue =
      Math.max(
        1,
        ...rows.flatMap(
          r => [
            Number(
              r[firstKey]
            ) || 0,
            Number(
              r[secondKey]
            ) || 0
          ]
        )
      );


    const rowH =
      plotH /
      Math.max(
        rows.length,
        1
      );


    /* grille */

    [0, 0.25, 0.5, 0.75, 1].forEach(
      ratio => {

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
          [241, 245, 249],
          0.2
        );

        pdfText(
          doc,
          fmt(
            maxValue *
              ratio
          ),
          gx,
          top - 1.5,
          {
            size: 3.5,
            color: muted,
            align:
              ratio === 0
                ? "left"
                : ratio === 1
                  ? "right"
                  : "center"
          }
        );
      }
    );


    rows.forEach(
      (r, index) => {

        const rowY =
          top +
          index *
            rowH;

        const labelY =
          rowY +
          rowH *
            0.7;

        const label =
          String(
            r.metier
          );

        pdfText(
          doc,
          label.length > 18
            ? `${label.slice(
                0,
                17
              )}…`
            : label,
          x + 3,
          labelY,
          {
            size: 3.7,
            color: text,
            bold: true
          }
        );


        const v1 =
          Math.max(
            0,
            Number(
              r[firstKey]
            ) || 0
          );

        const v2 =
          Math.max(
            0,
            Number(
              r[secondKey]
            ) || 0
          );


        const barHeight =
          Math.max(
            0.8,
            rowH *
              0.28
          );


        const y1 =
          rowY +
          rowH *
            0.18;

        const y2 =
          rowY +
          rowH *
            0.56;


        doc.setFillColor(
          ...firstColor
        );

        doc.rect(
          left,
          y1,
          plotW *
            (v1 /
              maxValue),
          barHeight,
          "F"
        );


        doc.setFillColor(
          ...secondColor
        );

        doc.rect(
          left,
          y2,
          plotW *
            (v2 /
              maxValue),
          barHeight,
          "F"
        );
      }
    );
  }


  drawBarChart(
    M,
    chartY,
    chartW,
    chartH,
    "Budget alloué vs consommé",
    lignes,
    "budgetAlloue",
    "encouru",
    [148, 163, 184],
    blue,
    "Budget",
    "Consommé"
  );


  drawBarChart(
    M +
      chartW +
      chartGap,
    chartY,
    chartW,
    chartH,
    "Consommé vs budget à date",
    lignes,
    "budgetDate",
    "encouru",
    [167, 243, 208],
    [8, 145, 178],
    "Budget date",
    "Consommé"
  );


  /* =======================================================
     PIED DE PAGE
     ======================================================= */

  pdfLine(
    doc,
    M,
    PAGE_H - 8,
    PAGE_W - M,
    PAGE_H - 8,
    border,
    0.3
  );

  pdfText(
    doc,
    "PilotageH · Rapport généré automatiquement",
    M,
    PAGE_H - 4,
    {
      size: 5,
      color: muted
    }
  );

  pdfText(
    doc,
    meta.affaire
      ? `Analyse filtrée : ${meta.affaire}`
      : "Analyse globale",
    PAGE_W / 2,
    PAGE_H - 4,
    {
      size: 5,
      color: muted,
      align: "center"
    }
  );

  pdfText(
    doc,
    `${lignes.length} métiers`,
    PAGE_W - M,
    PAGE_H - 4,
    {
      size: 5,
      color: muted,
      align: "right"
    }
  );


  /* =======================================================
     SAUVEGARDE
     ======================================================= */

  const safeAffaire =
    String(
      meta.affaire ||
        "global"
    )
      .replace(
        /[^a-zA-Z0-9-_]/g,
        "_"
      )
      .slice(0, 50);

  doc.save(
    `pilotageh_rapport_${safeAffaire}.pdf`
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

      } catch (error) {

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


  /*
   * Synchronisation URL
   */

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

      } catch (err) {

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

      } catch (err) {

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

      } catch (err) {

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

                } catch (err) {

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
                x.encouru,
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
                x.budgetDate,
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


  /*
   * Retour complet :
   * on restaure tous les filtres
   * connus du Dashboard.
   */

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
        value || 0
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