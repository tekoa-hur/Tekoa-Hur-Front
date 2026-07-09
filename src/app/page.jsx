"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { BACK_URL, getAuthHeaders } from "@/config/api";
import {
  QrCode,
  Camera,
  ClipboardList,
  BarChart3,
  FileSpreadsheet,
  Building2,
  History,
  Users,
  Landmark,
  CalendarDays,
  KeyRound,
  Clock,
  DoorOpen,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";

// ─── Días en español sin tilde (igual que el backend) ────────
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function diaActual() {
  return DIAS[new Date().getDay()];
}

function horaActual() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Compara dos strings "HH:MM" */
function horaMenorIgual(a, b) { return a <= b; }

// ─── Menú de opciones por rol ─────────────────────────────────
// Icons de lucide-react (trazo fino, monocromático, profesional).
// Nota sobre los items con `labelPorRol`: cuando un mismo path
// significa cosas distintas según el rol, definimos el label en
// función del rol. Si no, usamos `label` fijo.
const MENU_ITEMS = [
  {
    href: "/generar-qr",
    label: "Generar QR del aula",
    description: "Creá un código QR para identificar un aula",
    Icon: QrCode,
    variant: "primary",
    roles: ["docente", "administrador"],
  },
  {
    href: "/leer-qr",
    labelPorRol: {
      alumno: "Leer código QR",
      docente: "Leer código QR",
      administrador: "Probar QR de aulas",
    },
    descripcionPorRol: {
      alumno: "Escaneá un QR para registrar asistencia",
      docente: "Escaneá un QR para registrar asistencia",
      administrador: "Verificá que los QR de aulas generados funcionen",
    },
    Icon: Camera,
    variant: "primary",
    roles: ["alumno", "docente", "administrador"],
  },
  {
    href: "/mis-asistencias",
    label: "Mis asistencias",
    description: "Consultá tu historial de asistencia por materia",
    Icon: ClipboardList,
    variant: "secondary",
    roles: ["alumno"],
  },
  {
    href: "/mis-asistencias-docente",
    label: "Mi asistencia",
    description: "Consultá tu propio historial de asistencia como docente",
    Icon: ClipboardList,
    variant: "secondary",
    roles: ["docente"],
  },
  {
    href: "/asistencia",
    label: "Listado de asistencia",
    description: "Consultá el historial de asistencias por comisión",
    Icon: BarChart3,
    variant: "secondary",
    roles: ["docente", "administrador"],
  },
  {
    href: "/importar",
    label: "Cargar planilla",
    description: "Importá el archivo Excel con comisiones y alumnos",
    Icon: FileSpreadsheet,
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    href: "/importar-aulas",
    label: "Importar aulas",
    description: "Cargá o actualizá las aulas desde el archivo Excel maestro",
    Icon: Building2,
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    href: "/historial-importaciones",
    label: "Historial de importaciones",
    description: "Consultá las importaciones realizadas y descargá los archivos",
    Icon: History,
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    href: "/prueba-conexion",
    label: "Listado de estudiantes",
    description: "Visualizá el padrón de estudiantes registrados",
    Icon: Users,
    variant: "secondary",
    roles: ["docente", "administrador"],
  },
  {
    href: "/admin-aulas",
    label: "Gestión de aulas",
    description: "Configurá los atributos y equipamiento de cada aula",
    Icon: Landmark,
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    // Nota: la URL sigue siendo /admin-espacios por compatibilidad,
    // pero el usuario ve "Gestión de eventos" en el menú.
    href: "/admin-espacios",
    label: "Gestión de eventos",
    description: "Reservá aulas para eventos, reuniones o charlas",
    Icon: CalendarDays,
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    href: "/admin-usuarios",
    label: "Gestión de usuarios",
    description: "Administrá los accesos y roles del sistema",
    Icon: KeyRound,
    variant: "secondary",
    roles: ["administrador"],
  },
];

export default function HomePage() {
  const router = useRouter();
  const { usuario, loading } = useAuth();
  const headers = useMemo(() => ({ Accept: "application/json", ...getAuthHeaders() }), []);

  // ── Estado para el aviso de clase activa del docente ─────────
  const [clasesActivas, setClasesActivas] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const [msgPresente, setMsgPresente] = useState("");
  const [yaRegistrado, setYaRegistrado] = useState({});
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  // ── Al cargar, si es docente verificar si tiene clase ahora ──
  useEffect(() => {
    if (!usuario || usuario.rol !== "docente" || !BACK_URL) return;

    (async () => {
      try {
        const resProf = await fetch(`${BACK_URL}/api/profesores`, { headers });
        const profList = await resProf.json();
        const profesor = profList.find(
          p => p.dni === usuario.referenciaId || p.dni === usuario.dni
        );
        if (!profesor) return;

        const resCom = await fetch(`${BACK_URL}/api/comisiones`, { headers });
        const comList = await resCom.json();
        const misComisiones = Array.isArray(comList)
          ? comList.filter(c => String(c.profesorId) === String(profesor.profesorId))
          : [];

        if (misComisiones.length === 0) return;

        const dia = diaActual();
        const hora = horaActual();

        const activas = [];
        for (const com of misComisiones) {
          const horarios = com.horarios ?? [];
          for (const h of horarios) {
            const diaHorario = (h.diaSemana ?? "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            if (
              diaHorario === dia &&
              horaMenorIgual(h.horaDesde?.slice(0, 5), hora) &&
              horaMenorIgual(hora, h.horaHasta?.slice(0, 5))
            ) {
              activas.push({ comision: com, horario: h });
            }
          }
        }

        if (activas.length === 0) return;

        const hoy = new Date().toISOString().split("T")[0];
        const yaRegistradoHoy = {};

        for (const a of activas) {
          const comId = a.comision.comisionId;
          const rAsis = await fetch(
            `${BACK_URL}/api/asistencias?comisionId=${comId}`,
            { headers }
          );
          if (rAsis.ok) {
            const regs = await rAsis.json();
            const yaRegHoy = regs.some(
              r => String(r.usuarioId) === String(usuario.dni) &&
                r.tipoUsuario === "PROFESOR" &&
                r.fecha === hoy
            );
            if (yaRegHoy) yaRegistradoHoy[comId] = true;
          }
        }

        if (Object.keys(yaRegistradoHoy).length > 0) {
          setYaRegistrado(yaRegistradoHoy);
        }

        setClasesActivas(activas);
      } catch (e) {
        console.error("Error verificando clases activas:", e);
      }
    })();
  }, [usuario, headers]);

  // ── Registrar presente del docente ───────────────────────────
  async function registrarPresente(comisionId) {
    setRegistrando(true);
    setMsgPresente("");
    try {
      const token = localStorage.getItem("tekoa_token");
      const res = await fetch(`${BACK_URL}/api/asistencias/docente-presente`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comisionId }),
      });
      const data = await res.json();

      if (res.ok || res.status === 409) {
        setYaRegistrado(prev => ({ ...prev, [comisionId]: true }));
        setMsgPresente(data.message);
      } else {
        setMsgPresente(data.message ?? "No se pudo registrar la presencia.");
      }
    } catch {
      setMsgPresente("Error de red. Intentá de nuevo.");
    } finally {
      setRegistrando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2
          className="h-6 w-6 animate-spin"
          style={{ color: "var(--color-primary)" }}
          strokeWidth={1.75}
        />
      </div>
    );
  }

  if (!usuario) return null;

  const itemsVisibles = MENU_ITEMS.filter(item => item.roles.includes(usuario.rol));
  const pares = itemsVisibles.length % 2 !== 0 ? itemsVisibles.slice(0, -1) : itemsVisibles;
  const huerfano = itemsVisibles.length % 2 !== 0 ? [itemsVisibles[itemsVisibles.length - 1]] : [];

  const clasesParaMostrar = clasesActivas.filter(c => !yaRegistrado[c.comision.comisionId]);
  const mostrarAviso = usuario.rol === "docente" && clasesParaMostrar.length > 0 && !descartado;

  const primerNombre = usuario.nombre?.split(" ")[0] || "";

  return (
    <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-2xl">

        {/* ── Bienvenida ── */}
        <div className="mb-8 text-center">
          <h1
            className="text-2xl font-medium sm:text-3xl"
            style={{ color: "var(--color-text-primary)" }}
          >
            Hola, {primerNombre}
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            ¿Qué querés hacer hoy?
          </p>
        </div>

        {/* ── Aviso de clase activa para el DOCENTE ── */}
        {mostrarAviso && (
          <div
            className="mb-6 overflow-hidden rounded-2xl border"
            style={{
              borderColor: "var(--color-primary-ring)",
              background: "var(--color-primary-subtle)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-3"
              style={{
                borderColor: "var(--color-primary-ring)",
                background: "var(--color-primary-light)",
              }}
            >
              <div className="flex items-center gap-2">
                <Clock
                  className="h-4 w-4"
                  style={{ color: "var(--color-primary-active)" }}
                  strokeWidth={1.75}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--color-primary-active)" }}
                >
                  {clasesParaMostrar.length === 1
                    ? "Tenés una clase en curso ahora"
                    : `Tenés ${clasesParaMostrar.length} clases en curso ahora`}
                </span>
              </div>
              <button
                onClick={() => setDescartado(true)}
                className="rounded-full p-1 transition hover:bg-white/50"
                aria-label="Cerrar aviso"
                style={{ color: "var(--color-primary-active)" }}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div
              className="divide-y"
              style={{ borderColor: "var(--color-primary-ring)" }}
            >
              {clasesParaMostrar.map(({ comision, horario }) => {
                const comId = comision.comisionId;
                const registrado = yaRegistrado[comId];
                const materia = comision.materia?.nombre ?? comision.cod_comision;
                const desde = horario.horaDesde?.slice(0, 5) ?? "";
                const hasta = horario.horaHasta?.slice(0, 5) ?? "";

                return (
                  <div key={comId} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {materia}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {comision.cod_comision} · {desde} – {hasta}
                        </p>
                        {horario.aula && (
                          <p
                            className="mt-1 flex items-center gap-1 text-xs"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            <DoorOpen className="h-3 w-3" strokeWidth={1.75} />
                            {horario.aula.sector}-{horario.aula.numero}
                            {horario.aula.edificio?.nombre && ` · ${horario.aula.edificio.nombre}`}
                          </p>
                        )}
                      </div>

                      {registrado ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: "var(--color-primary-light)",
                            color: "var(--color-primary-active)",
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Presente registrado
                        </span>
                      ) : (
                        <button
                          onClick={() => registrarPresente(comId)}
                          disabled={registrando}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                          style={{ background: "var(--color-primary)" }}
                        >
                          {registrando ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                              Registrando…
                            </>
                          ) : (
                            "Registrar mi presencia"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {msgPresente && (
              <div
                className="border-t px-5 py-3 text-sm font-medium"
                style={{
                  borderColor: "var(--color-primary-ring)",
                  background: msgPresente.startsWith("✅")
                    ? "var(--color-success-bg)"
                    : "var(--color-error-bg)",
                  color: msgPresente.startsWith("✅")
                    ? "var(--color-success)"
                    : "var(--color-error)",
                }}
              >
                {msgPresente}
              </div>
            )}
          </div>
        )}

        {/* ── Menú de opciones ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pares.map(item => <MenuCard key={item.href} item={item} rol={usuario.rol} />)}
        </div>

        {huerfano.length > 0 && (
          <div className="mt-3 flex justify-center">
            <div className="w-full sm:w-1/2">
              <MenuCard item={huerfano[0]} rol={usuario.rol} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * MenuCard — Tarjeta del dashboard.
 *
 * Dos variantes:
 *  - primary: fondo verde UNAHUR (acción principal)
 *  - secondary: fondo blanco con círculo verde claro (acciones frecuentes)
 */
function MenuCard({ item, rol }) {
  const isPrimary = item.variant === "primary" &&
    (rol === "alumno" ? true : item.href !== "/leer-qr");

  const labelMostrado = item.labelPorRol?.[rol] ?? item.label;
  const descripcionMostrada = item.descripcionPorRol?.[rol] ?? item.description;
  const Icon = item.Icon;

  if (isPrimary) {
    return (
      <Link
        href={item.href}
        className="group flex items-start gap-4 rounded-2xl p-5 transition hover:opacity-95 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          background: "var(--color-primary)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium leading-tight text-white">
            {labelMostrado}
          </span>
          <span className="text-xs leading-snug text-white/75">
            {descripcionMostrada}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className="group flex items-start gap-4 rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105"
        style={{ background: "var(--color-primary-light)" }}
      >
        <Icon
          className="h-5 w-5"
          style={{ color: "var(--color-primary)" }}
          strokeWidth={1.75}
        />
      </span>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-sm font-medium leading-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {labelMostrado}
        </span>
        <span
          className="text-xs leading-snug"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {descripcionMostrada}
        </span>
      </div>
    </Link>
  );
}
