# 🌱 Tekoa-Hur-Front

Sistema académico desarrollado como parte de la tesina en la **Universidad Nacional de Hurlingham (UNAHUR)**.  
Frontend del **Sistema de gestión académica Tekoá-Hur**. Interfaz web para gestión de estudiantes, materias, profesores, comisiones, matrículas, aulas, reservas de espacios, asistencia por QR e importación de planillas.

---
## Configuración del entorno

Antes de ejecutar el proyecto por primera vez, es necesario crear el archivo de variables de entorno.

Copiar el archivo .env.example y renombrarlo como .env.local

```bash
cp .env.example .env.local
```
Completar las variables requeridas con los valores correspondientes según el entorno local.

Por ejemplo:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:<nro_puerto>
```
Adicionalmente hay que configurar usuario y clave para poder usar los endpoints
```bash
NEXT_PUBLIC_BASIC_USER=nombre_usuario
NEXT_PUBLIC_BASIC_PASS=clave_usuario
```

Estas variables permiten configurar la conexión con el backend y otros parámetros necesarios para la ejecución del proyecto.

## Ejecución del proyecto

Una vez configurado el archivo .env.local, ejecutar:

```bash
npm install
npm run dev
```

La aplicación quedará disponible en la dirección configurada mediante las variables de entorno definidas en el archivo .env.local



## Estructura de archivos

A continuación se describe la organización del frontend del sistema Tekoá-Hur y la finalidad de cada carpeta principal.

### /src/app
Contiene las rutas de la aplicación utilizando el App Router de Next.js.
Cada subcarpeta dentro de app representa una pantalla del sistema.

* Definir las páginas del sistema
* Organizar la navegación
* Estructurar layouts globales
* Centralizar la entrada principal de la aplicación

### /src/components
Contiene los componentes reutilizables de la interfaz.

* Encapsular lógica visual reutilizable
* Evitar duplicación de código
* Separar UI de lógica de navegación
* Facilitar mantenimiento y escalabilidad

### Coverage
[![codecov](https://codecov.io/github/tekoa-hur/Tekoa-Hur-Front/graph/badge.svg?token=LNBKU6WAF2)](https://codecov.io/github/tekoa-hur/Tekoa-Hur-Front)

### /src/config
Contiene configuraciones globales del frontend.

### /public
Contiene archivos estáticos accesibles directamente desde el navegador.


## Versiones necesarias
Next: 16.2.2
React: 19.2.4