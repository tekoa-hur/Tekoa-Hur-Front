"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listarHistorialImportaciones, descargarArchivoImportacion } from "@/utils/historialImportacionApi";

/**
 * Permite consultar todas las importaciones realizadas desde el sistema.
 */
export default function HistorialImportacionesPage() {

    return (
        <ProtectedRoute roles={["administrador"]}>
            <HistorialImportacionesContenido />
        </ProtectedRoute>
    );
}


/**
 * Convierte el tipo de operación a un texto más amigable para el usuario.
 */
function obtenerTipoOperacion(tipoOperacion) {
    switch (tipoOperacion) {
        case "CARGA_INICIAL":
            return "Carga inicial";
        case "ACTUALIZACION":
            return "Actualización";
        default:
            return tipoOperacion;
    }
}

/**
 * Convierte el estado almacenado en la base a un texto más legible.
 */
function obtenerEstado(estado) {
    switch (estado) {
        case "EXITOSA":
            return "Exitosa";
        case "ERROR":
            return "Error";
        default:
            return estado;
    }
}

/**
 * Contenido principal de la pantalla.
 */
function HistorialImportacionesContenido() {
    /** Historial obtenido desde el backend. */
    const [historialImportaciones, setHistorialImportaciones] = useState([]);
    /**
     * Indica si la información todavía se encuentra cargando.
     */
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    /**Importación seleccionada para visualizar su detalle. */
    const [importacionSeleccionada, setImportacionSeleccionada] = useState(null);
    /**Controla la apertura del modal. */
    const [mostrarDetalle, setMostrarDetalle] = useState(false);

    /**
     * Al ingresar a la pantalla se consulta el historial de importaciones.
     */
    useEffect(() => {
        async function cargarHistorial() {
            try {
                const historial =
                    await listarHistorialImportaciones();
                setHistorialImportaciones(historial);
            } catch (error) {
                setError(error.message);
            } finally {
                setCargando(false);
            }
        }

        cargarHistorial();
    }, []);

    /** Descarga el archivo Excel asociado a la importación seleccionada. */
    async function descargarArchivo() {
        try {
            // Solicita el archivo al backend.
            const archivo =
                await descargarArchivoImportacion(
                    importacionSeleccionada.historialId
                );

            // Crear una URL temporal para el archivo.
            const url = window.URL.createObjectURL(archivo);

            // Crear un enlace invisible para iniciar la descarga.
            const enlace = document.createElement("a");
            enlace.href = url;
            enlace.download =
                importacionSeleccionada.nombreArchivo;
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            // Liberar la memoria utilizada por la URL temporal.
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert("No fue posible descargar el archivo.");
        }
    }

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-6">
            {/* Encabezado */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-green-900">
                    Historial de Importaciones
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                    Consultá todas las importaciones realizadas en el sistema.
                </p>
            </div>

            {/* Pantalla de carga */}
            {cargando && (
                <div className="rounded-xl bg-white p-6 text-center shadow">
                    Cargando historial...
                </div>
            )}

            {/* Mensaje de error */}
            {!cargando && error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Tabla */}
            {!cargando && !error && (
                <div className="rounded-xl bg-white p-6 shadow">
                    <h2 className="mb-2 text-lg font-semibold">
                        Importaciones registradas
                    </h2>
                    <p className="mb-5 text-sm text-gray-600">
                        Total de importaciones:
                        <strong>
                            {" "}
                            {historialImportaciones.length}
                        </strong>
                    </p>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                                        Fecha y hora
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">
                                        Usuario
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                                        Archivo
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                                        Operación
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                                        Estado
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">
                                        Errores
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {historialImportaciones.map((importacion) => (
                                    <tr
                                        key={importacion.historialId}
                                        className="hover:bg-gray-50"
                                    >
                                        {/* Fecha */}
                                        <td className="px-4 py-3 text-sm text-gray-700">
                                            {new Date(
                                                importacion.fechaEjecucion)
                                                .toLocaleString("es-AR")}
                                        </td>

                                        {/* Usuario */}
                                        <td className="px-4 py-3 text-center text-sm text-gray-700">
                                            {importacion.usuario?.nombre ?? "-"}
                                        </td>

                                        {/* Archivo */}
                                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                                            {importacion.nombreArchivo}
                                        </td>

                                        {/* Tipo de operación */}
                                        <td className="px-4 py-3 text-sm text-gray-700">
                                            {obtenerTipoOperacion(
                                                importacion.tipoOperacion
                                            )}
                                        </td>

                                        {/* Estado */}
                                        <td className="px-4 py-3">
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${importacion.estado === "EXITOSA"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                                    }`}
                                            >
                                                {obtenerEstado(
                                                    importacion.estado
                                                )}
                                            </span>
                                        </td>

                                        {/* Cantidad de errores */}
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`font-semibold ${importacion.cantidadErrores > 0
                                                    ? "text-red-600"
                                                    : "text-green-600"
                                                    }`}
                                            >
                                                {importacion.cantidadErrores}
                                            </span>
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => {
                                                    setImportacionSeleccionada(importacion);
                                                    setMostrarDetalle(true);
                                                }}
                                                className="rounded-md border border-green-600 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-50"
                                            >
                                                Ver detalle
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ======================================================
    Modal de detalle de la importación
====================================================== */}

            {
                mostrarDetalle &&
                importacionSeleccionada && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    >
                        <div
                            className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"
                        >
                            {/* Encabezado */}
                            <div className="mb-6 flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-green-900">
                                    Detalle de la importación
                                </h2>
                                <button
                                    onClick={() => {
                                        setMostrarDetalle(false);
                                        setImportacionSeleccionada(null);
                                    }}
                                    className="text-2xl text-gray-400 hover:text-red-600"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Información general */}
                            <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <strong>Archivo:</strong>
                                    <br />
                                    {importacionSeleccionada.nombreArchivo}
                                </div>
                                <div>
                                    <strong>Usuario:</strong>
                                    <br />
                                    {importacionSeleccionada.usuario?.nombre}
                                </div>
                                <div>
                                    <strong>Operación:</strong>
                                    <br />
                                    {obtenerTipoOperacion(
                                        importacionSeleccionada.tipoOperacion
                                    )}
                                </div>
                                <div>
                                    <strong>Estado:</strong>
                                    <br />
                                    {obtenerEstado(
                                        importacionSeleccionada.estado
                                    )}
                                </div>
                            </div>

                            {/* Resultados */}
                            <h3 className="mb-3 text-lg font-semibold text-green-800">
                                Resultado de la importación
                            </h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <p>Edificios:</p>
                                <p>{importacionSeleccionada.detalle.edificios}</p>
                                <p>Aulas:</p>
                                <p>{importacionSeleccionada.detalle.aulas}</p>
                                <p>Profesores:</p>
                                <p>{importacionSeleccionada.detalle.profesores}</p>
                                <p>Materias:</p>
                                <p>{importacionSeleccionada.detalle.materias}</p>
                                <p>Comisiones:</p>
                                <p>{importacionSeleccionada.detalle.comisiones}</p>
                                <p>Horarios:</p>
                                <p>{importacionSeleccionada.detalle.horarios}</p>
                                <p>Estudiantes:</p>
                                <p>{importacionSeleccionada.detalle.estudiantes}</p>
                                <p>Matrículas:</p>
                                <p>{importacionSeleccionada.detalle.matriculas}</p>
                                <p>Usuarios creados:</p>
                                <p>{importacionSeleccionada.detalle.usuariosCreados}</p>
                            </div>

                            {/* Errores */}
                            <h3 className="mt-6 mb-3 text-lg font-semibold text-red-700">
                                Errores
                            </h3>
                            {
                                importacionSeleccionada.detalle.errores.length === 0 ? (
                                    <p className="text-sm text-green-700">
                                        No se registraron errores durante la importación.
                                    </p>
                                ) : (
                                    <ul className="list-disc pl-5 text-sm text-red-700">
                                        {
                                            importacionSeleccionada.detalle.errores.map(
                                                (error, indice) => (
                                                    <li key={indice}>
                                                        {error}
                                                    </li>
                                                )
                                            )
                                        }
                                    </ul>
                                )
                            }

                            {/* Pie */}
                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={descargarArchivo}
                                    className="rounded-lg border border-green-700 px-4 py-2 text-green-700 transition hover:bg-green-50"
                                >
                                    Descargar archivo
                                </button>

                                <button
                                    onClick={() => {
                                        setMostrarDetalle(false);
                                        setImportacionSeleccionada(null);
                                    }}

                                    className="rounded-lg bg-green-700 px-4 py-2 text-white transition hover:bg-green-800"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </main>
    );
}