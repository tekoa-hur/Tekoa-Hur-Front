"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { BACK_URL, getAuthHeaders } from "@/config/api";

export default function EditarAusenciaPage() {
  return (
    <ProtectedRoute roles={["administrador", "docente"]}>
      <EditarAusenciaContenido />
    </ProtectedRoute>
  );
}

function EditarAusenciaContenido() {
  const router = useRouter();
  const { usuario } = useAuth();
  const isDocente = usuario?.rol === "docente";

  const headers = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    }),
    []
  );

  const [todasLasMaterias, setTodasLasMaterias] = useState([]);
  const [todasLasComisiones, setTodasLasComisiones] = useState([]);
  const [todosLosDiasSinClase, setTodosLosDiasSinClase] = useState([]);
  const [tipoEventos, setTipoEventos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [materiaId, setMateriaId] = useState("");
  const [comisionId, setComisionId] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [sinClase, setSinClase] = useState(true);
  
  const [tipoEventoId, setTipoEventoId] = useState("");

  const [editandoId, setEditandoId] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [idParaBorrar, setIdParaBorrar] = useState(null);
  const [filtroMateriaId, setFiltroMateriaId] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const REGISTROS_POR_PAGINA = 5;

  const searchParams = useSearchParams();

  // 1. Filtrar las comisiones que le pertenecen al docente (o todas si es admin)
  const comisiones = useMemo(() => {
    if (isDocente && usuario) {
      return todasLasComisiones.filter(
        (c) => String(c.docenteId) === String(usuario.id) || String(c.usuarioId) === String(usuario.id)
      );
    }
    return todasLasComisiones;
  }, [todasLasComisiones, isDocente, usuario]);

  // 2. Filtrar las materias base que dicta el profesor (o todas si es admin)
  const materiasDelProfesor = useMemo(() => {
    if (isDocente) {
      const misMateriasIds = new Set(comisiones.map((c) => String(c.materiaId)));
      return todasLasMaterias.filter((m) => misMateriasIds.has(String(m.materiaId)));
    }
    return todasLasMaterias;
  }, [todasLasMaterias, comisiones, isDocente]);

  // 3. Filtrar los días sin clase asociados a las comisiones del profesor
  const diasSinClase = useMemo(() => {
    if (isDocente) {
      const misComisionesIds = new Set(comisiones.map((c) => String(c.comisionId)));
      return todosLosDiasSinClase.filter((d) => misComisionesIds.has(String(d.comisionId)));
    }
    return todosLosDiasSinClase;
  }, [todosLosDiasSinClase, comisiones, isDocente]);

  // Si ya eligió una comisión, acotar la lista de materias del formulario a esa en específico
  const materiasFormulario = useMemo(() => {
    if (comisionId) {
      const comisionSeleccionada = comisiones.find((c) => String(c.comisionId) === String(comisionId));
      if (comisionSeleccionada) {
        return materiasDelProfesor.filter((m) => String(m.materiaId) === String(comisionSeleccionada.materiaId));
      }
    }
    return materiasDelProfesor;
  }, [materiasDelProfesor, comisionId, comisiones]);

  // Filtrar comisiones asociadas a la materia seleccionada
  const comisionesFiltradas = useMemo(() => {
    if (!materiaId) return comisiones;
    return comisiones.filter((comision) => String(comision.materiaId) === String(materiaId));
  }, [comisiones, materiaId]);

  const limpiarFormulario = () => {
    setFecha("");
    setDescripcion("");
    setSinClase(true);
    setTipoEventoId(tipoEventos[0]?.tipoEventoId || "");
    setEditandoId(null);
    
    if (isDocente && comisiones.length > 0) {
      const primeraComision = comisiones[0];
      setComisionId(primeraComision.comisionId || "");
      setMateriaId(primeraComision.materiaId || "");
    } else {
      setMateriaId("");
      setComisionId("");
    }
  };

  // Cargar datos iniciales de la API
  useEffect(() => {
    if (!usuario || !BACK_URL) return;

    const cargarDatosInicialesFormulario = async () => {
      setLoading(true);
      setError("");

      try {
        const respuesta = await fetch(`${BACK_URL}/api/diaSinClase/formData`, { headers });
        if (!respuesta.ok) throw new Error("No se pudieron cargar los datos iniciales.");
        
        const datosFormulario = await respuesta.json();
        setTodasLasMaterias(Array.isArray(datosFormulario.materias) ? datosFormulario.materias : []);
        setTodasLasComisiones(Array.isArray(datosFormulario.comisiones) ? datosFormulario.comisiones : []);
        setTodosLosDiasSinClase(Array.isArray(datosFormulario.diasSinClase) ? datosFormulario.diasSinClase : []);
        setTipoEventos(Array.isArray(datosFormulario.tipoEventos) ? datosFormulario.tipoEventos : []);
        
        if (Array.isArray(datosFormulario.tipoEventos) && datosFormulario.tipoEventos.length > 0) {
          setTipoEventoId(datosFormulario.tipoEventos[0].tipoEventoId);
        }
      } catch (errorCapturado) {
        setError(errorCapturado.message || "Error cargando datos.");
      } finally {
        setLoading(false);
      }
    };

    cargarDatosInicialesFormulario();
  }, [usuario, headers]);

  // Manejar inicialización de estados por Query Params o por Selección por Defecto
  useEffect(() => {
    if (loading || comisiones.length === 0) return;

    const urlMateriaId = searchParams.get("materiaId");
    const urlComisionId = searchParams.get("comisionId");

    if (urlMateriaId || urlComisionId) {
      if (urlMateriaId) {
        setMateriaId(urlMateriaId);
        setFiltroMateriaId(urlMateriaId);
      }
      if (urlComisionId) {
        setComisionId(urlComisionId);
      }
    } else if (isDocente) {
      const primeraComision = comisiones[0];
      setComisionId(primeraComision.comisionId || "");
      setMateriaId(primeraComision.materiaId || "");
      setFiltroMateriaId(primeraComision.materiaId || "");
    }
  }, [searchParams, loading, comisiones, isDocente]);

  const registroExistente = !comisionId || !fecha
    ? null
    : diasSinClase.find((dia) => String(dia.comisionId) === String(comisionId) && dia.fecha === fecha);

  useEffect(() => {
    if (editandoId) return;

    if (registroExistente) {
      setSinClase(true);
      setDescripcion(registroExistente.descripcion || "");
      setTipoEventoId(registroExistente.tipoEventoId || tipoEventos[0]?.tipoEventoId || "");
    } else {
      setSinClase(false);
      setDescripcion("");
      setTipoEventoId(tipoEventos[0]?.tipoEventoId || "");
    }
  }, [registroExistente, editandoId, tipoEventos]);

  // Filtrado y ordenamiento de la tabla inferior
  const diasSinClaseProcesados = useMemo(() => {
    let listaFiltrada = [...diasSinClase];
    
    if (filtroMateriaId) {
      listaFiltrada = listaFiltrada.filter((diaSinClaseItem) => {
        const comisionAsociada = comisiones.find(
          (comision) => String(comision.comisionId) === String(diaSinClaseItem.comisionId)
        );
        return String(comisionAsociada?.materiaId) === String(filtroMateriaId);
      });
    }

    return listaFiltrada.sort((diaA, diaB) => {
      const comisionDiaA = comisiones.find((comision) => String(comision.comisionId) === String(diaA.comisionId));
      const nombreMateriaA = comisionDiaA?.materia?.nombre || "";
      const codigoComisionA = comisionDiaA?.cod_comision || "";

      const comisionDiaB = comisiones.find((comision) => String(comision.comisionId) === String(diaB.comisionId));
      const nombreMateriaB = comisionDiaB?.materia?.nombre || "";
      const codigoComisionB = comisionDiaB?.cod_comision || "";

      const comparacionMateria = nombreMateriaA.localeCompare(nombreMateriaB);
      if (comparacionMateria !== 0) return comparacionMateria;

      return codigoComisionA.localeCompare(codigoComisionB);
    });
  }, [diasSinClase, comisiones, filtroMateriaId]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroMateriaId]);

  const totalPaginas = Math.ceil(diasSinClaseProcesados.length / REGISTROS_POR_PAGINA);
  
  const registrosPaginados = useMemo(() => {
    const indiceInicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
    const indiceFin = indiceInicio + REGISTROS_POR_PAGINA;
    return diasSinClaseProcesados.slice(indiceInicio, indiceFin);
  }, [diasSinClaseProcesados, paginaActual]);

  useEffect(() => {
    if (paginaActual > totalPaginas && totalPaginas > 0) {
      setPaginaActual(totalPaginas);
    }
  }, [totalPaginas, paginaActual]);

  const cargarParaEditar = (item) => {
    setError("");
    setSuccess("");
    setEditandoId(item.diaSinClaseId || null);
    setFecha(item.fecha || "");
    setDescripcion(item.descripcion || "");
    setSinClase(true);
    setTipoEventoId(item.tipoEventoId || tipoEventos[0]?.tipoEventoId || "");
    setComisionId(item.comisionId || "");

    const comisionAsociada = comisiones.find(c => String(c.comisionId) === String(item.comisionId));
    if (comisionAsociada) {
      setMateriaId(comisionAsociada.materiaId || "");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmarBorrado = (id) => {
    setIdParaBorrar(id);
    setModalAbierto(true);
  };

  async function ejecutarBorrado() {
    if (!idParaBorrar) return;

    setModalAbierto(false);
    setGuardando(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${BACK_URL}/api/diaSinClase/${idParaBorrar}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) throw new Error("No se pudo restaurar el día de clases.");

      setTodosLosDiasSinClase(prev => prev.filter(item => item.diaSinClaseId !== idParaBorrar));
      setSuccess("El día volvió a marcarse como día normal de clases.");
      limpiarFormulario();
    } catch (e) {
      setError(e.message || "Error al eliminar.");
    } finally {
      setGuardando(false);
      setIdParaBorrar(null);
    }
  }

  async function guardarCambios() {
    if (!comisionId || !fecha) {
      setError("Seleccioná comisión y fecha.");
      return;
    }

    if (isDocente) {
      const esMia = comisiones.some(c => String(c.comisionId) === String(comisionId));
      if (!esMia) {
        setError("No tenés permisos para modificar esta comisión.");
        return;
      }
    }

    setGuardando(true);
    setError("");
    setSuccess("");

    try {
      if (editandoId) {
        const body = {
          fecha,
          descripcion: descripcion.trim() || "No hubo clases",
          tipoEventoId: tipoEventoId,
          comisionId,
        };

        if (!sinClase) {
          await fetch(`${BACK_URL}/api/diaSinClase/${editandoId}`, { method: "DELETE", headers });
          setTodosLosDiasSinClase(prev => prev.filter(item => item.diaSinClaseId !== editandoId));
          setSuccess("El día se guardó como jornada normal (eliminado de excepciones).");
          limpiarFormulario();
          return;
        }

        const response = await fetch(`${BACK_URL}/api/diaSinClase/${editandoId}`, {
          method: "PUT", 
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("No se pudieron actualizar los datos del día sin clases.");

        const actualizado = await response.json();
        const comisionAsociada = comisiones.find(c => String(c.comisionId) === String(comisionId));
        
        const modificadoFormateado = { 
          ...actualizado, 
          diaSinClaseId: editandoId,
          fecha: actualizado.fecha || fecha, 
          descripcion: actualizado.descripcion !== undefined ? actualizado.descripcion : body.descripcion,
          comisionId: actualizado.comisionId || comisionId, 
          comision: comisionAsociada 
        };

        setTodosLosDiasSinClase(prev => prev.map(item => item.diaSinClaseId === editandoId ? modificadoFormateado : item));
        setSuccess("Día sin clases modificado correctamente.");
        limpiarFormulario();
        return;
      }

      if (sinClase) {
        if (registroExistente) {
          setSuccess("El día ya estaba marcado como sin clases.");
          return;
        }

        const body = {
          fecha,
          descripcion: descripcion.trim() || "No hubo clases",
          tipoEventoId: tipoEventoId,
          comisionId,
        };

        const response = await fetch(`${BACK_URL}/api/diaSinClase`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("No se pudo guardar el día sin clases.");

        const nuevo = await response.json();
        const comisionAsociada = comisiones.find(c => String(c.comisionId) === String(comisionId));
        const nuevoFormateado = { ...nuevo, comision: comisionAsociada };

        setTodosLosDiasSinClase(prev => [...prev, nuevoFormateado]);
        setSuccess("Día marcado correctamente como sin clases.");
        limpiarFormulario();
      } else {
        if (!registroExistente) {
          setSuccess("Ese día ya figura con clases normales.");
          return;
        }
        confirmarBorrado(registroExistente.diaSinClaseId);
      }
    } catch (e) {
      setError(e.message || "Error guardando cambios.");
    } finally {
      setGuardando(false);
    }
  }

  const obtenerDetalleComision = (comisionId) => {
    if (!comisionId) return "Sin Comisión";

    const comision = comisiones.find(c => String(c.comisionId) === String(comisionId));
    if (!comision) return `Comisión ID: ${comisionId}`;

    const nombreMateria = comision.materia?.nombre;
    return nombreMateria 
      ? `${comision.cod_comision} — ${nombreMateria}` 
      : comision.cod_comision;
  };

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {editandoId ? "Modificar día sin clase" : "Editar días sin clase"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">Configurá excepciones de asistencia por comisión.</p>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Volver
          </button>
        </div>

        {/* Formulario */}
        <div className={`rounded-2xl bg-white p-6 shadow-sm ring-1 transition-all ${editandoId ? 'ring-blue-400 bg-blue-50/5' : 'ring-gray-200'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500">Cargando datos...</div>
          ) : (
            <div className="space-y-5">
              
              {editandoId && (
                <div className="rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-700 flex items-center justify-between">
                  <span>Modificando registro seleccionado</span>
                  <button onClick={limpiarFormulario} className="underline hover:text-blue-900">
                    Cancelar edición
                  </button>
                </div>
              )}

              {/* Materia */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Materia</label>
                <select
                  value={materiaId || ""}
                  onChange={(e) => {
                    const selectedMateriaId = e.target.value;
                    
                    if (!selectedMateriaId && isDocente && comisiones.length > 0) {
                      const primeraComision = comisiones[0];
                      setMateriaId(primeraComision.materiaId || "");
                      setComisionId(primeraComision.comisionId || "");
                      return;
                    }

                    setMateriaId(selectedMateriaId);
                    
                    const comisionesDeMateria = comisiones.filter(c => String(c.materiaId) === String(selectedMateriaId));
                    if (comisionesDeMateria.length > 0) {
                      setComisionId(comisionesDeMateria[0].comisionId);
                    } else {
                      setComisionId("");
                    }
                  }}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  {!isDocente && <option value="">Seleccionar materia</option>}
                  {materiasFormulario.map((m) => (
                    <option key={m.materiaId} value={m.materiaId}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Comisión */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Comisión</label>
                <select
                  value={comisionId || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setComisionId(id);
                    const com = comisiones.find(c => String(c.comisionId) === String(id));
                    if (com) setMateriaId(com.materiaId || "");
                  }}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Seleccionar comisión</option>
                  {comisionesFiltradas.map((c) => (
                    <option key={c.comisionId} value={c.comisionId}>
                      {c.cod_comision} {c.materia?.nombre ? ` — ${c.materia.nombre}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Fecha</label>
                <input
                  type="date"
                  value={fecha || ""}
                  onChange={(e) => setFecha(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </div>

              {/* Estado */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">Estado del día</h2>
                    <p className="mt-1 text-xs text-gray-500">Definí si hubo clases o no.</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${sinClase ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {sinClase ? "Sin clases" : "Hubo clases"}
                  </div>
                </div>
                <label className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!sinClase}
                    onChange={(e) => setSinClase(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  Marcar este día como “sin clases”
                </label>
              </div>

              {/* Tipo Evento */}
              {sinClase && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Motivo / Tipo de Evento</label>
                  <select
                    value={tipoEventoId || ""}
                    onChange={(e) => setTipoEventoId(e.target.value)}
                    className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    {tipoEventos.map((t) => (
                      <option key={t.tipoEventoId} value={t.tipoEventoId}>
                        {t.nombre || t.descripcion || "Evento sin nombre"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Descripción */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  value={descripcion || ""}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  placeholder="Ej: Suspensión institucional"
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </div>

              {/* Alerts */}
              {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {editandoId ? "Cancelar" : "Limpiar"}
                </button>
                <button
                  type="button"
                  onClick={guardarCambios}
                  disabled={guardando}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${editandoId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-700 hover:bg-green-800'}`}
                >
                  {guardando ? "Guardando..." : editandoId ? "Actualizar cambios" : "Guardar cambios"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabla con Filtro Dinámico */}
        {!loading && todosLosDiasSinClase.length > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-5">
            
            <div className="flex items-end justify-between gap-4 flex-wrap border-b border-gray-100 pb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-gray-800">Días sin clase registrados</h2>
                <p className="text-xs text-gray-400">Ordenados alfabéticamente por materia y comisión.</p>
              </div>
              
              {/* DROPDOWN DE FILTRO POR MATERIA */}
              <div className="flex flex-col gap-1.5 w-full sm:w-64">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtrar por Materia</label>
                <select
                  value={filtroMateriaId}
                  onChange={(e) => setFiltroMateriaId(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Todas las materias</option>
                  {materiasDelProfesor.map((m) => (
                    <option key={m.materiaId} value={m.materiaId}>{m.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mensaje si el filtro no devuelve resultados */}
            {diasSinClaseProcesados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-medium text-gray-500">No hay días sin clase registrados para esta materia.</p>
                <button 
                  onClick={() => setFiltroMateriaId("")} 
                  className="mt-1.5 text-xs text-green-700 underline font-semibold hover:text-green-800"
                >
                  Mostrar todas
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-700 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Comisión / Materia</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Descripción</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {registrosPaginados.map((item, index) => (
                        <tr 
                          key={item.diaSinClaseId || `dia-${index}`} 
                          className={`hover:bg-gray-50/80 transition-colors ${editandoId === item.diaSinClaseId ? 'bg-blue-50/60 font-medium' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {obtenerDetalleComision(item.comisionId)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.fecha}
                          </td>
                          <td className="px-4 py-3 text-xs italic max-w-xs truncate">
                            {item.descripcion}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                            <button
                              onClick={() => cargarParaEditar(item)}
                              disabled={guardando}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition disabled:opacity-40"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => confirmarBorrado(item.diaSinClaseId)}
                              disabled={guardando}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 transition disabled:opacity-40"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-4 gap-4 flex-wrap">
                    <p className="text-xs text-gray-500">
                      Mostrando página <span className="font-semibold text-gray-700">{paginaActual}</span> de <span className="font-semibold text-gray-700">{totalPaginas}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                        disabled={paginaActual === 1}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      
                      {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPaginaActual(n)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${paginaActual === n ? 'bg-green-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        >
                          {n}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                        disabled={paginaActual === totalPaginas}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* Pop Up de Confirmación */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setModalAbierto(false)} />
          <div className="relative transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-xl ring-1 ring-gray-200 transition-all sm:my-8 sm:w-full sm:max-w-md space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">¿Revertir día sin clases?</h3>
              <p className="mt-2 text-sm text-gray-500">Esta acción volverá a habilitar este día como una jornada normal de clases para la comisión asignada.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalAbierto(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                No, cancelar
              </button>
              <button type="button" onClick={ejecutarBorrado} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                Sí, confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}