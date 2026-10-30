import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { tavily } from "@tavily/core";
import { embed, embedMany } from "ai";
import type { ModelTier } from "@/lib/data";

// Server-only: reads the NVIDIA_API_KEY or NEBIUS key, and TAVILY, from .env.local.

/**
 * Two OpenAI-compatible hosts serve the same Nemotron models:
 * - NVIDIA's API catalog (build.nvidia.com), free with an NVIDIA_API_KEY.
 * - Nebius Token Factory, with a NEBIUS key.
 * NVIDIA wins when both are set. Sandbox runs always need NEBIUS.
 */
export const AI_PROVIDER: "nvidia" | "nebius" = process.env.NVIDIA_API_KEY ? "nvidia" : "nebius";
const isNvidia = AI_PROVIDER === "nvidia";

const providerConfig = {
  name: AI_PROVIDER,
  baseURL: isNvidia ? "https://integrate.api.nvidia.com/v1" : "https://api.tokenfactory.nebius.com/v1",
  apiKey: isNvidia ? process.env.NVIDIA_API_KEY : process.env.NEBIUS,
  supportsStructuredOutputs: true,
};

const llm = createOpenAICompatible(providerConfig);

/** Provider-specific request options, keyed by whichever host is in use. */
export const providerOptions = (options: Record<string, unknown>) =>
  ({ [AI_PROVIDER]: options }) as Record<string, Record<string, never>>;

/** The model id for a role: the env override, else the host's default. */
const pick = (envName: string, nvidia: string, nebius: string) => process.env[envName] || (isNvidia ? nvidia : nebius);

/** NVIDIA Nemotron. Tool calling and streamed reasoning both work. */
export const CHAT_MODEL_ID = pick("NEBIUS_CHAT_MODEL", "nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-super-120b-a12b");
export const chatModel = llm.chatModel(CHAT_MODEL_ID);

/**
 * The agent's model tiers, all NVIDIA Nemotron: Lightning for a quick pass,
 * Super (the chat model) by default, Ultra for in-depth reviews.
 */
export const TIER_MODEL_IDS: Record<ModelTier, string> = {
  quick: pick("NEBIUS_QUICK_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b", "nvidia/Nemotron-3_5-Lightning"),
  balanced: CHAT_MODEL_ID,
  deep: pick("NEBIUS_DEEP_MODEL", "nvidia/nemotron-3-ultra-550b-a55b", "nvidia/Nemotron-3-Ultra-550b-a55b"),
};

export const tierModel = (tier: ModelTier) => llm.chatModel(TIER_MODEL_IDS[tier]);

/** The judging chat's model picker: Fast runs Lightning, Smart the chat model. */
export const CHAT_MODELS = {
  fast: { tier: "quick", label: "Fast", hint: "Quicker answers" },
  smart: { tier: "balanced", label: "Smart", hint: "Best for comparisons and research" },
} as const satisfies Record<string, { tier: ModelTier; label: string; hint: string }>;

export type ChatModelKey = keyof typeof CHAT_MODELS;

/** A chat model key from untrusted input; Smart unless it's a known key. */
export const parseChatModel = (raw: unknown): ChatModelKey =>
  typeof raw === "string" && Object.hasOwn(CHAT_MODELS, raw) ? (raw as ChatModelKey) : "smart";

/** A double check runs one tier up, so a bigger model takes the second look. */
export const checkTier = (tier: ModelTier): ModelTier => (tier === "quick" ? "balanced" : "deep");

/**
 * Vision. The vision models only describe what they see; a Nemotron model does
 * the judging. NVIDIA serves Nemotron VL models; Nebius retired its NVIDIA
 * multimodal models from serverless on Aug 31, 2026, so it uses others.
 */
export const VISION_MODEL_IDS = {
  quick: pick("NEBIUS_VISION_QUICK_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "openbmb/MiniCPM-V-4_5"),
  full: pick("NEBIUS_VISION_MODEL", "nvidia/nemotron-3.5-super-vl-120b-a12b", "deepseek-ai/DeepSeek-V4.1-Flash"),
};

export const visionModelId = (tier: ModelTier) => (tier === "quick" ? VISION_MODEL_IDS.quick : VISION_MODEL_IDS.full);
export const visionModel = (tier: ModelTier) => llm.chatModel(visionModelId(tier));

/**
 * Must match extensions.vector(1024) in public.project_chunks.
 * - Nebius: Qwen3 embeddings are Matryoshka-trained, so asking for 1024 of the
 *   native 4096 dims keeps quality and lets pgvector's HNSW index them.
 * - NVIDIA: Snowflake Arctic Embed L is 1024 dims natively. NVIDIA's retrieval
 *   models need input_type ("passage" to index, "query" to search), which the
 *   AI SDK doesn't send, so a fetch wrapper adds it to the request body.
 * Switching hosts changes the vectors: re-index projects after a switch.
 */
export const EMBEDDING_DIMENSIONS = 1024;

function nvidiaEmbedder(inputType: "passage" | "query") {
  const provider = createOpenAICompatible({
    ...providerConfig,
    fetch: async (url, init) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (!body) return fetch(url, init);
      delete body.dimensions;
      return fetch(url, { ...init, body: JSON.stringify({ ...body, input_type: inputType, truncate: "END" }) });
    },
  });
  return provider.embeddingModel("snowflake/arctic-embed-l");
}

const passageModel = isNvidia ? nvidiaEmbedder("passage") : llm.embeddingModel("Qwen/Qwen3-Embedding-8B");
const queryModel = isNvidia ? nvidiaEmbedder("query") : passageModel;
const embeddingOptions = isNvidia ? {} : providerOptions({ dimensions: EMBEDDING_DIMENSIONS });

export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({
    model: passageModel,
    values,
    providerOptions: embeddingOptions,
    maxParallelCalls: isNvidia ? 2 : 4,
  });
  return embeddings;
}

export async function embedQuery(value: string): Promise<number[]> {
  const { embedding } = await embed({ model: queryModel, value, providerOptions: embeddingOptions });
  return embedding;
}

export const web = tavily({ apiKey: process.env.TAVILY });
