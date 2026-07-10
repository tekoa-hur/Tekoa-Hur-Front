"use client";

// ============================================================
// app/espacio/[token]/page.jsx
// ============================================================
// Pantalla pública con lista de ocupación
//
// Página PÚBLICA (sin auth) que se abre al escanear el QR de aula.
// Muestra DOS cosas:
//
//   1. Atributos del aula (lo que ya estaba: capacidad, equipamiento)
//   2. Lista de ocupación del día actual desde la hora del escaneo
//      en adelante (cursadas + reservas hasta fin del día)
//
// Hace una sola llamada al endpoint público
// /api/qr/espacio/calendario/:token que ya trae todo junto:
// aula, atributos y eventos.
//
// No es un calendario completo (eso es para el admin).
// Acá solo lista cronológica del día, mobile-first.
// ============================================================

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BACK_URL } from "@/config/api";
import {
  Landmark,
  MapPin,
  Users,
  Tag,
  Monitor,
  FileText,
  Wrench,
  Clock,
  BookOpen,
  Calendar,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

export default function EspacioPublicoPage() {
  const params = useParams();
  const token = params?.token;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Hora en la que se escaneó el QR (se calcula UNA VEZ) ─────
  // No queremos que cambie en cada re-render. La fijamos al
  // montar el componente con useState que solo se inicializa
  // la primera vez.
  const [horaEscaneo] = useState(() => new Date());

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(
          `${BACK_URL}/api/qr/espacio/calendario/${token}`
        );
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || json.message || "QR inválido");
        } else {
          setData(json);
        }
      } catch {
        setError("Error de red");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--color-page-bg)" }}
      >
        <div className="text-center">
          <Loader2
            className="mx-auto h-10 w-10 animate-spin"
            style={{ color: "var(--color-primary)" }}
            strokeWidth={1.75}
          />
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cargando información…
          </p>
        </div>
      </main>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <main
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: "var(--color-page-bg)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-6 text-center shadow-lg"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-error-bg)",
          }}
        >
          <XCircle
            className="mx-auto mb-3 h-12 w-12"
            style={{ color: "var(--color-error)" }}
            strokeWidth={1.5}
          />
          <h1
            className="mb-2 text-xl font-bold"
            style={{ color: "var(--color-error)" }}
          >
            QR inválido
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {error}
          </p>
          <p
            className="mt-3 text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Este QR puede estar desactivado o no existir.
          </p>
        </div>
      </main>
    );
  }

  // ── Datos cargados: armamos la vista ─────────────────────────
  const { aula, atributos, eventos = [] } = data;
  const { evento: eventoAhora, proximos } = separarEventos(eventos, horaEscaneo);

  return (
    <main
      className="min-h-screen p-4 pb-12"
      style={{ background: "var(--color-page-bg)" }}
    >
      <div className="mx-auto w-full max-w-lg pt-6">
        {/* ═══════════════════════════════════════════════════════
            Header con info del aula
            ═══════════════════════════════════════════════════════ */}
        <div
          className="mb-4 rounded-2xl p-6 text-white shadow-lg"
          style={{ background: "var(--color-primary)" }}
        >
          <div
            className="flex items-center gap-1.5 text-xs uppercase tracking-wide"
            style={{ color: "var(--color-primary-light)" }}
          >
            <Landmark className="h-3.5 w-3.5" strokeWidth={1.75} />
            Aula
          </div>
          <h1 className="mt-1 text-3xl font-bold">
            {aula.nombreCompleto}
          </h1>
          {aula.edificio && (
            <p
              className="mt-2 flex items-center gap-1.5 text-sm"
              style={{ color: "var(--color-primary-subtle)" }}
            >
              <MapPin className="h-4 w-4" strokeWidth={1.75} />
              {aula.edificio.nombre}
            </p>
          )}
          <p
            className="mt-3 flex items-center gap-1.5 text-xs"
            style={{ color: "var(--color-primary-subtle)" }}
          >
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Consultado: {formatearFechaHora(horaEscaneo)}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SECCIÓN: ESTADO ACTUAL
            ═══════════════════════════════════════════════════════ */}
        <SeccionEstadoActual evento={eventoAhora} />

        {/* ═══════════════════════════════════════════════════════
            SECCIÓN: PRÓXIMAS OCUPACIONES DEL DÍA
            ═══════════════════════════════════════════════════════ */}
        <SeccionProximos proximos={proximos} />

        {/* ═══════════════════════════════════════════════════════
            SECCIÓN: ATRIBUTOS DEL AULA
            ═══════════════════════════════════════════════════════ */}
        {atributos && (
          <div className="mt-6">
            <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-gray-600">
              Información del aula
            </h2>
            <div className="space-y-3">
              {atributos.capacidad != null && (
                <Card label="Capacidad" value={`${atributos.capacidad} personas`} Icon={Users} />
              )}

              {atributos.tipoAula && (
                <Card label="Tipo" value={atributos.tipoAula} Icon={Tag} />
              )}

              {atributos.esLaboratorioInformatico && (
                <Card
                  label="Laboratorio Informático"
                  value={
                    atributos.cantidadPC != null
                      ? `Sí (${atributos.cantidadPC} PCs)`
                      : "Sí"
                  }
                  Icon={Monitor}
                  highlight
                />
              )}

              {atributos.descripcion && (
                <Card label="Descripción" value={atributos.descripcion} Icon={FileText} />
              )}

              {Array.isArray(atributos.equipamiento) && atributos.equipamiento.length > 0 && (
                <div
                  className="rounded-xl p-4 shadow-sm"
                  style={{ background: "var(--color-surface)" }}
                >
                  <p
                    className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <Wrench className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Equipamiento
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {atributos.equipamiento.map((eq, idx) => (
                      <span
                        key={idx}
                        className="rounded-full px-3 py-1 text-sm font-medium"
                        style={{
                          background: "var(--color-primary-light)",
                          color: "var(--color-primary-active)",
                        }}
                      >
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-500">
          Tekoá-Hur · Sistema de gestión académica
        </p>
      </div>
    </main>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENTE: estado actual del aula
// ════════════════════════════════════════════════════════════════
// Muestra una tarjeta grande con el estado AHORA:
//   - Si hay evento activo: muestra qué es (verde si cursada,
//     azul si reserva)
//   - Si no hay evento activo: muestra "Aula libre" en verde
function SeccionEstadoActual({ evento }) {
  if (!evento) {
    return (
      <div
        className="mb-4 rounded-2xl border-2 p-5 text-center shadow-sm"
        style={{
          borderColor: "var(--color-primary-ring)",
          background: "var(--color-primary-subtle)",
        }}
      >
        <CheckCircle2
          className="mx-auto mb-2 h-10 w-10"
          style={{ color: "var(--color-primary)" }}
          strokeWidth={1.5}
        />
        <p
          className="text-lg font-bold"
          style={{ color: "var(--color-primary-active)" }}
        >
          Aula libre ahora
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--color-primary)" }}
        >
          No hay ninguna ocupación en este momento
        </p>
      </div>
    );
  }

  // Hay evento activo
  const esCursada = evento.tipo === "cursada";
  const bgColor = esCursada ? "bg-orange-50 border-orange-300" : "bg-blue-50 border-blue-300";
  const textColor = esCursada ? "text-orange-700" : "text-blue-700";
  const labelColor = esCursada ? "text-orange-600" : "text-blue-600";
  const IconoEvento = esCursada ? BookOpen : Calendar;
  const label = esCursada ? "En cursada ahora" : "Reservado ahora";

  return (
    <div className={`mb-4 rounded-2xl border-2 ${bgColor} p-5 shadow-sm`}>
      <div className="mb-2 flex items-center gap-2">
        <IconoEvento className={`h-5 w-5 ${labelColor}`} strokeWidth={1.75} />
        <span className={`text-sm font-semibold uppercase ${labelColor}`}>
          {label}
        </span>
      </div>
      <h3 className={`text-xl font-bold ${textColor}`}>{evento.title}</h3>
      {evento.subtitulo && (
        <p className={`mt-1 text-sm ${textColor}`}>{evento.subtitulo}</p>
      )}
      <p className={`mt-3 flex items-center gap-1.5 text-xs ${labelColor}`}>
        <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
        {formatearHora(evento.start)} — {formatearHora(evento.end)}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENTE: próximas ocupaciones del día
// ════════════════════════════════════════════════════════════════
function SeccionProximos({ proximos }) {
  if (!proximos || proximos.length === 0) {
    return (
      <div
        className="mb-4 flex items-center justify-center gap-2 rounded-xl border p-5 text-center"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <Info
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--color-text-muted)" }}
          strokeWidth={1.75}
        />
        <p
          className="text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          No hay más ocupaciones programadas para hoy.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-gray-600">
        Próximas ocupaciones hoy
      </h2>
      <div className="space-y-2">
        {proximos.map((ev) => (
          <EventoCard key={ev.id} evento={ev} />
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENTE: tarjeta de un evento futuro
// ════════════════════════════════════════════════════════════════
function EventoCard({ evento }) {
  const esCursada = evento.tipo === "cursada";
  const borderColor = esCursada ? "border-l-green-700" : "border-l-blue-700";
  const badgeBg = esCursada ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
  const badgeText = esCursada ? "Cursada" : "Reserva";

  return (
    <div className={`rounded-lg border border-gray-200 border-l-4 ${borderColor} bg-white p-3 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-800">{evento.title}</p>
          {evento.subtitulo && (
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {evento.subtitulo}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeBg}`}>
          {badgeText}
        </span>
      </div>
      <p
        className="mt-2 flex items-center gap-1.5 text-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <Clock className="h-3 w-3" strokeWidth={1.75} />
        {formatearHora(evento.start)} — {formatearHora(evento.end)}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENTE: tarjeta de atributo (existente)
// ════════════════════════════════════════════════════════════════
function Card({ label, value, icon, highlight }) {
  return (
    <div
      className={`rounded-xl p-4 shadow-sm ${
        highlight ? "bg-blue-50 border border-blue-200" : "bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon} {label}
      </p>
      <p
        className={`mt-1 text-base ${
          highlight ? "font-bold text-blue-900" : "font-medium text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// HELPERS — funciones puras que no usan estado de React
// ════════════════════════════════════════════════════════════════

/**
 * Separa los eventos en: el que está pasando AHORA (si hay) y los
 * próximos (los que arrancan después de "ahora").
 *
 * Un evento se considera "actual" si:
 *   ahora >= start  &&  ahora < end
 */
function separarEventos(eventos, ahora) {
  const ahoraMs = ahora.getTime();
  let evento = null;
  const proximos = [];

  for (const ev of eventos) {
    const startMs = new Date(ev.start).getTime();
    const endMs = new Date(ev.end).getTime();

    if (ahoraMs >= startMs && ahoraMs < endMs) {
      // Está ocurriendo ahora
      evento = ev;
    } else if (startMs >= ahoraMs) {
      // Está en el futuro (mismo día porque el backend filtra)
      proximos.push(ev);
    }
    // Si ya pasó (endMs <= ahoraMs) lo ignoramos
  }

  return { evento, proximos };
}

/**
 * Formatea una fecha ISO a "HH:MM" en hora local del navegador.
 * Ej: "2026-06-14T14:00:00.000Z" → "14:00"
 */
function formatearHora(fechaISO) {
  const d = new Date(fechaISO);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Formatea una fecha completa para mostrar en el header.
 * Ej: "sábado, 14 de junio · 14:35"
 */
function formatearFechaHora(fecha) {
  const opciones = {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  };
  return fecha.toLocaleString("es-AR", opciones);
}