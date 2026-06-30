"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const router              = useRouter();
  const { usuario, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const menuRef = useRef(null);

  const rolLabel = {
    alumno:        "Alumno",
    docente:       "Docente",
    administrador: "Área Académica",
  };

  const rolColor = {
    alumno:        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    docente:       "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    administrador: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  };

  // Inicializar estado del Dark Mode leyendo el DOM / LocalStorage
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark") || 
                   localStorage.getItem("theme") === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    }
  }, []);

  // Alternar Modo Oscuro
  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDarkMode(true);
    }
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-green-900 dark:bg-zinc-950 shadow-md border-b dark:border-zinc-800 transition-colors">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">

        {/* Logo + Nombre */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-900"
          aria-label="Ir al inicio — Tekoá-Hur"
        >
          <img
            src="/logo.png"
            alt="Logo Tekoá-Hur"
            width={32} height={32}
            className="h-8 w-8 flex-shrink-0 rounded-full bg-white object-contain p-0.5"
          />
        <span
            className="text-sm font-semibold sm:text-base"
            style={{ color: "#FFFFFF" }}
          >
            Tekoá-Hur
          </span>
        </Link>

        {/* Derecha */}
        <div className="flex items-center gap-2">

          {/* Selector de modo oscuro */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-green-100 hover:bg-green-800 dark:text-zinc-400 dark:hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition"
            aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {darkMode ? (
              <span className="text-lg">☀️</span>
            ) : (
              <span className="text-lg">🌙</span>
            )}
          </button>

          {usuario ? (
            <>
              {/* Badge de rol — solo visible en pantallas medianas+ */}
              <div className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium sm:flex ${rolColor[usuario.rol] ?? "bg-gray-100 text-gray-700"}`}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
                {rolLabel[usuario.rol] ?? usuario.rol}
              </div>

              {/* Dropdown de usuario */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(prev => !prev)}
                  className="flex items-center gap-1.5 rounded-lg border border-green-700 bg-green-800 dark:border-zinc-800 dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                >
                  <span className="sm:hidden">
                    {usuario.rol === "alumno" ? "🎓" : usuario.rol === "docente" ? "👨‍🏫" : "🔑"}
                  </span>
                  <span className="hidden sm:inline" style={{ color: "#FFFFFF" }}>{usuario.nombre.split(" ")[0]}</span>
                  <svg className={`h-3 w-3 flex-shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd"  style={{ color: "#FFFFFF" }} d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg transition-colors">
                    <div className="border-b border-[var(--color-border)] px-4 py-3">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{usuario.nombre}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">DNI: {usuario.dni}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium sm:hidden ${rolColor[usuario.rol]}`}>
                        {rolLabel[usuario.rol]}
                      </span>
                    </div>

                    <Link href="/perfil" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-alt)]">
                      <span aria-hidden="true">👤</span> Mi perfil
                    </Link>
                    <Link href="/perfil" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-alt)]">
                      <span aria-hidden="true">🔑</span> Cambiar contraseña
                    </Link>
                    <div className="mt-1 border-t border-[var(--color-border)]" />
                    <button onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/30">
                      <span aria-hidden="true">🚪</span> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login"
              className="rounded border border-green-700 bg-green-800 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 dark:hover:bg-zinc-800">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}