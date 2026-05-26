"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { BACK_URL, getAuthHeaders } from "@/config/api";

export default function EditarAusenciaPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <EditarAusenciaContenido />
    </ProtectedRoute>
  );
}

function EditarAusenciaContenido() {
  const router = useRouter();
  const { usuario } = useAuth();

  //setea los headers
  const headers = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    }),
    []
  );

  const [materias, setMaterias] = useState([]);
  const [comisiones, setComisiones] = useState([]);
  const [diasSinClase, setDiasSinClase] = useState([]);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [materiaId, setMateriaId] = useState("");
  const [comisionId, setComisionId] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [sinClase, setSinClase] = useState(true);

  // dia sin clase
  const TIPO_EVENTO_DIA_SIN_CLASE =
    "e4149267-e3dd-4824-abde-1cd9a6a09699";

  useEffect(() => {
    if (!usuario || !BACK_URL) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const [resMat, resCom, resDias] = await Promise.all([
          fetch(`${BACK_URL}/api/materias`, { headers }),
          fetch(`${BACK_URL}/api/comisiones`, { headers }),
          fetch(`${BACK_URL}/api/diaSinClase`, { headers }),
        ]);

        const materiasData = await resMat.json();
        const comisionesData = await resCom.json();
        const diasData = await resDias.json();

        setMaterias(Array.isArray(materiasData) ? materiasData : []);
        setComisiones(Array.isArray(comisionesData) ? comisionesData : []);
        setDiasSinClase(Array.isArray(diasData) ? diasData : []);
      } catch {
        setError("Error cargando datos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [usuario, headers]);

  const comisionesFiltradas = useMemo(() => {
    if (!materiaId) return comisiones;

    return comisiones.filter(
      c => String(c.materiaId) === String(materiaId)
    );
  }, [materiaId, comisiones]);

  const registroExistente = useMemo(() => {
    if (!comisionId || !fecha) return null;

    return diasSinClase.find(
      d =>
        String(d.comisionId) === String(comisionId) &&
        d.fecha === fecha
    );
  }, [diasSinClase, comisionId, fecha]);

  useEffect(() => {
    if (registroExistente) {
      setSinClase(true);
      setDescripcion(registroExistente.descripcion || "");
    } else {
      setSinClase(false);
      setDescripcion("");
    }
  }, [registroExistente]);

  async function guardarCambios() {
    if (!comisionId || !fecha) {
      setError("Seleccioná comisión y fecha.");
      return;
    }

    setGuardando(true);
    setError("");
    setSuccess("");

    try {
      // marcar día SIN clases
      if (sinClase) {
        // Si ya existe, no crear duplicado
        if (registroExistente) {
          setSuccess("El día ya estaba marcado como sin clases.");
          return;
        }

        const body = {
          fecha,
          descripcion:
            descripcion.trim() || "No hubo clases",
          tipoEventoId: TIPO_EVENTO_DIA_SIN_CLASE,
          comisionId,
        };

        const res = await fetch(`${BACK_URL}/api/diaSinClase`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error("No se pudo guardar el día sin clases.");
        }

        const nuevo = await res.json();

        setDiasSinClase(prev => [...prev, nuevo]);

        setSuccess("Día marcado correctamente como sin clases.");
      }

      // ✅ Hubo clases → eliminar excepción
      else {
        if (!registroExistente) {
          setSuccess("Ese día ya figura con clases normales.");
          return;
        }

        const res = await fetch(
          `${BACK_URL}/api/diaSinClase/${registroExistente.diaSinClaseId}`,
          {
            method: "DELETE",
            headers,
          }
        );

        if (!res.ok) {
          throw new Error("No se pudo restaurar el día de clases.");
        }

        setDiasSinClase(prev =>
          prev.filter(
            d =>
              d.diaSinClaseId !==
              registroExistente.diaSinClaseId
          )
        );

        setSuccess("El día volvió a marcarse como día normal de clases.");
      }
    } catch (e) {
      setError(e.message || "Error guardando cambios.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Editar días sin clase
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Configurá excepciones de asistencia por comisión.
            </p>
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Volver
          </button>
        </div>

        {/* Card principal */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">

          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500">
              Cargando datos...
            </div>
          ) : (
            <div className="space-y-5">

              {/* Materia */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Materia
                </label>

                <select
                  value={materiaId}
                  onChange={(e) => {
                    setMateriaId(e.target.value);
                    setComisionId("");
                  }}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Seleccionar materia</option>

                  {materias.map((m) => (
                    <option
                      key={m.materiaId}
                      value={m.materiaId}
                    >
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comisión */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Comisión
                </label>

                <select
                  value={comisionId}
                  onChange={(e) => setComisionId(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Seleccionar comisión</option>

                  {comisionesFiltradas.map((c) => (
                    <option
                      key={c.comisionId}
                      value={c.comisionId}
                    >
                      {c.cod_comision}
                      {c.materia?.nombre
                        ? ` — ${c.materia.nombre}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Fecha
                </label>

                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </div>

              {/* Estado */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">
                      Estado del día
                    </h2>

                    <p className="mt-1 text-xs text-gray-500">
                      Definí si hubo clases o no para esta comisión.
                    </p>
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      sinClase
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {sinClase ? "Sin clases" : "Hubo clases"}
                  </div>
                </div>

                <label className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sinClase}
                    onChange={(e) => setSinClase(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />

                  Marcar este día como “sin clases”
                </label>
              </div>

              {/* Descripción */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Descripción
                </label>

                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  placeholder="Ej: Suspensión institucional"
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </div>

              {/* Alerts */}
              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => router.back()}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  onClick={guardarCambios}
                  disabled={guardando}
                  className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}