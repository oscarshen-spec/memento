import "./index.css";
import { Composition } from "remotion";
import { GlueScene } from "./Composition";
import { DragGlueScene } from "./DragGlueScene";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GlueScene"
        component={GlueScene}
        durationInFrames={210}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="DragGlueScene"
        component={DragGlueScene}
        durationInFrames={280}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
