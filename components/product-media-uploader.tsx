"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Film, ImagePlus, Trash2, UploadCloud } from "lucide-react";

type LocalImage = { id: string; file: File; preview: string };

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const allowedVideoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const maxImageBytes = 8 * 1024 * 1024;

export function ProductMediaUploader() {
  const [images, setImages] = useState<LocalImage[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<LocalImage[]>([]);

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview)), []);

  function addImages(files: FileList | null) {
    if (!files) return;
    const available = 10 - images.length;
    const incoming = Array.from(files);
    const invalidTypeCount = incoming.filter((file) => !allowedImageTypes.has(file.type)).length;
    const oversizedCount = incoming.filter((file) => allowedImageTypes.has(file.type) && file.size > maxImageBytes).length;
    const valid = incoming.filter((file) => allowedImageTypes.has(file.type) && file.size <= maxImageBytes);
    const accepted = valid.slice(0, available).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    const messages: string[] = [];
    if (invalidTypeCount) messages.push(`${invalidTypeCount} unsupported image${invalidTypeCount === 1 ? " was" : "s were"} skipped.`);
    if (oversizedCount) messages.push(`${oversizedCount} image${oversizedCount === 1 ? " exceeds" : "s exceed"} the 8 MB limit.`);
    if (valid.length > available) messages.push(`Only ${available} more image${available === 1 ? "" : "s"} can be added. The limit is 10.`);
    setImages((current) => [...current, ...accepted]);
    setMessage(messages.join(" "));
    if (inputRef.current) inputRef.current.value = "";
  }

  function chooseVideo(file: File | undefined) {
    if (!file) {
      setVideo(null);
      return;
    }
    if (!allowedVideoTypes.has(file.type)) {
      setVideo(null);
      setMessage("Use an MP4, WebM, or MOV video.");
      return;
    }
    setVideo(file);
    setMessage("");
  }

  function removeImage(id: string) {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((image) => image.id !== id);
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  return (
    <div className="media-uploader">
      <div className="media-uploader-heading">
        <div><strong>Product images</strong><p>Add up to 10 images. The first image is the catalog cover.</p></div>
        <span className={images.length === 10 ? "limit-full" : ""}>{images.length} / 10</span>
      </div>
      <button className="upload-dropzone" type="button" onClick={() => inputRef.current?.click()} disabled={images.length >= 10}>
        <UploadCloud size={26} />
        <strong>{images.length >= 10 ? "Image limit reached" : "Choose product images"}</strong>
        <span>JPEG, PNG, WebP, or AVIF, up to 8 MB each. Recommended square format.</span>
      </button>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => addImages(event.target.files)} />
      {message ? <p className="field-error">{message}</p> : null}
      {images.length ? (
        <div className="media-preview-grid">
          {images.map((image, index) => (
            <article key={image.id}>
              <div className="media-preview-image"><Image src={image.preview} alt={`Local preview ${index + 1}`} fill unoptimized /></div>
              <div><strong>{index === 0 ? "Cover image" : `Image ${index + 1}`}</strong><span title={image.file.name}>{image.file.name}</span></div>
              <div className="media-order-actions">
                <button type="button" aria-label="Move image earlier" disabled={index === 0} onClick={() => moveImage(index, -1)}><ArrowUp size={15} /></button>
                <button type="button" aria-label="Move image later" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}><ArrowDown size={15} /></button>
                <button type="button" aria-label="Remove image" onClick={() => removeImage(image.id)}><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="media-empty"><ImagePlus size={20} /> No images selected yet.</div>
      )}

      <div className="video-upload-row">
        <div className="video-upload-icon"><Film size={22} /></div>
        <div><strong>Product video</strong><p>Optional. Upload one video; use Cloudflare Stream in production.</p></div>
        <label className="button secondary compact">
          {video ? "Replace video" : "Choose video"}
          <input className="visually-hidden" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => chooseVideo(event.target.files?.[0])} />
        </label>
        {video ? <span className="selected-file">{video.name}</span> : null}
      </div>
      <p className="field-help">This starter previews local files. The included API routes create signed R2 image uploads and direct Stream video uploads after credentials are configured.</p>
    </div>
  );
}
