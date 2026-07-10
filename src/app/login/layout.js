/**
 * Layout específico para la pantalla de login.
 * No usa AppShell para evitar mostrar el header/breadcrumb/footer
 * en la pantalla de autenticación.
 *
 * Fondo institucional con leve tinte verde (paleta UNAHUR).
 */
export default function LoginLayout({ children }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--color-page-bg)" }}
    >
      {children}
    </div>
  );
}