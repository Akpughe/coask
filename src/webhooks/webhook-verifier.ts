import crypto from 'crypto';
import { logger } from '../utils/logger';
import { WebhookVerification } from './webhook-types';

/**
 * Webhook Verifier
 * Verifies webhook signatures from different sources
 */
export class WebhookVerifier {
  /**
   * Verify GitHub webhook signature
   * Uses HMAC SHA-256
   */
  verifyGitHub(payload: string, signature: string, secret: string): WebhookVerification {
    try {
      if (!signature || !signature.startsWith('sha256=')) {
        return {
          verified: false,
          error: 'Invalid signature format',
        };
      }

      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(payload).digest('hex');

      // Constant-time comparison to prevent timing attacks
      if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        logger.debug('GitHub webhook signature verified');
        return { verified: true, source: 'github' };
      }

      return {
        verified: false,
        error: 'Signature mismatch',
      };
    } catch (error: any) {
      logger.error('GitHub webhook verification failed', error);
      return {
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify Slack webhook signature
   * Uses HMAC SHA-256 with timestamp
   */
  verifySlack(
    payload: string,
    timestamp: string,
    signature: string,
    secret: string
  ): WebhookVerification {
    try {
      if (!signature || !signature.startsWith('v0=')) {
        return {
          verified: false,
          error: 'Invalid signature format',
        };
      }

      // Check timestamp to prevent replay attacks (5 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp, 10);

      if (Math.abs(currentTime - requestTime) > 60 * 5) {
        return {
          verified: false,
          error: 'Request timestamp too old',
        };
      }

      // Verify signature
      const sigBasestring = `v0:${timestamp}:${payload}`;
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'v0=' + hmac.update(sigBasestring).digest('hex');

      if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        logger.debug('Slack webhook signature verified');
        return { verified: true, source: 'slack' };
      }

      return {
        verified: false,
        error: 'Signature mismatch',
      };
    } catch (error: any) {
      logger.error('Slack webhook verification failed', error);
      return {
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify custom webhook with simple HMAC SHA-256
   */
  verifyCustom(payload: string, signature: string, secret: string): WebhookVerification {
    try {
      if (!signature) {
        // If no signature provided but no secret required, allow
        if (!secret) {
          logger.debug('Custom webhook - no verification required');
          return { verified: true, source: 'custom' };
        }

        return {
          verified: false,
          error: 'Signature required but not provided',
        };
      }

      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(payload).digest('hex');

      if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        logger.debug('Custom webhook signature verified');
        return { verified: true, source: 'custom' };
      }

      return {
        verified: false,
        error: 'Signature mismatch',
      };
    } catch (error: any) {
      logger.error('Custom webhook verification failed', error);
      return {
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook based on source type
   */
  verify(
    source: string,
    payload: string,
    headers: Record<string, string>,
    secret: string
  ): WebhookVerification {
    switch (source.toLowerCase()) {
      case 'github':
        return this.verifyGitHub(payload, headers['x-hub-signature-256'] || '', secret);

      case 'slack':
        return this.verifySlack(
          payload,
          headers['x-slack-request-timestamp'] || '',
          headers['x-slack-signature'] || '',
          secret
        );

      case 'custom':
        return this.verifyCustom(payload, headers['x-webhook-signature'] || '', secret);

      default:
        logger.warn('Unknown webhook source, skipping verification', { source });
        return { verified: true, source: 'unknown' };
    }
  }
}

export const webhookVerifier = new WebhookVerifier();
