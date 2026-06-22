import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistroAsistencia from "@/components/RegistroAsistencia";

/** 
 * Dado un usuario logueado y un QR válido
 * Cuando intenta registrar asistencia
 * Y el backend responde 409 entonces se muestra:
 * "Ya estabas registrado hoy"
 */
 

/**
 * Simulamos una ubicación válida.
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
 * Primera llamada:
 *   Validación QR
 *
 * Segunda llamada:
 *   Registro asistencia -> 409
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
    ok: false,
    status: 409,
    json: async () => ({
      message: "Ya estabas registrado hoy",
    }),
  });

describe("RegistroAsistencia - Ya registrado", () => {

  it("muestra mensaje cuando el estudiante ya registró asistencia", async () => {

    /**
     * Simulamos sesión iniciada.
     */
    localStorage.setItem(
      "tekoa_user",
      JSON.stringify({
        nombre: "Juan Pérez",
        dni: "12345678",
        rol: "alumno",
      })
    );

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
     * Simulamos click.
     */
    await userEvent.click(boton);

    /**
     * Verificamos mensaje devuelto por backend.
     */
    await waitFor(() => {

      expect(
        screen.getByText(
          /Ya estabas registrado hoy/i
        )
      ).toBeInTheDocument();

    });

  });

});