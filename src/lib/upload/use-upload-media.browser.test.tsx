import { describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useUploadMedia } from "./use-upload-media";

const waitFor = vi.waitFor;

const requirePreviewUrl = (url: string | undefined): string => {
  if (url === undefined) {
    throw new Error("The selected image does not have a preview URL");
  }
  return url;
};

describe(useUploadMedia, () => {
  it("preserves image order across kind changes and releases obsolete previews", async () => {
    const { result, unmount } = await renderHook(() =>
      useUploadMedia({ onSelectionChanged: () => undefined }),
    );
    const first = new File(["first image"], "first.png", {
      lastModified: 1,
      type: "image/png",
    });
    const second = new File(["second image"], "second.png", {
      lastModified: 2,
      type: "image/png",
    });
    const rejected = new File(["rejected image"], "rejected.png", {
      lastModified: 3,
      type: "image/png",
    });

    result.current.onImageFilesChange({
      acceptedFiles: [first, second],
      rejectedFiles: [{ errors: ["TOO_MANY_FILES"], file: rejected }],
    });
    await waitFor(() => {
      expect(result.current.imageFiles).toEqual([first, second]);
      expect(result.current.imageValidationErrors).toEqual([
        {
          fileKey: "rejected.png:14:3",
          message: "You can select up to 10 images per post",
        },
      ]);
    });

    const firstPreview = requirePreviewUrl(
      result.current.imagePreviewUrlFor(first),
    );
    const secondPreview = requirePreviewUrl(
      result.current.imagePreviewUrlFor(second),
    );
    expect(firstPreview).toMatch(/^blob:/);
    expect(secondPreview).toMatch(/^blob:/);
    expect(await (await fetch(firstPreview)).text()).toBe("first image");

    result.current.moveImage(0, 1);
    result.current.setMediaKind("image");
    await waitFor(() => {
      expect(result.current.imageFiles).toEqual([second, first]);
      expect(result.current.mediaKind).toBe("image");
    });
    expect(result.current.imagePreviewUrlFor(first)).toBe(firstPreview);
    expect(result.current.imagePreviewUrlFor(second)).toBe(secondPreview);

    result.current.onImageFilesChange({
      acceptedFiles: [second, first, rejected],
      rejectedFiles: [],
    });
    await waitFor(() => {
      expect(result.current.imageValidationErrors).toEqual([]);
      expect(result.current.imageFiles).toEqual([second, first, rejected]);
    });

    result.current.removeImage(0);
    await waitFor(() => {
      expect(result.current.imageFiles).toEqual([first, rejected]);
      expect(result.current.imagePreviewUrlFor(second)).toBeUndefined();
    });
    await expect(fetch(secondPreview)).rejects.toThrow();

    const remainingPreview = requirePreviewUrl(
      result.current.imagePreviewUrlFor(first),
    );
    await unmount();
    await expect(fetch(remainingPreview)).rejects.toThrow();
  });

  it("signals in-flight upload cancellation when the media snapshot changes", async () => {
    const selectionChanges = new Array<number>();
    const { result } = await renderHook(() =>
      useUploadMedia({
        onSelectionChanged: () =>
          selectionChanges.push(selectionChanges.length + 1),
      }),
    );
    const image = new File(["image"], "image.png", { type: "image/png" });
    const initialVersion = result.current.getSelectionVersion();

    result.current.onImageFilesChange({
      acceptedFiles: [image],
      rejectedFiles: [],
    });
    result.current.setMediaKind("image");

    expect(result.current.getSelectionVersion()).toBe(initialVersion + 2);
    expect(selectionChanges).toEqual([1, 2]);
  });
});
