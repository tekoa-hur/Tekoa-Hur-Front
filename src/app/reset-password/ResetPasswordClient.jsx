"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import PasswordRequirements from "@/components/PasswordRequirements";
import { passwordCumplePolitica } from "@/utils/passwordPolicy";

/**
 * ResetPasswordClient
 * --------------------------------------------------------------
 * Pantalla de restablecimiento de contraseña. Implementa
 * el flujo completo pedido por el enunciado:
 *
 *  1. Toma el `token` y `email` del query string (?token=...&email=...).
 *  2. Valida el token contra el backend antes de mostrar el form
 *     (POST /api/auth/validate-reset-token), así si el link está
 *     vencido o roto se ve un mensaje claro sin que el usuario
 *     escriba nada.
 *  3. Si el token es válido, muestra el formulario con:
 *     - Campo "nueva contraseña" + lista de requisitos en vivo.
 *     - Campo "confirmar contraseña".
 *     - Botón "Mostrar/ocultar" para ambos campos.
 *  4. Valida en cliente que la nueva clave cumple la política
 *     (≥8 chars, mayúscula, especial) y que ambas coinciden.
 *  5. Envía POST /api/auth/reset-password. Si el backend devuelve
 *     `errors[]`, los renderiza como lista (defensa en profundidad).
 *  6. Al éxito muestra un cartel verde de confirmación y
 *     redirige al /login después de 2.5 segundos.
 *
 * Diseño: replica el estilo del resto de la app (panel blanco
 * redondeado sobre fondo gris, logo arriba, botón verde 700).
 */
