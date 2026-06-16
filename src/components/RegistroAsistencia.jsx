"use client";

// ============================================================
// components/RegistroAsistencia.jsx
// ============================================================
// Pantalla a la que llega el usuario después de escanear un QR de
// asistencia. Soporta DOS formatos de URL:
//
//   NUEVO (recomendado, atado a comisión):
//     /registrar-asistencia?qrToken
//
//   LEGACY (atado al aula, se mantiene por compatibilidad):
//     /registrar-asistencia?edificioId=...&aulaId=...&rtoken=...
//
// Flujo:
//   1. Detecta cuál de los dos formatos vino.
//   2. Llama al endpoint de validación correspondiente:
//        - Nuevo:   GET /api/qr/asistencia/validar?qrToken=...
//        - Legacy:  GET /api/qr/validar?edificioId=...&aulaId=...&rtoken=...
//   3. Si el QR es válido:
//        - Si el usuario está logueado → registro en un click usando JWT
//        - Si no → formulario manual (rol + DNI)
//   4. Llama al endpoint de registro:
//        - Nuevo:   POST /api/qr/asistencia/registrar  con { qrToken, ... }
//        - Legacy:  POST /api/asistencias/registrar-desde-qr  (sin tocar)
//
// MIGRACIÓN A TAILWIND:
//   El componente original usaba MUI. Lo migramos al sistema Tailwind
//   que viene usándose en el resto de la app (verdes #16a34a, etc.).
//   La lógica funcional se mantiene.
// ============================================================

import { useEffect, useState } from "react";

const BACK_URL = process.env.NEXT_PUBLIC_BACK_URL;

/**
 * Props soportadas:
 *
 *   Nuevo formato:    qrToken
 *   Legacy:           edificioId, aulaId, rtoken, fechaInicio, fechaFin
 *
 * El componente detecta cuál llegó y opera en consecuencia.
 */
