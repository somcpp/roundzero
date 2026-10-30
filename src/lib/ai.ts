import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { tavily } from "@tavily/core";
import { embed, embedMany } from "ai";
import type { ModelTier } from "@/lib/data";

// Server-only: reads the NEBIUS and TAVILY keys from .env.local.

/**
 * Nebius Token Factory speaks the OpenAI API. Its models honor strict JSON
 * schemas, so structured output is sent as a real json_schema.
 */
const nebius = createOpenAICompatible({
  name: "nebius",
  baseURL: "https://api.tokenfactory.nebius.com/v1",
  apiKey: process.env.NEBIUS,
  supportsStructuredOutputs: true,
});

/** NVIDIA Nemotron on Nebius. Tool calling and streamed reasoning both work. */
export const CHAT_MODEL_ID = process.env.NEBIUS_CHAT_MODEL || "nvidia/nemotron-3-super-120b-a12b";
export const chatModel = nebius.chatModel(CHAT_MODEL_ID);

/**
 * The agent's model tiers, all NVIDIA Nemotron: Lightning for a quick pass,
 * Super (the chat model) by default, Ultra for in-depth reviews.
 */
export const TIER_MODEL_IDS: Record<ModelTier, string> = {
  quick: process.env.NEBIUS_QUICK_MODEL || "nvidia/Nemotron-3_5-Lightning",
  balanced: CHAT_MODEL_ID,
  deep: process.env.NEBIUS_DEEP_MODEL || "nvidia/Nemotron-3-Ultra-550b-a55b",
};

export const tierModel = (tier: ModelTier) => nebius.chatModel(TIER_MODEL_IDS[tier]);

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
 * Vision. Nebius retired its NVIDIA multimodal models (Nemotron 3 Nano Omni,
 * Cosmos 3) from serverless on Aug 31, 2026, so images go to the vision
 * models it still serves; they only describe what they see, and a Nemotron
 * model does the judging. Point NEBIUS_VISION_MODEL at an NVIDIA VL model
 * (e.g. a dedicated endpoint) to swap it in.
 */
export const VISION_MODEL_IDS = {
  quick: process.env.NEBIUS_VISION_QUICK_MODEL || "openbmb/MiniCPM-V-4_5",
  full: process.env.NEBIUS_VISION_MODEL || "deepseek-ai/DeepSeek-V4.1-Flash",
};

export const visionModelId = (tier: ModelTier) => (tier === "quick" ? VISION_MODEL_IDS.quick : VISION_MODEL_IDS.full);
export const visionModel = (tier: ModelTier) => nebius.chatModel(visionModelId(tier));

/**
 * Must match extensions.vector(1024) in public.project_chunks. Qwen3 embeddings
 * are Matryoshka-trained, so asking for 1024 of the native 4096 dims keeps
 * quality and lets pgvector's HNSW index them.
 */
export const EMBEDDING_DIMENSIONS = 1024;
const embeddingModel = nebius.embeddingModel("Qwen/Qwen3-Embedding-8B");
const embeddingOptions = { nebius: { dimensions: EMBEDDING_DIMENSIONS } };

export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values,
    providerOptions: embeddingOptions,
    maxParallelCalls: 4,
  });
  return embeddings;
}

export async function embedQuery(value: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value, providerOptions: embeddingOptions });
  return embedding;
}

export const web = tavily({ apiKey: process.env.TAVILY });
