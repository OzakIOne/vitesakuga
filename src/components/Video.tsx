import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import {
  MediaPlaybackRateMenu,
  MediaPlaybackRateMenuButton,
} from "media-chrome/react/menu";
import React from "react";

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
    const uuid = React.useId();
    const controllerId = `controller-${uuid}`;
    const menuId = `menu-${uuid}`;
    const buttonId = `button-${uuid}`;

    return (
      <div className="flex w-full flex-col">
        <MediaController id={controllerId} ref={ref}>
          <video
            muted
            slot="media"
            src={bypass ? url : BaseURL + url}
            style={{
              height: "100%",
              width: "100%",
            }}
            suppressHydrationWarning
          />
          <MediaPlaybackRateMenu
            anchor={buttonId}
            hidden
            id={menuId}
            rates={[0.25, 0.5, 0.75, 1]}
          />
        </MediaController>
        {/* @ts-expect-error - mediacontroller attribute is not typed in the react wrapper */}
        <MediaControlBar mediacontroller={controllerId}>
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
          <MediaPlaybackRateMenuButton id={buttonId} invokeTarget={menuId} />
          <MediaFullscreenButton />
        </MediaControlBar>
      </div>
    );
  },
);
