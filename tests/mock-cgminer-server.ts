import net from 'node:net';

export interface MockCgminerServer {
  port: number;
  close: () => Promise<void>;
}

/**
 * Minimal TCP server that emulates a CGMiner API endpoint for transport tests.
 *
 * It accepts a single request per connection, writes a provided response (optionally
 * in chunks), and closes.
 */
export async function startMockCgminerServer(opts: {
  respond: (req: string) => { chunks: Array<string | Buffer>; delayMs?: number } | string | Buffer;
}): Promise<MockCgminerServer> {
  const server = net.createServer((socket) => {
    const reqChunks: Buffer[] = [];
    let responded = false;

    const maybeRespond = async () => {
      if (responded) return;
      responded = true;

      const req = Buffer.concat(reqChunks).toString('utf-8');
      const response = opts.respond(req);

      const resolved =
        typeof response === 'string' || Buffer.isBuffer(response)
          ? { chunks: [response], delayMs: 0 }
          : response;

      const delay = resolved.delayMs ?? 0;

      for (let i = 0; i < resolved.chunks.length; i++) {
        const chunk = resolved.chunks[i]!;
        if (delay > 0 && i > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        socket.write(chunk);
      }
      socket.end();
    };

    socket.on('data', (d) => {
      reqChunks.push(d);
      // CGMiner clients often don't half-close after writing the request.
      // Respond as soon as we have any request bytes.
      void maybeRespond();
    });

    socket.once('end', () => {
      void maybeRespond();
    });

    socket.once('error', () => {
      socket.destroy();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind mock cgminer server');
  }

  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

