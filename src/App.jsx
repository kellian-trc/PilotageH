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
  exportPDF,
  downloadTemplate
} from "./export";

import {
  signIn,
  getSession,
  subscribeToAuth
} from "./lib/auth";


/* =========================================================
   HOOK GLOBAL DES DONNÉES
   ========================================================= */

function useData() {
  const [rows, setRows] = useState([]);
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await loadData();

        if (!mounted) return;

        syncMetiers(data);

        setRows(data);
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
        setSettings(loadSettings());
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
        typeof unsubscribeRealtime === "function"
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
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="actions">
        {actions}
      </div>
    </div>
  );
}


/* =========================================================
   GRAPHIQUE HORIZONTAL SCROLLABLE
   ========================================================= */

function MetiersBarChart({
  data,
  bars,
  yAxisUnit
}) {
  /*
   * On réserve environ 120 px par métier.
   * Ainsi, même avec beaucoup de métiers,
   * les noms ne se chevauchent pas.
   */
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
          width: `${chartWidth}px`,
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
              unit={yAxisUnit || ""}
            />

            <Tooltip />

            {bars.length > 1 && (
              <Legend />
            )}

            {bars.map(bar => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name}
                fill={bar.fill}
              />
            ))}
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

  /*
   * Le filtre Affaire est initialisé depuis l'URL.
   * Exemple :
   *
   * /?affaire=AFF-001
   *
   * Cela permet de conserver le filtre lorsque
   * l'utilisateur ouvre un détail métier.
   */
  const initialAffaire =
    searchParams.get("affaire") || "";

  const [
    filters,
    setFilters
  ] = useState(() => ({
    affaire: initialAffaire,
    metier:
      searchParams.get("metier") || "",
    date:
      searchParams.get("date") || ""
  }));


  /*
   * Synchronisation des filtres avec l'URL.
   *
   * Le filtre reste donc mémorisé même lorsque
   * l'utilisateur quitte le Dashboard.
   */
  useEffect(() => {
    const params = {};

    if (filters.affaire) {
      params.affaire = filters.affaire;
    }

    if (filters.metier) {
      params.metier = filters.metier;
    }

    if (filters.date) {
      params.date = filters.date;
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


  const s = useMemo(
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


  const t = s.total;

  const affairs =
    distinct(
      rows,
      "affaire"
    ).length;


  const pieData =
    s.lignes.filter(
      x => x.encouru > 0
    );


  return (
    <>
      <Header
        title="Dashboard de pilotage"
        subtitle={
          `Consommation des heures par métier · ` +
          `${affairs} affaire${affairs > 1 ? "s" : ""}`
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
              <FileSpreadsheet size={15} />
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
              <Download size={15} />
              CSV
            </button>

            <button
              className="btn"
              onClick={() =>
                exportPDF(
                  s.lignes,
                  t,
                  {
                    date:
                      settings.dateAnalyse,
                    affaires
                  }
                )
              }
            >
              <FileText size={15} />
              PDF
            </button>
          </>
        }
      />


      <Filters
        rows={rows}
        filters={filters}
        setFilters={setFilters}
      />


      <div className="kpis">

        <KPI
          label="Budget alloué"
          value={fmt(t.budgetAlloue)}
          unit="h"
        />

        <KPI
          label="Heures consommées"
          value={fmt(t.encouru)}
          unit="h"
          kind="blue"
        />

        <KPI
          label="Budget à date"
          value={fmt(t.budgetDate)}
          unit="h"
          kind="green"
        />

        <KPI
          label="Écart consommé / date"
          value={sign(t.ecartH)}
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
          value={fmt1(t.consoReelle)}
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
          value={sign(t.ecartPoints)}
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
        lignes={s.lignes}
        total={t}
        filters={filters}
      />


      <div className="grid2">

        {/* =================================================
            HISTOGRAMME 1
           ================================================= */}

        <Card
          title="Budget alloué vs consommé"
          subtitle="Comparaison par métier"
        >

          <MetiersBarChart
            data={s.lignes}
            bars={[
              {
                dataKey: "budgetAlloue",
                name: "Budget alloué",
                fill: "#94a3b8"
              },
              {
                dataKey: "encouru",
                name: "Consommé",
                fill: "#2563eb"
              }
            ]}
          />

        </Card>


        {/* =================================================
            HISTOGRAMME 2
           ================================================= */}

        <Card
          title="Consommé vs budget à date"
          subtitle="Indicateur principal de pilotage"
          highlight
        >

          <MetiersBarChart
            data={s.lignes}
            bars={[
              {
                dataKey: "budgetDate",
                name: "Budget à date",
                fill: "#a7f3d0"
              },
              {
                dataKey: "encouru",
                name: "Consommé",
                fill: "#0891b2"
              }
            ]}
          />

        </Card>


        {/* =================================================
            HISTOGRAMME 3
           ================================================= */}

        <Card
          title="Taux de consommation"
          subtitle="Consommé / budget alloué"
        >

          <MetiersBarChart
            data={s.lignes}
            yAxisUnit="%"
            bars={[
              {
                dataKey: "consoReelle",
                name: "Consommation réelle",
                fill: "#2563eb"
              },
              {
                dataKey: "consoDate",
                name: "Budget à date",
                fill: "#cbd5e1"
              }
            ]}
          />

        </Card>


        {/* =================================================
            CAMEMBERT
           ================================================= */}

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
                data={pieData}
                dataKey="encouru"
                nameKey="metier"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {pieData.map(
                  (x, index) => (
                    <Cell
                      key={`${x.metier}-${index}`}
                      fill={
                        COLORS[x.metier] ||
                        COLORS.default ||
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
  const nav = useNavigate();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");


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

        nav("/imports");
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
          onSubmit={handleSubmit}
          className="loginform"
        >

          <label>
            Adresse e-mail

            <input
              type="email"
              value={email}
              onChange={e =>
                setEmail(e.target.value)
              }
              placeholder="votre@email.fr"
              required
            />
          </label>


          <label>
            Mot de passe

            <input
              type="password"
              value={password}
              onChange={e =>
                setPassword(e.target.value)
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
            disabled={busy}
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
            <ArrowLeft size={15} />
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
  const nav = useNavigate();

  const [session, setSession] =
    useState(undefined);


  useEffect(() => {
    let mounted = true;

    getSession()
      .then(s => {
        if (mounted) {
          setSession(s);
        }
      })
      .catch(error => {
        console.error(
          "Erreur récupération session :",
          error
        );

        if (mounted) {
          setSession(null);
        }
      });


    const authSubscription =
      subscribeToAuth(
        s => {
          if (mounted) {
            setSession(s);
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
        authSubscription.data.subscription.unsubscribe();
      }
    };

  }, []);


  if (
    session === undefined
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
  const { rows } =
    useData();

  const [preview, setPreview] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [msg, setMsg] =
    useState("");

  const [msgType, setMsgType] =
    useState("success");


  const handle = async e => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setBusy(true);
    setMsg("");
    setMsgType("success");


    try {
      const result =
        await readWorkbook(file);

      setPreview(result);

    } catch (err) {
      console.error(
        "Erreur lecture Excel :",
        err
      );

      setMsg(
        "Erreur de lecture : " +
        err.message
      );

      setMsgType("danger");

    } finally {
      setBusy(false);

      e.target.value = "";
    }
  };


  const validate =
    async () => {

      if (!preview) return;

      if (
        preview.missing?.length
      ) {
        setMsg(
          "Impossible d'importer : certaines colonnes obligatoires sont manquantes."
        );

        setMsgType("danger");
        return;
      }

      if (
        !preview.valid?.length
      ) {
        setMsg(
          "Aucune ligne valide à importer."
        );

        setMsgType("danger");
        return;
      }


      setBusy(true);


      try {
        await saveData(
          preview.valid
        );

        setPreview(null);

        setMsg(
          `${preview.valid.length} ligne(s) importée(s). ` +
          `Les anciennes données ont été remplacées.`
        );

        setMsgType("success");

      } catch (err) {
        console.error(
          "Erreur import :",
          err
        );

        setMsg(
          "Erreur lors de l'import : " +
          err.message
        );

        setMsgType("danger");

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
        <b>Format attendu</b>
        <span>Affaire</span>
        <span>Métier</span>
        <span>Heures consommées</span>
        <span>Budget à date</span>
        <span>Budget alloué</span>
        <span>Date (optionnelle)</span>
      </div>


      <Card
        title="Importer le fichier d'alimentation"
        subtitle={
          "Les colonnes sont reconnues automatiquement."
        }
      >

        <label className="drop">

          <Upload size={30} />

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
            onChange={handle}
          />

        </label>


        {msg && (
          <div
            className={`notice ${msgType}`}
          >
            {msg}
          </div>
        )}


        {preview && (
          <div className="preview">

            <div className="previewhead">

              <div>

                <b>
                  {preview.valid.length}
                  {" "}ligne(s) valide(s)
                  {" / "}
                  {preview.rows.length}
                </b>


                {preview.missing.length > 0 && (
                  <div className="notice danger">
                    Colonnes manquantes :
                    {" "}
                    {preview.missing.join(", ")}
                  </div>
                )}


                {preview.errors.length > 0 && (
                  <div className="notice warn">

                    <AlertTriangle
                      size={15}
                    />

                    {" "}
                    {preview.errors.length}
                    {" "}ligne(s) en erreur

                  </div>
                )}

              </div>


              <div>

                <button
                  className="btn"
                  onClick={() =>
                    setPreview(null)
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
                    <th>Affaire</th>
                    <th>Métier</th>
                    <th>Consommé</th>
                    <th>Budget date</th>
                    <th>Budget alloué</th>
                    <th>Date</th>
                  </tr>
                </thead>


                <tbody>

                  {preview.rows
                    .slice(0, 100)
                    .map(row => (

                      <tr key={row.id}>

                        <td>
                          {row.affaire}
                        </td>

                        <td>
                          {row.metier}
                        </td>

                        <td>
                          {row.encouru}
                        </td>

                        <td>
                          {row.budgetDate}
                        </td>

                        <td>
                          {row.budgetAlloue}
                        </td>

                        <td>
                          {row.date || "—"}
                        </td>

                      </tr>

                    ))}

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
            {fmt(rows.length)}
            {" "}
            <small>lignes</small>
          </div>

          <p className="muted">
            Les données sont centralisées
            dans Supabase.
          </p>
        </Card>


        <Card title="Effacer les données">

          <p className="muted">
            Cette action supprime toutes
            les données actuellement chargées.
          </p>


          <button
            className="btn dangerbtn"
            onClick={async () => {

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

            }}
          >
            <Trash2 size={15} />
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

  const [filters, setFilters] =
    useState({});

  const [metier, setMetier] =
    useState("Tous");


  const s = useMemo(
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


  useEffect(() => {

    if (
      metier !== "Tous" &&
      !METIERS.includes(metier)
    ) {
      setMetier("Tous");
    }

  }, [rows, metier]);


  const rs =
    metier === "Tous"
      ? s.filtered
      : s.filtered.filter(
          x =>
            x.metier === metier
        );


  const dates = [
    ...new Set(
      rs
        .map(x => x.date)
        .filter(Boolean)
    )
  ].sort();


  let cumul = 0;


  const serie =
    dates.map(date => {

      cumul += rs
        .filter(
          x => x.date === date
        )
        .reduce(
          (a, x) =>
            a + x.encouru,
          0
        );


      const budgetDate =
        rs
          .filter(
            x =>
              x.date === date
          )
          .reduce(
            (a, x) =>
              a + x.budgetDate,
            0
          );


      return {
        date,
        encouru: cumul,
        budgetDate
      };

    });


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
        rows={rows}
        filters={filters}
        setFilters={setFilters}
      />


      <div className="selectbar">

        <b>
          Métier pour l'évolution :
        </b>


        <select
          value={metier}
          onChange={e =>
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
        title={`Évolution temporelle — ${metier}`}
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
              data={serie}
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
            data={s.lignes}
            bars={[
              {
                dataKey: "ecartH",
                name: "Écart (h)",
                fill: "#0891b2"
              }
            ]}
          />

        </Card>


        <Card
          title="Écart en points"
        >

          <MetiersBarChart
            data={s.lignes}
            bars={[
              {
                dataKey: "ecartPoints",
                name: "Écart (pts)",
                fill: "#7c3aed"
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
    decodeURIComponent(nom);

  const nav =
    useNavigate();

  const [
    searchParams
  ] = useSearchParams();

  const {
    rows,
    settings
  } = useData();


  /*
   * Récupération automatique du filtre Affaire
   * transmis depuis le Dashboard.
   *
   * Aucun nouveau menu déroulant n'est ajouté
   * à cette page.
   */
  const affaire =
    searchParams.get("affaire") || "";


  const s = useMemo(
    () =>
      synthese(
        rows,
        METIERS,
        {
          metier,
          affaire
        },
        settings
      ),
    [
      rows,
      metier,
      affaire,
      settings
    ]
  );


  const r =
    s.lignes.find(
      x =>
        x.metier === metier
    );


  if (!r) {
    return (
      <div className="empty">
        Métier introuvable.
      </div>
    );
  }


  /*
   * Retour vers le Dashboard avec le filtre
   * Affaire toujours présent dans l'URL.
   */
  const handleBack = () => {

    const params = {};

    if (affaire) {
      params.affaire = affaire;
    }

    nav(
      `/?${new URLSearchParams(params).toString()}`
    );
  };


  return (
    <>
      <Header
        title={metier}
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
          status={r.statut}
        />
      </div>


      <div className="kpis">

        <KPI
          label="Budget alloué"
          value={fmt(
            r.budgetAlloue
          )}
          unit="h"
        />

        <KPI
          label="Consommé"
          value={fmt(
            r.encouru
          )}
          unit="h"
          kind="blue"
        />

        <KPI
          label="Budget à date"
          value={fmt(
            r.budgetDate
          )}
          unit="h"
          kind="green"
        />

        <KPI
          label="Écart"
          value={sign(
            r.ecartH
          )}
          unit="h"
          kind={
            r.ecartH > 0
              ? "red"
              : "green"
          }
        />

        <KPI
          label="Conso réelle"
          value={fmt1(
            r.consoReelle
          )}
          unit="%"
        />

        <KPI
          label="Écart points"
          value={sign(
            r.ecartPoints
          )}
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
            {pct(
              r.consoReelle
            )}
          </div>

          <div className="muted center">
            du budget alloué consommé
          </div>

        </Card>


        <Card title="Analyse">

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
              {fmt(
                Math.abs(
                  r.ecartH
                )
              )}{" "}
              h
            </b>

            {r.ecartH > 0
              ? " consommées au-dessus du budget à date."
              : " de moins que le budget à date."}

          </div>


          <p>
            La consommation réelle
            est de{" "}
            <b>
              {pct(
                r.consoReelle
              )}
            </b>

            {" "}contre{" "}

            <b>
              {pct(
                r.consoDate
              )}
            </b>

            {" "}du budget alloué
            au titre du budget à date,
            soit{" "}

            <b>
              {sign(
                r.ecartPoints
              )} points
            </b>.
          </p>


          <div className="infogrid">

            <span>
              Budget alloué
              <b>
                {fmt(
                  r.budgetAlloue
                )} h
              </b>
            </span>

            <span>
              Budget à date
              <b>
                {fmt(
                  r.budgetDate
                )} h
              </b>
            </span>

            <span>
              Consommé
              <b>
                {fmt(
                  r.encouru
                )} h
              </b>
            </span>

            <span>
              Reste
              <b>
                {fmt(
                  r.reste
                )} h
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
    (v / 100) * 180 - 90;


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
          color || "#64748b"
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

  const [s, setS] =
    useState(settings);


  useEffect(() => {
    setS(settings);
  }, [settings]);


  const handleSave =
    () => {

      const green =
        Number(s.green);

      const orange =
        Number(s.orange);


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
              value={s.green}
              onChange={e =>
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
              value={s.orange}
              onChange={e =>
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
              onChange={e =>
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
          <Save size={15} />
          Enregistrer
        </button>

      </Card>


      <Card
        title="Métiers suivis"
      >

        <div className="metierlist">

          {METIERS.map(
            (m, i) => (

              <span
                key={m}
              >

                <i
                  style={{
                    background:
                      COLORS[m] ||
                      COLORS.default ||
                      "#64748b"
                  }}
                />

                {i + 1}. {m}

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


      <Card title="Formules">

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