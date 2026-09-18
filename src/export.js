import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { fmt1 } from "./calculs";


// =========================================================
// TÉLÉCHARGEMENT
// =========================================================

function download(blob, name) {

  const u =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = u;
  a.download = name;

  document.body.appendChild(a);

  a.click();

  a.remove();

  // On laisse au navigateur le temps
  // de démarrer le téléchargement.

  setTimeout(() => {
    URL.revokeObjectURL(u);
  }, 1000);

}


// =========================================================
// EXPORT EXCEL
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

        fmt1(
          x.consoReelle
        ),

        fmt1(
          x.consoDate
        ),

        x.ecartH,

        fmt1(
          x.ecartPoints
        ),

        x.statut

      ]
    ),

    [
      "TOTAL",

      total.encouru,

      total.budgetDate,

      total.budgetAlloue,

      total.reste,

      fmt1(
        total.consoReelle
      ),

      fmt1(
        total.consoDate
      ),

      total.ecartH,

      fmt1(
        total.ecartPoints
      ),

      total.statut

    ]

  ];


  const wb =
    XLSX.utils.book_new();


  const ws =
    XLSX.utils.aoa_to_sheet(
      data
    );


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
// EXPORT CSV
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

        fmt1(
          x.consoReelle
        ),

        fmt1(
          x.consoDate
        ),

        x.ecartH,

        fmt1(
          x.ecartPoints
        ),

        x.statut

      ]
    ),

    [
      "TOTAL",

      total.encouru,

      total.budgetDate,

      total.budgetAlloue,

      total.reste,

      fmt1(
        total.consoReelle
      ),

      fmt1(
        total.consoDate
      ),

      total.ecartH,

      fmt1(
        total.ecartPoints
      ),

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
              cell =>
                `"${String(
                  cell ?? ""
                ).replaceAll(
                  '"',
                  '""'
                )}"`
            )
            .join(";")
      )
      .join("\n");


  download(

    new Blob(
      [
        csv
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    ),

    "pilotageh_export.csv"

  );

}


// =========================================================
// EXPORT PDF
// =========================================================

export function exportPDF(
  lignes,
  total,
  meta = {}
) {

  try {

    const doc =
      new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });


    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();


    const margin = 12;


    // =====================================================
    // TITRE
    // =====================================================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(16);

    doc.text(
      "PilotageH — Pilotage des heures",
      margin,
      15
    );


    // =====================================================
    // INFORMATIONS
    // =====================================================

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(9);


    doc.text(
      `Date d'analyse : ${
        meta.date || "—"
      }`,
      margin,
      22
    );


    // Affaire filtrée

    let affaireLabel =
      "Toutes";


    if (
      meta.affaire
    ) {

      affaireLabel =
        String(
          meta.affaire
        );

    }
    else if (
      meta.affaires &&
      typeof meta.affaires ===
        "string"
    ) {

      affaireLabel =
        meta.affaires;

    }
    else if (
      Number.isFinite(
        Number(
          meta.affaires
        )
      )
    ) {

      affaireLabel =
        `${meta.affaires} affaire${
          Number(
            meta.affaires
          ) > 1
            ? "s"
            : ""
        }`;

    }


    doc.text(
      `Affaire : ${affaireLabel}`,
      margin + 75,
      22
    );


    // =====================================================
    // INFORMATIONS SUPPLÉMENTAIRES
    // =====================================================

    doc.text(
      `Métiers : ${lignes.length}`,
      margin + 165,
      22
    );


    // =====================================================
    // TABLEAU
    // =====================================================

    const headers = [

      "Métier",
      "Consommé",
      "Budget date",
      "Budget alloué",
      "Reste",
      "Conso %",
      "Date %",
      "Écart h",
      "Écart pts",
      "Statut"

    ];


    const xs = [

      12,
      48,
      72,
      99,
      129,
      158,
      180,
      201,
      225,
      249

    ];


    let y = 34;


    // =====================================================
    // EN-TÊTES
    // =====================================================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(8);


    headers.forEach(
      (header, i) => {

        doc.text(
          header,
          xs[i],
          y
        );

      }
    );


    doc.line(
      margin,
      y + 2,
      pageWidth - margin,
      y + 2
    );


    y += 8;


    // =====================================================
    // DONNÉES
    // =====================================================

    const rows = [

      ...lignes,

      total

    ];


    rows.forEach(
      (r, index) => {

        // -------------------------------------------------
        // NOUVELLE PAGE
        // -------------------------------------------------

        if (
          y >
          pageHeight - 15
        ) {

          doc.addPage();

          y = 18;


          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(8);


          headers.forEach(
            (header, i) => {

              doc.text(
                header,
                xs[i],
                y
              );

            }
          );


          doc.line(
            margin,
            y + 2,
            pageWidth - margin,
            y + 2
          );


          y += 8;


          doc.setFont(
            "helvetica",
            "normal"
          );

        }


        const isTotal =
          index ===
          rows.length - 1;


        if (isTotal) {

          doc.setFont(
            "helvetica",
            "bold"
          );

        }
        else {

          doc.setFont(
            "helvetica",
            "normal"
          );

        }


        const values = [

          r.metier ??
            "—",

          fmt1(
            r.encouru
          ),

          fmt1(
            r.budgetDate
          ),

          fmt1(
            r.budgetAlloue
          ),

          fmt1(
            r.reste
          ),

          fmt1(
            r.consoReelle
          ),

          fmt1(
            r.consoDate
          ),

          fmt1(
            r.ecartH
          ),

          fmt1(
            r.ecartPoints
          ),

          r.statut ??
            "—"

        ];


        values.forEach(
          (value, i) => {

            let text =
              String(
                value
              );


            // Évite les débordements
            // des noms de métiers.

            if (
              i === 0 &&
              text.length > 25
            ) {

              text =
                text.substring(
                  0,
                  22
                ) +
                "...";

            }


            doc.text(
              text,
              xs[i],
              y
            );

          }
        );


        // Ligne au-dessus du TOTAL

        if (isTotal) {

          doc.line(
            margin,
            y - 5,
            pageWidth - margin,
            y - 5
          );

        }


        y += 6;

      }
    );


    // =====================================================
    // PIED DE PAGE
    // =====================================================

    const pages =
      doc.internal.getNumberOfPages();


    for (
      let i = 1;
      i <= pages;
      i++
    ) {

      doc.setPage(i);


      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7);


      doc.text(
        `PilotageH — Page ${i} / ${pages}`,
        pageWidth - margin,
        pageHeight - 7,
        {
          align: "right"
        }
      );

    }


    // =====================================================
    // GÉNÉRATION ET TÉLÉCHARGEMENT
    // =====================================================

    const blob =
      doc.output("blob");


    download(
      blob,
      "pilotageh_export.pdf"
    );


  }
  catch (error) {

    console.error(
      "Erreur génération PDF :",
      error
    );


    alert(
      "Impossible de générer le PDF. " +
      "Vérifiez la console du navigateur."
    );

  }

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