import { expect, test, describe } from "vitest";
import {
  metadataTypeSchema,
  metadataRefineSchema,
  metadataLogicalSchema,
  validateSliderLabels,
  promptFileSchema,
} from "./promptFile.js";

// ----------- Type Schema Validation (metadataTypeSchema) ------------

test("valid metadata passes type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    notes: "Optional notes",
    rows: 3,
  };
  const result = metadataTypeSchema.safeParse(metadata);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("missing required type field fails type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid type value fails type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "invalidType",
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("notes field is optional in type schema", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "noResponse",
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

// ----------- Refined Validation (metadataRefineSchema) ------------

test("valid refined metadata passes all refine rules", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    rows: 5,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

test("invalid: rows provided but type is not openResponse", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "multipleChoice",
    rows: 3,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid: select provided but type is not multipleChoice", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    select: "single",
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid: shuffleOptions provided but type is noResponse", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "noResponse",
    shuffleOptions: true,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

// ----------- Logical Schema (metadataLogicalSchema) ------------

test("valid logical schema with arbitrary name", () => {
  const metadata = {
    name: "any name the author wants",
    type: "openResponse",
  };
  const result = metadataLogicalSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

test("valid logical schema without name", () => {
  const metadata = {
    type: "openResponse",
  };
  const result = metadataLogicalSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

// ----------- Slider Type Validation ------------

test("valid slider metadata with all required fields", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 100,
    interval: 1,
    labelPts: [0, 25, 50, 75, 100],
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

test("invalid: slider missing min field", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    max: 100,
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const minError = result.error.issues.find(
      (issue) => issue.path[0] === "min",
    );
    expect(minError?.message).toBe("min is required for slider type");
  }
});

test("invalid: slider missing max field", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const maxError = result.error.issues.find(
      (issue) => issue.path[0] === "max",
    );
    expect(maxError?.message).toBe("max is required for slider type");
  }
});

test("invalid: slider missing interval field", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 100,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const intervalError = result.error.issues.find(
      (issue) => issue.path[0] === "interval",
    );
    expect(intervalError?.message).toBe("interval is required for slider type");
  }
});

test("invalid: slider min >= max", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 100,
    max: 100,
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const minError = result.error.issues.find(
      (issue) => issue.path[0] === "min",
    );
    expect(minError?.message).toBe("min must be less than max");
  }
});

test("invalid: slider min + interval > max", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 10,
    interval: 20,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const intervalError = result.error.issues.find(
      (issue) => issue.path[0] === "interval",
    );
    expect(intervalError?.message).toBe(
      "min + interval must be less than or equal to max",
    );
  }
});

test("invalid: non-slider type with min field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    min: 0,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const minError = result.error.issues.find(
      (issue) => issue.path[0] === "min",
    );
    expect(minError?.message).toBe("min can only be specified for slider type");
  }
});

test("invalid: non-slider type with max field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    max: 100,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const maxError = result.error.issues.find(
      (issue) => issue.path[0] === "max",
    );
    expect(maxError?.message).toBe("max can only be specified for slider type");
  }
});

test("invalid: non-slider type with interval field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    interval: 1,
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const intervalError = result.error.issues.find(
      (issue) => issue.path[0] === "interval",
    );
    expect(intervalError?.message).toBe(
      "interval can only be specified for slider type",
    );
  }
});

test("invalid: non-slider type with labelPts field", () => {
  const metadata = {
    name: "mock-prompt-files/prompt.md",
    type: "openResponse",
    labelPts: [0, 50, 100],
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const labelPtsError = result.error.issues.find(
      (issue) => issue.path[0] === "labelPts",
    );
    expect(labelPtsError?.message).toBe(
      "labelPts can only be specified for slider type",
    );
  }
});

// ----------- Layout Field (multipleChoice only) ------------

