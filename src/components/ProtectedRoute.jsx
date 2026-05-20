"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import PropTypes from "prop-types";

/**
 * ProtectedRoute — Protege páginas que requieren autenticación.
 *
 * Comportamiento:
 *  - loading === true  → muestra spinner (espera a que el contexto hidrate)
 *  - sin sesión        → redirige a /login
 *  - rol no permitido  → redirige a /
 *  - ok                → renderiza children
 *
 * Uso:
 *   <ProtectedRoute roles={["administrador"]}>
 *     <MiPagina />
 *   </ProtectedRoute>
 *
 *   // Sin restricción de rol (cualquier usuario logueado):
 *   <ProtectedRoute>
 *     <MiPagina />
 *   </ProtectedRoute>
 */
//export default function ProtectedRoute({ children, roles =  [] ,}) {
export default function ProtectedRoute(props) {
  const {
    children,
    roles = [],
  } = props;

  const router = useRouter();
  const { usuario, loading } = useAuth();

  // Normalización para evitar problemas por mayúsculas/espacios
  const tieneRoles = roles?.length > 0;
  const rolUsuario = usuario?.rol?.trim()?.toLowerCase();
  const rolesPermitidos = roles.map(r => r.trim().toLowerCase());

  useEffect(() => {
    if (loading) return; // esperar a que hidrate

    console.log("USUARIO EN PROTECTED ROUTE:", usuario);

    if (!usuario) {
      router.replace("/login");
      return;
    }

    // ── Cambio obligatorio de contraseña ──
    //
    // Si el usuario tiene el flag en true (primer ingreso o reset
    // de admin reciente), lo redirigimos a /cambio-obligatorio
    // y bloqueamos cualquier otra pantalla protegida hasta que
    // defina una clave que cumpla la política.
    //
    // La excepción es la propia pantalla /cambio-obligatorio: si
    // ya estamos ahí, no tiene sentido redirigir (loop infinito).
    // Eso lo controla la propia /cambio-obligatorio: NO usa
    // ProtectedRoute con este chequeo, sino su propio guard.
    if (usuario.cambioPasswordObligatorio) {
      router.replace("/cambio-obligatorio");
      return;
    }

    console.log("ROL USUARIO:", rolUsuario);
    console.log("ROLES PERMITIDOS:", rolesPermitidos);

    //if (roles.length > 0 && !roles.includes(usuario.rol)) {}
    if (tieneRoles && !rolesPermitidos.includes(rolUsuario)) {
      router.replace("/");
    }
  }, [loading, usuario, roles, router, rolUsuario, rolesPermitidos, tieneRoles]);

  // Mientras hidrata → spinner centrado
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  // Sin sesión
  if (!usuario) return null;

  // Flag de cambio obligatorio: no renderizamos children hasta
  // que el router termine de mover al usuario a /cambio-obligatorio.
  // Esto evita un "flash" momentáneo del contenido protegido.
  if (usuario.cambioPasswordObligatorio) return null;

  // Rol inválido
  if (
    tieneRoles &&
    !rolesPermitidos.includes(rolUsuario)
  ) {
    return null;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node,
  roles: PropTypes.arrayOf(PropTypes.string),
};