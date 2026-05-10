import { NextRequest } from 'next/server';
import { listOperatorResultsSince } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const callId = Number(params.id);
  const encoder = new TextEncoder();
  let lastId = Math.max(0, Number(request.nextUrl.searchParams.get('after') ?? 0));
  let closed = false;

  request.signal.addEventListener('abort', () => { closed = true; });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      while (!closed) {
        const newResults = listOperatorResultsSince(callId, lastId);

        for (const row of newResults) {
          send({ type: 'operator_result', data: { ...row, payload: JSON.parse(row.payload) } });
          lastId = row.id;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
