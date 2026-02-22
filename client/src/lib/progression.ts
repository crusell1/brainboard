// d:\programmering\BrainBoard\client\src\lib\progression.ts

// Formel: Level = floor(sqrt(XP / 100)) + 1
export const getLevelFromXp = (xp: number) =>
  Math.floor(Math.sqrt(xp / 20)) + 1;

// Formel: XP = (Level - 1)^2 * 100
export const getXpForLevel = (level: number) => Math.pow(level - 1, 2) * 20;

export const getProgressToNextLevel = (currentXp: number) => {
  const currentLevel = getLevelFromXp(currentXp);
  const nextLevel = currentLevel + 1;

  const xpForCurrent = getXpForLevel(currentLevel);
  const xpForNext = getXpForLevel(nextLevel);

  const progress = currentXp - xpForCurrent;
  const totalNeeded = xpForNext - xpForCurrent;

  return {
    currentLevel,
    nextLevel,
    progress,
    totalNeeded,
    percentage: Math.min(100, Math.max(0, (progress / totalNeeded) * 100)),
  };
};
