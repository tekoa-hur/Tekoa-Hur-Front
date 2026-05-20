"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext"; // ✅ usa el contexto real

export default function LoginPage() {
  const router    = useRouter();
  const { login } = useAuth();

  const [form,    setForm]    = useState({ dni: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setError("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.dni.trim())      { setError("Ingresá tu DNI.");        return; }
    if (!form.password.trim()) { setError("Ingresá tu contraseña."); return; }

    setLoading(true);
    try {
      // ✅ Llama al backend real: POST /api/auth/login
      const result = await login(form.dni, form.password);

      if (!result.ok) {
        setError(result.error ?? "DNI o contraseña incorrectos.");
        return;
      }

      // ── FLUJO DE CAMBIO OBLIGATORIO ──
      //
      // El backend devuelve `cambioPasswordObligatorio: true` cuando:
      //  - El usuario fue creado por seed/Excel (clave inicial = DNI).
      //  - El administrador acaba de resetearle la clave al DNI.
      //  - Es un usuario nuevo creado manualmente desde admin-usuarios.
      //
      // En esos casos, antes de habilitar el menú principal, lo
      // mandamos a /cambio-obligatorio donde DEBE definir una clave
      // que cumpla la política de seguridad. Mientras no la cambie,
      // ProtectedRoute lo rebota a esa pantalla.
      if (result.usuario?.cambioPasswordObligatorio) {
        router.push("/cambio-obligatorio");
        return;
      }

      // Redirigir al inicio (el menú se filtra por rol automáticamente)
      router.push("/");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="rounded-2xl bg-white p-8 shadow-lg">

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-full bg-green-50 p-1 ring-2 ring-green-200">
            <Image src="/logo.png" alt="Logo Tekoá-Hur" fill className="object-contain" priority />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-800">Tekoá-Hur</h1>
            <p className="text-sm text-gray-500">Control de Asistencias</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

          {/* DNI — autoFocus */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dni" className="text-sm font-medium text-gray-700">DNI</label>
            <input
              id="dni" name="dni" type="text" inputMode="numeric"
              autoComplete="username" autoFocus
              placeholder="Ej: 35123456"
              value={form.dni} onChange={handleChange} disabled={loading}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          {/* Contraseña */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">Contraseña</label>
            <input
              id="password" name="password" type="password"
              autoComplete="current-password" placeholder="Tu contraseña"
              value={form.password} onChange={handleChange} disabled={loading}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
            />
          </div>

          {/* Error */}
          {error && (
            <p id="login-error" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Botón */}
          <button
            type="submit" disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Ingresando...
              </>
            ) : "Ingresar"}
          </button>

        </form>

        <p className="mt-5 text-center text-xs text-gray-400">
          ¿Olvidaste tu contraseña? <a href="/forgot-password" className="text-green-600 hover:underline">Recupérala aquí</a>.
        </p>

        <p className="mt-5 text-center text-xs text-gray-400">
          ¿Problemas para ingresar? Contactá al Área Académica.
        </p>
      </div>

    </div>
  );
}
