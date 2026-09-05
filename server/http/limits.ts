export const MAX_API_BODY_BYTES = 262_144;

export class ApiBodyError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Bound bytes while reading, not after buffering an untrusted request.text().
export const readApiBody = async (request: Request): Promise<string> => {
  if (Number(request.headers.get("content-length")) > MAX_API_BODY_BYTES) {
    throw new ApiBodyError(413, "Request too large");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_API_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        throw new ApiBodyError(413, "Request too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof ApiBodyError) throw error;
    throw new ApiBodyError(400, "Invalid request body");
  } finally {
    reader.releaseLock();
  }
};
