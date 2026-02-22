export const BACKGROUNDS = [
  { level: 1, value: "#1e1e24", name: "Default Dark" },
  { level: 2, value: "#252525", name: "Charcoal" },
  {
    level: 3,
    value: "linear-gradient(to bottom right, #1e1e24, #2a2a35)",
    name: "Subtle Gradient",
  },
  { level: 4, value: "#1a1a2e", name: "Midnight Blue" },
  {
    level: 5,
    value: "linear-gradient(to bottom right, #2c3e50, #000000)",
    name: "Dark Knight",
  },
  {
    level: 6,
    value: "linear-gradient(to bottom right, #1a1a2e, #312e81)",
    name: "Deep Space",
  },
  { level: 7, value: "#0f172a", name: "Slate" },
  {
    level: 8,
    value: "linear-gradient(to bottom right, #232526, #414345)",
    name: "Metal",
  },
  {
    level: 9,
    value: "linear-gradient(to bottom right, #0f172a, #1e293b)",
    name: "Slate Night",
  },
  { level: 10, value: "#271a35", name: "Deep Purple" },
  {
    level: 11,
    value: "linear-gradient(to bottom right, #000428, #004e92)",
    name: "Frost",
  },
  {
    level: 12,
    value: "linear-gradient(to bottom right, #271a35, #4c1d95)",
    name: "Royal Purple",
  },
  { level: 13, value: "#141e30", name: "Navy" },
  {
    level: 14,
    value: "linear-gradient(to bottom right, #43cea2, #185a9d)",
    name: "Sea",
  },
  {
    level: 15,
    value: "linear-gradient(to bottom right, #000000, #434343)",
    name: "Obsidian",
  },
  {
    level: 16,
    value: "linear-gradient(to bottom right, #4b6cb7, #182848)",
    name: "Ocean",
  },
  { level: 17, value: "#3a1c71", name: "Plum" },
  {
    level: 18,
    value: "linear-gradient(to bottom right, #ff512f, #dd2476)",
    name: "Sunset",
  },
  {
    level: 19,
    value: "linear-gradient(to bottom right, #e55d87, #5fc3e4)",
    name: "Rose Water",
  },
  {
    level: 20,
    value: "linear-gradient(to bottom right, #141e30, #243b55)",
    name: "Midnight City",
  },
];

export const getBackgroundForLevel = (level: number) => {
  // Hitta den högsta upplåsta bakgrunden
  const unlocked = BACKGROUNDS.filter((bg) => level >= bg.level);
  return unlocked[unlocked.length - 1].value;
};

export const getNextUnlock = (level: number) => {
  return BACKGROUNDS.find((bg) => bg.level > level);
};
