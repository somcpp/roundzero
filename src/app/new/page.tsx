import { redirect } from "next/navigation";
import { AppBar } from "@/components/app-bar";
import { getCurrentUser } from "@/lib/supabase/server";
import { NewHackathon } from "./new-hackathon";

export default async function NewPage() {
  // Demo accounts can't start hackathons; send them back to the demos.
  if ((await getCurrentUser())?.demo) redirect("/");

  return (
    <>
      <AppBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <NewHackathon />
      </main>
    </>
  );
}
