"use client";

// ============================================================
// app/admin-qr-espacio/page.jsx
// ============================================================
// Le permite al administrador:
//   - Filtrar aulas por edificio
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
import {
  Building2,
  DoorOpen,
  QrCode,
  Download,
  AlertTriangle,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Trash2,
  Inbox,
  X,
} from "lucide-react";

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

  // ── NUEVO: Filtro por edificio ──────────────────────────
  const [edificioFiltro, setEdificioFiltro] = useState("");

  // ── Estado: aula seleccionada y QR generado ─────────────
  const [aulaSeleccionada, setAulaSeleccionada] = useState("");
  const [qrGenerado, setQrGenerado] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [genError, setGenError] = useState("");

  // ── Estado: modal de confirmación de desactivar ─────────
  const [qrADesactivar, setQrADesactivar] = useState(null);
  const [desactivando, setDesactivando] = useState(false);

  // ── NUEVO: Filtro por edificio para la LISTA de QRs activos ─
  const [edificioFiltroLista, setEdificioFiltroLista] = useState("");

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

  // ── NUEVO: Extraer edificios únicos de las aulas ───────
  // Uso Map para deduplicar por edificioId. Filtro nulls.
  const edificios = useMemo(() => {
    const mapa = new Map();
    for (const a of aulas) {
      if (a.edificio?.edificioId && !mapa.has(a.edificio.edificioId)) {
        mapa.set(a.edificio.edificioId, a.edificio);
      }
    }
    return Array.from(mapa.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }, [aulas]);

  // ── NUEVO: Aulas filtradas por edificio ─────────────────
  const aulasFiltradas = useMemo(() => {
    if (!edificioFiltro) return aulas;
    return aulas.filter(
      (a) => String(a.edificio?.edificioId) === String(edificioFiltro)
    );
  }, [aulas, edificioFiltro]);

  // ── NUEVO: QRs filtrados por edificio (para la LISTA) ───
  const qrsFiltrados = useMemo(() => {
    if (!edificioFiltroLista) return qrsActivos;
    return qrsActivos.filter(
      (qr) => String(qr.edificio?.edificioId) === String(edificioFiltroLista)
    );
  }, [qrsActivos, edificioFiltroLista]);

  // ── NUEVO: Al cambiar filtro de edificio, limpio aula seleccionada
  useEffect(() => {
    setAulaSeleccionada("");
  }, [edificioFiltro]);

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
      await cargarDatos();
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
      {/* ── Encabezado ── */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          QR de Aula (Espacio)
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Generá un código QR permanente para pegar físicamente en cada aula.
          Cuando alguien lo escanee, verá la información del espacio.
        </p>
      </div>

      {/* ── Error global ── */}
      {error && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--color-error-bg)",
            background: "var(--color-error-bg)",
            color: "var(--color-error)",
          }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ════════════════════════════════════════════════
            COLUMNA IZQUIERDA: Generador
            ════════════════════════════════════════════════ */}
        <div
          className="rounded-2xl border p-5 shadow-sm"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <QrCode
              className="h-5 w-5"
              style={{ color: "var(--color-primary)" }}
              strokeWidth={1.75}
            />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Generar nuevo QR
            </h2>
          </div>

          {/* ── NUEVO: Filtro por edificio ── */}
          <label
            className="mb-1 flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            <Building2 className="h-4 w-4" strokeWidth={1.75} />
            Edificio
          </label>
          <select
            value={edificioFiltro}
            onChange={(e) => setEdificioFiltro(e.target.value)}
            disabled={generando || loadingData}
            className="mb-4 w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-primary)",
              "--tw-ring-color": "var(--color-primary-ring)",
            }}
          >
            <option value="">Todos los edificios</option>
            {edificios.map((e) => (
              <option key={e.edificioId} value={e.edificioId}>
                {e.nombre}
              </option>
            ))}
          </select>

          {/* ── Aula ── */}
          <label
            className="mb-1 flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            <DoorOpen className="h-4 w-4" strokeWidth={1.75} />
            Aula
          </label>
          <select
            value={aulaSeleccionada}
            onChange={(e) => setAulaSeleccionada(e.target.value)}
            disabled={generando || loadingData}
            className="mb-3 w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-primary)",
              "--tw-ring-color": "var(--color-primary-ring)",
            }}
          >
            <option value="">
              {edificioFiltro
                ? `— Seleccioná un aula (${aulasFiltradas.length} disponibles) —`
                : "— Seleccioná un aula —"}
            </option>
            {aulasFiltradas.map((a) => (
              <option key={a.aulaId} value={a.aulaId}>
                {a.sector}-{a.numero}
                {a.edificio?.nombre ? ` · ${a.edificio.nombre}` : ""}
              </option>
            ))}
          </select>

          {/* ── Aviso ── */}
          <div
            className="mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: "var(--color-warning-bg)",
              background: "var(--color-warning-bg)",
              color: "var(--color-warning)",
            }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              Si el aula ya tenía un QR activo, generar uno nuevo lo desactiva automáticamente.
            </span>
          </div>

          {/* ── Botón generar ── */}
          <button
            onClick={handleGenerar}
            disabled={generando || !aulaSeleccionada}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {generando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Generando…
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4" strokeWidth={1.75} />
                Generar QR
              </>
            )}
          </button>

          {/* ── Error de generación ── */}
          {genError && (
            <div
              className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--color-error-bg)",
                background: "var(--color-error-bg)",
                color: "var(--color-error)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>{genError}</span>
            </div>
          )}

          {/* ── QR generado ── */}
          {qrGenerado && (
            <div
              className="mt-5 rounded-xl border p-4"
              style={{
                borderColor: "var(--color-primary-ring)",
                background: "var(--color-primary-subtle)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2
                  className="h-4 w-4"
                  style={{ color: "var(--color-primary-active)" }}
                  strokeWidth={1.75}
                />
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-primary-active)" }}
                >
                  QR generado para {nombreAula(qrGenerado.aulaId)}
                </p>
              </div>

              <div
                ref={qrRef}
                className="mb-3 flex items-center justify-center rounded-lg p-4"
                style={{ background: "#ffffff" }}
              >
                <QRCode value={urlQR} size={220} />
              </div>

              <p
                className="mb-3 break-all rounded p-2 text-xs"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {urlQR}
              </p>

              <button
                onClick={handleDescargar}
                className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-white/50"
                style={{
                  borderColor: "var(--color-primary)",
                  background: "var(--color-surface)",
                  color: "var(--color-primary)",
                }}
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
                Descargar PNG
              </button>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            COLUMNA DERECHA: Lista de QRs activos
            ════════════════════════════════════════════════ */}
        <div
          className="rounded-2xl border p-5 shadow-sm"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode
                className="h-5 w-5"
                style={{ color: "var(--color-primary)" }}
                strokeWidth={1.75}
              />
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                QRs activos
              </h2>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                background: "var(--color-primary-light)",
                color: "var(--color-primary-active)",
              }}
            >
              {qrsFiltrados.length}
              {edificioFiltroLista ? ` de ${qrsActivos.length}` : ""}
            </span>
          </div>

          {/* ── NUEVO: Filtro por edificio para la lista ── */}
          <div className="mb-4">
            <label
              className="mb-1 flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Building2 className="h-4 w-4" strokeWidth={1.75} />
              Filtrar por edificio
            </label>
            <select
              value={edificioFiltroLista}
              onChange={(e) => setEdificioFiltroLista(e.target.value)}
              disabled={loadingData}
              className="w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text-primary)",
                "--tw-ring-color": "var(--color-primary-ring)",
              }}
            >
              <option value="">Todos los edificios</option>
              {edificios.map((e) => (
                <option key={e.edificioId} value={e.edificioId}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>

          {loadingData ? (
            <div className="flex justify-center py-10">
              <Loader2
                className="h-6 w-6 animate-spin"
                style={{ color: "var(--color-primary)" }}
                strokeWidth={1.75}
              />
            </div>
          ) : qrsFiltrados.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 py-10 text-center"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Inbox className="h-8 w-8" strokeWidth={1.5} />
              <p className="text-sm">
                {edificioFiltroLista
                  ? "No hay QRs activos en este edificio."
                  : "No hay QRs activos. Generá uno seleccionando un aula."}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {qrsFiltrados.map((qr) => (
                <div
                  key={qr.espacioQrId}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5 transition hover:shadow-sm"
                  style={{
                    borderColor: "var(--color-border)",
                    background: "var(--color-surface)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {qr.aula?.sector}-{qr.aula?.numero}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {qr.edificio?.nombre || "—"}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {new Date(qr.createdAt).toLocaleString("es-AR")}
                    </p>
                  </div>
                  <button
                    onClick={() => setQrADesactivar(qr)}
                    className="ml-2 flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition hover:opacity-90"
                    style={{
                      borderColor: "var(--color-error)",
                      color: "var(--color-error)",
                      background: "var(--color-surface)",
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
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
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl"
            style={{ background: "var(--color-surface)" }}
          >
            <div
              className="flex items-center justify-between border-b px-6 py-4"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="h-5 w-5"
                  style={{ color: "var(--color-error)" }}
                  strokeWidth={1.75}
                />
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--color-error)" }}
                >
                  Desactivar QR
                </h3>
              </div>
              <button
                onClick={() => setQrADesactivar(null)}
                disabled={desactivando}
                className="rounded-full p-1 transition hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
                aria-label="Cerrar"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p
                className="text-sm"
                style={{ color: "var(--color-text-primary)" }}
              >
                ¿Estás seguro de desactivar el QR de{" "}
                <strong>
                  {qrADesactivar.aula?.sector}-{qrADesactivar.aula?.numero}
                </strong>
                ?
              </p>
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                El QR físico dejará de funcionar al escanearse. Esta acción no se puede deshacer.
              </p>
            </div>
            <div
              className="flex justify-end gap-2 border-t px-6 py-4"
              style={{ borderColor: "var(--color-border)" }}
            >
              <button
                onClick={() => setQrADesactivar(null)}
                disabled={desactivando}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                style={{
                  borderColor: "var(--color-border-strong)",
                  color: "var(--color-text-primary)",
                  background: "var(--color-surface)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDesactivar}
                disabled={desactivando}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--color-error)" }}
              >
                {desactivando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    Desactivando…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    Sí, desactivar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}