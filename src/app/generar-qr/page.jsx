"use client";

// ============================================================
// app/generar-qr/page.jsx
// ============================================================
// Ahora hay DOS generadores distintos según el rol:
//
//   docente        → GeneradorQR (QR de asistencia, atado a comisión)
//   administrador  → redirect a /generar-qr-espacio (QR de espacio)
//
// Mantenemos el path /generar-qr porque ya está en el menú. 
// Para el admin, en el menú agregamos
// un ítem nuevo apuntando a /generar-qr-espacio.
// ============================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import GeneradorQR from "@/components/GeneradorQR";
import { useAuth } from "@/context/AuthContext";

export default function GenerarQRPage() {
  const router = useRouter();
  const { usuario, loading } = useAuth();

  // Si llega un admin acá lo mandamos al flujo correcto.
  useEffect(() => {
    if (loading) return;
    if (usuario?.rol === "administrador") {
      router.replace("/generar-qr-espacio");
    }
  }, [usuario, loading, router]);

  return (
    <ProtectedRoute roles={["docente", "administrador"]}>
      <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:py-10">
        {/* Si es admin, mostramos un placeholder mientras redirige */}
        {usuario?.rol === "administrador" ? (
          <p className="text-sm text-gray-500">Redirigiendo...</p>
        ) : (
          <GeneradorQR />
        )}
      </div>
    </ProtectedRoute>
  );
}