test("valid: multipleChoice with layout: horizontal", () => {
  const metadata = {
    name: "mock-prompt-files/mc.md",
    type: "multipleChoice",
    layout: "horizontal",
  };
  const typeResult = metadataTypeSchema.safeParse(metadata);
  expect(typeResult.success).toBe(true);
  const refineResult = metadataRefineSchema.safeParse(metadata);
  expect(refineResult.success).toBe(true);
});

test("valid: multipleChoice with layout: vertical", () => {
  const metadata = {
    name: "mock-prompt-files/mc.md",
    type: "multipleChoice",
    layout: "vertical",
  };
  const typeResult = metadataTypeSchema.safeParse(metadata);
  expect(typeResult.success).toBe(true);
  const refineResult = metadataRefineSchema.safeParse(metadata);
  expect(refineResult.success).toBe(true);
});

test("valid: multipleChoice without layout (optional)", () => {
  const metadata = {
    name: "mock-prompt-files/mc.md",
    type: "multipleChoice",
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(true);
});

test("invalid: layout value other than vertical or horizontal", () => {
  const metadata = {
    name: "mock-prompt-files/mc.md",
    type: "multipleChoice",
    layout: "diagonal",
  };
  const result = metadataTypeSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid: layout on openResponse type", () => {
  const metadata = {
    name: "mock-prompt-files/open.md",
    type: "openResponse",
    layout: "horizontal",
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const layoutError = result.error.issues.find(
      (issue) => issue.path[0] === "layout",
    );
    expect(layoutError?.message).toBe(
      "layout can only be specified for multipleChoice type",
    );
  }
});

test("invalid: layout on slider type", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider",
    min: 0,
    max: 100,
    interval: 1,
    layout: "horizontal",
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
  if (!result.success) {
    const layoutError = result.error.issues.find(
      (issue) => issue.path[0] === "layout",
    );
    expect(layoutError?.message).toBe(
      "layout can only be specified for multipleChoice type",
    );
  }
});

