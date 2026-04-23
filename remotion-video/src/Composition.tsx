import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Timeline (at 30fps):
// 0–40    scrap falls in from above
// 40–70   scrap settles with a soft bounce
// 70–130  glue bottle enters, traces around scrap edges
// 130–180 scrap glues down (shadow flattens, glue sheen fades)

export const GlueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── scrap drop-in ────────────────────────────────────────────────────────
  const scrapDropProgress = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 14, stiffness: 80, mass: 1 },
    durationInFrames: 45,
  });

  const scrapY = interpolate(scrapDropProgress, [0, 1], [-420, 0]);
  const scrapRotation = interpolate(scrapDropProgress, [0, 1], [-8, -3]);
  const scrapScale = interpolate(scrapDropProgress, [0, 0.7, 1], [1.1, 0.94, 1]);

  // ── glue-down transition ──────────────────────────────────────────────────
  // starts at frame 130
  const glueProgress = spring({
    frame: Math.max(0, frame - 130),
    fps,
    from: 0,
    to: 1,
    config: { damping: 20, stiffness: 60, mass: 0.8 },
    durationInFrames: 50,
  });

  // shadow lifts while loose, flattens when glued
  const shadowBlur = interpolate(glueProgress, [0, 1], [28, 5]);
  const shadowOffsetY = interpolate(glueProgress, [0, 1], [18, 3]);
  const shadowOpacity = interpolate(glueProgress, [0, 1], [0.45, 0.25]);

  // subtle scale-down as it presses flat
  const glueScale = interpolate(glueProgress, [0, 0.5, 1], [1, 0.98, 1]);

  // glue sheen overlay — fades in then out
  const sheenOpacity = interpolate(
    frame,
    [70, 100, 145, 180],
    [0, 0.55, 0.55, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── glue bottle ───────────────────────────────────────────────────────────
  // enters from right at frame 65, exits at frame 140
  const bottleEnterProgress = spring({
    frame: Math.max(0, frame - 65),
    fps,
    from: 0,
    to: 1,
    config: { damping: 18, stiffness: 100 },
    durationInFrames: 30,
  });

  const bottleExitProgress = spring({
    frame: Math.max(0, frame - 135),
    fps,
    from: 0,
    to: 1,
    config: { damping: 18, stiffness: 120 },
    durationInFrames: 25,
  });

  // Bottle traces a path: enters from right, moves across top-left, exits up
  const bottleEnterX = interpolate(bottleEnterProgress, [0, 1], [340, 60]);
  const bottleExitX = interpolate(bottleExitProgress, [0, 1], [0, -280]);
  const bottleX = bottleEnterX + bottleExitX;

  const bottleEnterY = interpolate(bottleEnterProgress, [0, 1], [-60, 20]);
  const bottleExitY = interpolate(bottleExitProgress, [0, 1], [0, -300]);
  const bottleY = bottleEnterY + bottleExitY;

  // small wobble while gluing
  const wobble = Math.sin(frame * 0.5) * interpolate(frame, [70, 90, 130, 140], [0, 4, 4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const bottleRotation = interpolate(frame, [65, 90, 130, 140], [-40, -25, -35, -60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── background brightness as scrap approaches page ────────────────────────
  const pageBrightness = interpolate(frame, [0, 40], [0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#c8b89a" }}>
      {/* desk texture */}
      <AbsoluteFill>
        <img
          src={staticFile("desk-texture.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}
        />
      </AbsoluteFill>

      {/* scrapbook page */}
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

      {/* scrap with glue shadow transition */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            transform: `translateY(${scrapY}px) rotate(${scrapRotation}deg) scale(${scrapScale * glueScale}) translateX(30px)`,
            position: "relative",
          }}
        >
          {/* glue sheen overlay */}
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
            src={staticFile("scrap_06.png")}
            style={{
              width: 340,
              height: "auto",
              display: "block",
              filter: `drop-shadow(0px ${shadowOffsetY}px ${shadowBlur}px rgba(0,0,0,${shadowOpacity}))`,
              borderRadius: 2,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* glue bottle */}
      {frame >= 65 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={staticFile("Glue.png")}
            style={{
              width: 110,
              height: "auto",
              transform: `translate(${bottleX}px, ${bottleY - 160}px) rotate(${bottleRotation + wobble}deg)`,
              transformOrigin: "center bottom",
              filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.3))",
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
