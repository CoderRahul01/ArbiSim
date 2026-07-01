import Link from 'next/link';

export const metadata = { title: 'What ArbiSim Checks — Docs', description: 'Plain-English explanation of all 10 safety checks ArbiSim runs on every transaction.' };

const checks = [
  {
    id: 'would_revert',
    name: 'Transaction would fail',
    severity: 'danger',
    plain: 'The transaction would be rejected by the blockchain.',
    detail: 'Simulating the transaction caused it to revert — the smart contract rejected it mid-execution. This could be due to insufficient balance, wrong parameters, contract logic conditions, or a protocol state change. If sent for real, it would consume gas but accomplish nothing.',
    example: 'Trying to withdraw more than your deposited balance from a lending protocol.',
    reference: 'Ethereum: tx.origin revert semantics — https://docs.soliditylang.org/en/latest/control-structures.html#error-handling',
  },
  {
    id: 'price_impact_too_high',
    name: 'Price impact too high',
    severity: 'warning',
    plain: 'The trade moves the market price more than your acceptable limit.',
    detail: 'In automated market makers (AMMs), large trades shift the price. If your trade is too big relative to the available liquidity, you will receive significantly fewer tokens than the quoted price suggests. ArbiSim compares the simulated output against the current price and rejects if it exceeds your max_slippage_tolerance.',
    example: 'Swapping $50,000 of AVAX for USDC in a pool with $200,000 total liquidity — the price would move ~25%.',
    reference: 'Uniswap V2 price impact math — https://docs.uniswap.org/contracts/v2/concepts/advanced-topics/understanding-returns',
  },
  {
    id: 'frontrun_detected',
    name: 'Someone is front-running you',
    severity: 'danger',
    plain: 'Another transaction in the same block is positioned to exploit yours.',
    detail: 'MEV (Maximal Extractable Value) bots monitor the mempool for profitable transactions. When they see a large swap, they insert their own trade before yours to profit from the price movement you create. ArbiSim detects this sandwich pattern by simulating the block state and checking for suspicious surrounding transactions.',
    example: 'A bot buys AVAX before your large buy, then sells after you move the price.',
    reference: 'MEV documentation — https://ethereum.org/en/developers/docs/mev/',
  },
  {
    id: 'risky_allowance',
    name: 'Risky token permission',
    severity: 'warning',
    plain: 'You are giving a contract more spending permission than this transaction requires.',
    detail: 'ERC-20 approvals give a contract permission to spend your tokens up to a maximum amount. Many protocols request unlimited approvals for convenience, but this creates a risk: if that contract is exploited later, attackers can drain your full balance. ArbiSim flags when your approval amount significantly exceeds what the transaction actually needs.',
    example: 'Approving a DEX for MAX_UINT256 tokens when you only need to swap 10 AVAX.',
    reference: 'EIP-20 allowance — https://eips.ethereum.org/EIPS/eip-20',
  },
  {
    id: 'signature_invalid',
    name: 'Signature check failed',
    severity: 'danger',
    plain: 'The cryptographic signature for this transaction is wrong.',
    detail: 'For smart account transactions (ERC-4337 UserOps), the bundler validates your signature before including the transaction. If the signature is invalid — wrong key, expired session, or tampered data — the transaction will be rejected immediately without executing. ArbiSim calls simulateValidation on the EntryPoint contract to catch this.',
    example: 'A session key that was revoked is signing a new transaction.',
    reference: 'ERC-4337 — https://eips.ethereum.org/EIPS/eip-4337',
  },
  {
    id: 'permission_expired',
    name: 'Permission has expired',
    severity: 'danger',
    plain: 'The time-limited authorization for this action is past its deadline.',
    detail: 'Some transaction authorization schemes include a time window. If the current block timestamp is past the validUntil time embedded in the transaction, it will be rejected. This is common with session keys in smart accounts.',
    example: 'A trading session key set to expire at midnight is used at 12:05 AM.',
    reference: 'ERC-4337 validity range — https://eips.ethereum.org/EIPS/eip-4337#useroperation',
  },
  {
    id: 'use_priority_lane',
    name: 'Use the priority lane',
    severity: 'warning',
    plain: 'You could protect this transaction by paying a small speed fee.',
    detail: 'Arbitrum One has a feature called Timeboost — a priority lane that gives transactions a 200ms advantage over the standard queue. In competitive scenarios (like token launches or liquidations), this advantage can mean the difference between your transaction succeeding and being beaten by a faster bot. ArbiSim calculates whether the extra fee is worth paying.',
    example: 'Claiming a yield farming reward where bots compete to be first.',
    reference: 'Timeboost — https://docs.arbitrum.io/how-arbitrum-works/timeboost',
  },
  {
    id: 'compute_limit_exceeded',
    name: 'Smart contract hit its compute limit',
    severity: 'danger',
    plain: 'The contract would run out of compute budget mid-execution.',
    detail: 'Arbitrum Stylus allows smart contracts written in Rust, C, or C++ that compile to WebAssembly. These contracts use an "ink" compute budget rather than gas. If your transaction calls a Stylus contract that would exceed its ink limit, it runs out of budget mid-execution and fails — similar to running out of gas in a regular contract.',
    example: 'Calling a complex Stylus DeFi contract with a transaction that triggers deep recursive logic.',
    reference: 'Arbitrum Stylus — https://docs.arbitrum.io/stylus/stylus-gentle-introduction',
  },
  {
    id: 'untrusted_counterparty',
    name: 'Untrusted counterparty',
    severity: 'danger',
    plain: 'The address you are interacting with has a low or unknown trust score.',
    detail: 'ERC-8004 defines an on-chain reputation system for AI agents. ArbiSim checks the destination address against this registry. A low score (below 50/100) or an unregistered address means the counterparty has not established a verifiable history of safe interactions. This is particularly important for agent-to-agent payment flows.',
    example: 'An AI agent receiving a payment has no on-chain reputation history.',
    reference: 'ERC-8004 Agent Reputation — https://eips.ethereum.org/EIPS/eip-8004',
  },
  {
    id: 'payment_unverified',
    name: 'Payment destination unknown',
    severity: 'danger',
    plain: 'You are sending a payment to an unverified recipient.',
    detail: 'The x402 payment protocol enables machine-to-machine payments where AI agents pay for services. ArbiSim checks both the reputation of the recipient and whether the payment amount is proportional to what was agreed. This flag fires when the recipient address has no verifiable track record in agent payment flows.',
    example: 'An agent receiving payment for an API service has no previous transactions recorded.',
    reference: 'x402 Payment Protocol — https://x402.org',
  },
];

