import logger from '../utils/logger';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
}

export class RetryService {
  private static instance: RetryService;
  private defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  };

  public static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        logger.debug(`Executing ${operationName}, attempt ${attempt}/${config.maxAttempts}`);
        const result = await operation();

        if (attempt > 1) {
          logger.info(`${operationName} succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`${operationName} failed on attempt ${attempt}`, {
          error: error.message,
          attempt,
          maxAttempts: config.maxAttempts,
        });

        if (attempt === config.maxAttempts) {
          logger.error(`${operationName} failed after ${config.maxAttempts} attempts`, {
            error: error.message,
            operationName,
          });
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);
        logger.debug(`Waiting ${delay}ms before retry for ${operationName}`);

        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`${operationName} failed after ${config.maxAttempts} attempts`);
  }

  private calculateDelay(attempt: number, config: Required<RetryOptions>): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    if (config.jitter) {
      // Add random jitter to prevent thundering herd
      const jitterAmount = cappedDelay * 0.1;
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
      return Math.max(0, cappedDelay + jitter);
    }

    return cappedDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Circuit breaker pattern
  public createCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string,
    failureThreshold: number = 5,
    timeout: number = 60000
  ) {
    let failureCount = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return async (): Promise<T> => {
      const now = Date.now();

      // Check if circuit should be reset
      if (state === 'OPEN' && now - lastFailureTime > timeout) {
        state = 'HALF_OPEN';
        logger.info(`Circuit breaker for ${operationName} moved to HALF_OPEN state`);
      }

      // Reject if circuit is open
      if (state === 'OPEN') {
        throw new Error(`Circuit breaker is OPEN for ${operationName}`);
      }

      try {
        const result = await operation();

        // Reset on success
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failureCount = 0;
          logger.info(`Circuit breaker for ${operationName} moved to CLOSED state`);
        }

        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = now;

        if (failureCount >= failureThreshold) {
          state = 'OPEN';
          logger.error(`Circuit breaker for ${operationName} moved to OPEN state`, {
            failureCount,
            threshold: failureThreshold,
          });
        }

        throw error;
      }
    };
  }

  // Batch processing with retry
  public async processBatchWithRetry<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10,
    options: RetryOptions = {}
  ): Promise<R[]> {
    const results: R[] = [];
    const errors: Array<{ item: T; error: Error }> = [];

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item) => {
        try {
          const result = await this.executeWithRetry(
            () => processor(item),
            `batch-processor-${i}`,
            options
          );
          return { success: true, result, item };
        } catch (error) {
          errors.push({ item, error: error as Error });
          return { success: false, error: error as Error, item };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          results.push(result.value.result);
        }
      }
    }

    if (errors.length > 0) {
      logger.warn(`Batch processing completed with ${errors.length} errors`, {
        totalItems: items.length,
        successfulItems: results.length,
        failedItems: errors.length,
      });
    }

    return results;
  }
}

export const retryService = RetryService.getInstance();
