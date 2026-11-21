// The book's sentences by id, from the workspace's stored source (its blocks cut as they were stored, each sectioned into
// sentences): what every script that quotes the book reads.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { storedSource } from "../../ground/workspace/source.js";
import { cutBlocks } from "./blocks.js";
import { sectionBlock, type Sentence } from "./sectioning.js";

export async function loadWorkspaceSentences(novelDir: string): Promise<Map<string, Sentence>> {
  const bound = await storedSource(novelDir);
  const files = bound ? [bound.file] : (await readdir(join(novelDir, "source"))).filter((name) => !name.startsWith("."));
  if (files.length !== 1) throw new Error("Time-place needs one unambiguous stored source; explicit source migration required.");
  const text = await readFile(join(novelDir, "source", files[0]), "utf8");
  const sentences = new Map<string, Sentence>();
  for (const block of bound ? cutBlocks(text, bound.blockSize) : cutBlocks(text)) for (const sentence of sectionBlock(block.text, block.index).sentences) sentences.set(sentence.id, sentence);
  return sentences;
}
