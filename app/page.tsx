import { redirect } from "next/navigation";

// La racine renvoie vers le dashboard ; le middleware redirige vers /login
// si l'utilisateur n'est pas connecté.
export default function Home() {
  redirect("/dashboard");
}
