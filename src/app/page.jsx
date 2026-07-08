"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { BACK_URL, getAuthHeaders } from "@/config/api";

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
// Nota sobre los items con `labelPorRol`: cuando un mismo path
// significa cosas distintas según el rol, definimos el label en
// función del rol. Si no, usamos `label` fijo.
const MENU_ITEMS = [
  {
    href: "/generar-qr",
    label: "Generar QR del Aula",
    description: "Creá un código QR para identificar un aula",
    icon: "🏛️",
    variant: "primary",
    roles: ["docente", "administrador"],
  },
  {
    href: "/leer-qr",
    // Para admins el lector sirve para PROBAR los QR generados,
    // no para registrar asistencia. Lo dejamos claro en el label.
    labelPorRol: {
      alumno: "Leer Código QR",
      docente: "Leer Código QR",
      administrador: "Probar QR de Aulas",
    },
    descripcionPorRol: {
      alumno: "Escaneá un QR para registrar asistencia",
      docente: "Escaneá un QR para registrar asistencia",
      administrador: "Verificá que los QR de aulas generados funcionen",
    },
    icon: "📷",
    variant: "primary",
    roles: ["alumno", "docente", "administrador"],
  },
  {
    href: "/mis-asistencias",
    label: "Mis Asistencias",
    description: "Consultá tu historial de asistencia por materia",
    icon: "📋",
    variant: "secondary",
    roles: ["alumno"],
  },
  {
    href: "/mis-asistencias-docente",
    label: "Mi Asistencia",
    description: "Consultá tu propio historial de asistencia como docente",
    icon: "📋",
    variant: "secondary",
    roles: ["docente"],
  },
  {
    href: "/asistencia",
    label: "Listado de Asistencia",
    description: "Consultá el historial de asistencias por comisión",
    icon: "📊",
    variant: "secondary",
    roles: ["docente", "administrador"],
  },
  {
    href: "/importar",
    label: "Cargar Planilla",
    description: "Importá el archivo Excel con comisiones y alumnos",
    icon: "📁",
    variant: "secondary",
    roles: ["administrador"],
  },
    {
    href: "/importar-aulas",
    label: "Importar Aulas",
    description: "Cargá o actualizá las aulas desde el archivo Excel maestro",
    icon: "🏢",
    variant: "secondary",
    roles: ["administrador"],
  },
{
    href: "/historial-importaciones",
    label: "Historial de Importaciones",
    description: "Consultá las importaciones realizadas y descargá los archivos originales",
    icon: "📋",
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    href: "/prueba-conexion",
    label: "Listado de Estudiantes",
    description: "Visualizá el padrón de estudiantes registrados",
    icon: "👥",
    variant: "secondary",
    roles: ["docente", "administrador"],
  },
  {
    href: "/admin-aulas",
    label: "Gestión de Aulas",
    description: "Configurá los atributos y equipamiento de cada aula",
    icon: "🏛️",
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    // Nota: la URL sigue siendo /admin-espacios por compatibilidad,
    // pero el usuario ve "Gestión de Eventos" en el menú.
    href: "/admin-espacios",
    label: "Gestión de Eventos",
    description: "Reservá aulas para eventos, reuniones o charlas",
    icon: "📅",
    variant: "secondary",
    roles: ["administrador"],
  },
  {
    href: "/admin-usuarios",
    label: "Gestión de Usuarios",
    description: "Administrá los accesos y roles del sistema",
    icon: "🔑",
    variant: "secondary",
    roles: ["administrador"],
  },
];

