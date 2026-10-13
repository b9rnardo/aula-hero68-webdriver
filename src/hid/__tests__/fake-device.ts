import { PAYLOAD_LENGTH, REPORT_ID, checksum } from "../protocol";

/** Minimal HIDDevice stand-in: answers each output report with `respond(frame)`. */
export function fakeDevice(respond: (frame: Uint8Array) => number[] | Uint8Array | null) {
  const target = new EventTarget();
  const sent: Uint8Array[] = [];
  const device = Object.assign(target, {
    opened: true,
    vendorId: 0x372e,
    productId: 0x103e,
    productName: "HERO 68 HE",
    collections: [],
    async sendReport(reportId: number, data: BufferSource) {
      const frame = new Uint8Array(data as ArrayBuffer);
      sent.push(frame);
      const reply = respond(frame);
      if (!reply) return;
      const out = new Uint8Array(PAYLOAD_LENGTH);
      out.set(reply);
      out[PAYLOAD_LENGTH - 1] = checksum(out);
      queueMicrotask(() =>
        target.dispatchEvent(Object.assign(new Event("inputreport"), { reportId, data: new DataView(out.buffer) })),
      );
    },
  });
  return { device: device as unknown as HIDDevice, sent, reportId: REPORT_ID };
}

/** Reply header echoing the request: cmd, sub, type, total, index, length. */
export const header = (request: Uint8Array, length: number) => [request[0], request[1], request[2], request[3], request[4], length];
