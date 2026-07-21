/**
 * A handle to a running transport.
 *
 * Every transport starter returns one so the bootstrap can shut the server down
 * gracefully on a termination signal. `close` disconnects the transport and
 * releases its resources; it is idempotent-friendly (safe to await once during
 * shutdown). Both the stdio transport and the future http transport share this
 * shape, keeping the wiring symmetric.
 */
export interface TransportHandle {
  /** Disconnect the transport and stop serving requests. */
  close(): Promise<void>;
}
