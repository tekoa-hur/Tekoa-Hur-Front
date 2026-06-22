import { render, screen, waitFor } from "@testing-library/react";
import RegistroAsistencia from "@/components/RegistroAsistencia";
/** Que esta cubriendo el test:
 * - El componente RegistroAsistencia muestra el formulario manual cuando no hay usuario logueado.
 * - El componente hace un fetch para validar el QR y muestra el formulario manual si no hay sesión.
 * ✓ QR válido
 * ✓ Usuario NO logueado
 * ✓ Se muestra formulario manual
 * ✓ Se muestra campo DNI
 * ✓ Se muestra botón Registrar asistencia
 * Conceptos importantes:
 * - fetch: → simula el backend
 *                          Usamos vi.fn() para simular la función global fetch y 
 *                          devolver una respuesta personalizada.
 * - localStorage: → simula usuario logueado o no. 
 *                               Manipulamos localStorage para simular la ausencia de sesión.
 * - render: → monta el componente.
 *                               Usamos render() para montar el componente en el entorno de prueba.
 * - screen: → permite acceder a los elementos renderizados.
 * - expect(): →  verifica resultados.
 * - waitFor(): → espera a que se cumpla una condición asíncrona.
 *
 * Simulamos el backend.
 * Cuando el componente haga:GET /api/qr/asistencia/validar?qrToken=...
 * devolveremos un QR válido y una comisión ficticia.
 */
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        comision: {
          materia: "Matematica I",
          cod_comision: "COMISIÓN_001-TM",
        },
      }),
  })
);

describe("RegistroAsistencia", () => {
  it("muestra formulario manual cuando no hay usuario logueado", async () => {

    /**
     * Simulamos que NO existe sesión.
     * El componente ejecuta:
     * localStorage.getItem("tekoa_user") y queremos que reciba null.
     */
    localStorage.removeItem("tekoa_user");

    render(
      <RegistroAsistencia
        qrToken="token-prueba"
      />
    );

    /**
     * Esperamos a que termine el fetch que valida el QR.
     */
    await waitFor(() => {

      /**
       * Verificamos que aparezca el campo DNI.
       */
      expect(
        screen.getByPlaceholderText("Ingresá tu DNI")
      ).toBeInTheDocument();

    });

    /**
     * Verificamos que aparezca el botón de registro manual.
     */
    expect(
      screen.getByText("Registrar asistencia")
    ).toBeInTheDocument();

  });
});