"use client";

// ============================================================
// app/admin-calendario/[aulaId]/page.jsx
// ============================================================
// Calendario administrativo del aula
//
// Pantalla PRIVADA (solo administradores) que muestra un
// calendario completo de un aula con vistas Día / Semana / Mes.
//
// Sirve para:
//   - Ver de un pantallazo qué cursadas y reservas tiene un aula
//   - Detectar conflictos al armar nuevas reservas
//   - Cambiar de mes/semana navegando con los botones nativos
//     del calendario
//
// Consume el endpoint:
//   GET /api/aulas/:aulaId/ocupacion?desde=...&hasta=...
//
// Ese endpoint ya existe y devuelve los
// eventos en el formato que FullCalendar entiende (id, title,
// start, end, color).
// ============================================================

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { BACK_URL, getAuthHeaders } from "@/config/api";

// Imports de FullCalendar
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";       // vista mes
import timeGridPlugin from "@fullcalendar/timegrid";     // vista día y semana
import interactionPlugin from "@fullcalendar/interaction"; // click en eventos
import esLocale from "@fullcalendar/core/locales/es";    // textos en español

export default function AdminCalendarioPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <AdminCalendarioContenido />
    </ProtectedRoute>
  );
}

function AdminCalendarioContenido() {
  // ── Params de la URL ────────────────────────────────────
  // useParams lee la parte dinámica de la ruta. Como el archivo
  // está en [aulaId], acá obtenemos ese valor.
  const params = useParams();
  const router = useRouter();
  const aulaId = params?.aulaId;

  // ── Estado ──────────────────────────────────────────────
  const [aula, setAula] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estado del evento seleccionado (para el modal de detalles)
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);

  // Referencia al componente FullCalendar (para leer su API)
  // useRef nos da un "puntero" al componente que sobrevive entre
  // renders sin causar re-renders cuando cambia.
  const calendarRef = useRef(null);

  // ── Cargar eventos del aula ─────────────────────────────
  // useCallback memoriza la función para que no se cree de nuevo
  // en cada render (necesario porque la pasamos a useEffect).
  const cargarEventos = useCallback(async (desde, hasta) => {
    if (!aulaId) return;
    setLoading(true);
    setError("");
    try {
      // Construimos la URL con los parámetros de fecha.
      // toISOString().slice(0, 10) convierte "2026-06-23T..." en
      // "2026-06-23" que es el formato YYYY-MM-DD que pide el backend.
      const desdeStr = desde.toISOString().slice(0, 10);
      const hastaStr = hasta.toISOString().slice(0, 10);

      const url = `${BACK_URL}/api/aulas/${aulaId}/ocupacion?desde=${desdeStr}&hasta=${hastaStr}&soloVigentes=false`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Error al cargar eventos");
      }

      // Guardamos el aula (la primera vez) y los eventos
      if (data.aula) setAula(data.aula);
      setEventos(data.eventos || []);
    } catch (e) {
      setError(e.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }, [aulaId]);

  // ── Carga inicial: traer los próximos 60 días ──────────
  useEffect(() => {
    const hoy = new Date();
    const en60dias = new Date();
    en60dias.setDate(en60dias.getDate() + 60);
    cargarEventos(hoy, en60dias);
  }, [cargarEventos]);

  // ── Cuando el usuario cambia de mes/semana en el calendario ──
  // FullCalendar dispara este callback cada vez que cambia la
  // vista (mes, semana, día) o navega adelante/atrás.
  // info.start y info.end son las fechas visibles en ese momento.
  function handleDatesSet(info) {
    cargarEventos(info.start, info.end);
  }

  // ── Cuando el usuario hace clic en un evento ──────────
  // FullCalendar nos da el evento clickeado. Sus datos originales
  // (los que pasamos en `events`) están en event.extendedProps.
  function handleEventClick(info) {
    const ev = info.event;
    setEventoSeleccionado({
      title: ev.title,
      start: ev.start,
      end: ev.end,
      tipo: ev.extendedProps.tipo,
      subtitulo: ev.extendedProps.subtitulo,
      detalles: ev.extendedProps.detalles,
    });
  }

  // ── Formatear fecha y hora para el modal de detalles ──
  function formatearFechaHora(fecha) {
    if (!fecha) return "—";
    return new Date(fecha).toLocaleString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ════════════════════════════════════════════════════════
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* ── Header con info del aula y botón "volver" ─── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => router.push("/admin-aulas")}
            className="mb-2 text-sm text-green-700 hover:underline"
          >
            ← Volver a aulas
          </button>
          <h1 className="text-2xl font-bold text-green-900">
            Calendario de ocupación
            {aula && `: ${aula.nombreCompleto}`}
          </h1>
          {aula?.edificio && (
            <p className="mt-1 text-sm text-gray-600">
              📍 {aula.edificio.nombre}
            </p>
          )}
        </div>

        {/* Leyenda de colores */}
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-green-800" />
            Cursadas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-blue-700" />
            Reservas
          </span>
        </div>
      </div>

      {/* ── Mensajes de error / loading ──────────────── */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-3 text-xs text-gray-500">Cargando eventos...</div>
      )}

      {/* ════════════════════════════════════════════════
          CALENDARIO
          ════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <FullCalendar
          ref={calendarRef}
          // ── Plugins activos ──
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}

          // ── Vista inicial: semana con horas ──
          initialView="timeGridWeek"

          // ── Botones que se ven en la barra superior ──
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}

          // ── Idioma español ──
          locale={esLocale}

          // ── Datos: nuestros eventos ──
          // FullCalendar lee start, end, title, color directamente.
          // El resto de campos quedan accesibles en extendedProps.
          events={eventos}

          // ── Callbacks ──
          datesSet={handleDatesSet}
          eventClick={handleEventClick}

          // ── Configuración visual ──
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          weekends={true}
          nowIndicator={true} // línea roja indicando "ahora"
          allDaySlot={false}  // no mostrar la franja "todo el día"

          // ── Texto de botones (los traduce esLocale, pero por si acaso) ──
          buttonText={{
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
          }}
        />
      </div>

      {/* ════════════════════════════════════════════════
          MODAL DE DETALLES DE EVENTO
          ════════════════════════════════════════════════ */}
      {eventoSeleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEventoSeleccionado(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`rounded-t-2xl px-6 py-4 ${
                eventoSeleccionado.tipo === "cursada"
                  ? "bg-green-800 text-white"
                  : "bg-blue-700 text-white"
              }`}
            >
              <p className="text-xs uppercase tracking-wide opacity-80">
                {eventoSeleccionado.tipo === "cursada" ? "📚 Cursada" : "📅 Reserva"}
              </p>
              <h3 className="mt-1 text-lg font-bold">
                {eventoSeleccionado.title}
              </h3>
              {eventoSeleccionado.subtitulo && (
                <p className="mt-1 text-sm opacity-90">
                  {eventoSeleccionado.subtitulo}
                </p>
              )}
            </div>

            <div className="space-y-3 px-6 py-5 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Inicio
                </p>
                <p className="text-gray-800">
                  {formatearFechaHora(eventoSeleccionado.start)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Fin
                </p>
                <p className="text-gray-800">
                  {formatearFechaHora(eventoSeleccionado.end)}
                </p>
              </div>

              {/* Detalles específicos según el tipo */}
              {eventoSeleccionado.detalles && (
                <div className="rounded-lg bg-gray-50 p-3">
                  {eventoSeleccionado.tipo === "cursada" ? (
                    <>
                      {eventoSeleccionado.detalles.materia && (
                        <p>
                          <span className="font-semibold">Materia:</span>{" "}
                          {eventoSeleccionado.detalles.materia}
                        </p>
                      )}
                      {eventoSeleccionado.detalles.comision && (
                        <p>
                          <span className="font-semibold">Comisión:</span>{" "}
                          {eventoSeleccionado.detalles.comision}
                        </p>
                      )}
                      {eventoSeleccionado.detalles.docente && (
                        <p>
                          <span className="font-semibold">Docente:</span>{" "}
                          {eventoSeleccionado.detalles.docente}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {eventoSeleccionado.detalles.motivo && (
                        <p>
                          <span className="font-semibold">Motivo:</span>{" "}
                          {eventoSeleccionado.detalles.motivo}
                        </p>
                      )}
                      {eventoSeleccionado.detalles.descripcion && (
                        <p>
                          <span className="font-semibold">Descripción:</span>{" "}
                          {eventoSeleccionado.detalles.descripcion}
                        </p>
                      )}
                      {eventoSeleccionado.detalles.usuario && (
                        <p>
                          <span className="font-semibold">Reservado por:</span>{" "}
                          {eventoSeleccionado.detalles.usuario}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-6 py-3">
              <button
                onClick={() => setEventoSeleccionado(null)}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
