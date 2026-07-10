"use client";

import { useRef, useState } from "react";
import { getAuthHeaders } from "@/config/api";
import ProtectedRoute from "@/components/ProtectedRoute";

const API_URL = process.env.NEXT_PUBLIC_BACK_URL || "http://localhost:3001";

export default function ImportarPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <ImportarContenido />
    </ProtectedRoute>
  );
}

function ImportarContenido() {
  const inputRef = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [estado,   setEstado]   = useState("idle");
  const [preview,  setPreview]  = useState(null);
  const [mensaje,  setMensaje]  = useState("");
  // NUEVO: errores de aulas detectados en la validación previa
  const [erroresAulas, setErroresAulas] = useState([]);

  function procesarArchivo(file) {
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setMensaje("Solo se aceptan archivos .xlsx o .xls");
      setEstado("error");
      return;
    }
    setArchivo(file);
    setEstado("idle");
    setMensaje("");
    setPreview(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    procesarArchivo(e.dataTransfer.files?.[0]);
  }

  // PASO 1 — Preview
  async function handlePreview() {
    if (!archivo) return;
    setEstado("previewing");
    setMensaje("");
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);

      // ✅ getAuthHeaders() devuelve el JWT Bearer — requerido porque /api/importar está protegido
      // Nota: NO pasar Content-Type con FormData, el browser lo setea automáticamente con el boundary
      const { Authorization } = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/importar/preview`, {
        method: "POST",
        headers: { Authorization },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Error al previsualizar.");
      setPreview(data.resumen);
      // NUEVO: guardar los errores de aulas para mostrarlos y bloquear el confirmar
      setErroresAulas(Array.isArray(data.erroresAulas) ? data.erroresAulas : []);
      setEstado("preview_ok");
    } catch (err) {
      setEstado("error");
      setMensaje(err?.message ?? "Error al leer el archivo.");
    }
  }

  // PASO 2 — Confirmar importación
  async function handleConfirmar() {
    if (!archivo) return;
    setEstado("importing");
    setMensaje("");
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);

      const { Authorization } = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/importar/confirmar`, {
        method: "POST",
        headers: { Authorization },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        // Manejo especial: si el backend devolvió errores de aulas,
        // los mostramos formateados en pantalla.
        if (Array.isArray(data?.erroresAulas) && data.erroresAulas.length > 0) {
          setErroresAulas(data.erroresAulas);
        }
        throw new Error(data?.error ?? data?.message ?? "Error al importar.");
      }
      const r = data.resultados ?? {};
      setEstado("success");

      // NUEVO formato: cada entidad tiene { nuevos, actualizados, sinCambios }
      // Ej: "Docentes: +2 nuevos / ~1 actualizados"
      function resumen(label, obj) {
        if (!obj) return null;
        const partes = [];
        if (obj.nuevos) partes.push(`+${obj.nuevos} nuevos`);
        if (obj.actualizados) partes.push(`~${obj.actualizados} actualizados`);
        if (!partes.length && obj.sinCambios) return `${label}: sin cambios`;
        if (!partes.length) return null;
        return `${label}: ${partes.join(" / ")}`;
      }

      const items = [
        resumen("Docentes", r.profesores),
        resumen("Materias", r.materias),
        resumen("Comisiones", r.comisiones),
        resumen("Horarios", r.horarios),
        resumen("Estudiantes", r.estudiantes),
        resumen("Matrículas", r.matriculas),
      ].filter(Boolean);

      const extraUsuarios = r.usuariosCreados
        ? ` · Usuarios creados: ${r.usuariosCreados}`
        : "";

      setMensaje(
        `✓ Importación completada — ` +
        (items.length ? items.join(" · ") : "sin cambios") +
        extraUsuarios + "."
      );
      setArchivo(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setEstado("error");
      setMensaje(err?.message ?? "Error al importar el archivo.");
    }
  }

  function handleReset() {
    setArchivo(null);
    setEstado("idle");
    setMensaje("");
    setPreview(null);
    setErroresAulas([]);  // NUEVO: limpiar errores
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:py-12">
      <div className="w-full max-w-xl">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Importar Planilla de Cálculo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cargá el archivo Excel con la información de comisiones y matriculación.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">

          {/* Zona de drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !preview && inputRef.current?.click()}
            className={`mb-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition select-none ${
              dragging  ? "border-green-500 bg-green-50"
              : archivo ? "border-green-400 bg-green-50"
              :           "border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50"
            } ${preview ? "cursor-default" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Zona para cargar archivo Excel"
            onKeyDown={(e) => !preview && e.key === "Enter" && inputRef.current?.click()}
          >
            <span className="text-4xl select-none" aria-hidden="true">
              {archivo ? "📄" : "📁"}
            </span>
            <div className="text-center">
              {archivo ? (
                <>
                  <p className="text-sm font-medium text-green-700">{archivo.name}</p>
                  <p className="text-xs text-gray-500">{(archivo.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-600">Hacé click o arrastrá un archivo aquí</p>
                  <p className="text-xs text-gray-400">Solo archivos .xlsx o .xls</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => procesarArchivo(e.target.files?.[0])}
            />
          </div>

          {/* Resumen de preview */}
          {preview && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="mb-3 text-sm font-semibold text-green-800">Vista previa — lo que se va a importar:</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Comisiones",  valor: preview.comisiones },
                  { label: "Estudiantes", valor: preview.estudiantes },
                  { label: "Docentes",    valor: preview.docentes },
                  { label: "Materias",    valor: preview.materias?.length ?? 0 },
                  { label: "Edificios",   valor: preview.edificios?.length ?? 0 },
                  { label: "Aulas",       valor: preview.aulas },
                ].map(({ label, valor }) => (
                  <div key={label} className="rounded-lg bg-white px-3 py-2 text-center ring-1 ring-green-100">
                    <p className="text-lg font-bold text-green-700">{valor}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NUEVO: Errores de aulas ──
              Se muestran cuando el backend detectó aulas/edificios
              del Excel que no existen en la DB. Bloquea el confirmar. */}
          {erroresAulas.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="mb-2 flex items-start gap-2">
                <span className="text-lg" aria-hidden="true">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    No se puede importar todavía — {erroresAulas.length} problema{erroresAulas.length === 1 ? "" : "s"} de aulas/edificios
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    Cargá primero el archivo de aulas o corregí en el Excel los nombres que aparecen abajo.
                    El nombre debe coincidir exactamente con el edificio/aula ya cargados.
                  </p>
                </div>
              </div>

              <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-amber-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-amber-100 text-amber-900">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-semibold">Fila</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Edificio</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Aula</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Problema</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {erroresAulas.slice(0, 30).map((e, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-1.5 font-mono text-gray-700">{e.fila}</td>
                        <td className="px-3 py-1.5 text-gray-800">{e.edificio}</td>
                        <td className="px-3 py-1.5 text-gray-800">{e.espacio}</td>
                        <td className="px-3 py-1.5 text-amber-800">{e.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {erroresAulas.length > 30 && (
                  <p className="px-3 py-2 text-xs italic text-gray-500">
                    …y {erroresAulas.length - 30} más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Feedback */}
          {estado === "error" && mensaje && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{mensaje}</p>
          )}
          {estado === "success" && mensaje && (
            <p role="status" className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mensaje}</p>
          )}

          {/* Botones */}
          <div className="flex flex-col gap-2 sm:flex-row">
            {!preview && estado !== "success" && (
              <button
                onClick={handlePreview}
                disabled={!archivo || estado === "previewing"}
                className="flex-1 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {estado === "previewing" ? "Leyendo archivo..." : "Previsualizar"}
              </button>
            )}
            {preview && (
              <button
                onClick={handleConfirmar}
                disabled={estado === "importing" || erroresAulas.length > 0}
                className="flex-1 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                title={erroresAulas.length > 0 ? "Corregí primero los errores de aulas" : ""}
              >
                {estado === "importing"
                  ? "Importando..."
                  : erroresAulas.length > 0
                    ? "Corregí los errores primero"
                    : "Confirmar importación"}
              </button>
            )}
            {archivo && estado !== "importing" && estado !== "previewing" && (
              <button
                onClick={handleReset}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}