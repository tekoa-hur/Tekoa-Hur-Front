"use client";

import { REQUISITOS } from "@/utils/passwordPolicy";

/**
 * PasswordRequirements
 * --------------------------------------------------------------
 * Componente visual que muestra la lista de requisitos de la
 * política de contraseñas, marcando con un check verde los que
 * la `password` recibida ya cumple y con un punto gris los que
 * todavía faltan.
 *
 * Se usa en TODAS las pantallas donde el usuario debe ingresar
 * una nueva contraseña:
 *  - /reset-password (recuperación por email)
 *  - /cambio-obligatorio (primer ingreso / reset por admin)
 *  - /perfil (cambio voluntario)
 *
 * Centralizar este componente nos garantiza que:
 *  1. La lista es exactamente la misma en todas las pantallas.
 *  2. Si cambia la política, sólo se toca un archivo.
 *  3. El feedback visual es idéntico, mejorando consistencia.
 *
 * Props:
 *  - password: string  — la contraseña actual escrita por el usuario.
 *
 * Diseño:
 *  - Usa los tonos verdes de la app (Tailwind green-600/700).
 *  - Sigue el estilo de "cuadritos redondeados con icono y
 *    texto a la derecha" del resto de la aplicación.
 */
export default function PasswordRequirements({ password = "" }) {
  return (
    <ul
      // role="list" + aria-live="polite" para que un lector de
      // pantalla anuncie cambios de cumplimiento sin interrumpir
      // al usuario que está escribiendo.
      role="list"
      aria-live="polite"
      className="flex flex-col gap-1.5 rounded-lg bg-gray-50 px-3 py-2.5 text-xs"
    >
      {REQUISITOS.map((req) => {

        // Evaluamos en vivo si la contraseña actual cumple
        // este requisito. Es un boolean simple para decidir
        // el estilo (verde vs gris).
        const cumple = req.test(password);

        return (
          <li
            key={req.id}
            className={`flex items-center gap-2 transition-colors ${
              cumple ? "text-green-700" : "text-gray-500"
            }`}
          >
            {/*
              * Icono. Mostramos un ✓ verde si cumple, o un círculo
              * vacío gris si todavía falta. Usamos un span en lugar
              * de un SVG para mantener el bundle chico, ya que es
              * decorativo (aria-hidden).
              */}
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                cumple
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {cumple ? "✓" : "•"}
            </span>

            <span>{req.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
