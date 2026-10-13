import { downloadJson, snapshotFileName, type KeyboardSnapshot } from "../hid/snapshot";
import { useDriver } from "../store/driver";

/** Saves the whole configuration as JSON. */
export const downloadBackup = (snapshot: KeyboardSnapshot) => downloadJson(snapshot, snapshotFileName(snapshot));

/** Asks for a backup file and opens it. */
export function pickBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void useDriver.getState().openBackup(file);
  };
  input.click();
}
