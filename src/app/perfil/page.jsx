"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PasswordRequirements from "@/components/PasswordRequirements";
import { passwordCumplePolitica } from "@/utils/passwordPolicy";

const BACK_URL = process.env.NEXT_PUBLIC_BACK_URL;

/**
 * /perfil
 * --------------------------------------------------------------
 * Pantalla de perfil del usuario logueado. Muestra sus datos
 * básicos y permite cambiar la contraseña voluntariamente.
 *
 * Cambios respecto a la versión anterior:
 *  - Aplica la nueva política (≥8 chars, mayúscula, especial)
 *    usando el componente <PasswordRequirements/> y la utilidad
 *    passwordCumplePolitica(), idénticos al resto del sistema.
 *  - Renderiza la lista de errores `errors[]` que devuelve el
 *    backend cuando la política se incumple (defensa en profundidad).
 *  - Después de un cambio exitoso ya NO necesitamos forzar logout:
 *    podemos quedarnos en el perfil, pero por seguridad seguimos
 *    cerrando sesión para invalidar el JWT actual.
 */
export default function PerfilPage() {
  return (
    <ProtectedRoute>
      <PerfilContenido />
    </ProtectedRoute>
  );
}

function PerfilContenido() {
  const router              = useRouter();
  const { usuario, logout } = useAuth();

  const [form, setForm] = useState({
    passwordActual: "",
    passwordNueva:  "",
    passwordRepeat: "",
  });
  const [estado,  setEstado]  = useState("idle"); // idle | loading | error | success
  const [mensaje, setMensaje] = useState("");
  const [errores, setErrores] = useState([]);     // array de la política

  const rolLabel = {
    alumno:        "Alumno",
    docente:       "Docente",
    administrador: "Área Académica",
  };

  function handleChange(e) {
    setEstado("idle");
    setMensaje("");
    setErrores([]);
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const cumplePolitica = passwordCumplePolitica(form.passwordNueva);
  const passwordsCoinciden =
    form.passwordNueva.length > 0 && form.passwordNueva === form.passwordRepeat;

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");
    setErrores([]);

    if (!form.passwordActual) { setMensaje("Ingresá tu contraseña actual."); setEstado("error"); return; }
    if (!cumplePolitica)      { setMensaje("La nueva contraseña no cumple con los requisitos."); setEstado("error"); return; }
    if (form.passwordNueva !== form.passwordRepeat) { setMensaje("Las contraseñas nuevas no coinciden."); setEstado("error"); return; }

    setEstado("loading");
    try {
      const token = localStorage.getItem("tekoa_token");
      const res   = await fetch(`${BACK_URL}/api/auth/cambiar-password`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ passwordActual: form.passwordActual, passwordNueva: form.passwordNueva }),
      });
      const data = await res.json();

      if (!res.ok) {
        setEstado("error");
        setMensaje(data.message ?? "Error al actualizar.");
        setErrores(Array.isArray(data.errors) ? data.errors : []);
        return;
      }

      setEstado("success");
      setMensaje(data.message);
      setForm({ passwordActual: "", passwordNueva: "", passwordRepeat: "" });
      // Forzamos logout: el JWT actual sigue siendo válido hasta
      // su expiración natural, pero por higiene de seguridad
      // mejor cerrar sesión y exigir un nuevo login con la
      // contraseña recién creada.
      setTimeout(() => { logout(); router.push("/login"); }, 2500);
    } catch {
      setEstado("error");
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Mi perfil</h1>
          <p className="mt-1 text-sm text-gray-500">Administrá tus datos de acceso</p>
        </div>

        {/* Datos del usuario */}
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
              {usuario.rol === "alumno" ? "🎓" : usuario.rol === "docente" ? "👨‍🏫" : "🔑"}
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800">{usuario.nombre}</p>
              <p className="text-sm text-gray-500">DNI: {usuario.dni}</p>
              <span className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                {rolLabel[usuario.rol]}
              </span>
            </div>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-base font-semibold text-gray-800">Cambiar contraseña</h2>

          {estado === "success" && (
            <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              ✓ {mensaje} — Redirigiendo al login...
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

            {/* Contraseña actual */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passwordActual" className="text-sm font-medium text-gray-700">
                Contraseña actual
              </label>
              <input
                id="passwordActual" name="passwordActual" type="password" autoComplete="current-password"
                placeholder="Tu contraseña actual"
                value={form.passwordActual} onChange={handleChange}
                disabled={estado === "loading" || estado === "success"}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
              />
            </div>

            {/* Nueva contraseña + requisitos */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passwordNueva" className="text-sm font-medium text-gray-700">
                Nueva contraseña
              </label>
              <input
                id="passwordNueva" name="passwordNueva" type="password" autoComplete="new-password"
                placeholder="Definí tu nueva contraseña"
                value={form.passwordNueva} onChange={handleChange}
                disabled={estado === "loading" || estado === "success"}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
              />
              <PasswordRequirements password={form.passwordNueva} />
            </div>

            {/* Repetir */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passwordRepeat" className="text-sm font-medium text-gray-700">
                Repetir nueva contraseña
              </label>
              <input
                id="passwordRepeat" name="passwordRepeat" type="password" autoComplete="new-password"
                placeholder="Repetí la nueva contraseña"
                value={form.passwordRepeat} onChange={handleChange}
                disabled={estado === "loading" || estado === "success"}
                className={`rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  form.passwordRepeat.length === 0
                    ? "border-gray-300 focus:border-green-600 focus:ring-green-200"
                    : passwordsCoinciden
                      ? "border-green-400 focus:border-green-600 focus:ring-green-200"
                      : "border-red-300 focus:border-red-500 focus:ring-red-200"
                }`}
              />
              {form.passwordRepeat.length > 0 && !passwordsCoinciden && (
                <p className="text-xs text-red-600">Las contraseñas no coinciden.</p>
              )}
            </div>

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

            <button
              type="submit"
              disabled={estado === "loading" || estado === "success" || !cumplePolitica || !passwordsCoinciden}
              className="rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {estado === "loading" ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>

          <p className="mt-4 text-xs text-gray-400">
            Al cambiar tu contraseña vas a tener que volver a iniciar sesión.
          </p>
        </div>
      </div>
    </div>
  );
}
