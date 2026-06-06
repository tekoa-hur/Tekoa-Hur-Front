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

  // Redirigir si no es alumno
  useEffect(() => {
    if (!authLoading && !usuario) { router.push("/login"); return; }
    if (!authLoading && usuario?.rol !== "alumno") { router.push("/"); }
  }, [authLoading, usuario, router]);

  useEffect(() => {
    if (!usuario || usuario.rol !== "alumno") return;

    (async () => {
      setLoading(true); setError("");
      try {
        const dniEstudiante = obtenerDniEstudiante(usuario);
        if (!dniEstudiante) {
          throw new Error("No se pudo identificar el DNI del estudiante.");
        }

        // 1. Obtener el estudiante con sus comisiones (sin materia/profesor incluidos)
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

        // 2. Para cada comisión, cargar el detalle completo (con materia y profesor)
        //    y las asistencias filtradas por esa comisión
        const resultados = await Promise.all(
          comisionesRaw.map(async (com) => {
            const comisionId = com.comisionId ?? com.id;

            const [resDetalle, resAsis, resFeriados, resDiasSinClase] = await Promise.all([
              // Detalle de la comisión con materia y profesor
              fetch(`${BACK_URL}/api/comisiones/${comisionId}`, { headers }),
              // Asistencias de esta comisión — filtramos las del alumno en cliente
              fetch(`${BACK_URL}/api/asistencias?comisionId=${comisionId}`, { headers }),
              // Feriados para marcar en la grilla
              fetch(`${BACK_URL}/api/feriados`, { headers }),
              fetch(`${BACK_URL}/api/diaSinClase`, { headers }),
            ]);

            const detalle = resDetalle.ok ? await resDetalle.json() : com;
            const asistencias = resAsis.ok ? await resAsis.json() : [];
            //Feriados para marcar en la grilla
            const feriadosData = resFeriados.ok
              ? await resFeriados.json()
              : [];
            const diasSinClaseData = resDiasSinClase.ok
              ? await resDiasSinClase.json()
              : [];

            const diasSinClaseComision = Array.isArray(diasSinClaseData)
              ? diasSinClaseData.filter(d => String(d.comisionId) === String(comisionId))
              : [];

            // Transformar feriados y cancelaciones en eventos
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

            // Filtrar solo las asistencias del alumno
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

  if (authLoading || !usuario) return null;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Mis Asistencias</h1>
          <p className="mt-1 text-sm text-gray-500">
            Historial de asistencia por comisión — {usuario.nombre}
          </p>
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

        {!loading && !error && comisiones.length > 0 && (
          <div className="flex flex-col gap-5">
            {comisiones.map(({ comision, asistencias, eventos, periodo }) => (
              <ComisionCard
                key={comision.comisionId ?? comision.id}
                comision={comision}
                asistencias={asistencias}
                eventos={eventos}
                periodo={periodo}
              />

            ))}
          </div>
        )}

      </div>
    </div>
  );
}


/**
 * Genera todas las fechas de cursada de una comisión
 * desde el inicio del período hasta hoy (o hasta el fin del período,
 * si éste ya terminó).
 *
 * Solo incluye los días en los que realmente se cursa según los horarios de la comisión.
 */
function generarFechasCursada(periodo, horarios) {

  // Si no tenemos fechas de inicio o fin del período, no podemos generar la grilla.
  if (!periodo?.fecha_inicio_dictado || !periodo?.fecha_fin_dictado) {
    return [];
  }

  // Fecha actual en formato YYYY-MM-DD Ej: "2026-06-06"
  const hoy = new Date().toISOString().slice(0, 10);

  // Determinamos hasta qué fecha generar la grilla.
  // Si el período sigue vigente: usamos la fecha de hoy.
  // Si el período ya terminó: usamos la fecha de fin del período.
  const fechaLimite =
    hoy < periodo.fecha_fin_dictado
      ? hoy
      : periodo.fecha_fin_dictado;

  // Array donde iremos guardando las fechas de cursada.
  const fechas = [];

  // Fecha desde la que comenzamos a recorrer.
  let actual = new Date(`${periodo.fecha_inicio_dictado}T00:00:00`);

  // Fecha máxima a recorrer.
  const fin = new Date(`${fechaLimite}T00:00:00`);

  // Recorremos día por día desde el inicio hasta la fecha límite.
  while (actual <= fin) {
    // Convertimos la fecha actual a formato YYYY-MM-DD
    const fecha = actual.toISOString().slice(0, 10);
    // Verificamos si esa fecha corresponde a un día de cursada de la comisión.
    // Ejemplo: Si la comisión cursa lunes y miércoles, solo agregaremos esas fechas.
    if (correspondeADiaDeCursada(fecha, horarios)) {
      fechas.push(fecha);
    }

    // Avanzamos un día para seguir recorriendo.
    actual.setDate(actual.getDate() + 1);
  }

  // Devolvemos todas las fechas de cursada encontradas.
  return fechas;
}

/* ─── Tarjeta de comisión ───────────────────────────────────── */
function ComisionCard({ comision, asistencias, eventos = [], periodo }) {
  // Fechas únicas ordenadas incluidos feriados para marcar en la grilla

  const eventosFiltrados = eventos.filter(e =>
    estaEnPeriodo(e.fecha, periodo) &&
    correspondeADiaDeCursada(e.fecha, comision?.horarios)
  );


  // Todas las fechas de cursada hasta hoy
  const fechas = generarFechasCursada(
    periodo,
    comision?.horarios
  );

  // Presencias del alumno
  const presentes = new Set(
    asistencias
      .filter(a => String(a.estado).toUpperCase() === "PRESENTE")
      .map(a => normalizarFecha(a.fecha))
  );

  //Mapeo de eventos para marcar feriados en la grilla
  const eventosMap = new Map();

  eventosFiltrados.forEach(e => {
    eventosMap.set(e.fecha, e);
  });


  /*Asi contaria los feriados como clases y contarian en porcentajes
  const totalClases   = fechas.length;*/
  // Contar solo las fechas que no son feriados como clases
  const totalClases = fechas.filter(fecha => {
    const evento = eventosMap.get(fecha);
    return !evento;
  }).length;

  const totalPresente = asistencias.filter(
    a => String(a.estado).toUpperCase() === "PRESENTE"
  ).length;

  const porcentaje = totalClases > 0 ? Math.round((totalPresente / totalClases) * 100) : null;

  const colorPorcentaje =
    porcentaje === null ? "text-gray-400"
      : porcentaje >= 75 ? "text-green-700"
        : porcentaje >= 60 ? "text-amber-600"
          : "text-red-600";

  // Nombre de la materia — viene en comision.materia.nombre o en cod_comision
  const nombreMateria = comision.materia?.nombre ?? comision.cod_comision ?? "Comisión";
  const nombreDocente = comision.profesor?.nombre_apellido;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">

      {/* Header */}
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

      {/* Grilla de fechas */}
      {fechas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">
          Aún no hay clases registradas en esta comisión.
        </p>
      ) : (
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {fechas.map(fecha => {

              const asistencia = asistencias.find(
                a => normalizarFecha(a.fecha) === fecha
              );

              const evento = eventosMap.get(fecha);

              // Por defecto: asistencia pendiente de carga
              let texto = "-";
              let container = "border-gray-200 bg-gray-50";
              let textoColor = "text-gray-500";

              // Eventos tienen prioridad
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

          {/* Leyenda */}
          <div className="mt-3 flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-green-200" />
              Presente (P)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-200" />
              Ausente (A)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-yellow-200" />
              Cancelación (F)
            </span>

            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-blue-200" />
              No laborable (NL)
            </span>

            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-orange-200" />
              Paro docente (PD)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-gray-200" />
              Pendiente (-)
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