import { AppBar } from "@/components/app-bar";
import { HackathonCollection } from "@/components/hackathon-collection";
import { DemoBanner } from "@/components/read-only";
import { listHackathons } from "@/lib/hackathons";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Home() {
  const [hackathons, user] = await Promise.all([listHackathons(), getCurrentUser()]);
  const demo = !!user?.demo;
  return (
    <>
      {demo && <DemoBanner>You&apos;re in the demo. Open any hackathon and try things out; nothing you change is saved.</DemoBanner>}
      <AppBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <HackathonCollection hackathons={hackathons} demo={demo} />
      </main>
    </>
  );
}
