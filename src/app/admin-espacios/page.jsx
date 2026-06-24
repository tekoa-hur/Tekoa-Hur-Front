"use client";

// ============================================================
// app/admin-espacios/page.jsx
// ============================================================
// "Gestión de Eventos" — pantalla principal para administrar las
// reservas de aulas que NO son cursadas (eventos, reuniones, charlas).
//
// NOTA SOBRE EL NOMBRE:
//   La URL sigue siendo /admin-espacios por compatibilidad. El producto
//   evolucionó y ahora se llama "Gestión de Eventos" hacia el usuario.
//
// Tiene DOS vistas (tabs):
//   1. LISTA   → tarjetas filtrables, CRUD clásico
//   2. AGENDA  → calendario visual de todas las aulas, con creación
//
// REGLA DE NEGOCIO:
//   - Cualquier conflicto (cursada O reserva) BLOQUEA la creación.
//   - No hay "forzar". Hay que mover una de las dos antes.
//
// FILTROS EN CASCADA:
//   El filtro de edificio acota las aulas disponibles. Si cambia el
//   edificio, el filtro de aula se resetea automáticamente.
// ============================================================

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BACK_URL, getAuthHeaders } from "@/config/api";

// Imports de FullCalendar (mismos plugins que admin-calendario)
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";

export default function AdminEspaciosPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <AdminEspaciosContenido />
    </ProtectedRoute>
  );
}

