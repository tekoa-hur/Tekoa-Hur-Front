import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistroAsistencia from "@/components/RegistroAsistencia";
/**
* QR válido
* ↓
* Usuario logueado
* ↓
* Hace click en Registrar
* ↓
* El navegador rechaza compartir ubicación
* ↓
* Se muestra mensaje de error
*/


/**
 * Simulamos QR válido.
 */
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    comision: {
      materia: "Matemática I",
      cod_comision: "COMISION_001-TM",
    },
  }),
});

/**
 * Simulamos rechazo de ubicación.
 */
Object.defineProperty(global.navigator, "geolocation", {
  value: {
    getCurrentPosition: vi.fn((success, error) => {
      error({
        code: 1,
        message: "El usuario rechazo la Geolocalizacion",
      });
    }),
  },
  configurable: true,
});

describe("RegistroAsistencia - Sin geolocalización", () => {
  it("muestra error cuando el usuario rechaza compartir ubicación", async () => {

    localStorage.setItem(
      "tekoa_user",
      JSON.stringify({
        nombre: "Juan Pérez",
        dni: "55555555",
      })
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

    expect(
      await screen.findByText(
        /ubicación/i
      )
    ).toBeInTheDocument();

  });
});