export default function RegistroAsistencia({
  qrToken,
  edificioId,
  aulaId,
  rtoken,
  fechaInicio,
  fechaFin,
}) {
  // ── Modo de operación ─────────────────────────────────────
  // Si vino qrToken, usamos el flujo NUEVO (comisión).
  // Si no, asumimos LEGACY si vino el trío aulaId+rtoken+edificioId.
  const modo = qrToken ? "nuevo" : "legacy";

  // ── Estado general ────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [qrValido, setQrValido] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [msgExito, setMsgExito] = useState("");
  const [registrando, setRegistrando] = useState(false);
  // Info de la comisión (solo modo nuevo). Permite mostrarle al usuario
  // a qué materia/comisión va a registrar la asistencia.
  const [infoComision, setInfoComision] = useState(null);

  // ── Modo manual (sin sesión) ──────────────────────────────
  const [dni, setDni] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState("ESTUDIANTE");

  // ── Usuario logueado (si existe) ─────────────────────────
  const [usuarioLogueado, setUsuarioLogueado] = useState(null);

  // ── Leer sesión al montar ────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tekoa_user");
      if (raw) setUsuarioLogueado(JSON.parse(raw));
    } catch {
      /* ignorar */
    }
  }, []);

  // ── Validar el QR al cargar ──────────────────────────────
  useEffect(() => {
    async function validar() {
      // Validación de parámetros mínimos según el modo
      if (modo === "nuevo") {
        if (!qrToken) {
          setQrValido(false);
          setMsgError("URL inválida: falta qrToken.");
          setLoading(false);
          return;
        }
      } else {
        if (!edificioId || !aulaId || !rtoken) {
          setQrValido(false);
          setMsgError("URL inválida: faltan parámetros del QR.");
          setLoading(false);
          return;
        }
      }

      try {
        let res, data;
        if (modo === "nuevo") {
          // ── Endpoint nuevo ──
          res = await fetch(
            `${BACK_URL}/api/qr/asistencia/validar?qrToken=${qrToken}`
          );
          data = await res.json();
          if (!res.ok) {
            setQrValido(false);
            setMsgError(data.message || "QR inválido.");
          } else {
            setQrValido(true);
            setInfoComision(data.comision);
          }
        } else {
          // ── Endpoint legacy ──
          res = await fetch(
            `${BACK_URL}/api/qr/validar?edificioId=${edificioId}&aulaId=${aulaId}&rtoken=${rtoken}`
          );
          data = await res.json();
          if (!res.ok) {
            setQrValido(false);
            setMsgError(data.message || "QR inválido.");
          } else {
            setQrValido(true);
          }
        }
      } catch {
        setQrValido(false);
        setMsgError("No se pudo conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    }
    validar();
  }, [modo, qrToken, edificioId, aulaId, rtoken]);

  // ── Registrar asistencia ──────────────────────────────────
  // Acepta override de dni/tipo para que el modo logueado pueda
  // llamarla directo con los datos del JWT sin tocar los inputs.
  const registrar = async (dniOverride, tipoOverride) => {
    const dniFinal = (dniOverride ?? dni).toString().trim();
    const tipoFinal = tipoOverride ?? tipoUsuario;

    if (!dniFinal) return;

    setRegistrando(true);
    setMsgError("");
    setMsgExito("");

    try {
      const token = localStorage.getItem("tekoa_token");

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // ── Geolocalización ─────────────────────────────────────
      // Para el nuevo flujo de asistencia basado en qrToken,
      // se solicita la ubicación actual del usuario.
      //
      // Estas coordenadas serán enviadas al backend para que
      // valide que el usuario se encuentre dentro del radio
      // permitido antes de registrar la asistencia.
      //
      // El flujo legacy no utiliza geolocalización y continúa funcionando sin modificaciones.
      let latitudUsuario;
      let longitudUsuario;

      // Se utiliza la API Geolocation del navegador para obtener
      // la ubicación actual del usuario.
      //
      // Las coordenadas obtenidas se envían al backend para validar
      // que el registro de asistencia se realice dentro del radio permitido.
      if (modo === "nuevo") {
        try {
          const posicion = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
              }
            );
          });

          latitudUsuario = posicion.coords.latitude;
          longitudUsuario = posicion.coords.longitude;

          //Para probar funcionamiento
          console.log({
            latitudUsuario,
            longitudUsuario,
          });

        } catch {
          setMsgError(
            "Se requiere compartir la ubicación para registrar la asistencia."
          );
          setRegistrando(false);
          return;
        }
      }

      let res;
      let data;

      if (modo === "nuevo") {
        // Endpoint nuevo: body con
        // { qrToken, tipoUsuario, usuarioId, latitudUsuario, longitudUsuario }
        res = await fetch(`${BACK_URL}/api/qr/asistencia/registrar`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            qrToken,
            tipoUsuario: tipoFinal,
            usuarioId: dniFinal,
            latitudUsuario,
            longitudUsuario,
          }),
        });

      } else {
        // Endpoint legacy: igual al original
        res = await fetch(`${BACK_URL}/api/asistencias/registrar-desde-qr`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            tipoUsuario: tipoFinal,
            usuarioId: dniFinal,
            aulaId,
            rtoken,
            fechaInicio,
            fechaFin,
          }),
        });
      }

      data = await res.json();

      console.log("RESPUESTA BACKEND:", data);

      if (!res.ok) {

        // Ya registrado hoy
        if (res.status === 409) {

          setMsgExito(
            data.message || "Ya estabas registrado hoy."
          );

          // Error de geolocalización
        } else if (
          res.status === 403 &&
          data.message?.includes("Fuera del área permitida")
        ) {

          setMsgError(
            "Debés encontrarte dentro del establecimiento para registrar la asistencia."
          );

        } else {

          setMsgError(
            data.message || "Error al registrar."
          );
        }

      } else {

        setMsgExito(
          data.message || "✅ Asistencia registrada"
        );

        setDni("");
      }

    } catch {
      setMsgError(
        "Error de red. Verificá tu conexión."
      );
    } finally {
      setRegistrando(false);
    }
  };

  // Mapa rol → tipoUsuario del backend
  const rolToTipo = {
    alumno: "ESTUDIANTE",
    docente: "PROFESOR",
    administrador: "PROFESOR",
  };

  return (
    <div className="flex justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-md ring-1 ring-gray-200">
        <h1 className="text-xl font-bold text-gray-800 text-center mb-1">
          Registro de asistencia
        </h1>
        {modo === "nuevo" && (
          <p className="text-center text-xs text-gray-400 mb-4">
            Atado a comisión · funciona aunque cambie el aula
          </p>
        )}

        {/* Spinner de validación */}
        {loading && (
          <div className="flex justify-center py-6">
            <svg
              className="h-8 w-8 animate-spin text-green-700"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </div>
        )}

        {/* QR inválido */}
        {!loading && !qrValido && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            ⚠️ {msgError}
          </div>
        )}

        {/* QR válido */}
        {!loading && qrValido && (
          <>
            {/* Info de la comisión (solo modo nuevo) */}
            {modo === "nuevo" && infoComision && (
              <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <p className="text-xs text-green-700 uppercase tracking-wide">
                  Vas a registrarte a:
                </p>
                <p className="text-base font-bold text-green-900 mt-0.5">
                  {infoComision.materia || infoComision.cod_comision}
                </p>
                {infoComision.cod_comision && infoComision.materia && (
                  <p className="text-xs text-green-700">
                    {infoComision.cod_comision}
                  </p>
                )}
                {infoComision.docente && (
                  <p className="text-xs text-green-700 mt-1">
                    👨‍🏫 {infoComision.docente}
                  </p>
                )}
                {infoComision.expiraEn && (
                  <p className="text-xs text-amber-700 mt-1">
                    ⏱ Expira a las{" "}
                    {new Date(infoComision.expiraEn).toLocaleTimeString(
                      "es-AR",
                      { hour: "2-digit", minute: "2-digit" }
                    )}
                  </p>
                )}
              </div>
            )}

            {/* MODO AUTOMÁTICO: usuario logueado */}
            {usuarioLogueado ? (
              <>
                {!infoComision && (
                  <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                    ✅ QR válido. Vamos a registrar tu asistencia.
                  </div>
                )}

                {/* Tarjeta de usuario */}
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 flex flex-col gap-0.5">
                  <p className="text-xs text-gray-500">Registrando como</p>
                  <p className="text-base font-bold text-green-900">
                    {usuarioLogueado.nombre}
                  </p>
                  <p className="text-xs text-gray-600">
                    DNI: {usuarioLogueado.dni} ·{" "}
                    {usuarioLogueado.rol === "alumno"
                      ? "Estudiante"
                      : usuarioLogueado.rol === "docente"
                        ? "Docente"
                        : "Administrador"}
                  </p>
                </div>

                <button
                  onClick={() =>
                    registrar(
                      usuarioLogueado.dni,
                      rolToTipo[usuarioLogueado.rol] ?? "ESTUDIANTE"
                    )
                  }
                  disabled={registrando || !!msgExito}
                  className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {registrando ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Registrando...
                    </>
                  ) : (
                    "Registrar mi asistencia"
                  )}
                </button>
              </>
            ) : (
              /* MODO MANUAL: sin sesión */
              <>
                {!infoComision && (
                  <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                    ✅ QR válido. Ingresá tu DNI para registrar asistencia.
                  </div>
                )}

                <p className="text-sm font-medium text-gray-700 mb-2">Soy:</p>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {[
                    { v: "ESTUDIANTE", l: "Estudiante" },
                    { v: "PROFESOR", l: "Docente" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => {
                        setTipoUsuario(opt.v);
                        setMsgError("");
                        setMsgExito("");
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tipoUsuario === opt.v
                        ? "bg-green-700 text-white"
                        : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>

                <div className="mb-3 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    DNI
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dni}
                    onChange={(e) => {
                      setDni(e.target.value);
                      setMsgError("");
                      setMsgExito("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && dni.trim()) registrar();
                    }}
                    placeholder="Ingresá tu DNI"
                    className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                </div>

                <button
                  onClick={() => registrar()}
                  disabled={!dni.trim() || registrando}
                  className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {registrando ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Registrando...
                    </>
                  ) : (
                    "Registrar asistencia"
                  )}
                </button>

                {msgError && (
                  <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    ⚠️ {msgError}
                  </div>
                )}
              </>
            )}
            {msgError && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                ⚠️ {msgError}
              </div>
            )}
            {/* Mensaje de éxito (ambos modos) */}
            {msgExito && (
              <div className="mt-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                {msgExito}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
