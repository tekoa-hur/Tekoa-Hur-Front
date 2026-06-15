"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BACK_URL, getAuthHeaders } from "@/config/api";

const PERIODO_TEKOA = 256;
const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

function normalizarFecha(fecha) {
  return typeof fecha === "string" ? fecha.slice(0, 10) : "";
}

function normalizarDni(dni) {
  return String(dni ?? "").replace(/\D/g, "");
}

function obtenerDniEstudiante(usuario) {
  return normalizarDni(usuario?.referenciaId || usuario?.dni);
}

function estaEnPeriodo(fecha, periodo) {
  const fechaNormalizada = normalizarFecha(fecha);
  return Boolean(
    fechaNormalizada &&
    periodo?.fecha_inicio_dictado &&
    periodo?.fecha_fin_dictado &&
    fechaNormalizada >= periodo.fecha_inicio_dictado &&
    fechaNormalizada <= periodo.fecha_fin_dictado
  );
}

function extraerPeriodoTekoa(periodos) {
  if (!Array.isArray(periodos)) return null;
  return periodos.find(p => String(p.periodo) === String(PERIODO_TEKOA)) ?? null;
}

function normalizarDiaSemana(diaSemana) {
  return String(diaSemana ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function obtenerDiaSemana(fecha) {
  const fechaNormalizada = normalizarFecha(fecha);
  if (!fechaNormalizada) return "";

  const date = new Date(`${fechaNormalizada}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return DIAS_SEMANA[date.getDay()];
}

function correspondeADiaDeCursada(fecha, horarios = []) {
  const diasCursada = new Set(
    (Array.isArray(horarios) ? horarios : [])
      .map(h => normalizarDiaSemana(h.diaSemana))
      .filter(Boolean)
  );

  return diasCursada.size > 0 && diasCursada.has(obtenerDiaSemana(fecha));
}

export default function MisAsistenciasPage() {
  return (
    <ProtectedRoute roles={["alumno"]}>
      <MisAsistenciasContenido />
    </ProtectedRoute>
  );
}

function MisAsistenciasContenido() {
  const router = useRouter();
  const { usuario, loading: authLoading } = useAuth();
  const headers = useMemo(() => ({ Accept: "application/json", ...getAuthHeaders() }), []);

  const [comisiones, setComisiones] = useState([]); // [{comision, asistencias[]}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Estado para el filtro del select
  const [comisionSeleccionada, setComisionSeleccionada] = useState("TODAS");

  // Estado para almacenar las comisiones ya filtradas
  const [comisionesFiltradas, setComisionesFiltradas] = useState([]);

  // Estado para controlar el spinner de descargas
  const [descargando, setDescargando] = useState(false);

  // Redirigir si no es alumno
  useEffect(() => {
    if (!authLoading && !usuario) { router.push("/login"); return; }
    if (!authLoading && usuario?.rol !== "alumno") { router.push("/"); }
  }, [authLoading, usuario, router]);

  // Fetch inicial de datos
  useEffect(() => {
    if (!usuario || usuario.rol !== "alumno") return;

    (async () => {
      setLoading(true); setError("");
      try {
        const dniEstudiante = obtenerDniEstudiante(usuario);
        if (!dniEstudiante) {
          throw new Error("No se pudo identificar el DNI del estudiante.");
        }

        const resEst = await fetch(`${BACK_URL}/api/estudiantes/${dniEstudiante}`, { headers });
        if (!resEst.ok) throw new Error("No se pudieron cargar tus comisiones.");
        const estData = await resEst.json();
        const dnisEstudiante = new Set([
          dniEstudiante,
          normalizarDni(estData?.dni),
          normalizarDni(usuario?.dni),
          normalizarDni(usuario?.referenciaId),
        ].filter(Boolean));

        const comisionesRaw = estData.comisiones ?? [];
        if (comisionesRaw.length === 0) { setComisiones([]); setLoading(false); return; }

        const resPeriodo = await fetch(`${BACK_URL}/api/guarani/periodos-tekoa`, { headers });
        const periodo = resPeriodo.ok ? extraerPeriodoTekoa(await resPeriodo.json()) : null;
        if (!periodo) {
          throw new Error(`No se pudo cargar el periodo ${PERIODO_TEKOA} desde Guarani.`);
        }

        const resultados = await Promise.all(
          comisionesRaw.map(async (com) => {
            const comisionId = com.comisionId ?? com.id;

            const [resDetalle, resAsis, resFeriados, resDiasSinClase] = await Promise.all([
              fetch(`${BACK_URL}/api/comisiones/${comisionId}`, { headers }),
              fetch(`${BACK_URL}/api/asistencias?comisionId=${comisionId}`, { headers }),
              fetch(`${BACK_URL}/api/feriados`, { headers }),
              fetch(`${BACK_URL}/api/diaSinClase`, { headers }),
            ]);

            const detalle = resDetalle.ok ? await resDetalle.json() : com;
            const asistencias = resAsis.ok ? await resAsis.json() : [];
            const feriadosData = resFeriados.ok ? await resFeriados.json() : [];
            const diasSinClaseData = resDiasSinClase.ok ? await resDiasSinClase.json() : [];

            const diasSinClaseComision = Array.isArray(diasSinClaseData)
              ? diasSinClaseData.filter(d => String(d.comisionId) === String(comisionId))
              : [];

            const eventos = [
              ...(Array.isArray(feriadosData) ? feriadosData : []),
              ...diasSinClaseComision,
            ]
              .filter(f =>
                estaEnPeriodo(f.fecha, periodo) &&
                correspondeADiaDeCursada(f.fecha, detalle?.horarios)
              )
              .map(f => ({
                fecha: f.fecha,
                tipo: f.tipoEvento?.nombre,
                descripcion: f.descripcion,
              }));

            const misAsistencias = Array.isArray(asistencias)
              ? asistencias.filter(a =>
                dnisEstudiante.has(normalizarDni(a.usuarioId)) &&
                a.tipoUsuario === "ESTUDIANTE" &&
                estaEnPeriodo(a.fecha, periodo)
              )
              : [];

            return {
              comision: detalle,
              asistencias: misAsistencias,
              eventos,
              periodo,
            };
          })
        );

        setComisiones(resultados);
      } catch (e) {
        setError(e.message ?? "Error al cargar tus asistencias.");
      } finally {
        setLoading(false);
      }
    })();
  }, [usuario, headers]);

  // useEffect que reemplaza el useMemo
  useEffect(() => {
    if (comisionSeleccionada === "TODAS") {
      setComisionesFiltradas(comisiones);
    } else {
      const filtradas = comisiones.filter(c => {
        const id = c.comision.comisionId ?? c.comision.id;
        return String(id) === String(comisionSeleccionada);
      });
      setComisionesFiltradas(filtradas);
    }
  }, [comisiones, comisionSeleccionada]);

  // Funcion para descargar el reporte desde el backend
  const descargarReporteBackend = async (formato) => {
    setDescargando(true);
    try {
      const authHeaders = getAuthHeaders();

      let url = `${BACK_URL}/api/reportes/mis-asistencias?format=${formato}`;
      if (comisionSeleccionada !== "TODAS") {
        url += `&comisionId=${comisionSeleccionada}`;
      }

      const respuesta = await fetch(url, {
        method: "GET",
        headers: {
          ...authHeaders,
        },
      });

      if (!respuesta.ok) {
        throw new Error(`Error del servidor al generar el reporte en ${formato.toUpperCase()}.`);
      }

      const blob = await respuesta.blob();

      const contentDisposition = respuesta.headers.get("content-disposition");
      let nombreArchivo = `Reporte_Asistencias.${formato}`;
      
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) nombreArchivo = match[1];
      }

      // En lugar de forzar la descarga con link.click() para el PDF:
    const urlBlob = window.URL.createObjectURL(blob);

    if (formato === "pdf") {
      // Abre el PDF en una pestaña nueva: Vista previa e impresión nativa asegurada
      window.open(urlBlob, "_blank");
    } else {
      // El CSV se sigue descargando directo
      const link = document.createElement("a");
      link.href = urlBlob;
      link.setAttribute("download", nombreArchivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    window.URL.revokeObjectURL(urlBlob);
        } catch (e) {
          alert(e.message ?? "Ocurrió un error al descargar el archivo.");
        } finally {
          setDescargando(false);
        }
      };

      if (authLoading || !usuario) return null;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">

        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold text-gray-800">Mis Asistencias</h1>
            <p className="mt-1 text-sm text-gray-500">
              Historial de asistencia por comisión — {usuario.nombre}
            </p>
          </div>
          
          {!loading && !error && comisiones.length > 0 && (
            <div className="flex flex-row items-center sm:flex-nowrap gap-2 w-full md:w-auto md:justify-end overflow-x-auto pb-1 sm:pb-0">
              
              <select
                value={comisionSeleccionada}
                onChange={(e) => setComisionSeleccionada(e.target.value)}
                className="max-w-[180px] sm:max-w-[240px] truncate rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-all cursor-pointer"
              >
                <option value="TODAS">Todas las materias</option>
                {comisiones.map(({ comision }) => {
                  const id = comision.comisionId ?? comision.id;
                  const nombre = comision.materia?.nombre ?? comision.cod_comision ?? "Comisión";
                  return (
                    <option key={id} value={id}>
                      {nombre} ({comision.cod_comision})
                    </option>
                  );
                })}
              </select>

              {descargando && (
                <span className="text-xs text-gray-400 animate-pulse shrink-0 px-1">
                  Generando...
                </span>
              )}
              
              <button
                onClick={() => descargarReporteBackend("csv")}
                disabled={descargando}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-50"
              >
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span className="hidden sm:inline">CSV / Excel</span>
                <span className="inline sm:hidden">CSV</span>
              </button>

              <button
                onClick={() => descargarReporteBackend("pdf")}
                disabled={descargando}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                PDF
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-gray-200">
            <svg className="h-5 w-5 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm text-gray-500">Cargando tus asistencias...</span>
          </div>
        )}

        {!loading && !error && comisiones.length === 0 && (
          <div className="rounded-2xl bg-white px-5 py-12 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm font-medium text-gray-600">No tenés comisiones asignadas.</p>
            <p className="mt-1 text-xs text-gray-400">Contactá al Área Académica si creés que es un error.</p>
          </div>
        )}

        {/* Mapeo sobre el estado sincronizado comisionesFiltradas */}
        {!loading && !error && comisiones.length > 0 && (
          <div className="flex flex-col gap-5">
            {comisionesFiltradas.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-500 bg-white rounded-2xl border border-gray-100">
                No se encontraron registros para la opción seleccionada.
              </p>
            ) : (
              comisionesFiltradas.map(({ comision, asistencias, eventos, periodo }) => (
                <ComisionCard
                  key={comision.comisionId ?? comision.id}
                  comision={comision}
                  asistencias={asistencias}
                  eventos={eventos}
                  periodo={periodo}
                />
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function generarFechasCursada(periodo, horarios) {
  if (!periodo?.fecha_inicio_dictado || !periodo?.fecha_fin_dictado) return [];
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaLimite = hoy < periodo.fecha_fin_dictado ? hoy : periodo.fecha_fin_dictado;
  const fechas = [];
  let actual = new Date(`${periodo.fecha_inicio_dictado}T00:00:00`);
  const fin = new Date(`${fechaLimite}T00:00:00`);

  while (actual <= fin) {
    const fecha = actual.toISOString().slice(0, 10);
    if (correspondeADiaDeCursada(fecha, horarios)) {
      fechas.push(fecha);
    }
    actual.setDate(actual.getDate() + 1);
  }
  return fechas;
}

/* ─── Tarjeta de comisión ───────────────────────────────────── */
function ComisionCard({ comision, asistencias, eventos = [], periodo }) {
  const eventosFiltrados = eventos.filter(e =>
    estaEnPeriodo(e.fecha, periodo) &&
    correspondeADiaDeCursada(e.fecha, comision?.horarios)
  );

  const fechas = generarFechasCursada(periodo, comision?.horarios);
  const eventosMap = new Map();
  eventosFiltrados.forEach(e => eventosMap.set(e.fecha, e));

  const totalClases = fechas.filter(fecha => !eventosMap.get(fecha)).length;
  const totalPresente = asistencias.filter(a => String(a.estado).toUpperCase() === "PRESENTE").length;
  const porcentaje = totalClases > 0 ? Math.round((totalPresente / totalClases) * 100) : null;

  const colorPorcentaje =
    porcentaje === null ? "text-gray-400"
      : porcentaje >= 75 ? "text-green-700"
        : porcentaje >= 60 ? "text-amber-600"
          : "text-red-600";

  const nombreMateria = comision.materia?.nombre ?? comision.cod_comision ?? "Comisión";
  const nombreDocente = comision.profesor?.nombre_apellido;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
        <div>
          <p className="text-sm font-bold text-gray-800">{nombreMateria}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>Comisión: <strong>{comision.cod_comision}</strong></span>
            {nombreDocente && <span>Docente: <strong>{nombreDocente}</strong></span>}
          </div>
        </div>

        {porcentaje !== null && (
          <div className="text-right shrink-0 ml-4">
            <p className={`text-2xl font-bold ${colorPorcentaje}`}>{porcentaje}%</p>
            <p className="text-xs text-gray-400">{totalPresente}/{totalClases} clases</p>
          </div>
        )}
      </div>

      {fechas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">
          Aún no hay clases registradas en esta comisión.
        </p>
      ) : (
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {fechas.map(fecha => {
              const asistencia = asistencias.find(a => normalizarFecha(a.fecha) === fecha);
              const evento = eventosMap.get(fecha);

              let texto = "-";
              let container = "border-gray-200 bg-gray-50";
              let textoColor = "text-gray-500";

              if (evento) {
                switch (evento.tipo) {
                  case "Cancelación de clase":
                    texto = "F";
                    container = "border-yellow-200 bg-yellow-50";
                    textoColor = "text-yellow-700";
                    break;
                  case "Día no laborable":
                    texto = "NL";
                    container = "border-blue-200 bg-blue-50";
                    textoColor = "text-blue-700";
                    break;
                  case "Paro docente":
                    texto = "PD";
                    container = "border-orange-200 bg-orange-50";
                    textoColor = "text-orange-700";
                    break;
                  default:
                    texto = "E";
                    container = "border-gray-200 bg-gray-50";
                    textoColor = "text-gray-700";
                }
              } else if (asistencia) {
                const estado = String(asistencia.estado).toUpperCase();
                if (estado === "PRESENTE") {
                  texto = "P";
                  container = "border-green-200 bg-green-50";
                  textoColor = "text-green-700";
                }
                if (estado === "AUSENTE") {
                  texto = "A";
                  container = "border-red-200 bg-red-50";
                  textoColor = "text-red-600";
                }
              }

              return (
                <div
                  key={fecha}
                  title={evento?.descripcion ?? fecha}
                  className={`flex flex-col items-center rounded-lg border px-2.5 py-2 text-center min-w-[48px] ${container}`}
                >
                  <span className="text-xs text-gray-500 leading-tight">
                    {formatearFecha(fecha)}
                  </span>
                  <span className={`mt-1 text-sm font-bold ${textoColor}`}>
                    {texto}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-green-200" /> Presente (P)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-200" /> Ausente (A)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-yellow-200" /> Cancelación (F)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-blue-200" /> No laborable (NL)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-orange-200" /> Paro docente (PD)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-gray-200" /> Pendiente (-)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatearFecha(fecha) {
  if (!fecha) return "";
  const p = fecha.split("-");
  return p.length < 3 ? fecha : `${p[2]}/${p[1]}`;
}