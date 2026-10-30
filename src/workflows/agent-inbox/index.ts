import { sendAgentInbox, type AgentInboxSend } from "./steps";

// The agent-failed inbox email, started when an agent run ends with gate
// failures waiting on a call (src/lib/email/runs.ts). It goes to the owner,
// who makes the calls, once per new failure.

export async function agentInboxEmail(send: AgentInboxSend) {
  "use workflow";
  return sendAgentInbox(send);
}
