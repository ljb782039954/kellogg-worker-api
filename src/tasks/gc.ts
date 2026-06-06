import { Env } from '../types';

/**
 * Weekly Garbage Collection Task
 * [DISABLED] This task is permanently disabled to prevent any potential data loss or orphaned assets mismatches.
 */
export async function runGarbageCollection(env: Env): Promise<void> {
  console.log('[GC] Garbage Collection is currently disabled. No files will be scanned or deleted from R2.');
}