const colors = {
  danger:  { badge: 'bg-red-950/50 border-red-800/30 text-red-400', dot: 'bg-red-400' },
  warning: { badge: 'bg-amber-950/40 border-amber-800/30 text-amber-400', dot: 'bg-amber-400' },
};

export default function WhatItChecksPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">How It Works</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">What ArbiSim checks</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">ArbiSim runs 10 independent safety checks on every transaction. Any single check can block execution. Here is exactly what each one means, in plain English.</p>

      <div className="space-y-6">
        {checks.map((check, i) => {
          const c = colors[check.severity as keyof typeof colors];
          return (
            <div key={check.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-elevated/50">
                <span className="w-6 h-6 rounded-full border border-border bg-base text-xs font-mono text-text-tertiary flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <h3 className="text-text-primary font-semibold text-sm flex-1">{check.name}</h3>
                <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${c.badge}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot} mr-1.5`} />
                  {check.severity}
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="rounded-lg border border-teal/15 bg-teal/5 px-4 py-2.5">
                  <p className="text-teal text-sm">{check.plain}</p>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">{check.detail}</p>
                <div className="flex gap-6 text-xs">
                  <div>
                    <p className="text-text-tertiary mb-1 font-mono uppercase tracking-wider text-[10px]">Example</p>
                    <p className="text-text-secondary italic">{check.example}</p>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary border-t border-border pt-3">
                  <span className="font-mono uppercase tracking-wider text-[10px] mr-2">Reference</span>
                  <a href={check.reference.split(' — ')[1]} target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">{check.reference.split(' — ')[0]} ↗</a>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 pt-6 border-t border-border flex gap-4">
        <Link href="/docs/quickstart" className="text-sm text-coral hover:underline">← Back to Quickstart</Link>
        <Link href="/docs/chains" className="text-sm text-coral hover:underline ml-auto">Supported chains →</Link>
      </div>
    </article>
  );
}
