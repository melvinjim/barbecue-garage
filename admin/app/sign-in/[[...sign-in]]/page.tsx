import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignInPage(props: PageProps<"/sign-in/[[...sign-in]]">) {
  // Quien ya tiene sesión no debe ver esta pantalla (evita pantallas en blanco y bucles).
  // Las subrutas internas de Clerk (callbacks, tareas) se dejan pasar.
  const { "sign-in": segments } = await props.params;
  if (!segments?.length) {
    const { userId } = await auth();
    if (userId) redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      {/* forceRedirectUrl: siempre termina en "/", ignorando direcciones de retorno encadenadas */}
      <SignIn forceRedirectUrl="/" />
    </main>
  );
}
