import { describe, it, expect } from "vitest";
import { fuzzyScore, fuzzyMatchCandidate } from "./fuzzy";

describe("fuzzyScore", () => {
  it("returns null when the query's letters don't appear in order", () => {
    expect(fuzzyScore("xyz", "Restart Docker")).toBeNull();
  });

  it("matches when query characters appear in order but not consecutively", () => {
    expect(fuzzyScore("rd", "Restart Docker")).not.toBeNull();
  });

  it("scores an exact substring match higher than a scattered one", () => {
    const exact = fuzzyScore("docker", "Restart Docker");
    const scattered = fuzzyScore("rdck", "Restart Docker");
    expect(exact).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(exact! > scattered!).toBe(true);
  });

  it("rewards matches at word boundaries over mid-word matches", () => {
    // "rd" should score "Restart Docker" (both letters at word starts)
    // higher than a target where neither letter starts a word.
    const atWordStarts = fuzzyScore("rd", "Restart Docker");
    const midWord = fuzzyScore("rd", "carddrop"); // r and d both mid-word
    expect(atWordStarts).not.toBeNull();
    expect(midWord).not.toBeNull();
    expect(atWordStarts! > midWord!).toBe(true);
  });

  it("treats an empty query as matching everything with score 0", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("DOCKER", "restart docker")).not.toBeNull();
  });
});

describe("fuzzyMatchCandidate", () => {
  it("matches against title, subtitle, or keywords, using the best score", () => {
    const candidate = {
      title: "List files",
      subtitle: "ls -la",
      keywords: ["ls", "files", "list"],
    };
    expect(fuzzyMatchCandidate("ls", candidate)).not.toBeNull();
    expect(fuzzyMatchCandidate("files", candidate)).not.toBeNull();
  });

  it("returns null when nothing about the candidate matches", () => {
    const candidate = { title: "List files", subtitle: "ls -la", keywords: ["ls"] };
    expect(fuzzyMatchCandidate("zzz", candidate)).toBeNull();
  });

  it("handles a candidate with no subtitle", () => {
    const candidate = { title: "whoami", keywords: [] };
    expect(fuzzyMatchCandidate("who", candidate)).not.toBeNull();
  });
});
