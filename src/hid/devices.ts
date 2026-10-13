import { Hero68, PRODUCT_ID, VENDOR_ID } from "./hero68";
import { REPORT_ID } from "./protocol";
import { HidTransport } from "./transport";

export const HID_FILTERS: HIDDeviceFilter[] = [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }];

export const isWebHidSupported = () => typeof navigator !== "undefined" && "hid" in navigator;

/** The keyboard exposes several HID interfaces; only one carries the vendor report 9. */
const isConfigInterface = (device: HIDDevice) =>
  device.vendorId === VENDOR_ID &&
  device.productId === PRODUCT_ID &&
  device.collections.some((collection) => collection.outputReports?.some((report) => report.reportId === REPORT_ID));

/** Opens the browser picker. Resolves to null when the user cancels. */
export async function requestKeyboard(): Promise<HIDDevice | null> {
  const devices = await navigator.hid.requestDevice({ filters: HID_FILTERS });
  return devices.find(isConfigInterface) ?? null;
}

/** A keyboard the user already granted access to on a previous visit. */
export async function findGrantedKeyboard(): Promise<HIDDevice | null> {
  if (!isWebHidSupported()) return null;
  const devices = await navigator.hid.getDevices();
  return devices.find(isConfigInterface) ?? null;
}

export async function openKeyboard(device: HIDDevice): Promise<Hero68> {
  if (!device.opened) await device.open();
  return new Hero68(new HidTransport(device));
}

export async function closeKeyboard(keyboard: Hero68) {
  keyboard.transport.dispose();
  if (keyboard.device.opened) await keyboard.device.close();
}

/** Calls back when the given device is unplugged. Returns an unsubscribe function. */
export function onDisconnect(device: HIDDevice, callback: () => void): () => void {
  const listener = (event: HIDConnectionEvent) => {
    if (event.device === device) callback();
  };
  navigator.hid.addEventListener("disconnect", listener);
  return () => navigator.hid.removeEventListener("disconnect", listener);
}

/** Calls back when a granted keyboard is plugged in (e.g. after a polling-rate change re-enumerates it). */
export function onConnect(callback: (device: HIDDevice) => void): () => void {
  const listener = (event: HIDConnectionEvent) => {
    if (isConfigInterface(event.device)) callback(event.device);
  };
  navigator.hid.addEventListener("connect", listener);
  return () => navigator.hid.removeEventListener("connect", listener);
}
