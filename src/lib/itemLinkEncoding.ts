import { Buffer } from "node:buffer";

export function encodeItemLink(link: string): string {
	return Buffer.from(link).toString("base64url");
}

export function decodeItemLink(encoded: string): string {
	return Buffer.from(encoded, "base64url").toString("utf8");
}
