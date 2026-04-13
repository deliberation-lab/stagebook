import { describe, it, expect, vi } from "vitest";
import { loadTreatmentFromUrl } from "./loader";

const MINIMAL_YAML = `
introSequences:
  - name: intro1
    introSteps:
      - name: consent
        elements:
          - type: submitButton
            buttonText: Continue

treatments:
  - name: treatment1
    playerCount: 2
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: prompt
            name: q1
            file: prompts/q1.prompt.md
`;

function mockFetch(body: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    text: () => Promise.resolve(body),
  });
}

describe("loadTreatmentFromUrl", () => {
  it("fetches, parses, and expands a treatment file", async () => {
    const fetch = mockFetch(MINIMAL_YAML);
    const result = await loadTreatmentFromUrl(
      "https://github.com/org/repo/blob/main/treatment.yaml",
      fetch,
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/org/repo/main/treatment.yaml",
    );
    expect(result.treatmentFile.treatments).toHaveLength(1);
    expect(result.treatmentFile.treatments[0].name).toBe("treatment1");
    expect(result.unresolvedFields).toEqual([]);
    expect(result.rawBaseUrl).toBe(
      "https://raw.githubusercontent.com/org/repo/main/",
    );
  });

  it("throws on fetch failure", async () => {
    const fetch = mockFetch("Not Found", false);
    await expect(
      loadTreatmentFromUrl(
        "https://github.com/org/repo/blob/main/treatment.yaml",
        fetch,
      ),
    ).rejects.toThrow("Failed to fetch");
  });

  it("throws on invalid YAML", async () => {
    const fetch = mockFetch("{{bad yaml");
    await expect(
      loadTreatmentFromUrl(
        "https://github.com/org/repo/blob/main/treatment.yaml",
        fetch,
      ),
    ).rejects.toThrow();
  });
});
