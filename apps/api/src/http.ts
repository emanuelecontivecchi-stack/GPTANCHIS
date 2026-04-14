import type { ApiFailure, ApiResult, ApiSuccess } from "@anchise/contracts";

export interface JsonResponse<T> {
  status: number;
  body: ApiResult<T>;
}

export function ok<T>(data: T, status = 200): JsonResponse<T> {
  const body: ApiSuccess<T> = {
    ok: true,
    data
  };

  return { status, body };
}

export function failure(code: string, message: string, status = 400): JsonResponse<never> {
  const body: ApiFailure = {
    ok: false,
    error: {
      code,
      message
    }
  };

  return { status, body };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRequiredString(
  value: unknown,
  fieldName: string
): string | JsonResponse<never> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return failure("invalid_request", `${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

export function readOptionalString(
  value: unknown,
  fieldName: string
): string | undefined | JsonResponse<never> {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return failure("invalid_request", `${fieldName} must be a string when provided.`);
  }

  return value.trim();
}

export function readRequiredNumber(
  value: unknown,
  fieldName: string
): number | JsonResponse<never> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return failure("invalid_request", `${fieldName} must be a finite number.`);
  }

  return value;
}

export function readOptionalEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[]
): T | undefined | JsonResponse<never> {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return failure(
      "invalid_request",
      `${fieldName} must be one of: ${allowed.join(", ")}.`
    );
  }

  return value as T;
}

export function readRequiredEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[]
): T | JsonResponse<never> {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return failure(
      "invalid_request",
      `${fieldName} must be one of: ${allowed.join(", ")}.`
    );
  }

  return value as T;
}
