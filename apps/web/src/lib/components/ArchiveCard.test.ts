import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ArchiveCard from "./ArchiveCard.svelte";

const item = {
  slug: "useful-video-a1b2c3d4",
  title: "A useful video",
  summary: "A concise summary.",
  selectedText: null,
  sourceDomain: "youtube.com",
  outboundUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  tags: [{ slug: "design", label: "Design" }],
  publishedAt: new Date("2026-06-01T12:00:00Z"),
  updatedAt: new Date("2026-06-02T12:00:00Z"),
};

describe("ArchiveCard", () => {
  it("renders the allow-listed archive projection and YouTube preview", () => {
    render(ArchiveCard, { props: { item, locale: "en" } });
    expect(screen.getByRole("heading", { name: item.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Play on YouTube: ${item.title}` })).toHaveAttribute(
      "href",
      item.outboundUrl,
    );
    expect(screen.getByRole("link", { name: "Design" })).toHaveAttribute(
      "href",
      "/en/?tag=design",
    );
  });
});
