import Header from "@/components/layout/Header";
import Breadcrumb from "@/components/layout/Breadcrumb";

/**
 * AppShell — Estructura base de toda la aplicación.
 *
 * Incluye:
 *  - Header institucional (verde UNAHUR, sticky)
 *  - Breadcrumb automático (invisible en "/")
 *  - Área de contenido principal
 *  - Footer institucional
 *
 * Uso: se aplica en layout.js, no hace falta importarlo en cada página.
 */
export default function AppShell({ children }) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--color-page-bg)" }}
    >

      {/* ── Header global (sticky) ── */}
      <Header />

      {/* ── Breadcrumb (se auto-oculta en "/") ── */}
      <Breadcrumb />

      {/* ── Contenido de la página ── */}
      <main
        id="main-content"
        className="flex flex-1 flex-col"
        role="main"
      >
        {children}
      </main>

      {/* ── Footer institucional ── */}
      <footer
        className="border-t"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Tekoá-Hur — Sistema de gestión académica
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Universidad Nacional de Hurlingham · 2026
          </p>
        </div>
      </footer>

    </div>
  );
}