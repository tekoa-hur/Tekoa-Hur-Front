"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

//Console para deployer: mostramos las variables de entorno que
console.log("Variables de entorno:", {
  NEXT_PUBLIC_BACK_URL: process.env.NEXT_PUBLIC_BACK_URL,
  NEXT_PUBLIC_FRONT_URL: process.env.NEXT_PUBLIC_FRONT_URL,
});
// Fin del console

// Claves de localStorage. Las exportamos como constantes para
// poder cambiarlas en un solo lugar y evitar typos silenciosos.
const TOKEN_KEY = "tekoa_token";
const USER_KEY = "tekoa_user";

/**
 * AuthProvider — Envuelve toda la app y provee el estado de autenticación.
 *
 * Estado expuesto:
 *  - usuario  : { usuarioId, dni, nombre, rol, referenciaId,
 *                 cambioPasswordObligatorio } | null
 *  - token    : string | null
 *  - loading  : boolean (true mientras verifica el token al inicio)
 *
 * Métodos expuestos:
 *  - login(dni, password)            → autentica contra el backend
 *  - logout()                        → limpia sesión y redirige al login
 *  - forgotPassword(email)           → solicita link de recuperación
 *  - validateResetToken(email, token)→ chequea token antes de mostrar form
 *  - resetPassword(email, token, pwd)→ cambia clave con el token del email
 *  - marcarPasswordCambiada()        → baja el flag en memoria + storage
 *                                       (lo llaman /cambio-obligatorio y
 *                                       /perfil tras un cambio exitoso)
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar el árbol React (solo en cliente), recuperamos
  // la sesión desde localStorage. Esto evita pedirle al usuario
  // que vuelva a loguearse cada vez que recarga la página.
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUsuario(JSON.parse(savedUser));
      }
    } catch {
      // localStorage puede no estar disponible (SSR / privacy
      // mode estricto). Lo ignoramos: el usuario simplemente
      // verá la pantalla de login.
    } finally {
      // Marcamos loading=false SIEMPRE, exista o no sesión
      // previa, para que ProtectedRoute pueda decidir qué
      // hacer (mostrar contenido / redirigir a /login).
      setLoading(false);
    }
  }, []);

  /**
   * login — Autentica al usuario contra el backend.
   *
   * Devuelve un objeto { ok, error? }. NO redirige (eso lo hace
   * la pantalla que llamó), pero deja al contexto en estado
   * "logueado" para que otras pantallas reaccionen.
   */
  async function login(dni, password) {
    try {
      /**Console para deployer */
      console.log("NEXT_PUBLIC_BACK_URL =", process.env.NEXT_PUBLIC_BACK_URL);

      const url = `${process.env.NEXT_PUBLIC_BACK_URL}/api/auth/login`;

      console.log("LOGIN URL =", url);
      /** Terminna el console*/
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACK_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dni: String(dni).trim(), password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.message ?? "Error al iniciar sesión." };
      }

      // Guardamos en estado React (re-render) y en localStorage
      // (persistencia entre recargas). El objeto `data.usuario`
      // que viene del backend INCLUYE cambioPasswordObligatorio,
      // por lo que la pantalla de login podrá decidir si redirige
      // a "/" o a "/cambio-obligatorio".
      setToken(data.token);
      setUsuario(data.usuario);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));

      return { ok: true, usuario: data.usuario };
    } catch {
      return { ok: false, error: "No se pudo conectar con el servidor." };
    }
  }

  /**
   * forgotPassword — Solicita al backend que genere un token
   * de recuperación y envíe el email correspondiente.
   *
   * El backend devuelve SIEMPRE el mismo mensaje, exista o no
   * el email en la base, para no exponer la lista de cuentas.
   */
  async function forgotPassword(email) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACK_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: String(email).trim() }),
        }
      );

      const data = await res.json();

      return {
        ok: res.ok,
        message: data.message,
      };
    } catch {
      return {
        ok: false,
        message: "No se pudo conectar con el servidor.",
      };
    }
  }

  /**
   * validateResetToken — Verifica si un token de reset sigue
   * siendo válido SIN consumirlo. Lo llama la pantalla de
   * restablecimiento al cargar, para mostrar un mensaje claro
   * cuando el link está vencido o roto.
   *
   * Devuelve { ok, valid, message?, nombre? }.
   */
  async function validateResetToken(email, token) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACK_URL}/api/auth/validate-reset-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        }
      );

      const data = await res.json();

      return {
        ok: res.ok,
        valid: data.valid === true,
        message: data.message,
        nombre: data.nombre,
      };
    } catch {
      return {
        ok: false,
        valid: false,
        message: "No se pudo conectar con el servidor.",
      };
    }
  }

  /**
   * resetPassword — Confirma el cambio de contraseña con el
   * token recibido por email.
   *
   * Si el backend devuelve `errors[]` (política incumplida),
   * los retornamos al frontend para mostrarlos al usuario.
   */
  async function resetPassword(email, token, password) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACK_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, password }),
        }
      );

      const data = await res.json();

      return {
        ok: res.ok,
        message: data.message,
        errors: data.errors, // array opcional con detalles de política
      };
    } catch {
      return {
        ok: false,
        message: "No se pudo conectar con el servidor.",
      };
    }
  }

  /**
   * marcarPasswordCambiada — Baja localmente el flag
   * cambioPasswordObligatorio (en el estado React y en
   * localStorage) DESPUÉS de un cambio de password exitoso.
   *
   * Esto evita que el usuario tenga que cerrar sesión y volver
   * a entrar sólo para que el frontend "se entere" de que ya
   * no debe forzar el cambio obligatorio.
   */
  function marcarPasswordCambiada() {
    setUsuario((prev) => {
      if (!prev) return prev;
      const actualizado = { ...prev, cambioPasswordObligatorio: false };
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(actualizado));
      } catch { /* ignorar */ }
      return actualizado;
    });
  }

  /** logout — Limpia la sesión local. */
  function logout() {
    setToken(null);
    setUsuario(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch { /* ignorar */ }
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        loading,
        login,
        logout,
        forgotPassword,
        validateResetToken,
        resetPassword,
        marcarPasswordCambiada,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** useAuth — Hook para acceder al contexto de autenticación. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