function AdminEspaciosContenido() {
  // ════════════════════════════════════════════════════════════
  // ESTADO
  // ════════════════════════════════════════════════════════════

  const [aulas, setAulas] = useState([]);
  const [edificios, setEdificios] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [eventosCalendario, setEventosCalendario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab activa
  const [tabActiva, setTabActiva] = useState("lista");

  // Filtros en cascada
  const [filtroEdificio, setFiltroEdificio] = useState("");
  const [filtroAula, setFiltroAula] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("confirmada");
  const [filtroDesde, setFiltroDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [filtroHasta, setFiltroHasta] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  });

  // Modal de creación / edición
  const [modalAbierto, setModalAbierto] = useState(false);
  const [reservaEditando, setReservaEditando] = useState(null);
  const [form, setForm] = useState(formularioVacio());
  const [conflictosDetectados, setConflictosDetectados] = useState(null);
  const [verificandoConflictos, setVerificandoConflictos] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [reservaCancelando, setReservaCancelando] = useState(null);
  const calendarRef = useRef(null);

  function formularioVacio() {
    return {
      aulaId: "",
      motivo: "",
      fecha: "",
      horaInicio: "",
      horaFin: "",
      descripcion: "",
    };
  }

  // ════════════════════════════════════════════════════════════
  // CASCADA DE FILTROS
  // ════════════════════════════════════════════════════════════
  const aulasDisponibles = useMemo(() => {
    if (!filtroEdificio) return aulas;
    return aulas.filter((a) => a.edificioId === filtroEdificio);
  }, [aulas, filtroEdificio]);

  // Si cambia el edificio y la aula seleccionada ya no está, resetear
  useEffect(() => {
    if (!filtroAula) return;
    const sigueDisponible = aulasDisponibles.some((a) => a.aulaId === filtroAula);
    if (!sigueDisponible) setFiltroAula("");
  }, [filtroEdificio, aulasDisponibles, filtroAula]);

  // ════════════════════════════════════════════════════════════
  // CARGAR DATOS MAESTROS
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    (async () => {
      try {
        const headers = getAuthHeaders();
        const [resAulas, resEdif] = await Promise.all([
          fetch(`${BACK_URL}/api/aulas`, { headers }),
          fetch(`${BACK_URL}/api/edificios`, { headers }),
        ]);
        const dataAulas = await resAulas.json();
        const dataEdif = await resEdif.json();
        setAulas(Array.isArray(dataAulas) ? dataAulas : []);
        setEdificios(Array.isArray(dataEdif) ? dataEdif : []);
      } catch (e) {
        setError("Error al cargar aulas / edificios");
      }
    })();
  }, []);

  // ════════════════════════════════════════════════════════════
  // CARGAR RESERVAS (vista LISTA)
  // ════════════════════════════════════════════════════════════
  const cargarReservas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      if (filtroAula) params.set("aulaId", filtroAula);
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);

      const res = await fetch(`${BACK_URL}/api/reservas?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar reservas");

      let lista = Array.isArray(data) ? data : [];
      // Si hay edificio pero no aula puntual, filtramos en cliente
      if (filtroEdificio && !filtroAula) {
        lista = lista.filter((r) => r.aula?.edificioId === filtroEdificio);
      }
      setReservas(lista);
    } catch (e) {
      setError(e.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }, [filtroAula, filtroEdificio, filtroEstado, filtroDesde, filtroHasta]);

  // ════════════════════════════════════════════════════════════
  // CARGAR AGENDA GLOBAL (vista CALENDARIO)
  // ════════════════════════════════════════════════════════════
  const cargarAgendaGlobal = useCallback(async (desde, hasta) => {
    setLoading(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      params.set("desde", desde.toISOString().slice(0, 10));
      params.set("hasta", hasta.toISOString().slice(0, 10));
      if (filtroEdificio) params.set("edificioId", filtroEdificio);

      const res = await fetch(
        `${BACK_URL}/api/reservas/ocupacion-global?${params}`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar agenda");

      let eventos = data.eventos || [];
      if (filtroAula) {
        eventos = eventos.filter((ev) => ev.extendedProps?.aulaId === filtroAula);
      }
      setEventosCalendario(eventos);
    } catch (e) {
      setError(e.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }, [filtroEdificio, filtroAula]);

  // Recargar lista cuando cambian filtros (vista lista)
  useEffect(() => {
    if (tabActiva === "lista") cargarReservas();
  }, [tabActiva, cargarReservas]);

  // Si estamos en agenda y cambian los filtros, recargar
  useEffect(() => {
    if (tabActiva === "agenda" && calendarRef.current) {
      const view = calendarRef.current.getApi().view;
      cargarAgendaGlobal(view.activeStart, view.activeEnd);
    }
  }, [tabActiva, filtroEdificio, filtroAula, cargarAgendaGlobal]);

  // ════════════════════════════════════════════════════════════
  // MODAL
  // ════════════════════════════════════════════════════════════
  function abrirNueva(precarga = {}) {
    setReservaEditando(null);
    setForm({ ...formularioVacio(), ...precarga });
    setConflictosDetectados(null);
    setFormError("");
    setFormSuccess("");
    setModalAbierto(true);
  }

  function abrirEditar(reserva) {
    setReservaEditando(reserva);
    const fi = new Date(reserva.fechaInicio);
    const ff = new Date(reserva.fechaFin);
    setForm({
      aulaId: reserva.aulaId,
      motivo: reserva.motivo,
      fecha: fi.toISOString().slice(0, 10),
      horaInicio: `${String(fi.getHours()).padStart(2, "0")}:${String(fi.getMinutes()).padStart(2, "0")}`,
      horaFin: `${String(ff.getHours()).padStart(2, "0")}:${String(ff.getMinutes()).padStart(2, "0")}`,
      descripcion: reserva.descripcion || "",
    });
    setConflictosDetectados(null);
    setFormError("");
    setFormSuccess("");
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setReservaEditando(null);
    setConflictosDetectados(null);
  }

  // ════════════════════════════════════════════════════════════
  // VERIFICAR CONFLICTOS (debounced)
  // ════════════════════════════════════════════════════════════
  function construirFechas() {
    if (!form.fecha || !form.horaInicio || !form.horaFin) return null;
    const fechaInicio = new Date(`${form.fecha}T${form.horaInicio}:00`);
    const fechaFin = new Date(`${form.fecha}T${form.horaFin}:00`);
    return { fechaInicio, fechaFin };
  }

  useEffect(() => {
    if (!modalAbierto) return;
    if (!form.aulaId || !form.fecha || !form.horaInicio || !form.horaFin) {
      setConflictosDetectados(null);
      return;
    }
    const fechas = construirFechas();
    if (!fechas) return;
    if (fechas.fechaInicio >= fechas.fechaFin) {
      setConflictosDetectados(null);
      return;
    }

    const timer = setTimeout(async () => {
      setVerificandoConflictos(true);
      try {
        const body = {
          aulaId: form.aulaId,
          fechaInicio: fechas.fechaInicio.toISOString(),
          fechaFin: fechas.fechaFin.toISOString(),
        };
        if (reservaEditando) body.reservaIdExcluir = reservaEditando.reservaId;

        const res = await fetch(
          `${BACK_URL}/api/reservas/verificar-conflictos`,
          {
            method: "POST",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const data = await res.json();
        if (res.ok) setConflictosDetectados(data);
      } catch {
        // silencioso
      } finally {
        setVerificandoConflictos(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [form.aulaId, form.fecha, form.horaInicio, form.horaFin, modalAbierto, reservaEditando]);

  // ════════════════════════════════════════════════════════════
  // GUARDAR
  // ════════════════════════════════════════════════════════════
  async function handleGuardar(e) {
    e?.preventDefault?.();
    setFormError("");
    setFormSuccess("");

    if (!form.aulaId) return setFormError("Elegí un aula");
    if (!form.motivo || form.motivo.trim().length < 3) {
      return setFormError("El motivo debe tener al menos 3 caracteres");
    }

    const fechas = construirFechas();
    if (!fechas) return setFormError("Completá fecha y horas");
    if (fechas.fechaInicio >= fechas.fechaFin) {
      return setFormError("La hora de inicio debe ser anterior a la hora de fin");
    }

    setGuardando(true);
    try {
      const body = {
        aulaId: form.aulaId,
        motivo: form.motivo.trim(),
        fechaInicio: fechas.fechaInicio.toISOString(),
        fechaFin: fechas.fechaFin.toISOString(),
        descripcion: form.descripcion?.trim() || null,
      };

      const url = reservaEditando
        ? `${BACK_URL}/api/reservas/${reservaEditando.reservaId}`
        : `${BACK_URL}/api/reservas`;
      const method = reservaEditando ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Error al guardar");
        return;
      }

      setFormSuccess(reservaEditando ? "Evento actualizado" : "Evento creado");
      await cargarReservas();
      if (tabActiva === "agenda" && calendarRef.current) {
        const view = calendarRef.current.getApi().view;
        cargarAgendaGlobal(view.activeStart, view.activeEnd);
      }
      setTimeout(cerrarModal, 1000);
    } catch (e) {
      setFormError("Error de red");
    } finally {
      setGuardando(false);
    }
  }

  async function handleCancelar() {
    if (!reservaCancelando) return;
    try {
      const res = await fetch(
        `${BACK_URL}/api/reservas/${reservaCancelando.reservaId}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cancelar");
      setReservaCancelando(null);
      await cargarReservas();
      if (tabActiva === "agenda" && calendarRef.current) {
        const view = calendarRef.current.getApi().view;
        cargarAgendaGlobal(view.activeStart, view.activeEnd);
      }
    } catch (e) {
      alert(e.message);
    }
  }

  // ════════════════════════════════════════════════════════════
  // CALENDARIO: handlers
  // ════════════════════════════════════════════════════════════
  function handleDatesSet(info) {
    if (tabActiva === "agenda") {
      cargarAgendaGlobal(info.start, info.end);
    }
  }

  function handleSelect(info) {
    const inicio = info.start;
    const fin = info.end;
    const fecha = inicio.toISOString().slice(0, 10);
    const horaInicio = `${String(inicio.getHours()).padStart(2, "0")}:${String(inicio.getMinutes()).padStart(2, "0")}`;
    const horaFin = `${String(fin.getHours()).padStart(2, "0")}:${String(fin.getMinutes()).padStart(2, "0")}`;

    abrirNueva({
      fecha,
      horaInicio,
      horaFin,
      aulaId: filtroAula || "",
    });

    info.view.calendar.unselect();
  }

  function handleEventClick(info) {
    const tipo = info.event.extendedProps?.tipo;
    if (tipo !== "reserva") {
      const det = info.event.extendedProps?.detalles;
      alert(
        `Cursada (no editable desde acá)\n\n` +
        `Materia: ${det?.materia || "—"}\n` +
        `Comisión: ${det?.comision || "—"}\n` +
        `Docente: ${det?.docente || "—"}`
      );
      return;
    }
    const id = info.event.id.replace("reserva-", "");
    const reserva = reservas.find((r) => r.reservaId === id);
    if (reserva) {
      abrirEditar(reserva);
    } else {
      fetch(`${BACK_URL}/api/reservas/${id}`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((data) => {
          if (data?.reservaId) abrirEditar(data);
        });
    }
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════
  function formatearFechaHora(fecha) {
    return new Date(fecha).toLocaleString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* ── HEADER ──────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Gestión de Eventos</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reservá aulas para eventos, reuniones o charlas. Las cursadas tienen prioridad.
          </p>
        </div>
        <button
          onClick={() => abrirNueva()}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-800"
        >
          + Nuevo evento
        </button>
      </div>

      {/* ── TABS ────────────────────────────────────────── */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTabActiva("lista")}
          className={`px-4 py-2 text-sm font-medium transition ${
            tabActiva === "lista"
              ? "border-b-2 border-green-700 text-green-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 Lista
        </button>
        <button
          onClick={() => setTabActiva("agenda")}
          className={`px-4 py-2 text-sm font-medium transition ${
            tabActiva === "agenda"
              ? "border-b-2 border-green-700 text-green-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📅 Agenda
        </button>
      </div>

      {/* ── FILTROS ─────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Edificio
          </label>
          <select
            value={filtroEdificio}
            onChange={(e) => setFiltroEdificio(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
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
            Aula
          </label>
          <select
            value={filtroAula}
            onChange={(e) => setFiltroAula(e.target.value)}
            disabled={aulasDisponibles.length === 0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none disabled:bg-gray-100"
          >
            <option value="">
              {filtroEdificio ? "Todas del edificio" : "Todas"}
            </option>
            {aulasDisponibles.map((a) => (
              <option key={a.aulaId} value={a.aulaId}>
                {a.sector}-{a.numero}
              </option>
            ))}
          </select>
        </div>
        {tabActiva === "lista" && (
          <>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Estado
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="confirmada">Confirmadas</option>
                <option value="cancelada">Canceladas</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Desde
              </label>
              <input
                type="date"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Hasta
              </label>
              <input
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          VISTA: LISTA
          ════════════════════════════════════════════════════ */}
      {tabActiva === "lista" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="h-8 w-8 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : reservas.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
              No hay eventos con esos filtros.
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500">
                {reservas.length} {reservas.length === 1 ? "evento" : "eventos"}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {reservas.map((r) => (
                  <div
                    key={r.reservaId}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                      r.estado === "cancelada"
                        ? "border-gray-200 opacity-60"
                        : "border-blue-200"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{r.motivo}</h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                          🚪 {r.aula?.sector}-{r.aula?.numero}
                          {r.aula?.edificio?.nombre && ` · ${r.aula.edificio.nombre}`}
                        </p>
                      </div>
                      {r.estado === "cancelada" ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Cancelada
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Confirmada
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>🕐 {formatearFechaHora(r.fechaInicio)}</p>
                      <p>↳ hasta {formatearFechaHora(r.fechaFin)}</p>
                      {r.usuario?.nombre && (
                        <p>👤 Reservado por: {r.usuario.nombre}</p>
                      )}
                      {r.descripcion && (
                        <p className="mt-2 italic text-gray-500">{r.descripcion}</p>
                      )}
                    </div>
                    {r.estado === "confirmada" && (
                      <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                        <button
                          onClick={() => abrirEditar(r)}
                          className="flex-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setReservaCancelando(r)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          VISTA: AGENDA
          ════════════════════════════════════════════════════ */}
      {tabActiva === "agenda" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-green-800" />
              Cursadas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-blue-700" />
              Eventos / Reservas
            </span>
            <span className="ml-auto text-gray-500">
              💡 Arrastrá sobre la grilla horaria para crear un evento.
            </span>
          </div>

          {loading && (
            <div className="mb-3 text-xs text-gray-500">Cargando agenda...</div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              locale={esLocale}
              events={eventosCalendario}
              datesSet={handleDatesSet}
              eventClick={handleEventClick}
              selectable={true}
              select={handleSelect}
              selectMirror={true}
              height="auto"
              slotMinTime="07:00:00"
              slotMaxTime="23:00:00"
              weekends={true}
              nowIndicator={true}
              allDaySlot={false}
            />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL: CREAR / EDITAR
          ════════════════════════════════════════════════════ */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-lg font-bold text-green-900">
                {reservaEditando ? "Editar evento" : "Nuevo evento"}
              </h3>
              <button
                onClick={cerrarModal}
                className="text-2xl text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleGuardar} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Aula *
                </label>
                <select
                  value={form.aulaId}
                  onChange={(e) => setForm({ ...form, aulaId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
                  required
                >
                  <option value="">Elegí un aula</option>
                  {aulas.map((a) => (
                    <option key={a.aulaId} value={a.aulaId}>
                      {a.sector}-{a.numero}
                      {a.edificio?.nombre && ` · ${a.edificio.nombre}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Motivo *
                </label>
                <input
                  type="text"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Ej: Reunión de cátedra, Charla técnica..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Desde *
                  </label>
                  <input
                    type="time"
                    value={form.horaInicio}
                    onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Hasta *
                  </label>
                  <input
                    type="time"
                    value={form.horaFin}
                    onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Descripción (opcional)
                </label>
                <textarea
                  rows={2}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Detalles adicionales..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
                />
              </div>

              {/* Panel de conflictos */}
              {verificandoConflictos && (
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  Verificando conflictos...
                </div>
              )}

              {conflictosDetectados && !verificandoConflictos && (
                <>
                  {conflictosDetectados.conflictosCursadas?.length > 0 && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                      <p className="mb-2 text-sm font-bold text-red-800">
                        🚫 Conflicto con cursada
                      </p>
                      <p className="mb-2 text-xs text-red-700">
                        La cursada tiene prioridad. Cambiá la cursada de aula o elegí otra franja.
                      </p>
                      <ul className="space-y-1 text-xs text-red-700">
                        {conflictosDetectados.conflictosCursadas.map((c, i) => (
                          <li key={i} className="rounded bg-white/60 p-2">
                            📚 <strong>{c.materia}</strong> ({c.comision})
                            <br />
                            🕐 {new Date(c.fechaInicio).toLocaleString("es-AR")} a{" "}
                            {new Date(c.fechaFin).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                            <br />
                            👨‍🏫 {c.docente}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {conflictosDetectados.conflictosReservas?.length > 0 && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                      <p className="mb-2 text-sm font-bold text-red-800">
                        🚫 Conflicto con otro evento
                      </p>
                      <p className="mb-2 text-xs text-red-700">
                        Ya existe otro evento en ese horario. Hay que mover uno de los dos antes de continuar.
                      </p>
                      <ul className="space-y-1 text-xs text-red-700">
                        {conflictosDetectados.conflictosReservas.map((c, i) => (
                          <li key={i} className="rounded bg-white/60 p-2">
                            📅 <strong>{c.motivo}</strong>
                            <br />
                            🕐 {new Date(c.fechaInicio).toLocaleString("es-AR")} a{" "}
                            {new Date(c.fechaFin).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                            <br />
                            👤 {c.usuario}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!conflictosDetectados.hayConflictos && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      ✅ Sin conflictos en ese horario
                    </div>
                  )}
                </>
              )}

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {formSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    guardando ||
                    (conflictosDetectados?.hayConflictos === true)
                  }
                  className="rounded-lg bg-green-700 px-5 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    conflictosDetectados?.hayConflictos
                      ? "Bloqueado: hay conflictos. Cambiá una de las dos primero."
                      : ""
                  }
                >
                  {guardando ? "Guardando..." : reservaEditando ? "Guardar cambios" : "Crear evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL: CANCELAR
          ════════════════════════════════════════════════════ */}
      {reservaCancelando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-red-700">Cancelar evento</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700">
                ¿Estás seguro de cancelar el evento{" "}
                <strong>"{reservaCancelando.motivo}"</strong>?
              </p>
              <p className="mt-2 text-xs text-gray-500">
                El evento queda como histórico (no se borra de la base).
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setReservaCancelando(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                No
              </button>
              <button
                onClick={handleCancelar}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
