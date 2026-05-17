"use client";

import { useMemo } from "react";

/**
 * AsistenciaGrid — Sin MUI, 100% Tailwind.
 * Muestra la grilla de asistencia con P/A por fecha.
 * En mobile: scroll horizontal sobre la tabla.
 * Misma interfaz de props que antes — sin cambios en la lógica.
 */
export default function AsistenciaGrid({
  fechas        = [],
  alumnos       = [],
  asistencias   = [],
  feriados      = [],
  titulo        = "Grilla de asistencias",
  headerNombre  = "Nombre y apellido",
  mostrarDni    = true,
  mostrarVolver = true,
}) {
  const asistenciaSet = useMemo(() => {
    return new Set(asistencias.map(a => `${a.alumnoId}-${a.fecha}`));
  }, [asistencias]);

  //Crear mapa de eventos
  const feriadosMap = useMemo(() => {
  const map = new Map();

      feriados.forEach(f => { map.set(f.fecha, f); });
    return map;
  }, [feriados]);

  const fechasOrdenadas = useMemo(() => {
    return [...fechas].sort((a, b) => new Date(a) - new Date(b));
  }, [fechas]);

  const filas = useMemo(() => {
    return alumnos
      .slice()
      .sort((a, b) => a.apellido.localeCompare(b.apellido))
      .map(alumno => ({
        id:      alumno.id,
        nombre:  alumno.apellido,
        dni:     alumno.dni ?? alumno.id,
        fechas:  fechasOrdenadas.map(f => ({
          fecha:    f,
          presente: asistenciaSet.has(`${alumno.id}-${f}`),
        })),
      }));
  }, [alumnos, fechasOrdenadas, asistenciaSet]);

  if (alumnos.length === 0 && fechas.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
        No hay datos de asistencia para mostrar.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">

      {/* Título */}
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-800">{titulo}</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {alumnos.length} {alumnos.length === 1 ? "persona" : "personas"} · {fechasOrdenadas.length} clases
        </p>
      </div>

      {/* Tabla con scroll horizontal en mobile */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: Math.max(400, 200 + fechasOrdenadas.length * 70) }}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 min-w-[160px]">
                {headerNombre}
              </th>
              {mostrarDni && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 min-w-[100px]">
                  DNI
                </th>
              )}
              {fechasOrdenadas.map(f => (
                <th key={f} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 min-w-[56px]">
                  {formatearFecha(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={2 + fechasOrdenadas.length} className="px-5 py-8 text-center text-sm text-gray-400">
                  No hay registros.
                </td>
              </tr>
            ) : filas.map(fila => (
              <tr key={fila.id} className="transition hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                  {fila.nombre}
                </td>
                {mostrarDni && (
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{fila.dni}</td>
                )}
{/* Mapeo las fechas para mostrar P/A o Feriados, con estilos según el caso */}
      {fila.fechas.map(({ fecha, presente }) => {

        const evento = feriadosMap.get(fecha);

        let texto = presente ? "P" : "A";

        let estilos = presente
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-600";

        if (evento) {
          switch (evento.tipo) {

            case "Cancelación de clase":
              texto = "F";
              estilos = "bg-yellow-100 text-yellow-700";
            break;

            case "Día no laborable":
              texto = "NL";
              estilos = "bg-blue-100 text-blue-700";
            break;

            case "Paro docente":
              texto = "PD";
              estilos = "bg-orange-100 text-orange-700";
            break;

            default:
              texto = "E";
              estilos = "bg-gray-100 text-gray-700";
        }
      }

      return (
        <td key={fecha} className="px-2 py-3 text-center">
          <span
            title={evento?.descripcion ?? ""}
            className={`inline-flex min-w-[28px] h-7 px-1 items-center justify-center rounded-full text-[10px] font-bold ${estilos}`}
        >
          {texto}
        </span>
      </td>
    );
  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="border-t border-gray-100 px-5 py-3 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">P</span>
          Presente
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">A</span>
          Ausente
        </span>
        <span className="flex items-center gap-1">
        <span className="inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-yellow-100 text-xs font-bold text-yellow-700">F</span>
          Cancelacion de clase
        </span>
        <span className="flex items-center gap-1">
        <span className="inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">NL</span>
          No laborable
        </span>
        <span className="flex items-center gap-1">
        <span className="inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">PD</span>
          Paro docente
        </span>
      </div>
    </div>
  );
}

function formatearFecha(fecha) {
  const [, mes, dia] = fecha.split("-");
  return `${dia}/${mes}`;
}