test("invalid: layout on listSorter type", () => {
  const metadata = {
    name: "mock-prompt-files/ls.md",
    type: "listSorter",
    layout: "horizontal",
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

test("invalid: layout on noResponse type", () => {
  const metadata = {
    name: "mock-prompt-files/nr.md",
    type: "noResponse",
    layout: "horizontal",
  };
  const result = metadataRefineSchema.safeParse(metadata);
  expect(result.success).toBe(false);
});

// ----------- Slider Label Validation ------------

test("valid: labelPts length matches number of labels", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider" as const,
    min: 0,
    max: 100,
    interval: 1,
    labelPts: [0, 25, 50, 75, 100],
  };
  const responseItems = [
    "Very cold",
    "Chilly",
    "Tolerable",
    "Warm",
    "Super Hot",
  ];
  const issues = validateSliderLabels(metadata, responseItems);
  expect(issues.length).toBe(0);
});

test("invalid: labelPts length does not match number of labels", () => {
  const metadata = {
    name: "mock-prompt-files/slider.md",
    type: "slider" as const,
    min: 0,
    max: 100,
    interval: 1,
    labelPts: [0, 50, 100],
  };
  const responseItems = [
    "Very cold",
    "Chilly",
    "Tolerable",
    "Warm",
    "Super Hot",
  ];
  const issues = validateSliderLabels(metadata, responseItems);
  expect(issues.length).toBe(1);
  expect(issues[0].message).toContain(
    "labelPts length (3) must match the number of labels (5)",
  );
});

// ----------- Prompt File Schema (unified markdown validation) ------------

describe("promptFileSchema", () => {
  test("valid multipleChoice prompt file parses correctly", () => {
    const markdown = `---
name: projects/example/myPrompt.md
type: multipleChoice
---
Which option do you prefer?
---
- Option A
- Option B
- Option C`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.name).toBe("projects/example/myPrompt.md");
      expect(result.data.metadata.type).toBe("multipleChoice");
      expect(result.data.body).toContain("Which option do you prefer?");
      expect(result.data.responseItems).toEqual([
        "Option A",
        "Option B",
        "Option C",
      ]);
    }
  });

  test("valid openResponse prompt file", () => {
    const markdown = `---
name: projects/example/openQ.md
type: openResponse
rows: 5
---
Please describe your experience.
---
> Write your response here`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.type).toBe("openResponse");
      expect(result.data.metadata.rows).toBe(5);
      expect(result.data.responseItems).toEqual(["Write your response here"]);
    }
  });

  test("valid noResponse prompt file has empty responseItems", () => {
    const markdown = `---
name: projects/example/info.md
type: noResponse
---
This is informational text with no response needed.
---
`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.type).toBe("noResponse");
      expect(result.data.responseItems).toEqual([]);
    }
  });

  test("valid slider prompt file", () => {
    const markdown = `---
name: projects/example/slider.md
type: slider
min: 0
max: 100
interval: 10
labelPts: [0, 50, 100]
---
Rate your agreement.
---
- Disagree
- Neutral
- Agree`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.type).toBe("slider");
      expect(result.data.metadata.min).toBe(0);
      expect(result.data.responseItems).toEqual([
        "Disagree",
        "Neutral",
        "Agree",
      ]);
    }
  });

  test("fails on empty string", () => {
    const result = promptFileSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  test("fails on whitespace-only string", () => {
    const result = promptFileSchema.safeParse("   \n  ");
    expect(result.success).toBe(false);
  });

  test("fails when missing --- delimiters", () => {
    const markdown = `name: foo.md
type: noResponse
Some body text`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(false);
    if (!result.success) {
      const structureError = result.error.issues.find((i) =>
        i.message.includes("three sections"),
      );
      expect(structureError).toBeDefined();
    }
  });

  test("fails when body section is empty", () => {
    const markdown = `---
name: projects/example/empty.md
type: noResponse
---

---
`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(false);
    if (!result.success) {
      const bodyError = result.error.issues.find((i) =>
        i.message.includes("body"),
      );
      expect(bodyError).toBeDefined();
    }
  });

  test("fails with invalid metadata type", () => {
    const markdown = `---
name: projects/example/bad.md
type: invalidType
---
Some body.
---
- response`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(false);
  });

  test("fails when response lines have wrong format", () => {
    const markdown = `---
name: projects/example/badResponse.md
type: multipleChoice
---
Pick one.
---
Option A
Option B`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(false);
    if (!result.success) {
      const responseError = result.error.issues.find((i) =>
        i.message.includes("- "),
      );
      expect(responseError).toBeDefined();
    }
  });

  test("fails when slider labelPts length mismatches response items", () => {
    const markdown = `---
name: projects/example/badSlider.md
type: slider
min: 0
max: 100
interval: 10
labelPts: [0, 100]
---
Rate this.
---
- Low
- Medium
- High`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(false);
    if (!result.success) {
      const labelError = result.error.issues.find((i) =>
        i.message.includes("labelPts"),
      );
      expect(labelError).toBeDefined();
    }
  });

  test("non-string input fails", () => {
    const result = promptFileSchema.safeParse(42);
    expect(result.success).toBe(false);
  });

  test("valid multipleChoice prompt file with layout: horizontal", () => {
    const markdown = `---
name: projects/example/yesNo.md
type: multipleChoice
layout: horizontal
---
Do you agree?
---
- Yes
- No`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.layout).toBe("horizontal");
    }
  });

  test("fails when layout is set on openResponse prompt file", () => {
    const markdown = `---
name: projects/example/open.md
type: openResponse
layout: horizontal
---
Describe something.
---
> Write your response here`;

    const result = promptFileSchema.safeParse(markdown);
    expect(result.success).toBe(false);
    if (!result.success) {
      const layoutError = result.error.issues.find(
        (i) =>
          i.message === "layout can only be specified for multipleChoice type",
      );
      expect(layoutError).toBeDefined();
    }
  });
});
