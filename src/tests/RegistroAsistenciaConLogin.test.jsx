import { render, screen, waitFor } from "@testing-library/react";
import RegistroAsistencia from "@/components/RegistroAsistencia";


/**
 * Que se esta probando: Escenario con usuario logueado.
 * - El QR es válido.
 * - El alumno ya inició sesión.
 * - El sistema debe mostrar sus datos.
 * - Debe permitir registrar la asistencia
 *   sin pedir nuevamente el DNI.
 */


/**Simulamos una respuesta exitosa del endpoint de validación del QR.*/
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () =>
            Promise.resolve({
                comision: {
                    materia: "Matemática I",
                    cod_comision: "COMISION_001-TM",
                },
            }),
    })
);

describe("RegistroAsistencia - Usuario logueado", () => {

    it("muestra los datos del usuario y el botón de registro automático", async () => {

        /**
         * Simulamos una sesión existente.
         * Esto reemplaza lo que normalmente se guarda cuando el usuario inicia sesión.
         */
        localStorage.setItem(
            "tekoa_user",
            JSON.stringify({
                nombre: "Juan Pérez",
                dni: "12345678",
                rol: "alumno",
            })
        );

        render(
            <RegistroAsistencia
                qrToken="token-prueba"
            />
        );

        /**
         * Esperamos a que termine la validación del QR.
         */
        await waitFor(() => {

            /**
            * Como el usuario ya está autenticado, deben mostrarse sus datos en pantalla.
            */
            expect(
                screen.getByText("Registrando como")
            ).toBeInTheDocument();
        });

        /**
         * Verificamos nombre.
         */
        expect(
            screen.getByText("Juan Pérez")
        ).toBeInTheDocument();

        /**
         * Verificamos DNI.
         */
        expect(
            screen.getByText(/12345678/)
        ).toBeInTheDocument();

        /**
         * Debe existir el botón de registro automático.
         */
        expect(
            screen.getByText("Registrar mi asistencia")
        ).toBeInTheDocument();

        /**
         * NO debería aparecer el formulario manual.
         */
        expect(
            screen.queryByPlaceholderText("Ingresá tu DNI")
        ).not.toBeInTheDocument();

    });
});