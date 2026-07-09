"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2, User, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState({ dni: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setError("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.dni.trim()) { setError("Ingresá tu DNI."); return; }
    if (!form.password.trim()) { setError("Ingresá tu contraseña."); return; }

    setLoading(true);
    try {
      const result = await login(form.dni, form.password);

      if (!result.ok) {
        setError(result.error ?? "DNI o contraseña incorrectos.");
        return;
      }

      // ── Cambio obligatorio de contraseña ──
      if (result.usuario?.cambioPasswordObligatorio) {
        router.push("/cambio-obligatorio");
        return;
      }

      router.push("/");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div
        className="rounded-2xl p-8"
        style={{
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--color-border)",
        }}
      >

        {/* ── Logo + Título ── */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full p-1"
            style={{
              background: "var(--color-primary-light)",
              boxShadow: "0 0 0 3px var(--color-primary-subtle)",
            }}
          >
            <Image
              src="/logo.png"
              alt="Logo Tekoá-Hur"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <h1
              className="text-xl font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Tekoá-Hur
            </h1>
            <p
              className="mt-0.5 text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Sistema de gestión académica
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

          {/* ── DNI ── */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="dni"
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              DNI
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
                strokeWidth={1.75}
              />
              <input
                id="dni"
                name="dni"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                autoFocus
                placeholder="Ej: 35123456"
                value={form.dni}
                onChange={handleChange}
                disabled={loading}
                className="w-full rounded-lg border px-3 py-2.5 pl-9 text-sm transition focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                  "--tw-ring-color": "var(--color-primary-ring)",
                }}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
          </div>

          {/* ── Contraseña ── */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Contraseña
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
                strokeWidth={1.75}
              />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={form.password}
                onChange={handleChange}
                disabled={loading}
                className="w-full rounded-lg border px-3 py-2.5 pl-9 text-sm transition focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                  "--tw-ring-color": "var(--color-primary-ring)",
                }}
              />
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div
              id="login-error"
              role="alert"
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--color-error-bg)",
                color: "var(--color-error)",
              }}
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={1.75}
              />
              <span>{error}</span>
            </div>
          )}

          {/* ── Botón ── */}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Ingresando…
              </>
            ) : (
              "Ingresar"
            )}
          </button>

        </form>

        {/* ── Links secundarios ── */}
        <div className="mt-6 space-y-2 text-center">
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            ¿Olvidaste tu contraseña?{" "}
            <Link
              href="/forgot-password"
              className="font-medium transition hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              Recuperala acá
            </Link>
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            ¿Problemas para ingresar? Contactá al Área Académica.
          </p>
        </div>
      </div>

      {/* ── Firma institucional ── */}
      <p
        className="mt-6 text-center text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        Universidad Nacional de Hurlingham
      </p>
    </div>
  );
}