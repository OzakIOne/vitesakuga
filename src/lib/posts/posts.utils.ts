import type {
  FileUploadData,
  SerializedUploadData,
  VideoSerializableType,
} from "./posts.schema";

async function videoFileToBuffer(file: File): Promise<VideoSerializableType> {
  const arrayBuffer = await file.arrayBuffer();

  return {
    arrayBuffer,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

export async function transformUploadFormData(
  values: FileUploadData,
): Promise<SerializedUploadData> {
  if (!values.video) {
    throw new Error("Video file is required");
  }

  const videoData = await videoFileToBuffer(values.video);

  return {
    title: values.title,
    content: values.content,
    source: values.source,
    relatedPostId: values.relatedPostId,
    tags: values.tags,
    userId: values.userId,
    video: videoData,
  };
}
