import { PAYLOAD_LENGTH, REPORT_ID } from "./protocol";

export type PacketDirection = "tx" | "rx";
export type PacketListener = (direction: PacketDirection, frame: Uint8Array) => void;
type Match = (frame: Uint8Array) => boolean;

export interface RequestOptions {
  /** Which incoming frame answers this request. Defaults to same command, total and index. */
  match?: Match;
  timeoutMs?: number;
  retries?: number;
}

export class HidTimeoutError extends Error {
  constructor(readonly command: number) {
    super(`no reply to command 0x${command.toString(16).padStart(2, "0")}`);
  }
}

export const sameCommand =
  (request: Uint8Array): Match =>
  (reply) =>
    reply[0] === request[0] && reply[3] === request[3] && reply[4] === request[4];

/**
 * Serializes request/response exchanges over report id 9.
 * Replies that no request is waiting for (live travel, calibration, connection events) go to subscribers.
 */
export class HidTransport {
  private queue: Promise<unknown> = Promise.resolve();
  private waiters = new Set<{ match: Match; resolve: (frame: Uint8Array) => void }>();
  private subscribers = new Set<(frame: Uint8Array) => void>();
  private packetListeners = new Set<PacketListener>();

  constructor(readonly device: HIDDevice) {
    device.addEventListener("inputreport", this.handleInput);
  }

  dispose() {
    this.device.removeEventListener("inputreport", this.handleInput);
    this.waiters.clear();
    this.subscribers.clear();
    this.packetListeners.clear();
  }

  /** Frames not consumed by a pending request. Returns an unsubscribe function. */
  subscribe(listener: (frame: Uint8Array) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /** Every frame sent or received, for the debug log. */
  onPacket(listener: PacketListener): () => void {
    this.packetListeners.add(listener);
    return () => this.packetListeners.delete(listener);
  }

  request(frame: Uint8Array, options: RequestOptions = {}): Promise<Uint8Array> {
    const { match = sameCommand(frame), timeoutMs = 1000, retries = 2 } = options;
    return this.exclusive(async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const reply = this.waitFor(match, timeoutMs);
        await this.write(frame);
        const frameIn = await reply;
        if (frameIn) return frameIn;
      }
      throw new HidTimeoutError(frame[0]);
    });
  }

  /** Fire-and-forget write, still ordered with the other requests. */
  send(frame: Uint8Array): Promise<void> {
    return this.exclusive(() => this.write(frame));
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async write(frame: Uint8Array) {
    if (frame.length !== PAYLOAD_LENGTH) throw new Error(`frame must be ${PAYLOAD_LENGTH} bytes`);
    this.emitPacket("tx", frame);
    await this.device.sendReport(REPORT_ID, frame);
  }

  private waitFor(match: Match, timeoutMs: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const waiter = {
        match,
        resolve: (frame: Uint8Array) => {
          clearTimeout(timer);
          resolve(frame);
        },
      };
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        resolve(null);
      }, timeoutMs);
      this.waiters.add(waiter);
    });
  }

  private handleInput = (event: HIDInputReportEvent) => {
    if (event.reportId !== REPORT_ID) return;
    const frame = new Uint8Array(event.data.buffer.slice(event.data.byteOffset, event.data.byteOffset + event.data.byteLength));
    this.emitPacket("rx", frame);
    for (const waiter of this.waiters) {
      if (waiter.match(frame)) {
        this.waiters.delete(waiter);
        waiter.resolve(frame);
        return;
      }
    }
    for (const subscriber of this.subscribers) subscriber(frame);
  };

  private emitPacket(direction: PacketDirection, frame: Uint8Array) {
    for (const listener of this.packetListeners) listener(direction, frame);
  }
}
