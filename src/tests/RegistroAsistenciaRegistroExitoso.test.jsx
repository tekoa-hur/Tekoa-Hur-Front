import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistroAsistencia from "@/components/RegistroAsistencia";

/** 
 * Qué se está probando: Registro exitoso de asistencia.
 * - El QR es válido.
 * - El alumno ya inició sesión.
 * - El sistema registra la asistencia correctamente.
 * - Se muestra mensaje de éxito.
 * 
 * Con el flujo: 
 * QR válido
 *   ↓
 *  Usuario logueado
 *   ↓
 *   Hace click en "Registrar mi asistencia"
 *   ↓   
 *   Backend responde OK
 *   ↓
 *   Se muestra mensaje de éxito
 */

/**
 * Mock de geolocalización.
 *
 * Simulamos que el navegador devuelve una ubicación válida.
 */
const mockGeolocation = {
  getCurrentPosition: vi.fn((success) =>
    success({
      coords: {
        latitude: -34.6706,
        longitude: -58.7275,
      },
    })
  ),
};

Object.defineProperty(global.navigator, "geolocation", {
  value: mockGeolocation,
  configurable: true,
});

/**
 * Mock de fetch.
 *
 * El componente hace DOS llamadas:
 *
 * 1) validar QR
 * 2) registrar asistencia
 */
global.fetch = vi.fn()
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      comision: {
        materia: "Matemática I",
        cod_comision: "COMISION_001-TM",
      },
    }),
  })
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      message: "Asistencia registrada correctamente",
    }),
  });

describe("RegistroAsistencia - Registro exitoso", () => {

  it("registra asistencia cuando el usuario está logueado", async () => {

    /**
     * Simulamos usuario autenticado.
     */
    localStorage.setItem(
      "tekoa_user",
      JSON.stringify({
        nombre: "Juan Pérez",
        dni: "55555555",
        rol: "alumno",
      })
    );

    /**
     * Simulamos JWT.
     */
    localStorage.setItem(
      "tekoa_token",
      "token-falso"
    );

    render(
      <RegistroAsistencia
        qrToken="token-prueba"
      />
    );

    /**
     * Esperamos que aparezca el botón.
     */
    const boton = await screen.findByText(
      "Registrar mi asistencia"
    );

    /**
     * Simulamos click del usuario.
     */
    await userEvent.click(boton);

    /**
     * Esperamos el mensaje de éxito.
     */
    await waitFor(() => {

      expect(
        screen.getByText(
          /Asistencia registrada correctamente/i
        )
      ).toBeInTheDocument();

    });

  });

});