"use client";

// ============================================================
// app/espacio/[token]/page.jsx
// ============================================================
// Página PÚBLICA (sin auth) que se abre al escanear el QR de aula.
// Muestra info del aula: capacidad, tipo, equipamiento, ubicación.
// ============================================================

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BACK_URL } from "@/config/api";

export default function EspacioPublicoPage() {
  const params = useParams();
  const token = params?.token;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${BACK_URL}/api/qr/espacio/info/${token}`);
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center">
          <svg className="mx-auto h-10 w-10 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="mt-3 text-sm text-gray-600">Cargando información...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-lg">
          <div className="mb-3 text-4xl">❌</div>
          <h1 className="mb-2 text-xl font-bold text-red-700">QR inválido</h1>
          <p className="text-sm text-gray-600">{error}</p>
          <p className="mt-3 text-xs text-gray-500">
            Este QR puede estar desactivado o no existir.
          </p>
        </div>
      </main>
    );
  }

  const { aula, edificio, atributos } = data;

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 pb-12">
      <div className="mx-auto w-full max-w-lg pt-6">
        {/* Header */}
        <div className="mb-4 rounded-2xl bg-green-800 p-6 text-white shadow-lg">
          <p className="text-xs uppercase tracking-wide text-green-200">
            🏛️ Aula
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {aula.nombreCompleto}
          </h1>
          {edificio && (
            <p className="mt-2 text-sm text-green-100">
              📍 {edificio.nombre}
            </p>
          )}
        </div>

        {/* Atributos */}
        {atributos ? (
          <div className="space-y-3">
            {atributos.capacidad != null && (
              <Card label="Capacidad" value={`${atributos.capacidad} personas`} icon="👥" />
            )}

            {atributos.tipoAula && (
              <Card label="Tipo" value={atributos.tipoAula} icon="🏷️" />
            )}

            {atributos.esLaboratorioInformatico && (
              <Card
                label="Laboratorio Informático"
                value={
                  atributos.cantidadPC != null
                    ? `Sí (${atributos.cantidadPC} PCs)`
                    : "Sí"
                }
                icon="🖥️"
                highlight
              />
            )}

            {atributos.descripcion && (
              <Card label="Descripción" value={atributos.descripcion} icon="📝" />
            )}

            {Array.isArray(atributos.equipamiento) && atributos.equipamiento.length > 0 && (
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  🛠️ Equipamiento
                </p>
                <div className="flex flex-wrap gap-2">
                  {atributos.equipamiento.map((eq, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700"
                    >
                      {eq}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              No hay información adicional cargada para esta aula.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-500">
          Tekoá-Hur · Sistema de gestión académica
        </p>
      </div>
    </main>
  );
}

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
