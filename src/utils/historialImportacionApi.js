import { BACK_URL, getAuthHeaders } from "@/config/api";

/**
 * ============================================================
 * historialImportacionApi.js
 * ============================================================
 *
 * Este archivo centraliza todas las llamadas al backend relacionadas con el historial de importaciones.
 *
 * De esta forma evitamos escribir fetch() en cada componente de React y mantenemos el código más organizado.
 *
 * Actualmente permite:
 *  - Obtener el historial de importaciones.
 *  - Descargar el archivo original de una importación.
 *
 * Si en el futuro se agregan nuevos endpoints (eliminar, filtrar, actualizar, etc.), se incorporarán aquí.
 * ============================================================
 */


/**
 * Obtiene el historial completo de importaciones.
 *
 * Realiza una petición GET al backend y devuelve un arreglo
 * con todas las importaciones registradas.
 *
 * @returns {Promise<Array>}
 */
export async function listarHistorialImportaciones() {

    const respuesta = await fetch(
        `${BACK_URL}/api/historial-importaciones`,
        {
            method: "GET",
            headers: getAuthHeaders()
        }
    );

    const datos = await respuesta.json();
    if (!respuesta.ok) {
        throw new Error(
            datos.message ||
            "No fue posible obtener el historial de importaciones."
        );
    }

    return datos;
}


/**
 * Descarga el archivo correspondiente a una importación.
 *
 * Recibe el identificador del historial y devuelve el archivo Excel como un Blob para que posteriormente
 * pueda descargarse desde el navegador.
 *
 * Este método será utilizado cuando implementemos el botón "Descargar archivo" en la pantalla del historial.
 *
 * @param {string} historialId
 * @returns {Promise<Blob>}
 */
export async function descargarArchivoImportacion(historialId) {

    const respuesta = await fetch(

        `${BACK_URL}/api/historial-importaciones/${historialId}/archivo`,
        {
            method: "GET",
            headers: getAuthHeaders()
        }
    );

    if (!respuesta.ok) {
        throw new Error(
            "No fue posible descargar el archivo."
        );
    }

    return await respuesta.blob();

}