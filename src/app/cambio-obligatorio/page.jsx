"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import PasswordRequirements from "@/components/PasswordRequirements";
import { passwordCumplePolitica } from "@/utils/passwordPolicy";

const BACK_URL = process.env.NEXT_PUBLIC_BACK_URL;

/**
 * /cambio-obligatorio
 * --------------------------------------------------------------
 * Pantalla a la que se redirige al usuario cuando el backend
 * indica que tiene cambioPasswordObligatorio = true.
 *
 * Casos típicos:
 *  - Es la primera vez que ingresa al sistema (su clave es el DNI).
 *  - El administrador acaba de resetearle la clave al DNI.
 *  - Un usuario nuevo fue creado manualmente desde admin-usuarios.
 *
 * Diferencias importantes vs /reset-password:
 *  - Acá el usuario YA está autenticado (tiene JWT), por eso usa
 *    PUT /api/auth/cambiar-password en lugar del flujo por token.
 *  - El form pide la "contraseña actual" porque el backend la
 *    valida con bcrypt.compare antes de aceptar el cambio. Eso
 *    refuerza la seguridad: aunque alguien tomara una sesión
 *    abierta, no podría rotar la clave sin saber la actual.
 *  - NO usa <ProtectedRoute> con el chequeo de
 *    cambioPasswordObligatorio (provocaría un loop): implementa
 *    su propio guard que solo exige sesión, no flag.
 *
 * Al éxito:
 *  - Llama a marcarPasswordCambiada() del contexto, que baja el
 *    flag en estado y localStorage, así no vuelve a redirigir acá.
 *  - Muestra un cartel verde de éxito y redirige al "/" después
 *    de unos segundos.
 */
