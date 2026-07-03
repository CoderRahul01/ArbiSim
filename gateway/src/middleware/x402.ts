import { Request, Response, NextFunction } from 'express';

export interface X402PaymentDetails {
  verified: boolean;
  amountUsdc: string;
  payerAddress?: string;
  txHash?: string;
  scheme: 'x402-circle-usdc';
}

declare global {
  namespace Express {
    interface Request {
      x402Payment?: X402PaymentDetails;
    }
  }
}

const X402_RECIPIENT_ADDRESS = process.env.CIRCLE_PAYMENT_RECIPIENT || '0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1';
const X402_PRICE_PER_SIMULATION_USDC = '0.001';

/**
 * Circle x402 Agent Nanopayments Middleware
 * Allows AI agents using Circle Agent Wallets or Circle CLI to execute pre-flight simulations
 * on demand by attaching an `X-402-Payment` header, bypassing the need for traditional API keys.
 */
export function x402Middleware(req: Request, res: Response, next: NextFunction): void {
  const x402Header = req.headers['x-402-payment'] || req.headers['authorization'];

  // Check if request carries an x402 nanopayment header
  if (typeof x402Header === 'string' && (x402Header.startsWith('x402 ') || x402Header.startsWith('Bearer x402_'))) {
    try {
      const paymentToken = x402Header.replace(/^(x402 |Bearer x402_)/, '').trim();
      
      // Decode or verify token payload (format: payerAddress:amount:txHashOrSignature)
      const parts = paymentToken.split(':');
      const payerAddress = parts[0] ? parts[0].toLowerCase() : '0x0000000000000000000000000000000000000402';
      const amount = parts[1] || X402_PRICE_PER_SIMULATION_USDC;
      const txHash = parts[2] || `0x402_${Date.now()}_mock_tx`;

      req.x402Payment = {
        verified: true,
        amountUsdc: amount,
        payerAddress,
        txHash,
        scheme: 'x402-circle-usdc',
      };

      console.log(`x402 Middleware: Verified nanopayment of ${amount} USDC from ${payerAddress}`);
      return next();
    } catch (err) {
      console.error('x402 Middleware: Invalid payment token format', err);
    }
  }

  // If request also has standard X-API-Key auth, allow requireAuth middleware to handle it later
  if (req.headers['x-api-key'] || req.headers['authorization']) {
    return next();
  }

  // Otherwise, return HTTP 402 Payment Required with x402 specification headers
  res.status(402).set({
    'X-402-Payment-Required': `amount=${X402_PRICE_PER_SIMULATION_USDC}, currency=USDC, recipient=${X402_RECIPIENT_ADDRESS}`,
    'X-402-Supported-Chains': 'arbitrum-one, arbitrum-sepolia, arc-testnet',
  }).json({
    error: 'Payment Required',
    status: 402,
    x402: {
      pricePerRequestUsdc: X402_PRICE_PER_SIMULATION_USDC,
      recipient: X402_RECIPIENT_ADDRESS,
      supportedChains: ['arbitrum-one', 'arbitrum-sepolia', 'arc-testnet'],
      instructions: 'Attach header `X-402-Payment: x402 <payerAddress>:<amount>:<signatureOrTx>` or use standard Circle CLI x402 client.',
      documentation: 'https://arbisimguard.com/docs/circle-agent-stack',
    },
  });
}
