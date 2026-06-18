import type { Request } from 'express';

export function getRequestMetadata(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim() || req.ip;

  return {
    ipAddress,
    userAgent: req.headers['user-agent'],
  };
}
