import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { getSimulation } from '../db.js';
import { CHAIN_REGISTRY } from '../chain-config.js';

const router = Router();

interface TrustFeedCache {
  data: {
    totalAttestations: number;
    countersByChain: Record<string, number>;
    verdicts: any[];
  };
  fetchedAt: number;
}

let feedCache: TrustFeedCache | null = null;
const CACHE_TTL_MS = 30000; // 30-second TTL
let activeFetchPromise: Promise<any> | null = null;

const START_BLOCKS: Record<string, number> = {
  'arbitrum-one': 223000000,
  'arbitrum-sepolia': 56000000,
  'avalanche-mainnet': 53000000,
  'avalanche-fuji': 32000000,
};

const registryInterface = new ethers.Interface([
  'event SimulationLogged(bytes32 indexed sessionId, address indexed agent, bool safeToExecute, uint16 flagsBitmap, uint32 chainId)',
  'event SimulationLogged(bytes32 indexed sessionId, address indexed agent, bool safeToExecute, uint16 flagsBitmap, uint32 chainId, bytes32 evidenceHash)',
  'function totalSimulations() view returns (uint256)',
  'function getRecord(bytes32 sessionId) view returns ((address agent, bytes32 txHash, bool safeToExecute, uint16 flagsBitmap, uint64 gasEstimate, uint32 chainId, uint32 timestamp, bytes32 evidenceHash) record, string revertReason)'
]);

/**
 * @openapi
 * /api/v1/verdicts/trust-feed:
 *   get:
 *     summary: Retrieve aggregated on-chain log feed of safety verdicts
 *     description: Cached public route to retrieve historical verdict audits from Arbitrum and Avalanche without hitting RPC rate-limits.
 */
router.get('/trust-feed', async (req: Request, res: Response): Promise<void> => {
  try {
    if (feedCache && Date.now() - feedCache.fetchedAt < CACHE_TTL_MS) {
      res.json(feedCache.data);
      return;
    }

    if (activeFetchPromise) {
      const data = await activeFetchPromise;
      res.json(data);
      return;
    }

    activeFetchPromise = (async () => {
      const activeChains = Object.entries(CHAIN_REGISTRY).filter(([_, config]) => !!config.registryAddress);
      
      let grandTotal = 0;
      const counters: Record<string, number> = {};
      const allVerdicts: any[] = [];

      await Promise.all(
        activeChains.map(async ([networkKey, chain]) => {
          try {
            const provider = new ethers.JsonRpcProvider(chain.rpcUrl, undefined, {
              staticNetwork: true,
            });
            const registryAddress = chain.registryAddress!;
            const contract = new ethers.Contract(registryAddress, registryInterface, provider);

            // 1. Fetch total simulations count
            let total = 0;
            try {
              const count = await contract.totalSimulations();
              total = Number(count);
            } catch (e) {
              console.error(`totalSimulations failed for ${networkKey}:`, e);
            }
            counters[networkKey] = total;
            grandTotal += total;

            // 2. Fetch raw event logs
            const startBlock = START_BLOCKS[networkKey] || 0;
            const rawLogs = await provider.getLogs({
              address: registryAddress,
              fromBlock: startBlock,
            });

            for (const log of rawLogs) {
              try {
                const parsed = registryInterface.parseLog({
                  topics: log.topics as string[],
                  data: log.data,
                });
                if (parsed && parsed.name === 'SimulationLogged') {
                  const { sessionId, agent, safeToExecute, flagsBitmap, chainId, evidenceHash } = parsed.args;

                  // Format 32-byte hex value to standard UUID string
                  const cleanSession = sessionId.startsWith('0x') ? sessionId.slice(2) : sessionId;
                  const uuidSession = `${cleanSession.slice(0, 8)}-${cleanSession.slice(8, 12)}-${cleanSession.slice(12, 16)}-${cleanSession.slice(16, 20)}-${cleanSession.slice(20, 32)}`;

                  allVerdicts.push({
                    sessionId: uuidSession,
                    agent: agent.toLowerCase(),
                    safeToExecute,
                    flagsBitmap: Number(flagsBitmap),
                    chainId: Number(chainId),
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    networkKey,
                    version: evidenceHash ? 3 : 2,
                    evidenceHash: evidenceHash || null,
                  });
                }
              } catch (errLog) {
                // Topic mismatch or parsing error
              }
            }
          } catch (chainErr) {
            console.error(`Failed to process logs for chain ${networkKey}:`, chainErr);
          }
        })
      );

      // Sort verdicts by block number descending (most recent first)
      allVerdicts.sort((a, b) => Number(b.blockNumber - a.blockNumber));

      // Fetch block timestamps for the top 15 records in the list
      const topVerdicts = allVerdicts.slice(0, 15);
      await Promise.all(
        topVerdicts.map(async (v) => {
          try {
            const chain = CHAIN_REGISTRY[v.networkKey];
            const provider = new ethers.JsonRpcProvider(chain.rpcUrl, undefined, {
              staticNetwork: true,
            });
            const contract = new ethers.Contract(chain.registryAddress!, registryInterface, provider);

            const cleanUuid = v.sessionId.replace(/-/g, '');
            const hexSessionId = `0x${cleanUuid.padEnd(64, '0')}`;

            const recordData = await contract.getRecord(hexSessionId);
            v.timestamp = Number(recordData.record.timestamp);
          } catch (e) {
            console.warn(`Failed to fetch record timestamp for session ${v.sessionId}:`, e);
          }
        })
      );

      const aggregated = {
        totalAttestations: grandTotal,
        countersByChain: counters,
        verdicts: allVerdicts,
      };

      feedCache = {
        data: aggregated,
        fetchedAt: Date.now(),
      };

      return aggregated;
    })();

    const result = await activeFetchPromise;
    res.json(result);
  } catch (error) {
    console.error('Failed to retrieve trust feed:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to aggregate trust feed.' } });
  } finally {
    activeFetchPromise = null;
  }
});

/**
 * @openapi
 * /api/v1/verdicts/{sessionId}/evidence:
 *   get:
 *     summary: Retrieve public evidence report and on-chain hash binding for a simulation
 *     description: Unauthenticated endpoint for AI agents and verifiers to audit the safety evidence behind a verdict.
 */
router.get('/:sessionId/evidence', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      res.status(400).json({ error: { code: 'INVALID_SESSION_ID', message: 'Session ID must be a valid UUID.' } });
      return;
    }

    const sim = await getSimulation(sessionId);

    if (!sim) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Simulation session not found.' } });
      return;
    }

    res.json({
      sessionId: sim.session_id,
      network: sim.network,
      status: sim.status,
      evidenceReport: sim.evidence_report || [],
      evidenceHash: sim.evidence_hash || null,
      onchainTxHash: sim.onchain_tx_hash || null,
      createdAt: sim.created_at,
    });
  } catch (error) {
    console.error('Failed to retrieve verdict evidence:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve evidence.' } });
  }
});

export default router;
