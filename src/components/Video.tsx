import { useHotkeys } from "@tanstack/react-hotkeys";
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
import React, { useRef } from "react";
import { assetUrl } from "src/lib/assets/url";

type VideoProps = {
  url: string;
  bypass: boolean | undefined;
  frameRate?: number | undefined;
};

export const Video = React.forwardRef<any, VideoProps>(
  ({ url, bypass, frameRate }, ref) => {
    const uuid = React.useId();
    const controllerId = `controller-${uuid}`;
    const menuId = `menu-${uuid}`;
    const buttonId = `button-${uuid}`;
    const videoRef = useRef<HTMLVideoElement>(null);

    const seekOffset = frameRate ? 1 / frameRate : 0.04;

    useHotkeys(
      [
        {
          callback: () => {
            const video = videoRef.current;
            if (video)
              video.currentTime = Math.max(0, video.currentTime - seekOffset);
          },
          hotkey: ",",
        },
        {
          callback: () => {
            const video = videoRef.current;
            if (video)
              video.currentTime = Math.min(
                video.duration,
                video.currentTime + seekOffset,
              );
          },
          hotkey: ".",
        },
      ],
      { conflictBehavior: "allow" },
    );

    return (
      <div className="flex w-full flex-col">
        <MediaController id={controllerId} ref={ref}>
          <video
            muted
            ref={videoRef}
            slot="media"
            src={bypass ? url : assetUrl(url)}
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
