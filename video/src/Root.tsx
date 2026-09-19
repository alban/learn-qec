import React from 'react';
import { Composition } from 'remotion';
import { ShorCodeExplainer } from './compositions/ShorCodeExplainer';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ShorCodeExplainer"
        component={ShorCodeExplainer}
        durationInFrames={450} // 15 seconds at 30 FPS
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
