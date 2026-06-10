"use client";

// ============================================================
// app/admin-qr-espacio/page.jsx
// ============================================================
// Le permite al administrador:
//   - Generar el QR permanente de un aula (uno por aula a la vez)
//   - Ver todos los QRs activos en una lista
//   - Desactivar QRs existentes
//   - Ver el QR generado y descargarlo / imprimirlo para pegar
//     físicamente en el aula
// ============================================================

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BACK_URL, getAuthHeaders } from "@/config/api";
import QRCode from "react-qr-code";

export default function AdminQrEspacioPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <AdminQrEspacioContenido />
    </ProtectedRoute>
  );
}

function AdminQrEspacioContenido() {
  // ── Estado de datos ─────────────────────────────────────
  const [aulas, setAulas] = useState([]);
  const [qrsActivos, setQrsActivos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  // ── Estado: aula seleccionada y QR generado ─────────────
  const [aulaSeleccionada, setAulaSeleccionada] = useState("");
  const [qrGenerado, setQrGenerado] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [genError, setGenError] = useState("");

  // ── Estado: modal de confirmación de desactivar ─────────
  const [qrADesactivar, setQrADesactivar] = useState(null);
  const [desactivando, setDesactivando] = useState(false);

  const qrRef = useRef(null);

  // ── Cargar datos ────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoadingData(true);
    setError("");
    try {
      const headers = getAuthHeaders();

      const [resAulas, resQrs] = await Promise.all([
        fetch(`${BACK_URL}/api/aulas`, { headers }),
        fetch(`${BACK_URL}/api/qr/espacio?soloActivos=true`, { headers }),
      ]);

      const dataAulas = await resAulas.json();
      const dataQrs = await resQrs.json();

      if (!resAulas.ok) throw new Error(dataAulas.message || "Error aulas");
      if (!resQrs.ok) throw new Error(dataQrs.error || dataQrs.message || "Error QRs");

      setAulas(Array.isArray(dataAulas) ? dataAulas : []);
      setQrsActivos(Array.isArray(dataQrs.espacioQRs) ? dataQrs.espacioQRs : []);
    } catch (e) {
      setError(e.message || "Error al cargar datos.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── URL pública del QR (la que se codifica visualmente) ─
  const urlQR = useMemo(() => {
    if (!qrGenerado?.token) return "";
    const base = process.env.NEXT_PUBLIC_FRONT_URL || window.location.origin;
    return `${base}/espacio/${qrGenerado.token}`;
  }, [qrGenerado]);

  // ── Generar QR ──────────────────────────────────────────
  async function handleGenerar() {
    if (!aulaSeleccionada) {
      return setGenError("Seleccioná un aula primero.");
    }
    setGenerando(true);
    setGenError("");
    setQrGenerado(null);
    try {
      const res = await fetch(`${BACK_URL}/api/qr/espacio/generar`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ aulaId: aulaSeleccionada }),
      });
      const data = await res.json();
      if (!res.ok) return setGenError(data.error || data.message || "Error al generar.");

      setQrGenerado(data.espacioQR);
      await cargarDatos(); // recargar la lista de activos
    } catch {
      setGenError("Error de red.");
    } finally {
      setGenerando(false);
    }
  }

  // ── Desactivar QR ───────────────────────────────────────
  async function handleDesactivar() {
    if (!qrADesactivar) return;
    setDesactivando(true);
    try {
      const res = await fetch(
        `${BACK_URL}/api/qr/espacio/desactivar/${qrADesactivar.espacioQrId}`,
        { method: "POST", headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Error al desactivar.");
      } else {
        await cargarDatos();
        // Si era el que estaba mostrando, lo limpio
        if (qrGenerado?.espacioQrId === qrADesactivar.espacioQrId) {
          setQrGenerado(null);
        }
      }
    } catch {
      setError("Error de red.");
    } finally {
      setDesactivando(false);
      setQrADesactivar(null);
    }
  }

  // ── Helpers ─────────────────────────────────────────────
  function nombreAula(aulaId) {
    const a = aulas.find((x) => x.aulaId === aulaId);
    return a ? `${a.sector}-${a.numero}` : "—";
  }

  // ── Descargar QR como PNG ───────────────────────────────
  function handleDescargar() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const TAM = 1200;
    const MARGEN = 60;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = TAM;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, TAM, TAM);
      ctx.drawImage(img, MARGEN, MARGEN, TAM - MARGEN * 2, TAM - MARGEN * 2);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png", 1.0);
      link.download = `qr-aula-${nombreAula(qrGenerado.aulaId)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ════════════════════════════════════════════════════════
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-900">QR de Aula (Espacio)</h1>
        <p className="mt-1 text-sm text-gray-600">
          Generá un código QR permanente para pegar físicamente en cada aula.
          Cuando alguien lo escanee, verá la información del espacio.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ════════════════════════════════════════════════
            COLUMNA IZQUIERDA: Generador
            ════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-green-900">
            Generar nuevo QR
          </h2>

          <label className="mb-1 block text-sm font-semibold text-gray-700">
            Aula
          </label>
          <select
            value={aulaSeleccionada}
            onChange={(e) => setAulaSeleccionada(e.target.value)}
            disabled={generando || loadingData}
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
          >
            <option value="">— Seleccioná un aula —</option>
            {aulas.map((a) => (
              <option key={a.aulaId} value={a.aulaId}>
                {a.sector}-{a.numero}
              </option>
            ))}
          </select>

          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ Si el aula ya tenía un QR activo, generar uno nuevo lo desactiva automáticamente.
          </div>

          <button
            onClick={handleGenerar}
            disabled={generando || !aulaSeleccionada}
            className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
          >
            {generando ? "Generando..." : "Generar QR"}
          </button>

          {genError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {genError}
            </p>
          )}

          {/* ── QR generado ── */}
          {qrGenerado && (
            <div className="mt-5 rounded-xl border border-green-300 bg-green-50 p-4">
              <p className="mb-2 text-sm font-semibold text-green-900">
                ✓ QR generado para {nombreAula(qrGenerado.aulaId)}
              </p>

              <div
                ref={qrRef}
                className="mb-3 flex items-center justify-center rounded-lg bg-white p-4"
              >
                <QRCode value={urlQR} size={220} />
              </div>

              <p className="mb-3 break-all rounded bg-white p-2 text-xs text-gray-600">
                {urlQR}
              </p>

              <button
                onClick={handleDescargar}
                className="w-full rounded-lg border border-green-700 bg-white px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
              >
                📥 Descargar PNG
              </button>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            COLUMNA DERECHA: Lista de QRs activos
            ════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-green-900">
            QRs activos ({qrsActivos.length})
          </h2>

          {loadingData ? (
            <div className="flex justify-center py-10">
              <svg className="h-6 w-6 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : qrsActivos.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No hay QRs activos. Generá uno seleccionando un aula.
            </p>
          ) : (
            <div className="max-h-[500px] space-y-2 overflow-y-auto">
              {qrsActivos.map((qr) => (
                <div
                  key={qr.espacioQrId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-green-900">
                      {qr.aula?.sector}-{qr.aula?.numero}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {qr.edificio?.nombre || "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(qr.createdAt).toLocaleString("es-AR")}
                    </p>
                  </div>
                  <button
                    onClick={() => setQrADesactivar(qr)}
                    className="ml-2 rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Desactivar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN
          ════════════════════════════════════════════════════ */}
      {qrADesactivar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-red-700">Desactivar QR</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700">
                ¿Estás seguro de desactivar el QR de{" "}
                <strong>
                  {qrADesactivar.aula?.sector}-{qrADesactivar.aula?.numero}
                </strong>
                ?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                El QR físico dejará de funcionar al escanearse. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setQrADesactivar(null)}
                disabled={desactivando}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDesactivar}
                disabled={desactivando}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {desactivando ? "Desactivando..." : "Sí, desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
