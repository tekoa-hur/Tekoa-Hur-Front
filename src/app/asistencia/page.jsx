"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AsistenciaGrid from "@/components/AsistenciaGrid";
import { BACK_URL, getAuthHeaders } from "@/config/api";

export default function AsistenciaPage() {
  return (
    <ProtectedRoute roles={["docente", "administrador"]}>
      <AsistenciaContenido />
    </ProtectedRoute>
  );
}

// ── Genera y descarga un archivo Excel con la grilla de asistencia ──────────
function descargarExcel({ titulo, alumnos, fechas, asistencias }) {
  // Construimos el CSV manualmente y lo descargamos como .xlsx con BOM UTF-8
  // (Excel lo abre correctamente sin necesidad de librerías externas)
  const BOM = "\uFEFF";

  // Encabezados: Nombre, DNI, fecha1, fecha2, ...
  const encabezados = ["Nombre y apellido", "DNI", ...fechas].join(";");

  // Mapa rápido: "alumnoId-fecha" → presente
  const asisSet = new Set(asistencias.map(a => `${a.alumnoId}-${a.fecha}`));

  // Filas
  const filas = [...alumnos]
    .sort((a, b) => a.apellido.localeCompare(b.apellido))
    .map(alumno => {
      const cols = [
        `"${alumno.apellido}"`,
        alumno.dni ?? alumno.id,
        ...fechas.map(f => asisSet.has(`${alumno.id}-${f}`) ? "P" : "A"),
      ];
      return cols.join(";");
    });

  const csv     = BOM + [encabezados, ...filas].join("\n");
  const blob    = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement("a");
  link.href     = url;
  link.download = `${titulo.replace(/[^a-zA-Z0-9_\-]/g, "_")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function AsistenciaContenido() {
  const router      = useRouter();
  const { usuario } = useAuth();
  const isDocente   = usuario?.rol === "docente";
  const isAdmin     = usuario?.rol === "administrador";
  const headers     = useMemo(() => ({ Accept: "application/json", ...getAuthHeaders() }), []);
  
  // Dias no laborables
  const [feriados, setFeriados] = useState([]);

  // Catálogo
  const [materias,    setMaterias]    = useState([]);  // solo admin
  const [comisiones,  setComisiones]  = useState([]);  // todas o filtradas por materia
  const [loadingCat,  setLoadingCat]  = useState(true);
  const [error,       setError]       = useState("");

  // Filtros
  const [materiaId,   setMateriaId]   = useState("");  // solo admin
  const [comisionId,  setComisionId]  = useState("");
  const [mostrarTodas, setMostrarTodas] = useState(false); // admin: ver todas las comisiones

  // Datos de asistencia
  const [fechas,      setFechas]      = useState([]);
  const [alumnos,     setAlumnos]     = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [loading,     setLoading]     = useState(false);

  // ── Cargar catálogo ──────────────────────────────────────────
  useEffect(() => {
    if (!BACK_URL || !usuario) return;
    (async () => {
      setLoadingCat(true); setError("");
      try {
        if (isDocente) {
          // Docente: solo sus comisiones
          const [resProf, resCom] = await Promise.all([
            fetch(`${BACK_URL}/api/profesores`, { headers }),
            fetch(`${BACK_URL}/api/comisiones`, { headers }),
          ]);
          const profList = await resProf.json();
          const comList  = await resCom.json();
          const profesor = profList.find(
            p => p.dni === usuario.referenciaId || p.dni === usuario.dni
          );
          if (!profesor) { setError("No encontramos tu perfil de docente."); return; }
          setComisiones(
            Array.isArray(comList)
              ? comList.filter(c => String(c.profesorId) === String(profesor.profesorId))
              : []
          );
        } else {
          // Admin: cargar materias y todas las comisiones
          const [resMat, resCom] = await Promise.all([
            fetch(`${BACK_URL}/api/materias`,   { headers }),
            fetch(`${BACK_URL}/api/comisiones`, { headers }),
          ]);
          const matList = await resMat.json();
          const comList = await resCom.json();
          setMaterias(Array.isArray(matList) ? matList : []);
          setComisiones(Array.isArray(comList) ? comList : []);
        }
      } catch {
        setError("Error cargando datos.");
      } finally {
        setLoadingCat(false);
      }
    })();
  }, [usuario, isDocente, headers]);

  // ── Comisiones filtradas según materia elegida (admin) ───────
  const comisionesFiltradas = useMemo(() => {
    if (isDocente) return comisiones;
    if (!materiaId || mostrarTodas) return comisiones;
    return comisiones.filter(c => String(c.materiaId) === String(materiaId));
  }, [comisiones, materiaId, mostrarTodas, isDocente]);

  const comisionInfo = comisiones.find(c => c.comisionId === comisionId);

  // ── Cargar asistencias ───────────────────────────────────────
  useEffect(() => {
    if (!comisionId || !BACK_URL) return;
    setLoading(true); setError("");
    (async () => {
      try {
        const [resAsis, resCom, resFeriados] = await Promise.all([
          fetch(`${BACK_URL}/api/asistencias?comisionId=${comisionId}`, { headers }),
          fetch(`${BACK_URL}/api/comisiones/${comisionId}`,             { headers }),
          // Para dias no laborable
          fetch(`${BACK_URL}/api/feriados`,                             { headers }),
        ]);
        if (!resAsis.ok) throw new Error("Error cargando asistencias");

        const registros = await resAsis.json();
        const comData   = resCom.ok ? await resCom.json() : comisionInfo;

        // Dia no laborable
        const feriadosData = resFeriados.ok ? await resFeriados.json() : [];


        const estudiantesMatric  = comData?.estudiantes ?? [];
        const alumnosFormateados = estudiantesMatric.map(e => ({
          id:      e.dni,
          dni:     e.dni,
          apellido: e.nombre_apellido,
        }));

        const soloEstudiantes = registros.filter(r => r.tipoUsuario === "ESTUDIANTE");
        const fechasOrd = [...new Set(soloEstudiantes.map(r => r.fecha).filter(Boolean))].sort();
        const asisFormateadas = soloEstudiantes
          .filter(r => r.estado === "PRESENTE")
          .map(r => ({ alumnoId: String(r.usuarioId), fecha: r.fecha }));

        setFechas(fechasOrd);
        setAlumnos(alumnosFormateados);
        setAsistencias(asisFormateadas);
        // Dias no laborables
        setFeriados( Array.isArray(feriadosData) ? feriadosData.map(f => ({
            fecha: f.fecha,
            tipo: f.tipoEvento?.nombre,
            descripcion: f.descripcion,
        }))
        : [] );
      } catch (e) {
        setError(e.message ?? "Error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [comisionId, headers]);

  const tituloExcel = `Asistencia_${comisionInfo?.cod_comision ?? comisionId}_${new Date().toISOString().split("T")[0]}`;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">

        {/* Encabezado */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Asistencias</h1>
            <p className="mt-1 text-sm text-gray-500">
              {isDocente ? "Asistencia de tus alumnos por comisión" : "Historial de asistencia por comisión"}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            {/* Botón descargar Excel */}
            {comisionId && !loading && alumnos.length > 0 && (
              <button
                onClick={() => descargarExcel({ titulo: tituloExcel, alumnos, fechas, asistencias })}
                className="flex items-center gap-2 rounded-xl border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v4m0 0l-3-3m3 3l3-3M12 4v8" />
                </svg>
                Descargar Excel
              </button>
            )}

            {/* Tab Docentes — solo admin */}
            {isAdmin && (
              <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1">
                <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-green-800 shadow-sm">
                  🧑‍🎓 Estudiantes
                </div>
                <button
                  onClick={() => router.push("/asistencia-docente")}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
                >
                  👨‍🏫 Docentes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className={`grid gap-4 ${isAdmin ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>

            {/* Filtro por materia — solo admin */}
            {isAdmin && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="materia" className="text-sm font-medium text-gray-700">Materia</label>
                <select
                  id="materia"
                  value={materiaId}
                  disabled={loadingCat}
                  onChange={e => {
                    setMateriaId(e.target.value);
                    setComisionId("");
                    setMostrarTodas(false);
                    setFechas([]); setAlumnos([]); setAsistencias([]);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                >
                  <option value="">{loadingCat ? "Cargando..." : "Todas las materias"}</option>
                  {materias.map(m => (
                    <option key={m.materiaId} value={m.materiaId}>{m.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro por comisión */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="comision" className="text-sm font-medium text-gray-700">
                  {isDocente ? "Tu comisión" : "Comisión"}
                </label>
                {/* Opción "Ver todas" para admin cuando hay materia seleccionada */}
                {isAdmin && materiaId && (
                  <button
                    onClick={() => {
                      setMostrarTodas(prev => !prev);
                      setComisionId("");
                      setFechas([]); setAlumnos([]); setAsistencias([]);
                    }}
                    className="text-xs text-green-700 hover:underline"
                  >
                    {mostrarTodas ? "Solo esta materia" : "Ver todas las comisiones"}
                  </button>
                )}
              </div>
              <select
                id="comision"
                value={comisionId}
                disabled={loadingCat || comisionesFiltradas.length === 0}
                onChange={e => {
                  setComisionId(e.target.value);
                  setFechas([]); setAlumnos([]); setAsistencias([]);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
              >
                <option value="">
                  {loadingCat
                    ? "Cargando..."
                    : comisionesFiltradas.length === 0
                    ? "Sin comisiones"
                    : isDocente
                    ? "Seleccioná una de tus comisiones"
                    : "Seleccionar comisión"}
                </option>
                {comisionesFiltradas.map(c => (
                  <option key={c.comisionId} value={c.comisionId}>
                    {c.cod_comision}{c.materia?.nombre ? ` — ${c.materia.nombre}` : ""}
                    {isAdmin && !materiaId && c.profesor?.nombre_apellido
                      ? ` (${c.profesor.nombre_apellido})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Info comisión seleccionada */}
        {comisionInfo && (
          <div className="mb-4 flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="w-1.5 shrink-0 bg-green-700" />
            <div className="flex flex-wrap gap-4 px-5 py-3 text-xs text-gray-500">
              <span><strong className="text-gray-700">Comisión:</strong> {comisionInfo.cod_comision}</span>
              {comisionInfo.materia?.nombre && (
                <span><strong className="text-gray-700">Materia:</strong> {comisionInfo.materia.nombre}</span>
              )}
              {isAdmin && comisionInfo.profesor?.nombre_apellido && (
                <span><strong className="text-gray-700">Docente:</strong> {comisionInfo.profesor.nombre_apellido}</span>
              )}
              {alumnos.length > 0 && (
                <span><strong className="text-gray-700">Alumnos:</strong> {alumnos.length}</span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!comisionId && !loading && (
          <div className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
            {isDocente
              ? "Seleccioná una de tus comisiones para ver la asistencia de tus alumnos."
              : "Seleccioná una materia y luego una comisión para ver la grilla."}
          </div>
        )}

        {comisionId && loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white py-12 shadow-sm ring-1 ring-gray-200">
            <svg className="h-5 w-5 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm text-gray-500">Cargando asistencias...</span>
          </div>
        )}

        {comisionId && !loading && !error && (
          <AsistenciaGrid
            titulo={`Asistencia — ${comisionInfo?.cod_comision ?? ""}`}
            headerNombre="Nombre y apellido"
            fechas={fechas}
            alumnos={alumnos}
            asistencias={asistencias}
            feriados={feriados}
            mostrarDni={true}
            mostrarVolver={false}
          />
        )}

      </div>
    </div>
  );
}
