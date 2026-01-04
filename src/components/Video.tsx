import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPipButton,
  MediaPlayButton,
  MediaPlaybackRateButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import React from "react";
import ReactPlayer from "react-player";

const BaseURL = encodeURI(
  "https://pub-868cc8261ed54a608c02d025c56645a8.r2.dev/",
);

type VideoProps = {
  url: string;
  bypass: boolean;
  frameRate?: number;
};

export const Video = React.forwardRef<any, VideoProps>(
  ({ url, bypass, frameRate }, ref) => {
    return (
      <MediaController
        ref={ref}
        style={{
          aspectRatio: "16/9",
          width: "100%",
        }}
      >
        <ReactPlayer
          crossOrigin="anonymous"
          playsInline
          slot="media"
          src={bypass ? url : BaseURL + url}
          style={{
            height: "100%",
            width: "100%",
          }}
        />
        <MediaControlBar>
          <MediaPlayButton />
          <MediaSeekBackwardButton
            seekOffset={frameRate ? 1 / frameRate : 0.04}
          >
            <span
              className="mx-1 border-1 border-white px-1 text-xs"
              slot="icon"
            >
              &#60;1f
            </span>
          </MediaSeekBackwardButton>
          <MediaSeekForwardButton seekOffset={frameRate ? 1 / frameRate : 0.04}>
            <span
              className="mx-1 border-1 border-white px-1 text-xs"
              slot="icon"
            >
              1f&#62;
            </span>
          </MediaSeekForwardButton>
          <MediaTimeRange />
          <MediaTimeDisplay showDuration />

          <MediaMuteButton />
          <MediaVolumeRange />
          <MediaPlaybackRateButton rates={[0.25, 0.5, 0.75, 1]} />
          <MediaFullscreenButton />
          {/* <MediaPipButton /> */}
        </MediaControlBar>
      </MediaController>
    );
  },
);
