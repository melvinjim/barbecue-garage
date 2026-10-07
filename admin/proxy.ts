import { clerkMiddleware } from "@clerk/nextjs/server";

// Segunda barrera: TODO el panel exige sesión salvo el inicio/registro de sesión.
//
// La protección REAL está junto a los datos: cada página/acción llama a
// `requireAdmin()` (lib/access.ts), como recomienda Clerk (comprobaciones por
// recurso, no solo por ruta). Este proxy solo añade "denegar por defecto" por si
// alguna página nueva olvidara esa llamada.
//
// La excepción pública es una regla propia y estricta (solo /sign-in y /sign-up y
// sus subrutas; "/sign-in-loquesea" NO cuenta). `createRouteMatcher` de Clerk se
// retiró de la recomendación oficial, por eso no se usa.
const PUBLIC_PATH = /^\/(?:sign-in|sign-up)(?:\/[^/]+)*\/?$/;

export default clerkMiddleware(async (auth, request) => {
  if (!PUBLIC_PATH.test(request.nextUrl.pathname)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
