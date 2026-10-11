import { Composition } from "remotion";
import { Film } from "./Film";
import { FPS, DURATION } from "./theme";

export const Root = () => (
  <Composition id="Film" component={Film} width={1920} height={1080} fps={FPS} durationInFrames={DURATION} />
);
