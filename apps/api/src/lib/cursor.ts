export function encodeCursor(createdAt: string): string {
  return Buffer.from(createdAt).toString("base64url");
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, "base64url").toString("utf8");
}
