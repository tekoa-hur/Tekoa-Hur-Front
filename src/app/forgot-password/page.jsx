"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

/**
 * /forgot-password
 * --------------------------------------------------------------
 * Pantalla pública donde el usuario solicita el envío de un
 * email con el link para restablecer su contraseña.
 *
 * Mejoras sobre la versión anterior:
 *  - Reemplaza el `alert()` (rompe el flujo y se ve "como del 2005")
 *    por un cartel verde inline, consistente con el resto de la app.
 *  - Después de un envío exitoso, oculta el formulario y muestra
 *    instrucciones para que el usuario revise su correo, en lugar
 *    de dejar un campo vacío que invitaría a un segundo envío.
 *  - Conserva el comportamiento de seguridad del backend, que NO
 *    revela si el email existe o no en la base.
 */
export default function ForgotPasswordPage() {

  const { forgotPassword } = useAuth();

  // Estado del formulario
  const [mail, setMail] = useState("");

  // Estado de la operación: idle | loading | sent | error
  const [estado,  setEstado]  = useState("idle");
  const [mensaje, setMensaje] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    // Reset de mensajes previos en cada intento.
    setMensaje("");
    setEstado("loading");

    const res = await forgotPassword(mail);

    if (!res.ok) {
      // Caso de red caída o 500. Por contrato el backend nunca
      // devuelve 404 para no exponer cuentas.
      setEstado("error");
      setMensaje(res.message ?? "Ocurrió un error. Intentalo de nuevo más tarde.");
      return;
    }

    // Éxito (200). Mostramos el mensaje genérico devuelto por el
    // backend y ocultamos el formulario.
    setEstado("sent");
    setMensaje(res.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-lg">

          {/* Logo + título — consistente con login y reset */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-full bg-green-50 p-1 ring-2 ring-green-200">
              <Image src="/logo.png" alt="Logo Tekoá-Hur" fill className="object-contain" priority />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-gray-800">Recuperar contraseña</h1>
              <p className="mt-1 text-xs text-gray-500">
                Te enviaremos un enlace para restablecerla.
              </p>
            </div>
          </div>

          {estado === "sent" ? (
            // ── Vista "email enviado" ──
            // Reemplaza el alert() anterior por una caja verde
            // con instrucciones claras de qué hacer ahora.
            <>
              <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
                ✓ {mensaje}
              </div>

              <ul className="mt-4 space-y-1.5 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-600">
                <li>• Revisá tu casilla de entrada y la carpeta de spam.</li>
                <li>• El enlace expira en 1 hora por seguridad.</li>
                <li>• Si no recibís nada, contactá al Área Académica.</li>
              </ul>

              <a
                href="/login"
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                Volver al inicio de sesión
              </a>
            </>
          ) : (
            // ── Vista formulario ──
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mail" className="text-sm font-medium text-gray-700">
                  Email registrado
                </label>
                <input
                  type="email"
                  id="mail"
                  name="mail"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  value={mail}
                  onChange={(e) => setMail(e.target.value)}
                  disabled={estado === "loading"}
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                  required
                />
              </div>

              {/* Error (solo si estado === "error") */}
              {estado === "error" && mensaje && (
                <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {mensaje}
                </div>
              )}

              <button
                type="submit"
                disabled={estado === "loading"}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {estado === "loading" ? "Enviando..." : "Enviar enlace"}
              </button>

              <a
                href="/login"
                className="text-center text-xs text-gray-500 hover:underline"
              >
                Volver al inicio de sesión
              </a>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