export default function HomePage() {
  const router = useRouter();
  const { usuario, loading } = useAuth();
  const headers = useMemo(() => ({ Accept: "application/json", ...getAuthHeaders() }), []);

  // ── Estado para el aviso de clase activa del docente ─────────
  const [clasesActivas, setClasesActivas] = useState([]); // [{comision, horario}]
  const [registrando, setRegistrando] = useState(false);
  const [msgPresente, setMsgPresente] = useState(""); // éxito o error del registro
  const [yaRegistrado, setYaRegistrado] = useState({}); // {comisionId: true}
  const [descartado, setDescartado] = useState(false); // el docente cerró el aviso

  useEffect(() => {
    if (!loading && !usuario) router.push("/login");
  }, [loading, usuario, router]);

  // ── Al cargar, si es docente verificar si tiene clase ahora ──
  useEffect(() => {
    if (!usuario || usuario.rol !== "docente" || !BACK_URL) return;

    (async () => {
      try {
        // 1. Obtener profesorId del docente logueado
        const resProf = await fetch(`${BACK_URL}/api/profesores`, { headers });
        const profList = await resProf.json();
        const profesor = profList.find(
          p => p.dni === usuario.referenciaId || p.dni === usuario.dni
        );
        if (!profesor) return;

        // 2. Obtener sus comisiones con horarios
        const resCom = await fetch(`${BACK_URL}/api/comisiones`, { headers });
        const comList = await resCom.json();
        const misComisiones = Array.isArray(comList)
          ? comList.filter(c => String(c.profesorId) === String(profesor.profesorId))
          : [];

        if (misComisiones.length === 0) return;

        // 3. Verificar cuáles tienen horario activo AHORA
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
              activas.push({
                comision: com,
                horario: h,
              });
            }
          }
        }

        if (activas.length === 0) return;

        // 4. Verificar si ya registró hoy en cada clase activa
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

        // Precargar yaRegistrado con los que ya tienen registro hoy en la DB
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
  // Usa POST /api/asistencias/docente-presente — endpoint dedicado sin QR.
  // El JWT del docente es suficiente autenticación.
  // El backend valida: titular de la comisión + horario activo + sin doble registro.
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
        <svg className="h-6 w-6 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (!usuario) return null;

  const itemsVisibles = MENU_ITEMS.filter(item => item.roles.includes(usuario.rol));
  const pares = itemsVisibles.length % 2 !== 0 ? itemsVisibles.slice(0, -1) : itemsVisibles;
  const huerfano = itemsVisibles.length % 2 !== 0 ? [itemsVisibles[itemsVisibles.length - 1]] : [];

  // ¿Hay clases activas que todavía no confirmó ni descartó?
  const clasesParaMostrar = clasesActivas.filter(c => !yaRegistrado[c.comision.comisionId]);
  const mostrarAviso = usuario.rol === "docente" && clasesParaMostrar.length > 0 && !descartado;

  return (
    <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-2xl">

        {/* Bienvenida */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">
            Hola, {usuario.nombre.split(" ")[0]} 👋
          </h1>
          <p className="mt-2 text-sm text-gray-500">¿Qué querés hacer hoy?</p>
        </div>

        {/* ── Aviso de clase activa para el DOCENTE ── */}
        {mostrarAviso && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-green-300 bg-green-50 shadow-sm">
            {/* Header del aviso */}
            <div className="flex items-center justify-between border-b border-green-200 bg-green-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🕐</span>
                <span className="text-sm font-semibold text-green-900">
                  {clasesParaMostrar.length === 1
                    ? "Tenés una clase en curso ahora"
                    : `Tenés ${clasesParaMostrar.length} clases en curso ahora`}
                </span>
              </div>
              <button
                onClick={() => setDescartado(true)}
                className="text-green-600 hover:text-green-800 text-xs"
                aria-label="Cerrar aviso"
              >
                ✕
              </button>
            </div>

            {/* Una tarjeta por cada clase activa */}
            <div className="divide-y divide-green-200">
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
                        <p className="text-sm font-bold text-green-900">{materia}</p>
                        <p className="mt-0.5 text-xs text-green-700">
                          {comision.cod_comision} · {desde} – {hasta}
                        </p>
                        {horario.aula && (
                          <p className="mt-0.5 text-xs text-green-600">
                            🚪 {horario.aula.sector}-{horario.aula.numero}
                            {horario.aula.edificio?.nombre && ` · ${horario.aula.edificio.nombre}`}
                          </p>
                        )}
                      </div>

                      {registrado ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-200 px-3 py-1.5 text-xs font-semibold text-green-800">
                          ✅ Presente registrado
                        </span>
                      ) : (
                        <button
                          onClick={() => registrarPresente(comId)}
                          disabled={registrando}
                          className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50 shrink-0"
                        >
                          {registrando ? "Registrando..." : "Registrar mi presencia"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mensaje resultado */}
            {msgPresente && (
              <div className={`px-5 py-3 text-sm font-medium border-t border-green-200 ${msgPresente.startsWith("✅")
                  ? "text-green-800 bg-green-100"
                  : "text-red-700 bg-red-50"
                }`}>
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

function MenuCard({ item, rol }) {
  const isPrimary = item.variant === "primary" &&
    (rol === "alumno" ? true : item.href !== "/leer-qr");

  // Si el item define etiquetas por rol, usamos esas.
  // Si no, caemos a las genéricas.
  const labelMostrado = item.labelPorRol?.[rol] ?? item.label;
  const descripcionMostrada = item.descripcionPorRol?.[rol] ?? item.description;

  return (
    <Link
      href={item.href}
      className={`
        group flex items-start gap-4 rounded-2xl border p-5 transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2
        ${isPrimary
          ? "border-green-800 bg-green-800 hover:bg-green-700"
          : "border-green-200 bg-white hover:border-green-400 hover:shadow-sm"
        }
      `}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${isPrimary ? "bg-green-700" : "bg-green-50"
          }`}
        aria-hidden="true"
      >
        {item.icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className={`text-sm font-semibold leading-tight ${isPrimary ? "text-white" : "text-gray-800"}`}>
          {labelMostrado}
        </span>
        <span className={`text-xs leading-snug ${isPrimary ? "text-green-200" : "text-gray-500"}`}>
          {descripcionMostrada}
        </span>
      </div>
    </Link>
  );
}