export default function CambioObligatorioPage() {

  const router = useRouter();
  const { usuario, loading, marcarPasswordCambiada, logout } = useAuth();

  // ── Guard propio (no usamos ProtectedRoute para evitar loop) ──
  //
  // Reglas:
  //  - Si NO hay sesión, se va al /login.
  //  - Si hay sesión pero el flag ya está en false, no tiene
  //    sentido estar acá: lo mandamos al "/".
  //  - Si hay sesión y flag en true, queda en esta pantalla.
  useEffect(() => {
    if (loading) return;
    if (!usuario) {
      router.replace("/login");
      return;
    }
    if (!usuario.cambioPasswordObligatorio) {
      router.replace("/");
    }
  }, [loading, usuario, router]);

  // ── Estado del formulario ──
  const [form, setForm] = useState({
    passwordActual: "",
    passwordNueva:  "",
    passwordRepeat: "",
  });
  const [showActual, setShowActual] = useState(false);
  const [showNueva,  setShowNueva]  = useState(false);

  // ── Estado de la operación ──
  // idle | loading | error | success
  const [estado,  setEstado]  = useState("idle");
  const [mensaje, setMensaje] = useState("");
  const [errores, setErrores] = useState([]); // array detallado de política

  function handleChange(e) {
    setEstado("idle");
    setMensaje("");
    setErrores([]);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // Booleans para feedback visual en vivo:
  const cumplePolitica = passwordCumplePolitica(form.passwordNueva);
  const passwordsCoinciden =
    form.passwordNueva.length > 0 && form.passwordNueva === form.passwordRepeat;

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");
    setErrores([]);

    // Validaciones de cliente.
    if (!form.passwordActual) {
      setEstado("error");
      setMensaje("Ingresá tu contraseña actual.");
      return;
    }
    if (!cumplePolitica) {
      setEstado("error");
      setMensaje("La nueva contraseña no cumple con los requisitos de seguridad.");
      return;
    }
    if (form.passwordNueva !== form.passwordRepeat) {
      setEstado("error");
      setMensaje("Las contraseñas nuevas no coinciden.");
      return;
    }

    setEstado("loading");

    try {
      const token = localStorage.getItem("tekoa_token");
      const res   = await fetch(`${BACK_URL}/api/auth/cambiar-password`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          passwordActual: form.passwordActual,
          passwordNueva:  form.passwordNueva,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setEstado("error");
        setMensaje(data.message ?? "No se pudo actualizar la contraseña.");
        setErrores(Array.isArray(data.errors) ? data.errors : []);
        return;
      }

      // Éxito: bajamos el flag en el contexto + localStorage,
      // mostramos cartel y redirigimos al home tras 2.5s.
      marcarPasswordCambiada();
      setEstado("success");
      setMensaje(data.message ?? "Contraseña actualizada correctamente.");
      setTimeout(() => router.push("/"), 2500);
    } catch {
      setEstado("error");
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  // ── Loading inicial del contexto ──
  if (loading || !usuario || !usuario.cambioPasswordObligatorio) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-green-700" viewBox="0 0 24 24" fill="none" aria-label="Cargando">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">

        {/* Encabezado */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
            🔐
          </div>
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
            Cambio de contraseña obligatorio
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Hola <span className="font-medium text-gray-700">{usuario.nombre.split(" ")[0]}</span>,
            por tu seguridad necesitamos que definas una contraseña personal antes de continuar.
          </p>
        </div>

        {/* Bloque info */}
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          💡 Tu contraseña actual es la inicial (tu DNI o la que asignó el administrador).
          Tenés que cambiarla por una propia que cumpla los requisitos de seguridad.
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">

          {/* Cartel de éxito (oculta el form) */}
          {estado === "success" ? (
            <>
              <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
                ✓ {mensaje}
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">
                Te redirigimos al inicio en unos segundos...
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

              {/* ── Contraseña actual ── */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="passwordActual" className="text-sm font-medium text-gray-700">
                  Contraseña actual
                </label>
                <div className="relative">
                  <input
                    id="passwordActual"
                    name="passwordActual"
                    type={showActual ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Tu DNI o la que te dio el administrador"
                    value={form.passwordActual}
                    onChange={handleChange}
                    disabled={estado === "loading"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowActual((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-gray-500 hover:bg-gray-100"
                    aria-label={showActual ? "Ocultar" : "Mostrar"}
                    tabIndex={-1}
                  >
                    {showActual ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* ── Nueva contraseña ── */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="passwordNueva" className="text-sm font-medium text-gray-700">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="passwordNueva"
                    name="passwordNueva"
                    type={showNueva ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Definí tu nueva contraseña"
                    value={form.passwordNueva}
                    onChange={handleChange}
                    disabled={estado === "loading"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                    aria-describedby="reqs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNueva((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-gray-500 hover:bg-gray-100"
                    aria-label={showNueva ? "Ocultar" : "Mostrar"}
                    tabIndex={-1}
                  >
                    {showNueva ? "🙈" : "👁️"}
                  </button>
                </div>

                <div id="reqs">
                  <PasswordRequirements password={form.passwordNueva} />
                </div>
              </div>

              {/* ── Repetir ── */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="passwordRepeat" className="text-sm font-medium text-gray-700">
                  Repetir nueva contraseña
                </label>
                <input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type={showNueva ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repetí la nueva contraseña"
                  value={form.passwordRepeat}
                  onChange={handleChange}
                  disabled={estado === "loading"}
                  className={`rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ${
                    form.passwordRepeat.length === 0
                      ? "border-gray-300 focus:border-green-600 focus:ring-green-200"
                      : passwordsCoinciden
                        ? "border-green-400 focus:border-green-600 focus:ring-green-200"
                        : "border-red-300 focus:border-red-500 focus:ring-red-200"
                  }`}
                  required
                />
                {form.passwordRepeat.length > 0 && !passwordsCoinciden && (
                  <p className="text-xs text-red-600">Las contraseñas no coinciden.</p>
                )}
              </div>

              {/* ── Errores ── */}
              {estado === "error" && mensaje && (
                <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <p className="font-medium">{mensaje}</p>
                  {errores.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={estado === "loading" || !cumplePolitica || !passwordsCoinciden}
                  className="rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {estado === "loading" ? "Guardando..." : "Guardar nueva contraseña"}
                </button>

                <button
                  type="button"
                  onClick={() => { logout(); router.push("/login"); }}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancelar y cerrar sesión
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
