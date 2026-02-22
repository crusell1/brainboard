import type { PlantDefinition, PomodoroStatus, PlantDNA } from "../types";

// Hjälpfunktion för att rita olika kronblad
const renderPetal = (shape: PlantDNA["petalShape"], color: string) => {
  switch (shape) {
    case "spiky":
      return <polygon points="-5,0 0,-15 5,0" fill={color} />;
    case "long":
      return <ellipse cx="0" cy="-15" rx="3" ry="15" fill={color} />;
    case "heart":
      return (
        <path d="M0,0 C-5,-10 -10,-15 0,-20 C10,-15 5,-10 0,0" fill={color} />
      );
    case "cup":
      return (
        <path d="M-6,-10 Q0,5 6,-10 Q6,-15 0,-15 Q-6,-15 -6,-10" fill={color} />
      );
    case "star":
      return <polygon points="0,0 -4,-12 0,-20 4,-12" fill={color} />;
    case "wave":
      return (
        <path d="M0,0 Q-8,-10 -4,-20 Q0,-15 4,-20 Q8,-10 0,0" fill={color} />
      );
    case "round":
    default:
      return <ellipse cx="0" cy="-12" rx="5" ry="12" fill={color} />;
  }
};

// Hjälpfunktion för att rita olika löv
const renderLeaf = (type: PlantDNA["leafType"], side: "left" | "right") => {
  const scaleX = side === "left" ? 1 : -1;
  const color = "#34d399"; // Standard lövfärg, kan göras dynamisk senare

  switch (type) {
    case "jagged":
      return (
        <path
          d="M0,0 L-15,-5 L-10,-10 L-20,-15 L0,0"
          fill={color}
          transform={`scale(${scaleX}, 1)`}
        />
      );
    case "clover":
      return (
        <circle cx={-10} cy={-10} r={6} fill={color} transform={`scale(, 1)`} />
      );
    case "long":
      return (
        <path
          d="M0,0 Q-10,-20 -5,-40 Q0,-20 0,0"
          fill={color}
          transform={`scale(, 1)`}
        />
      );
    case "round":
      return (
        <circle cx={-12} cy={-5} r={8} fill={color} transform={`scale(, 1)`} />
      );
    case "simple":
    default:
      return (
        <path
          d="M 0 0 Q -15 -5 -20 -15 Q -5 -15 0 0"
          fill={color}
          opacity="0.8"
          transform={`scale(, 1)`}
        />
      );
  }
};

export const StitchFlower = ({
  progress,
  status,
  dna,
}: {
  progress: number;
  status: PomodoroStatus;
  dna?: PlantDNA | null; // 🔥 FIX: Tillåt null
}) => {
  // SÄKERHET: Defaulta till 1 om progress saknas eller är ogiltig
  const safeProgress = Number.isFinite(progress) ? progress : 1;

  // Om vi saknar DNA (gammal nod eller laddar), rendera inte en "default" blomma.
  // Vi hanterar detta genom att rendera en tom kruka/jord nedan.

  // LOGIK:
  // Work: 1 -> 0 progress => 0 -> 1 growth (Växer upp)
  // Break: 1 -> 0 progress => 1 -> 0 growth (Sjunker ner/vissnar)
  let growth = 0;
  if (status === "work") {
    growth = 1 - safeProgress;
  } else if (status === "break") {
    growth = safeProgress;
  }

  // Clamp growth mellan 0 och 1
  growth = Math.max(0, Math.min(1, growth));

  // SATURATION:
  const saturation = status === "break" ? growth : 1;

  // DIMENSIONER (Styrs av growth och DNA):
  // Säkra mot undefined i DNA
  const stemHeight = growth * (dna?.stemHeight || 0);
  const leafScale = Math.min(1, growth * 1.5) || 0;

  // Blomman kommer sista 30% av growth
  const flowerScaleRaw = growth > 0.7 ? (growth - 0.7) * 3.33 : 0;
  const flowerScale = Math.max(0, flowerScaleRaw) || 0;

  // Visa sparkles endast vid full växt och INTE under rast
  const isFullyGrown = growth >= 0.99 && status !== "break";

  // Generera kronblad baserat på DNA
  const petalCount = Math.max(0, dna?.petals || 0);
  const petals = Array.from({ length: petalCount }).map((_, i) => {
    // Undvik division med 0
    const angle = petalCount > 0 ? (360 / petalCount) * i : 0;
    return (
      <g key={i} transform={`rotate(${angle})`}>
        {dna && renderPetal(dna.petalShape, dna.color)}
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        width: "100%",
        height: "100%",
        overflow: "visible",
        transition: "all 0.5s linear",
        filter: `saturate(${saturation})`,
      }}
    >
      {/* JORD / MARK */}
      <ellipse cx="50" cy="95" rx="20" ry="4" fill="#4b5563" opacity="0.5" />

      {/* FRÖ */}
      <circle
        cx="50"
        cy="95"
        r={Math.max(0, 3 * (1 - growth))}
        fill={dna?.color || "#554b41"} // 🔥 FIX: Neutral färg om DNA saknas (inte lila)
        style={{ transition: "r 0.5s linear" }}
      />

      {/* STAM */}
      <path
        d={`M 50 95 Q 50 80 50 ${95 - stemHeight}`}
        stroke="#10b981"
        strokeWidth={Math.max(0, 3 + growth * 2)}
        fill="none"
        strokeLinecap="round"
        style={{ transition: "d 0.5s linear, stroke-width 0.5s linear" }}
      />

      {/* LÖV */}
      <g
        transform={`translate(50, ${95 - stemHeight * 0.5}) scale(${leafScale})`}
        style={{ transition: "transform 0.5s linear" }}
      >
        {dna && renderLeaf(dna.leafType, "left")}
        {dna && renderLeaf(dna.leafType, "right")}
      </g>

      {/* BLOMMA */}
      <g
        transform={`translate(50, ${95 - stemHeight}) scale(${flowerScale})`}
        style={{
          transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Kronblad */}
        {petals}

        {/* Center */}
        <circle cx="0" cy="0" r="8" fill={dna?.centerColor || "#fbbf24"} />
        <circle cx="0" cy="0" r="6" fill="black" opacity="0.1" />
      </g>

      {/* GLOW / SPARKLE */}
      {isFullyGrown && (
        <g>
          <circle cx="30" cy="20" r="2" fill="white" opacity="0.6" />
          <circle cx="70" cy="30" r="1.5" fill="white" opacity="0.4" />
        </g>
      )}
    </svg>
  );
};

// Behåll den gamla definitionen för bakåtkompatibilitet, men använd nya motorn
export const StitchPlant: PlantDefinition = {
  id: "stitchFlower",
  name: "Stitch Flower",
  stages: [],
  renderContinuous: (progress, status, dna) => (
    <StitchFlower progress={progress} status={status} dna={dna} />
  ),
};
