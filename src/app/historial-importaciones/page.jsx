"use client";

import { useEffect, useState } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";

import { listarHistorialImportaciones} from "@/utils/historialImportacionApi";


/**
 * Página principal del historial de importaciones.
 *
 * Solo los administradores pueden acceder a esta pantalla.
 */
export default function HistorialImportacionesPage() {

    return (
        <ProtectedRoute roles={["administrador"]}>
            <HistorialImportacionesContenido />
        </ProtectedRoute>
    );
}


/**
 * Contenido de la pantalla.
 */
function HistorialImportacionesContenido() {

    /** Historial obtenido desde el backend. */
    const [historialImportaciones, setHistorialImportaciones] = useState([]);

    /** Indica si la información se está cargando. */
    const [cargando, setCargando] = useState(true);

    /**Mensaje de error. */
    const [error, setError] = useState("");


    /** Al abrir la página obtenemos el historial. */
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


    return (

        <main className="mx-auto w-full max-w-7xl px-4 py-6">
            {/* Encabezado */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-green-900">
                    Historial de Importaciones
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                    Consultá todas las importaciones realizadas
                    en el sistema.
                </p>
            </div>

            {/* Loading */}

            {cargando && (
                <div className="rounded-xl bg-white p-6 text-center shadow">
                    Cargando historial...
                </div>
            )}

            {/* Error */}
            {!cargando && error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
                    {error}
                </div>
            )}


            {/* Resultado */}

            {!cargando && !error && (
                <div className="rounded-xl bg-white p-6 shadow">
                    <h2 className="mb-4 text-lg font-semibold">
                        Historial obtenido correctamente
                    </h2>
                    <p>
                        Cantidad de importaciones:
                        <strong>
                            {" "}
                            {historialImportaciones.length}
                        </strong>
                    </p>
                </div>

            )}

        </main>

    );

}