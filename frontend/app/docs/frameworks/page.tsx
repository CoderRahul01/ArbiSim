import Link from 'next/link';
export const metadata = { title: 'Agent Frameworks — ArbiSim Guard Docs', description: 'How to integrate ArbiSim Guard with Vibekit, Eliza, and LangGraph.' };
function CodeBlock({ code, lang = 'typescript' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-4">
      <div className="px-4 py-2 border-b border-border bg-elevated"><span className="text-xs font-mono text-text-tertiary">{lang}</span></div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}
export default function FrameworksPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Integrations</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Vibekit, Eliza & LangGraph</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">ArbiSim Guard integrates natively with the three most popular AI agent frameworks for DeFi. Pick the one you are already using.</p>

      {/* Vibekit */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden mb-8">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-elevated/40">
          <span className="w-8 h-8 rounded-lg bg-coral/10 border border-coral/20 text-coral flex items-center justify-center text-sm font-mono font-bold">V</span>
          <div><h2 className="text-text-primary font-semibold">Vibekit</h2><p className="text-text-tertiary text-xs">Native MCP integration — no extra config</p></div>
          <span className="ml-auto text-xs font-mono text-teal bg-teal/10 border border-teal/20 px-2 py-1 rounded">Native</span>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-text-secondary text-sm leading-relaxed">Vibekit is an Avalanche-native agent framework built by Ember. ArbiSim Guard is a first-class safety layer in Vibekit — when you enable ArbiSim, every DeFi action the agent takes is automatically pre-checked before execution.</p>
          <p className="text-text-secondary text-sm">Supported protocols: GMX, Camelot, Aave, Pendle, TraderJoe, Pangolin, Benqi.</p>
          <CodeBlock lang="typescript" code={`import { createAgent } from '@vibekit/core';
import { arbisimGuard } from '@vibekit/arbisim';

const agent = createAgent({
  network: 'avalanche-mainnet',
  safetyLayer: arbisimGuard({
    apiKey: process.env.ARBI_API_KEY,
    maxSlippage: 2.0,
    abortOnReject: true,   // agent stops if verdict is REJECTED
  }),
});`} />
        </div>
      </div>

      {/* Eliza */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden mb-8">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-elevated/40">
          <span className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/20 text-amber flex items-center justify-center text-sm font-mono font-bold">E</span>
          <div><h2 className="text-text-primary font-semibold">Eliza</h2><p className="text-text-tertiary text-xs">MCP plugin — drop-in to any Eliza agent</p></div>
          <span className="ml-auto text-xs font-mono text-amber bg-amber/10 border border-amber/20 px-2 py-1 rounded">Plugin</span>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-text-secondary text-sm leading-relaxed">Eliza is a multi-agent orchestration framework. Add the ArbiSim MCP server to your Eliza agent configuration and every transaction the agent plans will be checked before execution.</p>
          <CodeBlock lang="json" code={`{
  "name": "my-defi-agent",
  "plugins": ["@eliza/mcp"],
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["./gateway/dist/index.js", "--mcp"],
      "env": { "GATEWAY_API_KEY": "ask_free_a1b2_..." }
    }
  }
}`} />
          <p className="text-text-secondary text-sm">The agent can now call <code className="font-mono text-xs text-coral">preflight_simulate</code> directly from its reasoning loop. If the result is REJECTED, the agent receives the reason and can decide to abort or try an alternative.</p>
        </div>
      </div>

      {/* LangGraph */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden mb-8">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-elevated/40">
          <span className="w-8 h-8 rounded-lg bg-teal/10 border border-teal/20 text-teal flex items-center justify-center text-sm font-mono font-bold">L</span>
          <div><h2 className="text-text-primary font-semibold">LangGraph</h2><p className="text-text-tertiary text-xs">Tool node — insert into any graph</p></div>
          <span className="ml-auto text-xs font-mono text-teal bg-teal/10 border border-teal/20 px-2 py-1 rounded">Adapter</span>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-text-secondary text-sm leading-relaxed">In LangGraph, ArbiSim is a tool node that sits between your planning node and your execution node. The graph calls ArbiSim with the planned transaction, reads the verdict, and routes to either execute or abort.</p>
          <CodeBlock lang="python" code={`import requests
from langgraph.graph import StateGraph

def check_transaction(state):
    resp = requests.post(
        "https://arbisim-proxy.rahulpandey-creates.workers.dev/api/v1/simulate",
        headers={"X-API-Key": os.environ["ARBI_API_KEY"]},
        json={
            "network": state["network"],
            "agent_address": state["wallet"],
            "transactions": state["planned_txs"],
            "max_slippage_tolerance": 2.0,
        }
    ).json()
    return {**state, "verdict": resp["status"], "checks": resp["checks"]}

def route_on_verdict(state):
    return "execute" if state["verdict"] == "APPROVED" else "abort"

graph = StateGraph(AgentState)
graph.add_node("check", check_transaction)
graph.add_conditional_edges("check", route_on_verdict, {"execute": "send_tx", "abort": "report_error"})`} />
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <Link href="/docs/rest-api" className="text-sm text-coral hover:underline">← REST API</Link>
        <Link href="/docs/architecture" className="text-sm text-coral hover:underline ml-auto">Architecture →</Link>
      </div>
    </article>
  );
}
