// Magnetic switch catalog from the official driver (table `tl`). Names are product names, kept in English.

export interface SwitchInfo {
  id: number;
  name: string;
  /** Total travel in µm. */
  travelUm: number;
  color: string;
}

export const SWITCHES: SwitchInfo[] = [
  { id: 0, name: "Magnetic White", travelUm: 4000, color: "#52c0f6" },
  { id: 1, name: "Jade Pro", travelUm: 3400, color: "#07fd56" },
  { id: 2, name: "Magnetic Pro", travelUm: 3700, color: "#0000ff" },
  { id: 3, name: "Uranus Gaming", travelUm: 3400, color: "#6363ff" },
  { id: 4, name: "Wing Chun", travelUm: 3400, color: "#c535f8" },
  { id: 5, name: "Magneto King", travelUm: 3400, color: "#01c341" },
  { id: 6, name: "KTEK", travelUm: 3700, color: "#5050f1" },
  { id: 7, name: "Thunder", travelUm: 3500, color: "#aa27ec" },
  { id: 8, name: "Black King", travelUm: 3400, color: "#b1f835" },
  { id: 9, name: "Heaven King", travelUm: 3400, color: "#28fd7d" },
  { id: 10, name: "PG Powder", travelUm: 3500, color: "#f8e835" },
  { id: 11, name: "Nine Purple", travelUm: 3400, color: "#8a00ff" },
  { id: 12, name: "Blue Jade", travelUm: 3400, color: "#0004ff" },
  { id: 13, name: "Meteor", travelUm: 3400, color: "#8f18ff" },
  { id: 14, name: "Jade King", travelUm: 3400, color: "#ffb500" },
  { id: 15, name: "Dragon King", travelUm: 3400, color: "#0004ff" },
  { id: 16, name: "Jade", travelUm: 3400, color: "#6569f8" },
  { id: 18, name: "Blue Ice", travelUm: 3500, color: "#0066ff" },
  { id: 20, name: "Ice Rhino", travelUm: 3400, color: "#91bbfb" },
  { id: 21, name: "Star", travelUm: 3400, color: "#ff0000" },
  { id: 22, name: "Pink King", travelUm: 3400, color: "#ff0ed6" },
  { id: 24, name: "Jade Emperor", travelUm: 3400, color: "#00ff76" },
  { id: 25, name: "Mini Magnetic King", travelUm: 2800, color: "#6d15ec" },
  { id: 27, name: "Ice King", travelUm: 3300, color: "#5887ff" },
  { id: 28, name: "Mini Pink King", travelUm: 3000, color: "#c815ec" },
  { id: 32, name: "Mini Ice King", travelUm: 3000, color: "#f6efe7" },
  { id: 34, name: "Purple Star", travelUm: 3500, color: "#8400ff" },
  { id: 37, name: "Ash Wood", travelUm: 3400, color: "#c5c5c5" },
  { id: 40, name: "Mini Cha Huang", travelUm: 3000, color: "#839962" },
  { id: 59, name: "Lingyun", travelUm: 3400, color: "#b3e6ff" },
  { id: 60, name: "Xue Shen", travelUm: 3300, color: "#f8f8ff" },
  { id: 61, name: "Nick Magnetic", travelUm: 3400, color: "#ffe4b5" },
  { id: 62, name: "Ice Jade", travelUm: 3400, color: "#e0fff7" },
  { id: 63, name: "Lychee", travelUm: 3300, color: "#f8bbd0" },
  { id: 64, name: "Honey Snow", travelUm: 3400, color: "#f3e6fa" },
  { id: 65, name: "Silver Magnetic", travelUm: 3400, color: "#d1e6f9" },
];

export const switchById = new Map(SWITCHES.map((sw) => [sw.id, sw]));
