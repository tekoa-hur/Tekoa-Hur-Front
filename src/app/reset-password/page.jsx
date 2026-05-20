import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

/**
 * /reset-password
 * --------------------------------------------------------------
 * Página de entrada al flujo de restablecimiento.
 *
 * En Next.js 15 (App Router) `searchParams` en el server side
 * es una Promise, lo que complica leerlo directamente. Optamos
 * por leer los query params en el client component vía el hook
 * `useSearchParams`, que es la forma recomendada cuando la
 * lógica depende 100% del navegador (estado de formulario,
 * fetch, alertas, etc).
 *
 * Envolvemos en <Suspense> porque `useSearchParams` "suspende"
 * el árbol hasta que los params están disponibles. Sin esto,
 * Next.js advierte/falla durante el build estático.
 */
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
          <svg
            className="h-8 w-8 animate-spin text-green-700"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Cargando"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
