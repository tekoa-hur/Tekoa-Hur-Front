"use client";

// Página principal de asistencia docente
// app/asistencia-docente/page.jsx

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation"; 
// @ts-ignore
import AsistenciaGrid from "@/components/AsistenciaGrid";
import { BACK_URL, getAuthHeaders } from "@/config/api";

export default function AsistenciaDocentePage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <AsistenciaDocenteContenido />
    </ProtectedRoute>
  );
}

// ── Descarga CSV con asistencia del docente ──────────────────
function descargarExcel({ titulo, docentes, fechas, asistencias }) {
  const BOM = "\uFEFF";
  const encabezados = ["Docente", ...fechas].join(";");
  const asisSet = new Set(asistencias.map(a => `${a.alumnoId}-${a.fecha}`));

  const filas = [...docentes]
    .sort((a, b) => a.apellido.localeCompare(b.apellido))
    .map(doc => {
      const cols = [
        `"${doc.apellido}"`,
        ...fechas.map(f => asisSet.has(`${doc.id}-${f}`) ? "P" : "A"),
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

function AsistenciaDocenteContenido() {
  const router  = useRouter();
  const headers = useMemo(() => ({ Accept: "application/json", ...getAuthHeaders() }), []);

  // Catálogo
  const [materias,    setMaterias]    = useState([]);
  const [profesores,  setProfesores]  = useState([]);
  const [comisiones,  setComisiones]  = useState([]);
  const [loadingCat,  setLoadingCat]  = useState(true);
  const [error,       setError]       = useState("");

  // Filtros
  const [materiaId,            setMateriaId]            = useState("");
  const [profesorSeleccionado, setProfesorSeleccionado] = useState("");
  const [comisionSeleccionada, setComisionSeleccionada] = useState("");

  // Datos
  const [fechas,      setFechas]      = useState([]);
  const [docentes,    setDocentes]    = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [infoComision, setInfoComision] = useState(null);

  // ── Cargar catálogo ──────────────────────────────────────────
  useEffect(() => {
    if (!BACK_URL) { setError("Falta NEXT_PUBLIC_BACK_URL."); return; }
    (async () => {
      try {
        const [resMat, resProf, resCom] = await Promise.all([
          fetch(`${BACK_URL}/api/materias`,   { headers }),
          fetch(`${BACK_URL}/api/profesores`, { headers }),
          fetch(`${BACK_URL}/api/comisiones`, { headers }),
        ]);
        if (!resProf.ok || !resCom.ok) throw new Error("Error cargando catálogo");

        const matList  = await resMat.json();
        const profList = await resProf.json();
        const comList  = await resCom.json();

        setMaterias(Array.isArray(matList) ? matList : []);
        setProfesores(profList.map(p => ({
          id:          String(p.profesorId ?? p.dni),
          dni:         p.dni,
          nombre:      p.nombre_apellido,
          comisiones:  comList
            .filter(c => String(c.profesorId) === String(p.profesorId))
            .map(c => String(c.comisionId)),
          materias: [...new Set(
            comList
              .filter(c => String(c.profesorId) === String(p.profesorId))
              .map(c => String(c.materiaId))
          )],
        })));
        setComisiones(comList.map(c => ({
          id:         String(c.comisionId),
          nombre:     c.cod_comision,
          profesorId: String(c.profesorId),
          materiaId:  String(c.materiaId),
          materia:    c.materia?.nombre ?? "",
          aula:       c.horarios?.[0]?.aula
                        ? `${c.horarios[0].aula.sector}-${c.horarios[0].aula.numero}`
                        : "",
          edificio:   c.horarios?.[0]?.aula?.edificio?.nombre ?? "",
          dia:        c.horarios?.[0]?.diaSemana ?? "",
          horario:    c.horarios?.[0]
                        ? `${c.horarios[0].horaDesde?.slice(0,5)} – ${c.horarios[0].horaHasta?.slice(0,5)}`
                        : "",
        })));
      } catch (e) {
        setError(e.message ?? "Error.");
      } finally { setLoadingCat(false); }
    })();
  }, [headers]);

  // Docentes filtrados por materia
  const profesoresFiltrados = useMemo(() => {
    if (!materiaId) return profesores;
    return profesores.filter(p => p.materias.includes(materiaId));
  }, [profesores, materiaId]);

  // Comisiones filtradas por docente (y opcionalmente materia)
  const comisionesFiltradas = useMemo(() => {
    if (!profesorSeleccionado) return [];
    return comisiones.filter(c => {
      const byProf = c.profesorId === profesorSeleccionado;
      return materiaId ? byProf && c.materiaId === materiaId : byProf;
    });
  }, [profesorSeleccionado, comisiones, materiaId]);

  // Info de la comisión
  useEffect(() => {
    if (!comisionSeleccionada) { setInfoComision(null); return; }
    setInfoComision(comisiones.find(c => c.id === comisionSeleccionada) ?? null);
  }, [comisionSeleccionada, comisiones]);

  // ── Cargar asistencias del docente ───────────────────────────
  useEffect(() => {
    if (!comisionSeleccionada) return;
    (async () => {
      setLoading(true); setError("");
      try {
        const [resAsis, resProf] = await Promise.all([
          fetch(`${BACK_URL}/api/asistencias?comisionId=${comisionSeleccionada}`, { headers }),
          fetch(`${BACK_URL}/api/profesores`, { headers }),
        ]);
        if (!resAsis.ok) throw new Error("Error cargando asistencias");

        const registros = await resAsis.json();
        const profesoresR = resProf.ok ? await resProf.json() : [];

        //const profMap: Record<string, {nombre: string, dni: string}> = {}; Pueto para TS
        const profMap = {};
        for (const p of profesoresR) {
          if (p.dni) profMap[String(p.dni)] = { nombre: p.nombre_apellido, dni: p.dni };
        }

       //const soloDocentes = registros.filter((r: any) => r.tipoUsuario === "PROFESOR"); Puestos para TS
        const soloDocentes = registros.filter((r) => r.tipoUsuario === "PROFESOR");
        const fechasOrd    = [...new Set(soloDocentes.map((r) => r.fecha).filter(Boolean))].sort();

        //const docentesMap = new Map<string, {id: string, apellido: string}>(); Para TS
        const docentesMap = new Map();
        for (const r of soloDocentes) {
          const key  = String(r.usuarioId);
          const prof = profMap[key];
          if (!docentesMap.has(key)) {
            docentesMap.set(key, { id: key, apellido: prof?.nombre ?? key });
          }
        }

        const asis = soloDocentes
          .filter((r) => r.estado === "PRESENTE")
          .map((r) => ({ alumnoId: String(r.usuarioId), fecha: r.fecha }));

        setFechas(fechasOrd);
        setDocentes([...docentesMap.values()]);
        setAsistencias(asis);
      } catch (e) {
        setError(e.message ?? "Error.");
      } finally { setLoading(false); }
    })();
  }, [comisionSeleccionada, headers]);

  const profSeleccionado = profesores.find(p => p.id === profesorSeleccionado);
  const tituloExcel = `Asistencia_Docente_${infoComision?.nombre ?? comisionSeleccionada}_${new Date().toISOString().split("T")[0]}`;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">

        {/* Encabezado + tabs */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Asistencias</h1>
            <p className="mt-1 text-sm text-gray-500">Historial de asistencia de docentes</p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            {/* Descargar Excel */}
            {comisionSeleccionada && !loading && docentes.length > 0 && (
              <button
                onClick={() => descargarExcel({ titulo: tituloExcel, docentes, fechas, asistencias })}
                className="flex items-center gap-2 rounded-xl border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v4m0 0l-3-3m3 3l3-3M12 4v8" />
                </svg>
                Descargar Excel
              </button>
            )}

            {/* Tabs */}
            <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1">
              <button
                onClick={() => router.push("/asistencia")}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
              >
                🧑‍🎓 Estudiantes
              </button>
              <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-green-800 shadow-sm">
                👨‍🏫 Docentes
              </div>
            </div>
          </div>
        </div>

        {/* Filtros: materia → docente → comisión */}
        <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            {/* Materia */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Materia</label>
              <select
                value={materiaId}
                disabled={loadingCat}
                onChange={e => {
                  setMateriaId(e.target.value);
                  setProfesorSeleccionado(""); setComisionSeleccionada("");
                  setFechas([]); setDocentes([]); setAsistencias([]);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
              >
                <option value="">{loadingCat ? "Cargando..." : "Todas las materias"}</option>
                {materias.map(m => (
                  <option key={m.materiaId} value={m.materiaId}>{m.nombre}</option>
                ))}
              </select>
            </div>

            {/* Docente */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Docente</label>
              <select
                value={profesorSeleccionado}
                disabled={loadingCat || profesoresFiltrados.length === 0}
                onChange={e => {
                  setProfesorSeleccionado(e.target.value);
                  setComisionSeleccionada("");
                  setFechas([]); setDocentes([]); setAsistencias([]);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
              >
                <option value="">
                  {loadingCat ? "Cargando..."
                    : profesoresFiltrados.length === 0 ? "Sin docentes"
                    : "Seleccionar docente"}
                </option>
                {profesoresFiltrados.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Comisión */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Comisión</label>
              <select
                value={comisionSeleccionada}
                disabled={!profesorSeleccionado || comisionesFiltradas.length === 0}
                onChange={e => setComisionSeleccionada(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
              >
                <option value="">
                  {!profesorSeleccionado ? "Primero elegí un docente"
                    : comisionesFiltradas.length === 0 ? "Sin comisiones"
                    : "Seleccionar comisión"}
                </option>
                {comisionesFiltradas.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} {c.materia ? `— ${c.materia}` : ""}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Info del docente + comisión */}
        {profSeleccionado && (
          <div className="mb-4 flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="w-1.5 shrink-0 bg-green-700" />
            <div className="flex flex-wrap items-center gap-6 px-5 py-4">
              {[
                { label: "Docente",  valor: `👨‍🏫 ${profSeleccionado.nombre}` },
                { label: "DNI",      valor: profSeleccionado.dni },
                infoComision?.materia   && { label: "Materia",      valor: infoComision.materia },
                infoComision?.edificio  && { label: "Edificio",     valor: `🏢 ${infoComision.edificio}` },
                infoComision?.aula      && { label: "Aula",         valor: `🚪 ${infoComision.aula}` },
                infoComision?.dia       && { label: "Día/Horario",  valor: `📅 ${cap(infoComision.dia)} ${infoComision.horario}` },
              ].filter(Boolean).map(({ label, valor }) => (
                <div key={label}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-800">{valor}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!profesorSeleccionado && !loading && (
          <div className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
            Seleccioná una materia y un docente para ver su historial.
          </div>
        )}
        {profesorSeleccionado && !comisionSeleccionada && (
          <div className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
            Ahora elegí una comisión.
          </div>
        )}
        {comisionSeleccionada && loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white py-12 shadow-sm ring-1 ring-gray-200">
            <svg className="h-5 w-5 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-sm text-gray-500">Cargando datos...</span>
          </div>
        )}

        {comisionSeleccionada && !loading && !error && (
          <AsistenciaGrid
            titulo={`Asistencia — ${profSeleccionado?.nombre ?? ""}`}
            headerNombre="Docente"
            fechas={fechas}
            alumnos={docentes}
            asistencias={asistencias}
            mostrarDni={false}
            mostrarVolver={false}
          />
        )}

      </div>
    </div>
  );
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
