import { NextResponse } from "next/server";

/** The stable error codes of a Route Handler (`.claude/rules/backend.md`). */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

interface ApiErrorDetail {
  field: string;
  issue: string;
}

/** The standardized error body with its status. Never carries a stack trace or a raw database error. */
export function apiError(code: ApiErrorCode, message: string, details?: ApiErrorDetail[]) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  );
}
