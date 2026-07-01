import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GeneradorQR from "@/components/GeneradorQR";

/**
 * Mock del router de Next.
 * Para que el componente no intente navegar realmente.
 */
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

/**
 * Mock del contexto de autenticación.
 * Simulamos un docente autenticado.
 */
vi.mock("@/context/AuthContext", () => ({
    useAuth: () => ({
        usuario: {
            rol: "docente",
            referenciaId: 12345678,
        },
    }),
}));

/**
 * Mock del componente QR.
 * No necesitamos renderizar un QR real para estos tests.
 */
vi.mock("react-qr-code", () => ({
    default: () => <div data-testid="qr-code" />,
}));

/**
 * Mock de react-to-print.
 */
vi.mock("react-to-print", () => ({
    useReactToPrint: () => vi.fn(),
}));

/**
 * Mock de la configuración de la API.
 */
vi.mock("@/config/api", () => ({
    BACK_URL: "http://localhost:3000",
    getAuthHeaders: () => ({}),
}));

describe("GeneradorQR - Renderizado básico", () => {

    /**
     * Mock de fetch.
     *
     * Como estos tests únicamente verifican el renderizado,
     * devolvemos listas vacías para que el useEffect termine
     * correctamente.
     */
    beforeEach(() => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve([]),
            })
        );
    });

    it("Debe mostrar el título principal", async () => {

        render(<GeneradorQR />);

        expect(
            screen.getByText("Generar QR de Asistencia")
        ).toBeInTheDocument();

    });

    it("Debe mostrar el selector de comisión", () => {

        render(<GeneradorQR />);

        expect(
            screen.getByText("Mi comisión")
        ).toBeInTheDocument();

    });

    it("Debe mostrar el campo duración", () => {

        render(<GeneradorQR />);

        const inputDuracion = screen.getByRole("spinbutton");

        expect(inputDuracion).toBeInTheDocument();
        expect(inputDuracion).toHaveValue(120);


    });

});