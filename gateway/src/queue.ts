import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { context, propagation } from '@opentelemetry/api';
import { createSimulation, enqueueSimulation } from './db.js';

const sqsQueueUrl = process.env.AWS_SQS_QUEUE_URL;
const awsRegion = process.env.AWS_REGION || 'us-east-1';

// Initialise SQS Client conditionally
let sqsClient: SQSClient | null = null;
if (sqsQueueUrl && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  sqsClient = new SQSClient({
    region: awsRegion,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
  console.log('SQS Queue initialized successfully.');
} else {
  console.log('No SQS credentials or queue URL provided. Defaulting to PostgreSQL local queue table.');
}

interface SimulatePayload {
  session_id: string;
  network: string;
  agent_address: string;
  transactions: Array<{
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
  }>;
  max_slippage_tolerance: number;
  trace_context?: Record<string, string>;
}

export async function submitSimulationJob(
  sessionId: string,
  network: string,
  agentAddress: string,
  transactions: any[],
  maxSlippageTolerance: number,
  apiKeyId: string | null = null,
  ownerAddress: string | null = null
): Promise<void> {
  const traceCarrier: Record<string, string> = {};
  propagation.inject(context.active(), traceCarrier);

  const payload: SimulatePayload = {
    session_id: sessionId,
    network,
    agent_address: agentAddress,
    transactions,
    max_slippage_tolerance: maxSlippageTolerance,
    trace_context: traceCarrier,
  };

  // 1. Log simulation record in database (NeonDB/Postgres)
  await createSimulation(sessionId, network, agentAddress, apiKeyId, ownerAddress);

  // 2. Put onto SQS or fallback to PostgreSQL local queue table
  if (sqsClient && sqsQueueUrl) {
    try {
      const command = new SendMessageCommand({
        QueueUrl: sqsQueueUrl,
        MessageBody: JSON.stringify(payload),
      });
      await sqsClient.send(command);
      console.log(`Successfully enqueued session ${sessionId} to SQS.`);
      return;
    } catch (err) {
      console.error('Failed to submit simulation to AWS SQS. Falling back to Postgres local queue table.', err);
    }
  }

  // Fallback: Enqueue into local PG queue table
  await enqueueSimulation(sessionId, payload);
  console.log(`Successfully enqueued session ${sessionId} to PostgreSQL local queue.`);
}
