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
import React, { useEffect, useRef } from "react";
import type { ComponentRef } from "react";
import { assetUrl } from "src/lib/assets/url";

type VideoProps = {
  url: string;
  bypass: boolean | undefined;
  frameRate?: number | undefined;
};

export type VideoRef = ComponentRef<typeof MediaController>;

function isInteractiveTarget(event: KeyboardEvent): boolean {
  // SAFETY: keyboard events dispatch with an Element (or null) target, and the
  // only member used below is `closest`, which every Element implements; `?.`
  // guards the null arm of the asserted union.
  const target = event.target as HTMLElement | null;
  return (
    target?.closest(
      "button, a, input, textarea, select, [role='button'], [role='link'], [contenteditable='true']",
    ) != null
  );
}

export const Video = React.forwardRef<VideoRef, VideoProps>(
  ({ url, bypass, frameRate }, ref) => {
    const uuid = React.useId();
    const controllerId = `controller-${uuid}`;
    const menuId = `menu-${uuid}`;
    const buttonId = `button-${uuid}`;
    const videoRef = useRef<HTMLVideoElement>(null);

    const seekOffset = frameRate ? 1 / frameRate : 0.04;

    const pauseVideo = () => {
      videoRef.current?.pause();
    };

    const togglePlay = (event: KeyboardEvent) => {
      if (
        isInteractiveTarget(event) ||
        document.activeElement === videoRef.current
      ) {
        return;
      }
      const video = videoRef.current;
      if (!video) {
        return;
      }
      event.preventDefault();
      if (video.paused) {
        void video.play();
      } else {
        video.pause();
      }
    };

    useHotkeys(
      [
        {
          callback: togglePlay,
          hotkey: "Space",
        },
      ],
      { conflictBehavior: "allow" },
    );

    // Frame stepping matches the typed character ("," / ".") instead of a
    // hotkey combination, so it works on any keyboard layout (e.g. AZERTY,
    // where "." requires Shift+;).
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (isInteractiveTarget(event)) {
          return;
        }
        const video = videoRef.current;
        if (!video) {
          return;
        }
        if (event.key === ",") {
          event.preventDefault();
          video.pause();
          video.currentTime = Math.max(0, video.currentTime - seekOffset);
        } else if (event.key === ".") {
          event.preventDefault();
          video.pause();
          video.currentTime = Math.min(
            video.duration,
            video.currentTime + seekOffset,
          );
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [seekOffset]);

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
            onClick={pauseVideo}
            seekOffset={frameRate ? 1 / frameRate : 0.04}
          >
            <span
              className="mx-1 border-1 border-white px-1 text-xs"
              slot="icon"
            >
              &#60;1f
            </span>
          </MediaSeekBackwardButton>
          <MediaSeekForwardButton
            onClick={pauseVideo}
            seekOffset={frameRate ? 1 / frameRate : 0.04}
          >
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
