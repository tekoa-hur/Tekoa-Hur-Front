"use client";

// ============================================================
// app/registrar-asistencia/page.jsx
// ============================================================
// Wrapper de la página de registro. Lee los parámetros de la URL y
// se los pasa al componente RegistroAsistencia.
//
// Acepta DOS formatos:
//
//   Nuevo (recomendado):
//     /registrar-asistencia?qrToken
//
//   Legacy (compatibilidad con QRs viejos pegados antes del refactor):
//     /registrar-asistencia?edificioId=...&aulaId=...&rtoken=...&fechaInicio=...&fechaFin=...
//
// El componente RegistroAsistencia detecta cuál de los dos recibió y
// actúa en consecuencia. Esto nos permite que los QR generados antes
// del cambio sigan funcionando hasta que se rote el parque de QR.
// ============================================================

import { Suspense } from "react";
import RegistroAsistencia from "@/components/RegistroAsistencia";
import { useSearchParams } from "next/navigation";

function PageContent() {
  const searchParams = useSearchParams();

  // ── Nuevo formato ──
  const qrToken = searchParams.get("qrToken");

  // ── Legacy (se mantienen por compatibilidad) ──
  const edificioId = searchParams.get("edificioId");
  const aulaId = searchParams.get("aulaId");
  const rtoken = searchParams.get("rtoken");
  const fechaInicio = searchParams.get("fechaInicio");
  const fechaFin = searchParams.get("fechaFin");

  return (
    <RegistroAsistencia
      qrToken={qrToken}
      edificioId={edificioId}
      aulaId={aulaId}
      rtoken={rtoken}
      fechaInicio={fechaInicio}
      fechaFin={fechaFin}
    />
  );
}

export default function RegistroAsistenciaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10">
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
}
