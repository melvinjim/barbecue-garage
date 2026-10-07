import {
  ClerkProvider,
  OrganizationSwitcher,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panel administrativo | Barbecue Garage",
  description: "Administración de la carta, banners y promociones de Barbecue Garage.",
  robots: { index: false, follow: false }, // el panel nunca debe aparecer en buscadores
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            variables: { colorPrimary: "#da2928" },
          }}
        >
          {/* Celular: marca + usuario arriba y el menú en una segunda fila (con desplazamiento si hiciera falta).
              Computador (sm+): todo en una sola fila de 4rem. */}
          <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-brand bg-black px-4 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
            <a href="/" className="shrink-0 whitespace-nowrap text-sm font-bold uppercase tracking-wider">
              Barbecue Garage <span className="hidden font-normal text-muted sm:inline">· Panel</span>
            </a>
            <Show when="signed-in">
              <nav
                aria-label="Secciones del panel"
                className="order-last flex w-full items-center gap-1 overflow-x-auto text-sm font-semibold sm:order-none sm:w-auto sm:flex-1 sm:overflow-visible"
              >
                {[
                  ["/", "Resumen"],
                  ["/productos", "Productos"],
                  ["/categorias", "Categorías"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="shrink-0 rounded-full px-3 py-1.5 hover:bg-surface-2 hover:text-white">
                    {label}
                  </a>
                ))}
              </nav>
            </Show>
            <div className="ml-auto flex items-center gap-3">
              <Show when="signed-out">
                <SignInButton forceRedirectUrl="/">
                  <button type="button" className="rounded-full px-3 py-1.5 text-sm hover:underline">
                    Iniciar sesión
                  </button>
                </SignInButton>
                <SignUpButton forceRedirectUrl="/">
                  <button type="button" className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white">
                    Crear cuenta
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                {/* El selector de organización ocupa mucho: en el celular solo se deja el botón de usuario. */}
                <div className="hidden sm:block">
                  <OrganizationSwitcher hidePersonal />
                </div>
                <UserButton />
              </Show>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
