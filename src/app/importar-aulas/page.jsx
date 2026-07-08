"use client";

// ============================================================
// src/app/importar-aulas/page.jsx
// ============================================================
// Pantalla para importar aulas desde Excel.
// Solo administradores. Un solo paso (no hay preview):
//   1. Elegir archivo
//   2. Subir
//   3. Ver resultado (creadas, actualizadas, errores)
// ============================================================

import { useRef, useState } from "react";
import { getAuthHeaders } from "@/config/api";
import ProtectedRoute from "@/components/ProtectedRoute";

const API_URL = process.env.NEXT_PUBLIC_BACK_URL || "http://localhost:3001";

export default function ImportarAulasPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <ImportarAulasContenido />
    </ProtectedRoute>
  );
}

function ImportarAulasContenido() {
  const inputRef = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [estado, setEstado] = useState("idle");
  //   ↑ idle | uploading | ok | error
  const [resultado, setResultado] = useState(null);
  const [mensajeError, setMensajeError] = useState("");
  const [dragging, setDragging] = useState(false);

  // ── Elegir archivo ──
  function elegirArchivo(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMensajeError("Solo se aceptan archivos .xlsx");
      setEstado("error");
      return;
    }
    setArchivo(file);
    setEstado("idle");
    setMensajeError("");
    setResultado(null);
  }

  // ── Drag & drop ──
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  }

  // ── Subir el archivo ──
  async function handleSubir() {
    if (!archivo) return;
    setEstado("uploading");
    setMensajeError("");
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append("archivo", archivo);

      // Nota: NO pasamos Content-Type, el browser lo setea con boundary
      const { Authorization } = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/importar/aulas`, {
        method: "POST",
        headers: { Authorization },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Error al importar aulas");
      }

      setResultado(data);
      setEstado("ok");
    } catch (err) {
      setMensajeError(err?.message || "Error al procesar el archivo");
      setEstado("error");
    }
  }

  // ── Reset para volver a empezar ──
  function reset() {
    setArchivo(null);
    setResultado(null);
    setEstado("idle");
    setMensajeError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Importar Aulas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Subí un archivo Excel con la hoja "AULAS" para cargar o actualizar
            las aulas de la universidad.
          </p>
        </div>

        {/* Card principal */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {/* Zona de drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              flex cursor-pointer flex-col items-center justify-center
              rounded-xl border-2 border-dashed p-8 text-center transition
              ${dragging
                ? "border-green-600 bg-green-50"
                : "border-gray-300 hover:border-green-500 hover:bg-gray-50"
              }
            `}
          >
            <svg
              className="mb-3 h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.9A5.001 5.001 0 0117 8h.5a4.5 4.5 0 010 9H7z"
              />
            </svg>
            {archivo ? (
              <>
                <p className="font-medium text-gray-800">{archivo.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {(archivo.size / 1024).toFixed(1)} KB
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-gray-700">
                  Arrastrá el archivo acá o hacé clic
                </p>
                <p className="mt-1 text-xs text-gray-500">Solo .xlsx</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => elegirArchivo(e.target.files?.[0])}
            />
          </div>

          {/* Botón subir */}
          <div className="mt-4 flex justify-end gap-2">
            {archivo && (
              <button
                onClick={reset}
                disabled={estado === "uploading"}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={handleSubir}
              disabled={!archivo || estado === "uploading"}
              className="rounded-lg bg-green-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
            >
              {estado === "uploading" ? "Procesando..." : "Subir e importar"}
            </button>
          </div>

          {/* Mensaje de error */}
          {estado === "error" && mensajeError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ❌ {mensajeError}
            </div>
          )}

          {/* Spinner mientras carga */}
          {estado === "uploading" && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Leyendo Excel y procesando aulas...
            </div>
          )}
        </div>

        {/* Resultado */}
        {estado === "ok" && resultado && (
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-lg font-bold text-gray-800">
              Resultado de la importación
            </h2>

            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-3xl font-bold text-green-800">
                  {resultado.creadas}
                </p>
                <p className="mt-1 text-xs font-medium text-green-700">
                  Creadas
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
                <p className="text-3xl font-bold text-blue-800">
                  {resultado.actualizadas}
                </p>
                <p className="mt-1 text-xs font-medium text-blue-700">
                  Actualizadas
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="text-3xl font-bold text-gray-600">
                  {resultado.ignoradas ?? 0}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-600">
                  Ignoradas
                </p>
              </div>
              <div
                className={`rounded-xl border p-4 text-center ${
                  resultado.totalErrores > 0
                    ? "border-red-200 bg-red-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <p
                  className={`text-3xl font-bold ${
                    resultado.totalErrores > 0 ? "text-red-800" : "text-gray-500"
                  }`}
                >
                  {resultado.totalErrores}
                </p>
                <p
                  className={`mt-1 text-xs font-medium ${
                    resultado.totalErrores > 0 ? "text-red-700" : "text-gray-600"
                  }`}
                >
                  Errores
                </p>
              </div>
            </div>

            {/* Tabla de errores */}
            {resultado.errores?.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Detalle de errores
                </h3>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 w-20">
                          Fila
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">
                          Motivo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultado.errores.map((err, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-mono text-gray-500">
                            {err.fila}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {err.motivo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={reset}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Importar otro archivo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
