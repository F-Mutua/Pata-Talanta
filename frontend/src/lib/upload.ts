import { createClient } from "@/utils/supabase/client";

/**
 * Upload a file to Supabase Storage with progress events. supabase-js's
 * upload() has no progress callback, so this calls the Storage REST endpoint
 * directly with the user's own access token (storage RLS still applies).
 */
export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<void> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session) throw new Error("Your session has expired. Please sign in again.");

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");
  const url = `${base}/storage/v1/object/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText);
        message = body.message || body.error || message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}
