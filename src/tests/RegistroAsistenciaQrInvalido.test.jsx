import { render, screen, waitFor } from "@testing-library/react";
import RegistroAsistencia from "@/components/RegistroAsistencia";

/**
 * Que estamos probando:
 * Dado un QR inválido, cuando el usuario abre la URL
 * Entonces se muestra un mensaje de error y no aparece el formulario de asistencia
 */

/**
 * Simulamos que el backend responde que el QR es inválido.
 */
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: false,
        json: () =>
            Promise.resolve({
                message: "QR inválido o vencido",
            }),
    })
);

describe("RegistroAsistencia - QR inválido", () => {

    it("muestra mensaje de error cuando el QR no es válido", async () => {

        /**
         * Nos aseguramos de que no exista una sesión previa.
         */
        localStorage.clear();

        render(
            <RegistroAsistencia
                qrToken="token-invalido"
            />
        );

        /**
         * Esperamos a que termine la validación.
         */
        await waitFor(() => {

            /**
             * Verificamos que aparezca el mensaje enviado por el backend.
             */
            expect(
                screen.getByText(/QR inválido o vencido/i)
            ).toBeInTheDocument();

        });

        /**
         * Como el QR es inválido, NO debería aparecer el campo DNI.
         */
        expect(
            screen.queryByPlaceholderText("Ingresá tu DNI")
        ).not.toBeInTheDocument();

    });

});