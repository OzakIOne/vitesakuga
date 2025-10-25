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
import ReactPlayer from "react-player";

const BaseURL = encodeURI(
  "https://pub-868cc8261ed54a608c02d025c56645a8.r2.dev/",
);

export function Video({ url, bypass }: { url: string; bypass: boolean }) {
  return (
    <MediaController
      style={{
        width: "100%",
        aspectRatio: "16/9",
      }}
    >
      <ReactPlayer
        slot="media"
        src={bypass ? url : BaseURL + url}
        controls={false}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
      <MediaControlBar>
        <MediaPlayButton />
        <MediaSeekBackwardButton seekOffset={0.04}>
          <span className="border-white border-1 px-1 mx-1 text-xs" slot="icon">
            &#60;1f
          </span>
        </MediaSeekBackwardButton>
        <MediaSeekForwardButton seekOffset={0.04}>
          <span className="border-white border-1 px-1 mx-1 text-xs" slot="icon">
            1f&#62;
          </span>
        </MediaSeekForwardButton>
        <MediaTimeRange />
        <MediaTimeDisplay showDuration />
        <MediaMuteButton />
        <MediaVolumeRange />
        <MediaPlaybackRateButton rates={[0.25, 0.5, 0.75, 1]} />
        <MediaFullscreenButton />
        <MediaPipButton />
      </MediaControlBar>
    </MediaController>
  );
}
