// app/api/chat/route.ts
// Context-aware policy chatbot — uses policy context + knowledge graph
import { getEnv } from '@/lib/env';
import { queryGraph } from '@/lib/graph';
import { callLLM } from '@/lib/llm';

const CHAT_SYSTEM_PROMPT = `You are Simula's policy assistant for Quezon City, Philippines. You are embedded in a simulation report and help the user understand the simulation results and explore policy trade-offs.

Answer the user's question directly and concisely. Be specific to the policy and location. Reference historical precedents when relevant. If you don't know something, say so.

Do NOT return JSON. Respond in plain conversational prose. Keep answers focused — 2-5 sentences for simple questions, a short paragraph for complex ones.`;

export async function POST(request: Request) {
  const env = await getEnv();

  let body: {
    message: string;
    simulation_id: string;
    policy: string;
    location: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.message) {
    return Response.json({ error: '"message" is required' }, { status: 400 });
  }

  try {
    // Query knowledge graph for relevant context
    const graphContext = await queryGraph(
      env,
      `${body.message} ${body.policy} ${body.location ?? 'Quezon City'}`,
      2,
      6
    );

    // Build conversation history for multi-turn context
    const historyText = (body.history ?? [])
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `## Policy Being Discussed
${body.policy}

## Location
${body.location ?? 'Quezon City'}, Metro Manila, Philippines

## Relevant Historical Context from Knowledge Graph
${graphContext.context_text.slice(0, 1500)}

${historyText ? `## Conversation So Far\n${historyText}\n` : ''}
## User's Question
${body.message}`;

    const answer = await callLLM(env, prompt, CHAT_SYSTEM_PROMPT, {
      temperature: 0.6,
    });

    return Response.json({ answer: answer.trim() });
  } catch (err) {
    return Response.json({ error: `Chat failed: ${err}` }, { status: 500 });
  }
}
