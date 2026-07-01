"use client";

import { useEffect, useState, useCallback } from "react";
import { BACK_URL, getAuthHeaders } from "@/config/api";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function EstudiantesPage() {
  return (
    <ProtectedRoute roles={["docente", "administrador"]}>
      <EstudiantesContenido />
    </ProtectedRoute>
  );
}

function EstudiantesContenido() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // ── Modal de gestión de matrículas ──────────────────────
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);

  const cargarEstudiantes = useCallback(() => {
    setLoading(true);
    fetch(`${BACK_URL}/api/estudiantes`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setEstudiantes(Array.isArray(data) ? data : []))
      .catch(() => setError("No se pudieron cargar los estudiantes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargarEstudiantes();
  }, [cargarEstudiantes]);

  const filtrados = estudiantes.filter((e) => {
    const t = busqueda.toLowerCase();
    return e.dni?.toString().includes(t) || e.nombre_apellido?.toLowerCase().includes(t);
  });

  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">

        {/* Encabezado */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">Estudiantes</h1>
            <p className="mt-0.5 text-sm text-gray-500">Padrón de estudiantes registrados</p>
          </div>
          <input
            type="search"
            placeholder="Buscar por DNI o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 sm:w-60"
          />
        </div>

        {/* Contenido */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-14">
              <svg className="h-5 w-5 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm text-gray-500">Cargando...</span>
            </div>
          ) : error ? (
            <p className="px-5 py-4 text-sm text-red-700">{error}</p>
          ) : (
            <>
              <div className="border-b border-gray-100 px-4 py-2.5">
                <span className="text-xs text-gray-400">
                  {filtrados.length} {filtrados.length === 1 ? "estudiante" : "estudiantes"}
                  {busqueda && ` para "${busqueda}"`}
                </span>
              </div>

              {/* Vista desktop: tabla */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-32">DNI</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre y apellido</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Comisiones</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-32">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtrados.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">No se encontraron estudiantes.</td>
                      </tr>
                    ) : filtrados.map((est) => (
                      <tr key={est.dni} className="transition hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-sm text-gray-600">{est.dni}</td>
                        <td className="px-5 py-3 font-medium text-gray-800">{est.nombre_apellido}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1">
                            {(est.comisiones ?? []).length === 0 ? (
                              <span className="text-xs italic text-gray-400">Sin matrículas</span>
                            ) : (
                              (est.comisiones ?? []).map((c) => (
                                <span key={c.comisionId} className="inline-flex items-center gap-1 text-xs">
                                  <span className="font-medium text-gray-700">
                                    {c.materia?.nombre || "Sin materia"}
                                  </span>
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
                                    {c.cod_comision}
                                  </span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setEstudianteSeleccionado(est)}
                            className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-800"
                          >
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista mobile: lista */}
              <div className="sm:hidden divide-y divide-gray-100">
                {filtrados.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">No se encontraron estudiantes.</p>
                ) : filtrados.map((est) => (
                  <div key={est.dni} className="px-4 py-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{est.nombre_apellido}</p>
                        <p className="font-mono text-xs text-gray-500">DNI: {est.dni}</p>
                        <div className="mt-2 flex flex-col gap-1">
                          {(est.comisiones ?? []).length === 0 ? (
                            <span className="text-xs italic text-gray-400">Sin matrículas</span>
                          ) : (
                            (est.comisiones ?? []).map((c) => (
                              <span key={c.comisionId} className="inline-flex items-center gap-1 text-xs">
                                <span className="font-medium text-gray-700">
                                  {c.materia?.nombre || "Sin materia"}
                                </span>
                                <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
                                  {c.cod_comision}
                                </span>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEstudianteSeleccionado(est)}
                        className="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Gestionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL DE GESTIÓN DE MATRÍCULAS */}
      {estudianteSeleccionado && (
        <ModalGestionMatriculas
          estudiante={estudianteSeleccionado}
          onClose={() => setEstudianteSeleccionado(null)}
          onChange={cargarEstudiantes}
        />
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE: ModalGestionMatriculas
// ============================================================
function ModalGestionMatriculas({ estudiante, onClose, onChange }) {
  const [matriculas, setMatriculas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Estado del cambio de comisión
  const [cambiandoMatriculaId, setCambiandoMatriculaId] = useState(null);
  const [comisionesDisponibles, setComisionesDisponibles] = useState([]);
  const [nuevaComisionId, setNuevaComisionId] = useState("");

  // Estado de la inscripción nueva
  const [mostrandoInscripcion, setMostrandoInscripcion] = useState(false);
  const [materias, setMaterias] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState("");
  const [comisionInscripcion, setComisionInscripcion] = useState("");

  // Estado de baja
  const [matriculaABaja, setMatriculaABaja] = useState(null);

  // Cargar matrículas activas del estudiante
  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${BACK_URL}/api/matriculas/por-estudiante/${estudiante.dni}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar matrículas");
      setMatriculas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [estudiante.dni]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ── Cambio de comisión ──────────────────────────────────
  async function abrirCambio(matriculaId) {
    setMensaje("");
    setError("");
    setNuevaComisionId("");
    try {
      const res = await fetch(
        `${BACK_URL}/api/matriculas/comisiones-disponibles/${matriculaId}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");

      if (!Array.isArray(data) || data.length === 0) {
        setError("Esta materia no tiene otras comisiones disponibles.");
        return;
      }

      setComisionesDisponibles(data);
      setCambiandoMatriculaId(matriculaId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmarCambio() {
    if (!nuevaComisionId) return;
    setError("");
    try {
      const res = await fetch(`${BACK_URL}/api/matriculas/cambiar-comision`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          matriculaId: cambiandoMatriculaId,
          nuevaComisionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar comisión");

      setMensaje("Comisión cambiada correctamente");
      setCambiandoMatriculaId(null);
      setComisionesDisponibles([]);
      setNuevaComisionId("");
      await cargar();
      onChange?.();
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Dar de baja ─────────────────────────────────────────
  async function confirmarBaja() {
    if (!matriculaABaja) return;
    setError("");
    try {
      const res = await fetch(
        `${BACK_URL}/api/matriculas/${matriculaABaja.matriculaId}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al dar de baja");

      setMensaje("Matrícula dada de baja correctamente");
      setMatriculaABaja(null);
      await cargar();
      onChange?.();
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Inscripción nueva ───────────────────────────────────
  async function abrirInscripcion() {
    setMensaje("");
    setError("");
    setMateriaSeleccionada("");
    setComisionInscripcion("");
    try {
      const res = await fetch(`${BACK_URL}/api/matriculas/materias-con-comisiones`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMaterias(Array.isArray(data) ? data : []);
      setMostrandoInscripcion(true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmarInscripcion() {
    if (!comisionInscripcion) return;
    setError("");
    try {
      const res = await fetch(`${BACK_URL}/api/matriculas`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          estudianteDni: estudiante.dni,
          comisionId: comisionInscripcion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al inscribir");

      setMensaje("Alumno inscripto correctamente");
      setMostrandoInscripcion(false);
      setMateriaSeleccionada("");
      setComisionInscripcion("");
      await cargar();
      onChange?.();
    } catch (e) {
      setError(e.message);
    }
  }

  // Comisiones de la materia seleccionada (para inscripción)
  const materiaActual = materias.find((m) => m.materiaId === materiaSeleccionada);
  const comisionesDeMateria = materiaActual?.comisiones || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-green-900">Gestionar matrículas</h3>
            <p className="text-sm text-gray-500">
              {estudiante.nombre_apellido} · DNI {estudiante.dni}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {/* Mensajes */}
        <div className="px-6 pt-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {mensaje && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {mensaje}
            </div>
          )}
        </div>

        {/* Lista de matrículas activas */}
        <div className="px-6 pb-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-700">
            Matrículas activas ({matriculas.length})
          </h4>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando matrículas...</p>
          ) : matriculas.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Este alumno no tiene matrículas activas.
            </p>
          ) : (
            <div className="space-y-2">
              {matriculas.map((m) => (
                <div
                  key={m.matriculaId}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        {m.comision?.materia?.nombre || "Sin materia"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Comisión: <strong>{m.comision?.cod_comision}</strong>
                      </p>
                      {m.comision?.profesor && (
                        <p className="text-xs text-gray-500">
                          Docente: {m.comision.profesor.nombre_apellido}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => abrirCambio(m.matriculaId)}
                        className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        title="Cambiar de comisión"
                      >
                        🔄 Cambiar
                      </button>
                      <button
                        onClick={() => setMatriculaABaja(m)}
                        className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        title="Dar de baja"
                      >
                        🗑️ Baja
                      </button>
                    </div>
                  </div>

                  {/* Selector de comisión nueva (inline) */}
                  {cambiandoMatriculaId === m.matriculaId && (
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Elegí la nueva comisión:
                      </label>
                      <select
                        value={nuevaComisionId}
                        onChange={(e) => setNuevaComisionId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">— Elegí una —</option>
                        {comisionesDisponibles.map((c) => (
                          <option key={c.comisionId} value={c.comisionId}>
                            {c.cod_comision}
                            {c.profesor && ` · ${c.profesor.nombre_apellido}`}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setCambiandoMatriculaId(null);
                            setComisionesDisponibles([]);
                          }}
                          className="rounded border border-gray-300 px-3 py-1 text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={confirmarCambio}
                          disabled={!nuevaComisionId}
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Confirmar cambio
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Botón inscribir en nueva comisión */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            {!mostrandoInscripcion ? (
              <button
                onClick={abrirInscripcion}
                className="w-full rounded-lg border-2 border-dashed border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                + Inscribir en nueva comisión
              </button>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Materia:
                  </label>
                  <select
                    value={materiaSeleccionada}
                    onChange={(e) => {
                      setMateriaSeleccionada(e.target.value);
                      setComisionInscripcion("");
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Elegí materia —</option>
                    {materias.map((m) => (
                      <option key={m.materiaId} value={m.materiaId}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {materiaSeleccionada && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Comisión:
                    </label>
                    <select
                      value={comisionInscripcion}
                      onChange={(e) => setComisionInscripcion(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">— Elegí comisión —</option>
                      {comisionesDeMateria.map((c) => (
                        <option key={c.comisionId} value={c.comisionId}>
                          {c.cod_comision}
                          {c.profesor && ` · ${c.profesor.nombre_apellido}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setMostrandoInscripcion(false)}
                    className="rounded border border-gray-300 px-3 py-1 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarInscripcion}
                    disabled={!comisionInscripcion}
                    className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    Inscribir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Sub-modal: confirmar baja */}
      {matriculaABaja && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-red-700">Dar de baja</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700">
                ¿Estás seguro de dar de baja a{" "}
                <strong>{estudiante.nombre_apellido}</strong> de la comisión{" "}
                <strong>{matriculaABaja.comision?.cod_comision}</strong>?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                La matrícula queda como histórico (soft delete: no se borra de la base).
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setMatriculaABaja(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                No
              </button>
              <button
                onClick={confirmarBaja}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Sí, dar de baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
