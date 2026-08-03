import { NextResponse } from "next/server";

export type MobileMeta = {
  requestId: string;
  nextCursor?: string | null;
};

function requestId() {
  return crypto.randomUUID();
}

export function jsonOk<T>(data: T, init?: { status?: number; meta?: Partial<MobileMeta> }) {
  const id = init?.meta?.requestId ?? requestId();
  return NextResponse.json(
    {
      data,
      error: null,
      meta: {
        requestId: id,
        nextCursor: init?.meta?.nextCursor ?? null
      }
    },
    { status: init?.status ?? 200 }
  );
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      data: null,
      error: { code, message, ...extra },
      meta: { requestId: requestId(), nextCursor: null }
    },
    { status }
  );
}