export default function ResetPasswordClient() {

  // ── Query params ──
  // Leemos token y email del URL. Pueden venir vacíos si el
  // usuario llegó manualmente sin un link válido.
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const router                          = useRouter();
  const { validateResetToken,
          resetPassword }               = useAuth();

  // ── Estado del FORMULARIO ──
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);

  // ── Estado de los ERRORES y MENSAJES ──
  const [error,        setError]        = useState("");       // error single line
  const [errores,      setErrores]      = useState([]);       // array de errores (política backend)
  const [message,      setMessage]      = useState("");       // éxito
  const [submitting,   setSubmitting]   = useState(false);

  // ── Estado de la VALIDACIÓN DEL TOKEN ──
  // tokenStatus puede ser: "checking" | "valid" | "invalid"
  const [tokenStatus,  setTokenStatus]  = useState("checking");
  const [tokenError,   setTokenError]   = useState("");
  const [nombreUser,   setNombreUser]   = useState("");

  // ── Effect: validar token al cargar la pantalla ──
  //
  // Se ejecuta una sola vez al montar (deps con token/email).
  // Si falta alguno, marca el token como inválido sin pegarle
  // al backend. Si ambos están, llama al endpoint dedicado.
  useEffect(() => {
    let cancelado = false; // flag por si el componente se desmonta

    async function chequear() {
      if (!token || !email) {
        if (!cancelado) {
          setTokenStatus("invalid");
          setTokenError("El enlace es inválido. Solicitá un nuevo correo de recuperación.");
        }
        return;
      }

      const res = await validateResetToken(email, token);

      if (cancelado) return;

      if (res.valid) {
        setTokenStatus("valid");
        setNombreUser(res.nombre ?? "");
      } else {
        setTokenStatus("invalid");
        setTokenError(res.message ?? "El enlace es inválido o expiró.");
      }
    }

    chequear();

    // Cleanup: si el usuario navega antes de que vuelva la
    // respuesta del backend, evitamos setear estado en un
    // componente desmontado.
    return () => { cancelado = true; };
  }, [token, email, validateResetToken]);

  /**
   * cumplePolitica — boolean memoizado a mano (sin useMemo
   * porque es un cálculo trivial). Lo usamos para deshabilitar
   * el botón y dar feedback visual al usuario.
   */
  const cumplePolitica = passwordCumplePolitica(password);
  const passwordsCoinciden =
    password.length > 0 && password === confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();

    // Limpiamos errores anteriores en cada intento.
    setError("");
    setErrores([]);
    setMessage("");

    // ── Validaciones de cliente ──
    if (!password || !confirmPassword) {
      setError("Completá ambos campos.");
      return;
    }

    if (!cumplePolitica) {
      setError("La contraseña no cumple con los requisitos de seguridad.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    // ── Submit al backend ──
    setSubmitting(true);

    const res = await resetPassword(email, token, password);

    if (!res.ok) {
      // Si el backend mandó `errors[]` (validador de política),
      // los mostramos como lista. Si no, mostramos solo el message.
      setError(res.message ?? "No se pudo actualizar la contraseña.");
      setErrores(Array.isArray(res.errors) ? res.errors : []);
      setSubmitting(false);
      return;
    }

    // Éxito: mostramos cartel y redirigimos al login.
    setMessage(res.message ?? "Contraseña actualizada correctamente.");
    setTimeout(() => router.push("/login"), 2500);
  }

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────

  // CASO 1: estamos chequeando el token → spinner
  if (tokenStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="flex flex-col items-center gap-3 py-6">
              <svg className="h-8 w-8 animate-spin text-green-700" viewBox="0 0 24 24" fill="none" aria-label="Verificando enlace">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-gray-500">Verificando el enlace...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CASO 2: token inválido → cartel rojo + link para volver a /forgot-password
  if (tokenStatus === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-white p-8 shadow-lg">

            <div className="mb-5 flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
                ⚠️
              </div>
              <h1 className="text-center text-lg font-bold text-gray-800">
                Enlace inválido
              </h1>
            </div>

            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {tokenError}
            </div>

            <a
              href="/forgot-password"
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              Solicitar un nuevo enlace
            </a>

            <a
              href="/login"
              className="mt-3 block text-center text-xs text-gray-500 hover:underline"
            >
              Volver al inicio de sesión
            </a>

          </div>
        </div>
      </div>
    );
  }

  // CASO 3: token válido → formulario completo
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-lg">

          {/* Logo + título — mismo estilo que la pantalla de login */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-full bg-green-50 p-1 ring-2 ring-green-200">
              <Image src="/logo.png" alt="Logo Tekoá-Hur" fill className="object-contain" priority />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-gray-800">Restablecer contraseña</h1>
              {nombreUser && (
                <p className="mt-1 text-sm text-gray-500">
                  Hola, <span className="font-medium text-gray-700">{nombreUser}</span>
                </p>
              )}
            </div>
          </div>

          {/* Si ya hubo éxito, mostramos solo el cartel verde y ocultamos el form */}
          {message ? (
            <>
              <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
                ✓ {message}
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">
                Te redirigimos al inicio de sesión en unos segundos...
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

              {/* ── Nueva contraseña ── */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Nueva contraseña
                </label>

                {/* Wrapper relativo para posicionar el botón ojo */}
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                    aria-describedby="password-requirements"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-gray-500 hover:bg-gray-100"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    tabIndex={-1}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>

                {/* Requisitos en vivo */}
                <div id="password-requirements">
                  <PasswordRequirements password={password} />
                </div>
              </div>

              {/* ── Confirmar ── */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  className={`rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ${
                    confirmPassword.length === 0
                      ? "border-gray-300 focus:border-green-600 focus:ring-green-200"
                      : passwordsCoinciden
                        ? "border-green-400 focus:border-green-600 focus:ring-green-200"
                        : "border-red-300 focus:border-red-500 focus:ring-red-200"
                  }`}
                  required
                />
                {confirmPassword.length > 0 && !passwordsCoinciden && (
                  <p className="text-xs text-red-600">Las contraseñas no coinciden.</p>
                )}
              </div>

              {/* ── Errores ── */}
              {error && (
                <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <p className="font-medium">{error}</p>
                  {errores.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* ── Botón submit ── */}
              <button
                type="submit"
                // Lo deshabilitamos si está en curso, o si todavía
                // no cumple política, o si las pass no coinciden.
                // Esto le da al usuario un feedback "fuerte" de
                // que aún falta algo, además del feedback "blando"
                // de los requisitos.
                disabled={submitting || !cumplePolitica || !passwordsCoinciden}
                className="mt-1 flex w-full items-center justify-center rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Actualizando..." : "Guardar nueva contraseña"}
              </button>

              <a
                href="/login"
                className="text-center text-xs text-gray-500 hover:underline"
              >
                Cancelar y volver al inicio de sesión
              </a>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
