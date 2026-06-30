"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import LectorQR from "@/components/LectorQR";

export default function LeerQRPage() {


  return (
    <ProtectedRoute>
      <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:py-10">
        <div className="w-full max-w-lg">
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#111827]! leading-tight">
              Leer código QR
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]!">
              Activá la cámara para escanear un código QR o cargá una imagen.
            </p>
          </div>

          <div className="rounded-2xl bg-[#ffffff]! p-6 shadow-sm ring-1 ring-gray-200">
            <LectorQR />
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}