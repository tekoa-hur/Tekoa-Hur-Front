"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useRouter } from "next/navigation";

// Decodifica una imagen usando 3 estrategias en orden
async function decodificarImagen(file) {
  const bitmap = await createImageBitmap(file);

  // 1. BarcodeDetector nativo (Chrome/Edge - más rápido)
  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const codes    = await detector.detect(bitmap);
      if (codes.length > 0) return codes[0].rawValue;
    } catch (e) {
      console.warn("BarcodeDetector falló:", e);
    }
  }

  // 2. jsQR con la imagen en su tamaño original
  const jsQR   = (await import("jsqr")).default;
  const canvas = document.createElement("canvas");
  canvas.width  = bitmap.width;
  canvas.height = bitmap.height;
  const ctx    = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  if (code) return code.data;

  // 3. jsQR escalado a 1024px
  const TAM     = 1024;
  const canvas2 = document.createElement("canvas");
  canvas2.width = canvas2.height = TAM;
  const ctx2    = canvas2.getContext("2d");
  ctx2.fillStyle = "white";
  ctx2.fillRect(0, 0, TAM, TAM);
  const scale = Math.min(TAM / bitmap.width, TAM / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx2.drawImage(bitmap, (TAM - w) / 2, (TAM - h) / 2, w, h);
  const imageData2 = ctx2.getImageData(0, 0, TAM, TAM);
  const code2 = jsQR(imageData2.data, TAM, TAM, { inversionAttempts: "attemptBoth" });
  if (code2) return code2.data;

  throw new Error("No se pudo leer el QR");
}

export default function LectorQR() {
  const qrRef  = useRef(null);
  const router = useRouter();

  const [escaneando, setEscaneando] = useState(false);
  const [resultado,  setResultado]  = useState("");
  const [error,      setError]      = useState("");
  const [cargando,   setCargando]   = useState(false);
  const [camaras,    setCamaras]    = useState([]);
  const [camaraId,   setCamaraId]   = useState("");

  useEffect(() => {
    let mounted = true;
    Html5Qrcode.getCameras().then((devices) => {
      if (!mounted) return;
      setCamaras(devices || []);
      if (devices?.length > 0) {
        const trasera = devices.find(d =>
          d.label?.toLowerCase().includes("back") ||
          d.label?.toLowerCase().includes("trasera") ||
          d.label?.toLowerCase().includes("rear")
        );
        setCamaraId(trasera ? trasera.id : devices[0].id);
      }
    }).catch(() => {
      if (mounted) setError("No se pudieron obtener las cámaras.");
    });
    return () => { mounted = false; };
  }, []);

  const iniciarScanner = async () => {
    try {
      setError(""); setResultado("");
      if (!camaraId) { setError("No hay cámara disponible."); return; }
      if (escaneando) return;
      const html5QrCode = new Html5Qrcode("reader");
      qrRef.current = html5QrCode;
      await html5QrCode.start(
        camaraId,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.7778 },
        (decodedText) => { setResultado(decodedText); detenerScanner(); },
        () => {}
      );
      setEscaneando(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo iniciar la cámara.");
    }
  };

  const detenerScanner = async () => {
    try {
      if (qrRef.current) {
        try { await qrRef.current.stop();  } catch { /* ignorar */ }
        try { await qrRef.current.clear(); } catch { /* ignorar */ }
        qrRef.current = null;
      }
    } finally { setEscaneando(false); }
  };

  const leerImagen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setError(""); setResultado(""); setCargando(true);
      if (escaneando) await detenerScanner();
      const texto = await decodificarImagen(file);
      setResultado(texto);
    } catch (err) {
      console.error(err);
      setError("No se pudo leer el QR. Probá descargando el QR de nuevo desde Generar QR.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Selector de cámara — ✅ foco verde en lugar de azul */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Cámara disponible</label>
        <select
          value={camaraId}
          onChange={(e) => setCamaraId(e.target.value)}
          disabled={escaneando}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-200 disabled:opacity-50"
        >
          {camaras.length === 0
            ? <option value="">No hay cámaras detectadas</option>
            : camaras.map((cam) => (
                <option key={cam.id} value={cam.id}>{cam.label || `Cámara ${cam.id}`}</option>
              ))
          }
        </select>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {!escaneando ? (
          <button
            type="button"
            onClick={iniciarScanner}
            className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          >
            Activar cámara
          </button>
        ) : (
          <button
            type="button"
            onClick={detenerScanner}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Detener lector
          </button>
        )}

        <label
          className={`w-full cursor-pointer rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition ${
            cargando ? "cursor-not-allowed bg-green-400" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {cargando ? "Procesando..." : "Cargar imagen QR"}
          <input type="file" accept="image/*" onChange={leerImagen} className="sr-only" disabled={cargando} />
        </label>
      </div>

      {/* Área del scanner */}
      <div
        id="reader"
        className="min-h-[300px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
      />

      {/* Resultado exitoso */}
      {resultado && (() => {
        // ── Detectar tipo de QR según la URL leída ─────────────
        // La función no captura nada: solo lee `resultado` para decidir
        // el texto y los colores del botón. De esta forma el botón es
        // contextual al contenido escaneado.
        let textoBoton = "Abrir enlace del QR";
        let descripcion = "QR leído correctamente.";

        if (typeof resultado === "string") {
          if (resultado.includes("/espacio/")) {
            // QR PERMANENTE de aula → lleva a ficha informativa del espacio
            textoBoton = "Ver información del aula";
            descripcion = "QR de AULA detectado. Te lleva a la ficha del espacio.";
          } else if (resultado.includes("/registrar-asistencia")) {
            // QR de ASISTENCIA generado por un docente para una clase puntual
            textoBoton = "Continuar registro de asistencia";
            descripcion = "QR de ASISTENCIA detectado.";
          }
        }

        return (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4">
            <p className="mb-1 text-sm font-semibold text-green-700">✅ QR leído correctamente</p>
            <p className="mb-2 text-xs text-green-700/80">{descripcion}</p>
            <a
              href={resultado}
              className="inline-block rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              {textoBoton}
            </a>
          </div>
        );
      })()}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      {/* ✅ Cancelar: gris neutro — no rojo (rojo = errores, no acciones secundarias) */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        Cancelar
      </button>
    </div>
  );
}
