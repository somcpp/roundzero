import AgentInboxEmail, { agentInboxSubject, type AgentInboxEmailProps } from "@/emails/agent-inbox";
import { deliver, type Delivery } from "@/lib/email/deliver";

// The one step behind ./index.ts: send the email. What it lists was
// snapshotted as the agent run ended (src/lib/email/agent-inbox.ts), and it's
// keyed on the newest gate failure, so a retry never sends it twice.

export type AgentInboxSend = {
  hackathonId: string;
  to: string;
  fromName: string;
  phaseId: string | null;
  dedupeKey: string;
  props: AgentInboxEmailProps;
};

export async function sendAgentInbox(s: AgentInboxSend): Promise<Delivery> {
  "use step";
  return deliver({
    hackathonId: s.hackathonId,
    kind: "agent_inbox",
    dedupeKey: s.dedupeKey,
    to: s.to,
    fromName: s.fromName,
    subject: agentInboxSubject(s.props.hackathon, s.props),
    element: <AgentInboxEmail {...s.props} />,
    phaseId: s.phaseId,
  });
}
