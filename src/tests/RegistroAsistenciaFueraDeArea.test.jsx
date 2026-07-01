import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistroAsistencia from "@/components/RegistroAsistencia";

/**
* QR válido
* ↓
* Usuario logueado
* ↓
* Comparte ubicación
* ↓
* Backend responde 403
* ↓
* "Fuera del área permitida"
 */

/**
 * Simulamos geolocalización válida.
 */
Object.defineProperty(global.navigator, "geolocation", {
  value: {
    getCurrentPosition: vi.fn((success) => {
      success({
        coords: {
          latitude: -34.6706,
          longitude: -58.7275,
        },
      });
    }),
  },
  configurable: true,
});

/**
 * Mock de fetch.
 *
 * Primera llamada:
 * Validación QR
 *
 * Segunda llamada:
 * Registro asistencia -> 403
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
    status: 403,
    json: async () => ({
      message: "Fuera del área permitida",
    }),
  });

describe("RegistroAsistencia - Fuera de área permitida", () => {

  it("muestra error cuando el estudiante está fuera del radio permitido", async () => {

    localStorage.setItem(
      "tekoa_user",
      JSON.stringify({
        nombre: "Juan Pérez",
        dni: "55555555",
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

    const boton = await screen.findByText(
      "Registrar mi asistencia"
    );

    await userEvent.click(boton);

    await waitFor(() => {

      expect(
        screen.getByText(
        /Debés encontrarte dentro del establecimiento/i
        )
      ).toBeInTheDocument();

    });

  });

});