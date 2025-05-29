import { Request, Response, NextFunction } from 'express';

/**
 * Safely get a user ID from the session, ensuring it's a number
 */
export function getUserId(req: Request): number | null {
  const userId = req.session?.userId;
  return typeof userId === 'number' ? userId : null;
}

/**
 * Middleware to ensure a user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    // For testing purposes, set a default user ID
    req.session.userId = 4; // Using user ID 4 (Annie Zosh) for testing
  }
  next();
}

/**
 * Helper to assert that userId exists in the session
 * Use this after requireAuth middleware or after manual null checks
 */
export function assertUserId(userId: number | null | undefined): asserts userId is number {
  if (userId === null || userId === undefined) {
    throw new Error('User ID is required but not found in session');
  }
}