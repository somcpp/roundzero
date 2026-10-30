import { notFound } from "next/navigation";
import { emailConfig } from "@/lib/email/config";
import { getViewableHackathon } from "@/lib/hackathons";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { HackathonSettings } from "./hackathon-settings";
import { Notifications } from "./notifications";

export default async function GeneralPage({ params }: PageProps<"/h/[slug]/setup/general">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const supabase = await createClient();
  const [user, { data }] = await Promise.all([
    getCurrentUser(),
    // "*" so the page still loads before notify_email's migration is applied.
    supabase.from("hackathons").select("*").eq("id", hackathon.id).maybeSingle<{ notify_email?: string }>(),
  ]);
  const config = emailConfig();
  return (
    <HackathonSettings
      hackathon={hackathon}
      // The owner's email settings aren't a demo viewer's business (and name this server's inboxes).
      notifications={
        !hackathon.readOnly && (
          <Notifications
            slug={slug}
            notifyEmail={data?.notify_email ?? ""}
            ownerEmail={user?.email ?? null}
            sending={"missing" in config ? config : { from: config.fromAddress, redirectTo: config.redirectTo }}
          />
        )
      }
    />
  );
}
