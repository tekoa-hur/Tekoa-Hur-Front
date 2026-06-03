"use client";

// ============================================================
// app/admin-aulas/page.jsx
// ============================================================
// Gestión de atributos de aulas (admin)
//
// Esta pantalla le permite al administrador:
//   - Ver todas las aulas del sistema con su estado de atributos
//   - Cargar / editar los atributos de un aula (modal)
//   - Eliminar los atributos cargados
//
// Demuestra en vivo la normalización defensiva del backend:
// cuando "Es laboratorio informático" está apagado, el campo
// cantidadPC se deshabilita y se manda como null.
//
// Sigue el mismo patrón de admin-usuarios:
//  - ProtectedRoute con roles=["administrador"]
//  - useState para state, useEffect para cargar datos
//  - Modal inline (controlado por un state `modal`)
// ============================================================

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { BACK_URL, getAuthHeaders } from "@/config/api";

export default function AdminAulasPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <AdminAulasContenido />
    </ProtectedRoute>
  );
}

function AdminAulasContenido() {
  // ── Estado: lista de aulas y sus atributos ─────────────────
  const [aulas, setAulas] = useState([]);
  const [atributosMap, setAtributosMap] = useState({}); // { aulaId: atributos o null }
  const [edificios, setEdificios] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  // ── Estado: filtros ────────────────────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [filtroEdificio, setFiltroEdificio] = useState("");
  const [filtroConAtributos, setFiltroConAtributos] = useState("todos"); // todos | con | sin

  // ── Estado: modal de edición ───────────────────────────────
  const [modal, setModal] = useState(null); // "editar" | "eliminar" | null
  const [aulaSeleccionada, setAulaSeleccionada] = useState(null);
  const [form, setForm] = useState({
    capacidad: "",
    tipoAula: "",
    esLaboratorioInformatico: false,
    cantidadPC: "",
    descripcion: "",
    equipamiento: [],
  });
  const [nuevoEquipo, setNuevoEquipo] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // ── Cargar aulas y edificios ───────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoadingData(true);
    setError("");
    try {
      const headers = getAuthHeaders();

      // 1. Traer todas las aulas
      const resAulas = await fetch(`${BACK_URL}/api/aulas`, { headers });
      const dataAulas = await resAulas.json();
      if (!resAulas.ok) throw new Error(dataAulas.message ?? "Error al cargar aulas");
      const lista = Array.isArray(dataAulas) ? dataAulas : [];
      setAulas(lista);

      // 2. Traer edificios para el filtro
      const resEdif = await fetch(`${BACK_URL}/api/edificios`, { headers });
      const dataEdif = await resEdif.json();
      setEdificios(Array.isArray(dataEdif) ? dataEdif : []);

      // 3. Para cada aula, consultar si tiene atributos.
      //    Se hacen en paralelo con Promise.all para no esperar
      //    una por una (sería N requests secuenciales).
      const mapa = {};
      await Promise.all(
        lista.map(async (aula) => {
          try {
            const res = await fetch(
              `${BACK_URL}/api/aulas/${aula.aulaId}/atributos`,
              { headers }
            );
            if (res.ok) {
              const data = await res.json();
              mapa[aula.aulaId] = data.atributos; // puede ser null
            }
          } catch {
            // si falla una en particular, seguimos
          }
        })
      );
      setAtributosMap(mapa);
    } catch (e) {
      setError(e.message ?? "Error al cargar datos.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Filtros aplicados ──────────────────────────────────────
  const aulasFiltradas = aulas.filter((aula) => {
    const nombreCompleto = `${aula.sector}-${aula.numero}`.toLowerCase();
    const matchBusqueda = nombreCompleto.includes(busqueda.toLowerCase());

    const matchEdificio = !filtroEdificio || aula.edificioId === filtroEdificio;

    const tieneAtributos = atributosMap[aula.aulaId] !== null && atributosMap[aula.aulaId] !== undefined;
    const matchAtributos =
      filtroConAtributos === "todos" ||
      (filtroConAtributos === "con" && tieneAtributos) ||
      (filtroConAtributos === "sin" && !tieneAtributos);

    return matchBusqueda && matchEdificio && matchAtributos;
  });

  // ── Handlers de modal ──────────────────────────────────────
  function abrirEditar(aula) {
    const existentes = atributosMap[aula.aulaId];
    setAulaSeleccionada(aula);
    setForm({
      capacidad: existentes?.capacidad ?? "",
      tipoAula: existentes?.tipoAula ?? "",
      esLaboratorioInformatico: Boolean(existentes?.esLaboratorioInformatico),
      cantidadPC: existentes?.cantidadPC ?? "",
      descripcion: existentes?.descripcion ?? "",
      equipamiento: Array.isArray(existentes?.equipamiento)
        ? [...existentes.equipamiento]
        : [],
    });
    setNuevoEquipo("");
    setFormError("");
    setFormSuccess("");
    setModal("editar");
  }

  function abrirEliminar(aula) {
    setAulaSeleccionada(aula);
    setFormError("");
    setFormSuccess("");
    setModal("eliminar");
  }

  function cerrarModal() {
    setModal(null);
    setAulaSeleccionada(null);
    setFormError("");
    setFormSuccess("");
  }

  function agregarEquipamiento() {
    const v = nuevoEquipo.trim();
    if (!v) return;
    if (form.equipamiento.includes(v)) {
      setNuevoEquipo("");
      return;
    }
    setForm({ ...form, equipamiento: [...form.equipamiento, v] });
    setNuevoEquipo("");
  }

  function quitarEquipamiento(idx) {
    setForm({
      ...form,
      equipamiento: form.equipamiento.filter((_, i) => i !== idx),
    });
  }

  // ── Submit del PUT ─────────────────────────────────────────
  async function handleGuardar(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    // Validaciones del cliente (el backend también valida)
    if (form.capacidad !== "" && Number(form.capacidad) < 0) {
      return setFormError("La capacidad no puede ser negativa.");
    }
    if (form.cantidadPC !== "" && Number(form.cantidadPC) < 0) {
      return setFormError("La cantidad de PCs no puede ser negativa.");
    }

    setFormLoading(true);
    try {
      // Construcción del payload.
      // Importante: cantidadPC se manda null si NO es lab informático.
      // Esto se alinea con la normalización defensiva del backend.
      const payload = {
        capacidad: form.capacidad === "" ? null : Number(form.capacidad),
        tipoAula: form.tipoAula.trim() || null,
        esLaboratorioInformatico: Boolean(form.esLaboratorioInformatico),
        cantidadPC: form.esLaboratorioInformatico
          ? form.cantidadPC === ""
            ? null
            : Number(form.cantidadPC)
          : null,
        descripcion: form.descripcion.trim() || null,
        equipamiento: form.equipamiento,
      };

      const res = await fetch(
        `${BACK_URL}/api/aulas/${aulaSeleccionada.aulaId}/atributos`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) return setFormError(data.error ?? data.message ?? "Error al guardar.");
      setFormSuccess(data.message ?? "Atributos guardados correctamente.");

      // Actualizar el mapa local sin tener que recargar todo
      setAtributosMap({
        ...atributosMap,
        [aulaSeleccionada.aulaId]: data.atributos,
      });

      setTimeout(cerrarModal, 1200);
    } catch {
      setFormError("Error de red.");
    } finally {
      setFormLoading(false);
    }
  }

  // ── Submit del DELETE ──────────────────────────────────────
  async function handleEliminar() {
    setFormError("");
    setFormSuccess("");
    setFormLoading(true);
    try {
      const res = await fetch(
        `${BACK_URL}/api/aulas/${aulaSeleccionada.aulaId}/atributos`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );
      const data = await res.json();
      if (!res.ok) return setFormError(data.error ?? data.message ?? "Error al eliminar.");
      setFormSuccess(data.message ?? "Atributos eliminados.");

      // Marcamos como null en el mapa local
      setAtributosMap({
        ...atributosMap,
        [aulaSeleccionada.aulaId]: null,
      });

      setTimeout(cerrarModal, 1200);
    } catch {
      setFormError("Error de red.");
    } finally {
      setFormLoading(false);
    }
  }

  // ── Helper: nombre del edificio ────────────────────────────
  function nombreEdificio(edificioId) {
    const e = edificios.find((x) => x.edificioId === edificioId);
    return e ? e.nombre : "—";
  }

  // ════════════════════════════════════════════════════════════
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* ── Header de la página ──────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-900">Gestión de Aulas</h1>
        <p className="mt-1 text-sm text-gray-600">
          Administrá los atributos de cada aula: capacidad, tipo, equipamiento.
        </p>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Buscar por nombre
          </label>
          <input
            type="text"
            placeholder="Ej: A-101"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Edificio
          </label>
          <select
            value={filtroEdificio}
            onChange={(e) => setFiltroEdificio(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
          >
            <option value="">Todos</option>
            {edificios.map((e) => (
              <option key={e.edificioId} value={e.edificioId}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Estado
          </label>
          <select
            value={filtroConAtributos}
            onChange={(e) => setFiltroConAtributos(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
          >
            <option value="todos">Todos</option>
            <option value="con">Con atributos cargados</option>
            <option value="sin">Sin atributos cargados</option>
          </select>
        </div>
      </div>

      {/* ── Mensaje de error ────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Loading state ───────────────────────────────────── */}
      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <svg className="h-8 w-8 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : aulasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No se encontraron aulas con esos filtros.
        </div>
      ) : (
        <>
          {/* ── Contador ────────────────────────────────────── */}
          <p className="mb-3 text-xs text-gray-500">
            {aulasFiltradas.length} {aulasFiltradas.length === 1 ? "aula" : "aulas"}
          </p>

          {/* ── Grid de tarjetas ────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {aulasFiltradas.map((aula) => {
              const atributos = atributosMap[aula.aulaId];
              const tieneAtributos = atributos !== null && atributos !== undefined;

              return (
                <div
                  key={aula.aulaId}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-green-900">
                        {aula.sector}-{aula.numero}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {nombreEdificio(aula.edificioId)}
                      </p>
                    </div>
                    {tieneAtributos ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ Cargada
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Sin atributos
                      </span>
                    )}
                  </div>

                  {/* Resumen de atributos */}
                  {tieneAtributos && (
                    <div className="mb-3 grow space-y-1 text-xs text-gray-600">
                      {atributos.capacidad != null && (
                        <p>
                          <span className="font-medium">Capacidad:</span>{" "}
                          {atributos.capacidad}
                        </p>
                      )}
                      {atributos.tipoAula && (
                        <p>
                          <span className="font-medium">Tipo:</span>{" "}
                          {atributos.tipoAula}
                        </p>
                      )}
                      {atributos.esLaboratorioInformatico && (
                        <p className="text-blue-700">
                          🖥️ Lab informático
                          {atributos.cantidadPC != null && ` (${atributos.cantidadPC} PCs)`}
                        </p>
                      )}
                      {Array.isArray(atributos.equipamiento) && atributos.equipamiento.length > 0 && (
                        <p>
                          <span className="font-medium">Equipo:</span>{" "}
                          {atributos.equipamiento.slice(0, 3).join(", ")}
                          {atributos.equipamiento.length > 3 && ` +${atributos.equipamiento.length - 3}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Botones */}
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      onClick={() => abrirEditar(aula)}
                      className="flex-1 rounded-lg bg-green-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-green-800"
                    >
                      {tieneAtributos ? "Editar" : "Cargar"}
                    </button>
                    {tieneAtributos && (
                      <button
                        onClick={() => abrirEliminar(aula)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL EDITAR / CARGAR ATRIBUTOS
          ════════════════════════════════════════════════════════ */}
      {modal === "editar" && aulaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-green-900">
                  Atributos de {aulaSeleccionada.sector}-{aulaSeleccionada.numero}
                </h3>
                <p className="text-xs text-gray-500">
                  {nombreEdificio(aulaSeleccionada.edificioId)}
                </p>
              </div>
              <button
                onClick={cerrarModal}
                className="text-2xl text-gray-400 transition hover:text-gray-600"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleGuardar} className="space-y-4 px-6 py-5">
              {/* Capacidad */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Capacidad
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.capacidad}
                  onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                  placeholder="Ej: 30"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
                />
              </div>

              {/* Tipo de aula */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Tipo de aula
                </label>
                <input
                  type="text"
                  value={form.tipoAula}
                  onChange={(e) => setForm({ ...form, tipoAula: e.target.value })}
                  placeholder="Ej: Aula común, Laboratorio, Salón de actos"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
                />
              </div>

              {/* Es laboratorio informático */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.esLaboratorioInformatico}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        esLaboratorioInformatico: e.target.checked,
                        // Limpio cantidadPC si se desactiva (normalización defensiva visual)
                        cantidadPC: e.target.checked ? form.cantidadPC : "",
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
                  />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      🖥️ Es laboratorio informático
                    </p>
                    <p className="text-xs text-blue-700">
                      Activá esta opción si el aula tiene computadoras
                    </p>
                  </div>
                </label>

                {/* Cantidad de PCs (condicional) */}
                {form.esLaboratorioInformatico && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Cantidad de PCs
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.cantidadPC}
                      onChange={(e) => setForm({ ...form, cantidadPC: e.target.value })}
                      placeholder="Ej: 15"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
                    />
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Descripción
                </label>
                <textarea
                  rows="2"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Ej: Aula amplia con vista al patio"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
                />
              </div>

              {/* Equipamiento (tags) */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Equipamiento
                </label>
                <div className="mb-2 flex gap-2">
                  <input
                    type="text"
                    value={nuevoEquipo}
                    onChange={(e) => setNuevoEquipo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        agregarEquipamiento();
                      }
                    }}
                    placeholder="Ej: proyector"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
                  />
                  <button
                    type="button"
                    onClick={agregarEquipamiento}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-800"
                  >
                    + Agregar
                  </button>
                </div>
                {form.equipamiento.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.equipamiento.map((eq, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                      >
                        {eq}
                        <button
                          type="button"
                          onClick={() => quitarEquipamiento(idx)}
                          className="text-emerald-900 transition hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mensajes */}
              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              {formSuccess && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {formSuccess}
                </p>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-lg bg-green-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {formLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL ELIMINAR
          ════════════════════════════════════════════════════════ */}
      {modal === "eliminar" && aulaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-red-700">Eliminar atributos</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700">
                ¿Estás seguro de que querés eliminar los atributos de{" "}
                <strong>{aulaSeleccionada.sector}-{aulaSeleccionada.numero}</strong>?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                El aula seguirá existiendo, solo se borrarán los atributos cargados.
              </p>

              {formError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              {formSuccess && (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {formSuccess}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={cerrarModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={formLoading}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {formLoading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
