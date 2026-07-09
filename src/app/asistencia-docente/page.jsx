"use client";
// Página principal de asistencia
//app/asistencia/page.jsx

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AsistenciaGrid from "@/components/AsistenciaGrid";
import { BACK_URL, getAuthHeaders } from "@/config/api";
import { GraduationCap, UserSquare2, Pencil } from "lucide-react";

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

/**
 * Genera todas las fechas de cursada de una comisión.
 * Recorre día por día desde el inicio del período hasta hoy.
 */
function generarFechasCursada(periodo, horarios) {
    if (!periodo?.fecha_inicio_dictado || !periodo?.fecha_fin_dictado) {
        return [];
    }

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

export default function AsistenciaPage() {
    return (
        <ProtectedRoute roles={["docente", "administrador"]}>
            <AsistenciaContenido />
        </ProtectedRoute>
    );
}

function descargarExcel({ titulo, alumnos, fechas, asistencias }) {
    const BOM = "\uFEFF";
    const encabezados = ["Nombre y apellido", "DNI", ...fechas].join(";");
    const asisSet = new Set(asistencias.map(a => `${a.alumnoId}-${a.fecha}`));

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

    const csv = BOM + [encabezados, ...filas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${titulo.replace(/[^a-zA-Z0-9_\-]/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function AsistenciaContenido() {
    const router = useRouter();
    const { usuario } = useAuth();
    const isDocente = usuario?.rol === "docente";
    const isAdmin = usuario?.rol === "administrador";
    const headers = useMemo(() => ({ Accept: "application/json", ...getAuthHeaders() }), []);

    const [feriados, setFeriados] = useState([]);
    const [materias, setMaterias] = useState([]);
    const [comisiones, setComisiones] = useState([]);
    const [loadingCat, setLoadingCat] = useState(true);
    const [error, setError] = useState("");

    const [materiaId, setMateriaId] = useState("");
    const [comisionId, setComisionId] = useState("");
    const [mostrarTodas, setMostrarTodas] = useState(false);

    const [fechas, setFechas] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    const [asistencias, setAsistencias] = useState([]);
    const [loading, setLoading] = useState(false);

    // ── Cargar catálogo ──────────────────────────────────────────
    useEffect(() => {
        if (!BACK_URL || !usuario) return;
        (async () => {
            setLoadingCat(true); setError("");
            try {
                if (isDocente) {
                    const [resProf, resCom] = await Promise.all([
                        fetch(`${BACK_URL}/api/profesores`, { headers }),
                        fetch(`${BACK_URL}/api/comisiones`, { headers }),
                    ]);
                    const profList = await resProf.json();
                    const comList = await resCom.json();
                    const profesor = profList.find(
                        p => p.dni === usuario.referenciaId || p.dni === usuario.dni
                    );
                    if (!profesor) { setError("No encontramos tu perfil de docente."); return; }
                    
                    // Esto es para filtrar estrictamente para que el docente solo vea sus comisiones
                    setComisiones(
                        Array.isArray(comList)
                            ? comList.filter(c => String(c.profesorId) === String(profesor.profesorId))
                            : []
                    );
                } else {
                    const [resMat, resCom] = await Promise.all([
                        fetch(`${BACK_URL}/api/materias`, { headers }),
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

    const comisionesFiltradas = useMemo(() => {
        if (isDocente) return comisiones;
        if (!materiaId || mostrarTodas) return comisiones;
        return comisiones.filter(c => String(c.materiaId) === String(materiaId));
    }, [comisiones, materiaId, mostrarTodas, isDocente]);

    const comisionInfo = comisiones.find(c => c.comisionId === comisionId);

    // Guardrail de seguridad en el frontend: Evitar que un docente intente forzar la URL de otra comisión
    useEffect(() => {
        if (isDocente && comisionId && comisiones.length > 0) {
            const perteneceAlDocente = comisiones.some(c => String(c.comisionId) === String(comisionId));
            if (!perteneceAlDocente) {
                setComisionId("");
                setFechas([]); setAlumnos([]); setAsistencias([]);
                setError("No tenés permisos para ver esta comisión.");
            }
        }
    }, [comisionId, comisiones, isDocente]);

    // ── Cargar asistencias ───────────────────────────────────────
    useEffect(() => {
        if (!comisionId || !BACK_URL) return;
        // Si es docente y la comisión actual no está en su listado permitido, frenar la petición
        if (isDocente && !comisiones.some(c => String(c.comisionId) === String(comisionId))) return;

        (async () => {
            setLoading(true); setError("");
            try {
                const [resAsis, resCom, resFeriados, resDiasSinClase, resPeriodo] = await Promise.all([
                    fetch(`${BACK_URL}/api/asistencias?comisionId=${comisionId}`, { headers }),
                    fetch(`${BACK_URL}/api/comisiones/${comisionId}`, { headers }),
                    fetch(`${BACK_URL}/api/feriados`, { headers }),
                    fetch(`${BACK_URL}/api/diaSinClase`, { headers }),
                    fetch(`${BACK_URL}/api/guarani/periodos-tekoa`, { headers }),
                ]);
                if (!resAsis.ok) throw new Error("Error cargando asistencias");

                const registros = await resAsis.json();
                const comData = resCom.ok ? await resCom.json() : comisionInfo;

                const feriadosData = resFeriados.ok ? await resFeriados.json() : [];
                const diasSinClaseData = resDiasSinClase.ok ? await resDiasSinClase.json() : [];
                const periodoData = resPeriodo.ok ? extraerPeriodoTekoa(await resPeriodo.json()) : null;
                if (!periodoData) {
                    throw new Error(`No se pudo cargar el periodo ${PERIODO_TEKOA} desde Guarani.`);
                }

                const diasSinClaseComision = diasSinClaseData.filter(
                    d => String(d.comisionId) === String(comisionId)
                );
                const horariosComision = comData?.horarios ?? [];

                // ── VISTA DE DOCENTES ──
                // En vez de mostrar estudiantes, mostramos al profesor titular
                // de la comisión (viene en comData.profesor).
                const profesorTitular = comData?.profesor;
                const alumnosFormateados = profesorTitular
                    ? [{
                        id: profesorTitular.dni,
                        dni: profesorTitular.dni,
                        apellido: profesorTitular.nombre_apellido,
                    }]
                    : [];

                const soloEstudiantes = registros.filter(
                    r => r.tipoUsuario === "PROFESOR" && estaEnPeriodo(r.fecha, periodoData)
                );

                const fechasFeriados = feriadosData
                    .map(f => f.fecha)
                    .filter(f =>
                        estaEnPeriodo(f, periodoData) &&
                        correspondeADiaDeCursada(f, horariosComision)
                    );

                const fechasDiasSinClase = diasSinClaseComision
                    .map(f => f.fecha)
                    .filter(f =>
                        estaEnPeriodo(f, periodoData) &&
                        correspondeADiaDeCursada(f, horariosComision)
                    );

                const fechasOrd = generarFechasCursada(
                    periodoData,
                    horariosComision
                );

                // 1. Mapeamos las asistencias normales que sí existen de los estudiantes
const asisFormateadas = soloEstudiantes.map(r => ({
    alumnoId: String(r.usuarioId),
    fecha: r.fecha,
    estado: r.estado || "A",
}));

// forzamos el motivo del "Día Sin Clase" para TODOS los alumnos en esa fecha
if (Array.isArray(diasSinClaseComision) && diasSinClaseComision.length > 0) {
    diasSinClaseComision.forEach(dia => {
        // Buscamos el código o nombre del evento (ej: "PD" para Paro Docente, "NL" para No Laborable)
        // Usamos el nombre
        const motivoCodigo = dia.tipoEvento?.nombre || dia.descripcion || "NSC";

        // Para cada alumno de la comisión, le generamos un registro de "asistencia" con el motivo
        alumnosFormateados.forEach(alumno => {
            // Buscamos si ya existía un registro para este alumno en esta fecha para pisarlo o añadirlo
            const indexExistente = asisFormateadas.findIndex(
                a => a.alumnoId === String(alumno.id) && a.fecha === dia.fecha
            );

            if (indexExistente !== -1) {
                // Si existía, lo pisamos con el motivo real
                asisFormateadas[indexExistente].estado = motivoCodigo;
            } else {
                // Si no existía registro, lo agregamos para que la grilla lo dibuje
                asisFormateadas.push({
                    alumnoId: String(alumno.id),
                    fecha: dia.fecha,
                    estado: motivoCodigo
                });
            }
        });
    });
}

                setFechas(fechasOrd);
                setAlumnos(alumnosFormateados);
                setAsistencias(asisFormateadas);
                
                setFeriados([
                    ...(Array.isArray(feriadosData)
                        ? feriadosData
                            .filter(f => estaEnPeriodo(f.fecha, periodoData) && correspondeADiaDeCursada(f.fecha, horariosComision))
                            .map(f => ({
                                fecha: f.fecha,
                                tipo: f.tipoEvento?.nombre,
                                descripcion: f.descripcion,
                            }))
                        : []),
                    ...diasSinClaseComision
.filter(f => estaEnPeriodo(f.fecha, periodoData) && correspondeADiaDeCursada(f.fecha, horariosComision))                        .map(f => ({
                            fecha: f.fecha,
                            tipo: f.tipoEvento?.nombre,
                            descripcion: f.descripcion,
                        })),
                ]);
            } catch (e) {
                setError(e.message ?? "Error.");
            } finally {
                setLoading(false);
            }
        })();
    }, [comisionId, headers, comisionInfo, isDocente, comisiones]);

    const tituloExcel = `Asistencia_${comisionInfo?.cod_comision ?? comisionId}_${new Date().toISOString().split("T")[0]}`;

    return (
        <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
            <div className="mx-auto w-full max-w-5xl">

                {/* Encabezado */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Asistencias de docentes</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            {isDocente ? "Tu asistencia como docente por comisión" : "Historial de asistencia docente por comisión"}
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

                        {/* Controles de navegación y edición */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {(isAdmin || isDocente) && (
                                <>
                                    {/* El selector de visualización Alumnos/Docentes sólo tiene sentido para el Administrador */}
                                    {isAdmin && (
                                        <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1">
                                            <button
                                                onClick={() => router.push("/asistencia")}
                                                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
                                            >
                                                <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
                                                Estudiantes
                                            </button>
                                            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-green-800 shadow-sm">
                                                <UserSquare2 className="h-4 w-4" strokeWidth={1.75} />
                                                Docentes
                                            </div>
                                        </div>
                                    )}

                                    {/* Botón editar con query params */}
                                    <button
                                        onClick={() => {
                                            let ruta = "/asistencia/editar-ausencia";
                                            const params = new URLSearchParams();
                                            if (materiaId) params.append("materiaId", materiaId);
                                            if (comisionId) params.append("comisionId", comisionId);
                                            
                                            const queryString = params.toString();
                                            if (queryString) ruta += `?${queryString}`;
                                            router.push(ruta);
                                        }}
                                        className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                                    >
                                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                                        Editar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                    <div className={`grid gap-4 ${isAdmin ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>

                        {/* Filtro por materia — SOLO para Admin */}
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
                            {comisionInfo.profesor?.nombre_apellido && (
                                <span><strong className="text-gray-700">Docente:</strong> {comisionInfo.profesor.nombre_apellido}</span>
                            )}
                            {alumnos.length > 0 && (
                                <span><strong className="text-gray-700">Alumnos:</strong> {alumnos.length}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Mensajes de Estado, Carga y Grilla */}
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