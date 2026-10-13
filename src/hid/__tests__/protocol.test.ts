import { describe, expect, it } from "vitest";
import { bitIndexes, buildFrame, checksum, chunk, Cmd, frameData, isValidChecksum, readU16, readU32, u16, u32 } from "../protocol";

describe("frame", () => {
  it("lays out header, data and checksum", () => {
    const frame = buildFrame(Cmd.GET_KEYS, { sub: 2, data: [0x00, 0x01, 0x00, 0x0f] });
    expect(frame.length).toBe(63);
    expect(Array.from(frame.subarray(0, 10))).toEqual([0x83, 2, 0, 1, 0, 4, 0x00, 0x01, 0x00, 0x0f]);
    expect(isValidChecksum(frame)).toBe(true);
  });

  it("matches the official checksum (report id included in the sum)", () => {
    // Official GET_INFO uuid request: [130, 1, 0, 1, 0, 6, 0…]
    const frame = buildFrame(Cmd.GET_INFO, { sub: 1, length: 6 });
    const sum = 9 + 130 + 1 + 1 + 6;
    expect(frame[62]).toBe(255 - (sum % 256));
    expect(checksum(frame)).toBe(frame[62]);
  });

  it("allows a declared length with zeroed data", () => {
    const frame = buildFrame(Cmd.GET_PROFILE, { length: 1 });
    expect(frame[5]).toBe(1);
    expect(frame[6]).toBe(0);
  });

  it("rejects data longer than 56 bytes", () => {
    expect(() => buildFrame(Cmd.SET_KEYS, { data: new Array(57).fill(0) })).toThrow();
  });

  it("trims reply data by byte 5", () => {
    const frame = buildFrame(Cmd.GET_KEYS, { data: [1, 2, 3] });
    expect(Array.from(frameData(frame))).toEqual([1, 2, 3]);
  });
});

describe("bytes", () => {
  it("encodes big-endian integers", () => {
    expect(u16(0x1234)).toEqual([0x12, 0x34]);
    expect(u32(0x0d010000)).toEqual([0x0d, 0x01, 0x00, 0x00]);
    expect(readU16([0x00, 0x63], 0)).toBe(99);
    expect(readU32([0xff, 0xff, 0xff, 0xff], 0)).toBe(0xffffffff);
  });

  it("chunks and reads bitfields", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(bitIndexes([0b101, 0b10])).toEqual([0, 2, 9]);
  });
});
