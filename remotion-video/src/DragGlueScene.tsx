import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Timeline (30fps, 280 frames ~9.3s):
// 0–20    Establish: canvas + Polaroid visible, Group 6 loose at bottom-left
// 20–80   Drag: Group 6 moves to right side beneath Polaroid
// 80–112  Adjust: small nudges settling into place
// 112–130 Cursor moves to Glue button
// 130–148 Tap Glue: button pulses
// 148–165 Cursor moves from Glue button to scrap
// 165–170 Tap scrap
// 170–248 Glue animation: sheen pulse, shadow flattens
// 248–280 Hold final state

const SCRAP_START_X = -295;
const SCRAP_START_Y = 225;
const SCRAP_END_X = 80;
const SCRAP_END_Y = 62;
const GLUE_BTN_SCREEN_X = 640;
const GLUE_BTN_SCREEN_Y = 612;

export const DragGlueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Group 6 drag ──────────────────────────────────────────────────────────
  const dragProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    from: 0,
    to: 1,
    config: { damping: 16, stiffness: 65, mass: 1 },
    durationInFrames: 60,
  });

  const adjustX = interpolate(
    frame,
    [80, 90, 98, 106, 112],
    [0, -14, 10, -6, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const adjustY = interpolate(
    frame,
    [80, 92, 102, 112],
    [0, -8, 5, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const scrapX =
    interpolate(dragProgress, [0, 1], [SCRAP_START_X, SCRAP_END_X]) + adjustX;
  const scrapY =
    interpolate(dragProgress, [0, 1], [SCRAP_START_Y, SCRAP_END_Y]) + adjustY;

  const scrapRotation = interpolate(
    frame,
    [0, 30, 60, 80, 112],
    [-6, -9, -5, -3, -3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Glue-down (starts frame 170) ──────────────────────────────────────────
  const glueProgress = spring({
    frame: Math.max(0, frame - 170),
    fps,
    from: 0,
    to: 1,
    config: { damping: 24, stiffness: 40, mass: 0.9 },
    durationInFrames: 80,
  });

  const shadowBlur = interpolate(glueProgress, [0, 1], [28, 4]);
  const shadowOffsetY = interpolate(glueProgress, [0, 1], [18, 2]);
  const shadowOpacity = interpolate(glueProgress, [0, 1], [0.45, 0.18]);
  const glueScale = interpolate(glueProgress, [0, 0.4, 1], [1, 0.965, 1]);

  const sheenOpacity = interpolate(
    frame,
    [170, 192, 218, 250],
    [0, 0.65, 0.65, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Glue button ───────────────────────────────────────────────────────────
  const glueButtonScale = interpolate(
    frame,
    [130, 137, 142, 150],
    [1, 0.82, 1.12, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const glueButtonGlow = interpolate(
    frame,
    [130, 140, 154],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Cursor ────────────────────────────────────────────────────────────────
  const SCRAP_SCREEN_X = 640 + SCRAP_END_X;
  const SCRAP_SCREEN_Y = 360 + SCRAP_END_Y;

  // Phase 1 (0–112f): follows the dragging scrap
  const cursorFollowX = 640 + scrapX;
  const cursorFollowY = 360 + scrapY;

  // Phase 2 (112–148f): moves from scrap final pos to glue button
  const moveToGlueProgress = spring({
    frame: Math.max(0, frame - 112),
    fps,
    from: 0,
    to: 1,
    config: { damping: 22, stiffness: 110 },
    durationInFrames: 22,
  });
  const cursorAtGlueX = interpolate(
    moveToGlueProgress,
    [0, 1],
    [SCRAP_SCREEN_X, GLUE_BTN_SCREEN_X]
  );
  const cursorAtGlueY = interpolate(
    moveToGlueProgress,
    [0, 1],
    [SCRAP_SCREEN_Y, GLUE_BTN_SCREEN_Y]
  );

  // Phase 3 (148–170f): moves from glue button back to scrap
  const moveToScrapProgress = spring({
    frame: Math.max(0, frame - 148),
    fps,
    from: 0,
    to: 1,
    config: { damping: 22, stiffness: 110 },
    durationInFrames: 20,
  });
  const cursorAtScrapX = interpolate(
    moveToScrapProgress,
    [0, 1],
    [GLUE_BTN_SCREEN_X, SCRAP_SCREEN_X]
  );
  const cursorAtScrapY = interpolate(
    moveToScrapProgress,
    [0, 1],
    [GLUE_BTN_SCREEN_Y, SCRAP_SCREEN_Y]
  );

  const cursorX =
    frame < 112 ? cursorFollowX : frame < 148 ? cursorAtGlueX : cursorAtScrapX;
  const cursorY =
    frame < 112 ? cursorFollowY : frame < 148 ? cursorAtGlueY : cursorAtScrapY;

  const cursorOpacity = interpolate(
    frame,
    [15, 22, 170, 182],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Tap presses: glue button (~130f) and scrap (~165f)
  const cursorScale = interpolate(
    frame,
    [130, 136, 142, 165, 169, 174],
    [1, 0.62, 1, 1, 0.62, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const pageBrightness = interpolate(frame, [0, 20], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#c8b89a" }}>
      {/* Desk texture */}
      <AbsoluteFill>
        <img
          src={staticFile("desk-texture.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.7,
          }}
        />
      </AbsoluteFill>

      {/* Scrapbook page */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: `brightness(${pageBrightness})`,
        }}
      >
        <img
          src={staticFile("scrapbook_cover.png")}
          style={{
            width: 700,
            height: "auto",
            borderRadius: 4,
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          }}
        />
      </AbsoluteFill>

      {/* Polaroid — pre-glued on page */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={staticFile("Poloroid.png")}
          style={{
            width: 200,
            height: "auto",
            transform: "translate(-30px, -85px) rotate(4deg)",
            filter: "drop-shadow(0px 2px 5px rgba(0,0,0,0.22))",
          }}
        />
      </AbsoluteFill>

      {/* Group 6 — dragged in and glued */}
      <AbsoluteFill
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${scrapX}px), calc(-50% + ${scrapY}px)) rotate(${scrapRotation}deg) scale(${glueScale})`,
          }}
        >
          {sheenOpacity > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at 40% 40%, rgba(255,255,220,0.9) 0%, rgba(200,240,160,0.5) 50%, transparent 80%)",
                opacity: sheenOpacity,
                borderRadius: 4,
                mixBlendMode: "screen",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
          )}
          <img
            src={staticFile("Group 6.png")}
            style={{
              width: 220,
              height: "auto",
              display: "block",
              filter: `drop-shadow(0px ${shadowOffsetY}px ${shadowBlur}px rgba(0,0,0,${shadowOpacity}))`,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Glue button (bottom toolbar) */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: "50%",
            transform: `translateX(-50%) scale(${glueButtonScale})`,
            transformOrigin: "bottom center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(255,255,255,0.92)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 16px rgba(0,0,0,0.18), 0 0 0 ${interpolate(
                glueButtonGlow,
                [0, 1],
                [0, 8]
              )}px rgba(180,140,70,${(glueButtonGlow * 0.55).toFixed(2)})`,
            }}
          >
            <img
              src={staticFile("Glue.png")}
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
          </div>
        </div>
      </AbsoluteFill>

      {/* Touch cursor */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: cursorX - 22,
            top: cursorY - 22,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.88)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.28)",
            opacity: cursorOpacity,
            transform: `scale(${cursorScale})`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
