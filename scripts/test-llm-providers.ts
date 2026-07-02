/**
 * One-shot smoke test for Gemini + Grok via shared LlmClient.
 * Usage: dotenv -e .env -- ts-node --transpile-only scripts/test-llm-providers.ts
 */
import { LlmClient } from '../src/common/ai/llm.client';
import { loadLlmConfigFromEnv, resolveXaiApiKey, isGroqApiKey } from '../src/common/ai/llm.config';
import { GeminiProvider } from '../src/common/ai/providers/gemini.provider';
import { GrokProvider } from '../src/common/ai/providers/grok.provider';

const PROMPT = 'Reply with exactly this JSON and nothing else: {"ok":true,"provider":"test"}';

function keyFormatHint(key: string | undefined): string {
  if (!key) return 'not set';
  const trimmed = key.trim();
  if (trimmed.startsWith('gsk_')) return 'invalid (Groq gsk_ prefix)';
  if (trimmed.startsWith('xai-')) return `valid format (len ${trimmed.length})`;
  if (trimmed.startsWith('AQ.')) return 'looks like Gemini key';
  return `unexpected format (len ${trimmed.length})`;
}

async function testProvider(
  label: string,
  fn: () => Promise<string>,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const text = await fn();
    const preview = text.replace(/\s+/g, ' ').slice(0, 120);
    return { ok: true, detail: preview };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message };
  }
}

async function main() {
  const config = loadLlmConfigFromEnv();
  const xaiResolved = resolveXaiApiKey(process.env);
  const groqKeyInGrokSlot = isGroqApiKey(process.env.GROK_API_KEY);

  console.log('═'.repeat(60));
  console.log('LLM provider smoke test');
  console.log('═'.repeat(60));
  console.log(`provider order: ${config.providerOrder.join(' → ')}`);
  console.log(`gemini key: ${keyFormatHint(config.gemini.apiKey)}`);
  console.log(`gemini model: ${config.gemini.model}`);
  console.log(`xai key: ${keyFormatHint(config.grok.apiKey)} (source: ${xaiResolved.source ?? 'none'})`);
  console.log(`grok model: ${config.grok.model}`);
  if (groqKeyInGrokSlot && process.env.XAI_API_KEY?.trim()) {
    console.log('note: GROK_API_KEY holds a Groq key — using XAI_API_KEY instead');
  } else if (groqKeyInGrokSlot) {
    console.log('warn: GROK_API_KEY is a Groq key — set XAI_API_KEY from console.x.ai');
  }
  console.log('');

  const gemini = new GeminiProvider(config.gemini);
  const grok = new GrokProvider(config.grok);

  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  if (gemini.isConfigured()) {
    const model = gemini.getModels()[0];
    const result = await testProvider('gemini', () =>
      gemini.generate({ prompt: PROMPT, model, responseMimeType: 'application/json' }),
    );
    results.push({ name: `gemini (${model})`, ...result });
  } else {
    results.push({
      name: 'gemini',
      ok: false,
      detail: 'GEMINI_API_KEY not set — skipped',
    });
  }

  if (grok.isConfigured()) {
    const configError = grok.validateConfiguration();
    if (configError) {
      results.push({ name: 'grok', ok: false, detail: configError });
    } else {
      const model = grok.getModels()[0];
      const result = await testProvider('grok', () =>
        grok.generate({ prompt: PROMPT, model, responseMimeType: 'application/json' }),
      );
      results.push({ name: `grok (${model})`, ...result });
    }
  } else {
    results.push({
      name: 'grok',
      ok: false,
      detail: 'GROK_API_KEY / XAI_API_KEY not set — skipped',
    });
  }

  // Failover chain test (uses first configured provider in order)
  const client = LlmClient.fromEnv((level, message) => {
    if (level === 'warn') console.log(`  [failover] ${message}`);
  });

  if (client.isConfigured()) {
    const failover = await testProvider('failover chain', async () => {
      const result = await client.generateJson<{ ok: boolean }>(PROMPT);
      return JSON.stringify(result);
    });
    results.push({
      name: `failover chain (used: ${client.getLastUsedProvider() ?? 'none'} / ${client.getLastUsedModel() || 'n/a'})`,
      ...failover,
    });
  }

  console.log('Results');
  console.log('─'.repeat(60));
  for (const result of results) {
    const icon = result.ok ? 'PASS' : 'FAIL';
    console.log(`${icon}  ${result.name}`);
    console.log(`      ${result.detail}`);
  }
  console.log('─'.repeat(60));

  const configuredTests = results.filter(
    (r) => !r.detail.includes('skipped') && !r.name.startsWith('failover'),
  );
  const allConfiguredPass = configuredTests.every((r) => r.ok);
  const failoverPass = results.find((r) => r.name.startsWith('failover'))?.ok ?? false;

  if (!client.isConfigured()) {
    console.log('No API keys configured.');
    process.exit(1);
  }

  if (!allConfiguredPass || !failoverPass) {
    process.exit(1);
  }

  console.log('All configured providers OK.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
