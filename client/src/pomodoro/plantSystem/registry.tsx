import React from "react";
import type { PlantDefinition } from "../types";
import { Sprout, Flower, Trees, Leaf } from "lucide-react";

// Helper för att skapa enkla stadier med Lucide-ikoner
const createSimpleStages = (color: string) => [
  {
    stageIndex: 0,
    render: (
      <div
        style={{
          width: 12,
          height: 12,
          background: "#554b41",
          borderRadius: "50%",
        }}
      />
    ),
  }, // Frö
  { stageIndex: 1, render: <Sprout size={24} color="#84cc16" /> },
  { stageIndex: 2, render: <Sprout size={40} color="#84cc16" /> },
  { stageIndex: 3, render: <Leaf size={48} color={color} /> },
  { stageIndex: 4, render: <Flower size={56} color={color} /> },
  { stageIndex: 5, render: <Trees size={72} color={color} /> }, // Fullvuxen
];

export const PLANTS: Record<string, PlantDefinition> = {
  sunflower: {
    id: "sunflower",
    name: "Solros",
    stages: createSimpleStages("#eab308"),
  },
  tulip: {
    id: "tulip",
    name: "Tulpan",
    stages: createSimpleStages("#ef4444"),
  },
  cactus: {
    id: "cactus",
    name: "Kaktus",
    stages: createSimpleStages("#10b981"),
  },
  rose: {
    id: "rose",
    name: "Ros",
    stages: createSimpleStages("#f43f5e"),
  },
};

export const getRandomPlantId = () => {
  const keys = Object.keys(PLANTS);
  return keys[Math.floor(Math.random() * keys.length)];
};

export const getPlant = (id: string) => PLANTS[id] || PLANTS["sunflower"];
