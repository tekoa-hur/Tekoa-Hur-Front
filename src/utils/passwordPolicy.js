/**
 * passwordPolicy.js
 * --------------------------------------------------------------
 * Espejo en el frontend de la política definida en
 * backend/utils/passwordValidator.js
 *
 * ¿Por qué duplicarla? Porque queremos dar feedback INSTANTÁNEO al
 * usuario mientras escribe la contraseña (sin esperar a llamar al
 * backend en cada tecla). El backend sigue siendo la fuente de
 * verdad y SIEMPRE revalida en el endpoint; este archivo solo
 * sirve para la UX en tiempo real.
 *
 * REGLA DE ORO: si en algún momento cambia la política en el
 * backend, hay que actualizar acá también. La lista REQUISITOS
 * fue diseñada para que el componente <PasswordRequirements/>
 * renderice los ítems mostrando un check verde o un punto gris.
 */

/**
 * Lista de requisitos de la política.
 *
 * Cada item es un objeto con:
 *  - id:      identificador único, usado como `key` en React.
 *  - label:   texto descriptivo mostrado al usuario.
 *  - test:    función que recibe la contraseña y devuelve true
 *             si cumple ese requisito puntual.
 *
 * Mantenerlos como funciones permite combinar fácilmente los
 * tres checks en un solo render sin escribir condicionales
 * dispersos en el JSX.
 */
export const REQUISITOS = [
  {
    id:    "longitud",
    label: "Mínimo 8 caracteres",
    test:  (pwd) => typeof pwd === "string" && pwd.length >= 8,
  },
  {
    id:    "mayuscula",
    label: "Al menos una letra mayúscula (A-Z)",
    // [A-Z] coincide con cualquier mayúscula latina.
    test:  (pwd) => /[A-Z]/.test(pwd || ""),
  },
  {
    id:    "especial",
    label: "Al menos un carácter especial (!, @, #, $, etc.)",
    // [^a-zA-Z0-9] = cualquier cosa que no sea letra ni dígito.
    test:  (pwd) => /[^a-zA-Z0-9]/.test(pwd || ""),
  },
];

/**
 * Devuelve true si la password cumple TODOS los requisitos.
 *
 * Se usa para habilitar/deshabilitar el botón de "Guardar" o
 * para decidir si conviene mandar la request al backend.
 */
export function passwordCumplePolitica(pwd) {
  // .every() devuelve true sólo si todos los items pasan el test.
  return REQUISITOS.every((req) => req.test(pwd));
}
