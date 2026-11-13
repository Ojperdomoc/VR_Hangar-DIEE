# Hangar DIEE · Laboratorio inmersivo

Prototipo web interactivo para explorar en primera persona el espacio del Hangar DIEE de la Universidad Nacional de Colombia. El recorrido combina una recreación 3D conceptual, comparación de las fotografías de referencia, exploración de equipos, estimación de aforo por puesto y propuestas de uso académico.

## Ejecutar

```bash
npm install
npm run dev
```

Vite sirve la experiencia en `http://localhost:5173`. Para compilar una versión estática:

```bash
npm run build
npm run preview
```

## Publicar en GitHub Pages

El workflow `.github/workflows/pages.yml` construye y publica el sitio al hacer push a `main` (y también se puede ejecutar manualmente desde **Actions**). Configura Vite con la ruta de proyecto `/VR_Hangar-DIEE/`, incluyendo las fotografías y el favicon.

La acción intenta habilitar Pages automáticamente. Si la configuración del repositorio no lo permite, en **Settings → Pages → Build and deployment** selecciona **GitHub Actions**. Tras el primer despliegue, el sitio estará en `https://ojperdomoc.github.io/VR_Hangar-DIEE/`.

## Controles

- **Arrastrar** sobre la escena: mirar alrededor.
- **W, A, S, D** o flechas: desplazarse por el laboratorio.
- **Plano de sala**: pulsar un punto para cambiar de zona.
- **Aforo**: seleccionar sillas o ajustar el control para distribuir personas (28 puestos modelados).
- **Fotos**: deslizar la comparación entre el espacio base y el laboratorio equipado.
- **Visor VR**: entrada a WebXR cuando el navegador y el visor lo admiten; el joystick mueve al usuario y apuntar al piso permite desplazarse.

## Criterios del prototipo

- Los equipos se representan de forma genérica: las fotografías no permiten confirmar marcas, modelos ni especificaciones.
- Los cursos/prácticas son líneas de uso orientativas, no un catálogo oficial. Validar denominaciones y oferta vigente con el DIEE-UNAL.
- La recreación 3D y la cifra de aforo son aproximaciones visuales que deben validarse con medidas, inventario y requisitos de seguridad del espacio.
