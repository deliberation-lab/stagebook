import { describe, it, expect } from "vitest";
import { isYouTubeURL } from "./isYouTubeURL.js";

describe("isYouTubeURL", () => {
  describe("returns the video ID for valid YouTube URLs", () => {
    it("handles youtube.com/watch?v= format", () => {
      expect(isYouTubeURL("https://www.youtube.com/watch?v=QC8iQqtG0hg")).toBe(
        "QC8iQqtG0hg",
      );
    });

    it("handles youtu.be short URL format", () => {
      expect(isYouTubeURL("https://youtu.be/QC8iQqtG0hg")).toBe("QC8iQqtG0hg");
    });

    it("handles youtube.com/embed/ format", () => {
      expect(isYouTubeURL("https://www.youtube.com/embed/QC8iQqtG0hg")).toBe(
        "QC8iQqtG0hg",
      );
    });

    it("handles youtube.com without www", () => {
      expect(isYouTubeURL("https://youtube.com/watch?v=QC8iQqtG0hg")).toBe(
        "QC8iQqtG0hg",
      );
    });

    it("handles mobile m.youtube.com format", () => {
      expect(isYouTubeURL("https://m.youtube.com/watch?v=QC8iQqtG0hg")).toBe(
        "QC8iQqtG0hg",
      );
    });

    it("handles youtu.be with query params", () => {
      expect(isYouTubeURL("https://youtu.be/QC8iQqtG0hg?t=30")).toBe(
        "QC8iQqtG0hg",
      );
    });

    it("handles youtube.com/watch with extra query params", () => {
      expect(
        isYouTubeURL(
          "https://www.youtube.com/watch?v=QC8iQqtG0hg&list=PLxxx&index=2",
        ),
      ).toBe("QC8iQqtG0hg");
    });

    it("handles video IDs with hyphens and underscores", () => {
      expect(isYouTubeURL("https://youtu.be/abc-123_XYZ")).toBe("abc-123_XYZ");
    });
  });

  describe("returns null for non-YouTube URLs", () => {
    it("returns null for S3 URLs", () => {
      expect(
        isYouTubeURL("https://bucket.s3.amazonaws.com/recordings/session.mp4"),
      ).toBeNull();
    });

    it("returns null for CDN URLs", () => {
      expect(isYouTubeURL("https://cdn.example.com/video.mp4")).toBeNull();
    });

    it("returns null for relative paths", () => {
      expect(isYouTubeURL("shared/footage.mp4")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(isYouTubeURL("")).toBeNull();
    });

    it("returns null for unrelated domains containing 'youtube'", () => {
      expect(isYouTubeURL("https://not-youtube.com/watch?v=abc")).toBeNull();
    });
  });
});
