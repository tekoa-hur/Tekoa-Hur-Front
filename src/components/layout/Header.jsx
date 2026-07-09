"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ChevronDown,
  LogOut,
  User,
  Sun,
  Moon,
} from "lucide-react";

/**
 * Header — Barra superior institucional.
 *
 * Diseño alineado con la identidad visual de UNAHUR:
 *  - Verde institucional #558B2F
 *  - Iconos con lucide-react (trazo fino, monocromáticos)
 *  - Badge de rol con estado activo
 *  - Menú de usuario con avatar
 */
export default function Header() {
  const router = useRouter();
  const { usuario, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const menuRef = useRef(null);

  const rolLabel = {
    alumno: "Alumno",
    docente: "Docente",
    administrador: "Área Académica",
  };

  // ── Dark mode ──
  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains("dark") ||
      localStorage.getItem("theme") === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

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

  // ── Cerrar menú al clickear afuera ──
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const nombreInicial =
    usuario?.nombre_apellido?.charAt(0)?.toUpperCase() ||
    rolLabel[usuario?.rol]?.charAt(0) ||
    "U";

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10"
      style={{ background: "var(--color-primary)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">

        {/* ── Logo + Título ── */}
        <Link href="/" className="flex items-center gap-3 transition hover:opacity-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
            <Image
              src="/unahur-iso.png"
              alt="Logo UNAHUR"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="text-base font-medium leading-tight text-white">
              Tekoá-Hur
            </div>
            <div className="text-xs leading-tight text-white/70">
              Sistema de gestión académica
            </div>
          </div>
        </Link>

        {/* ── Área derecha: rol + menú usuario ── */}
        {usuario && (
          <div className="flex items-center gap-3">

            {/* Badge de rol */}
            <div className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1 sm:flex">
              <div className="h-2 w-2 rounded-full bg-lime-300" />
              <span className="text-xs font-medium text-white">
                {rolLabel[usuario.rol] || usuario.rol}
              </span>
            </div>

            {/* Toggle dark mode */}
            <button
              onClick={toggleDarkMode}
              className="hidden h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white sm:flex"
              aria-label="Cambiar tema"
              title={darkMode ? "Modo claro" : "Modo oscuro"}
            >
              {darkMode ? (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>

            {/* Menú de usuario */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-white transition hover:bg-white/10"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-medium">
                  {nombreInicial}
                </div>
                <span className="hidden text-sm sm:inline">
                  {usuario.nombre_apellido || rolLabel[usuario.rol]}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.75}
                />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border shadow-lg"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <Link
                    href="/perfil"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    <User className="h-4 w-4" strokeWidth={1.75} />
                    Mi perfil
                  </Link>
                  <button
                    onClick={toggleDarkMode}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-gray-50 sm:hidden dark:hover:bg-gray-800"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {darkMode ? (
                      <Sun className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <Moon className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    {darkMode ? "Modo claro" : "Modo oscuro"}
                  </button>
                  <div
                    className="border-t"
                    style={{ borderColor: "var(--color-border)" }}
                  />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-red-50 dark:hover:bg-red-950/30"
                    style={{ color: "var(--color-error)" }}
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.75} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}