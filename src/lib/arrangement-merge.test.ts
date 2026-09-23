import { describe, expect, it } from "vitest";
import {
  isSyntheticUnit,
  moveAudio,
  moveBlock,
  moveImage,
  movePage,
  reorderUnits,
  renumberRealUnits,
} from "./arrangement-merge";
import type { GeneratedUnit, UnitOutline } from "./ai/schemas";

function makeUnit(unitNumber: number, pageCount = 2): GeneratedUnit {
  return {
    unitNumber,
    title: `Unit ${unitNumber}`,
    studentBookPages: Array.from({ length: pageCount }, (_, i) => ({
      sourcePageNumber: unitNumber * 100 + i,
      pageType: "content" as const,
      unitNumber,
      blocks: [{ kind: "explanation" as const, heading: `Page ${i}`, body: `Body ${i}` }],
    })),
    workbookPages: [],
    glossary: [],
  };
}

function makeOutlineUnit(number: number): UnitOutline {
  return {
    number,
    title: `Unit ${number}`,
    level: "A2",
    sourcePageRange: { start: number, end: number },
    learningObjectives: [`Objective ${number}`],
    keyTerms: [`term${number}`],
  };
}

describe("isSyntheticUnit", () => {
  it("flags sentinel unit numbers as synthetic", () => {
    expect(isSyntheticUnit(makeUnit(90001))).toBe(true);
    expect(isSyntheticUnit(makeUnit(90002))).toBe(true);
  });

  it("does not flag real unit numbers", () => {
    expect(isSyntheticUnit(makeUnit(1))).toBe(false);
    expect(isSyntheticUnit(makeUnit(12))).toBe(false);
  });
});

describe("reorderUnits", () => {
  it("moves a unit to a new position", () => {
    const units = [makeUnit(1), makeUnit(2), makeUnit(3)];
    const result = reorderUnits(units, 2, 0);
    expect(result.map((u) => u.unitNumber)).toEqual([3, 1, 2]);
  });

  it("does not mutate the input array", () => {
    const units = [makeUnit(1), makeUnit(2)];
    reorderUnits(units, 0, 1);
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2]);
  });

  it("throws for an out-of-range index", () => {
    const units = [makeUnit(1)];
    expect(() => reorderUnits(units, 0, 5)).toThrow(/Geçersiz ünite indeksi/);
  });
});

describe("movePage", () => {
  it("reorders pages within the same unit", () => {
    const units = [makeUnit(1, 3)];
    const result = movePage(units, 1, "studentBookPages", 0, 1, 2);
    expect(result[0].studentBookPages.map((p) => p.blocks[0].heading)).toEqual(["Page 1", "Page 2", "Page 0"]);
  });

  it("moves a page to a different unit and updates its unitNumber", () => {
    const units = [makeUnit(1, 2), makeUnit(2, 1)];
    const result = movePage(units, 1, "studentBookPages", 0, 2, 1);
    const [unit1, unit2] = result;
    expect(unit1.studentBookPages).toHaveLength(1);
    expect(unit2.studentBookPages).toHaveLength(2);
    const movedPage = unit2.studentBookPages[1];
    expect(movedPage.blocks[0].heading).toBe("Page 0");
    expect(movedPage.unitNumber).toBe(2);
  });

  it("leaves the source page's sourcePageNumber untouched when moved (safe as a lookup key)", () => {
    const units = [makeUnit(1, 1), makeUnit(2, 0)];
    const originalSourcePageNumber = units[0].studentBookPages[0].sourcePageNumber;
    const result = movePage(units, 1, "studentBookPages", 0, 2, 0);
    expect(result[1].studentBookPages[0].sourcePageNumber).toBe(originalSourcePageNumber);
  });

  it("throws for a nonexistent source or destination unit", () => {
    const units = [makeUnit(1, 1)];
    expect(() => movePage(units, 99, "studentBookPages", 0, 1, 0)).toThrow(/Ünite 99/);
    expect(() => movePage(units, 1, "studentBookPages", 0, 99, 0)).toThrow(/Ünite 99/);
  });

  it("throws for an out-of-range page index", () => {
    const units = [makeUnit(1, 1)];
    expect(() => movePage(units, 1, "studentBookPages", 5, 1, 0)).toThrow(/sayfası bulunamadı/);
  });
});

describe("moveBlock", () => {
  it("reorders blocks within the same page", () => {
    const units = [makeUnit(1, 1)];
    units[0].studentBookPages[0].blocks.push({ kind: "practice", heading: "Second", body: "Body" });
    const { units: result, audioMoved } = moveBlock(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 1 },
    );
    expect(result[0].studentBookPages[0].blocks.map((b) => b.heading)).toEqual(["Second", "Page 0"]);
    expect(audioMoved).toBe(false);
  });

  it("moves a block to a different page in the same unit", () => {
    const units = [makeUnit(1, 2)];
    const { units: result } = moveBlock(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
    );
    expect(result[0].studentBookPages[0].blocks).toHaveLength(0);
    expect(result[0].studentBookPages[1].blocks.map((b) => b.heading)).toEqual(["Page 1", "Page 0"]);
  });

  it("drops the moved block's layout unless a layoutOverride is given", () => {
    const units = [makeUnit(1, 2)];
    units[0].studentBookPages[0].blocks[0].layout = { x: 1, y: 2, width: 3, height: 4 };
    const { units: withoutOverride } = moveBlock(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
    );
    expect(withoutOverride[0].studentBookPages[1].blocks[1].layout).toBeUndefined();

    const layout = { x: 10, y: 20, width: 30, height: 40 };
    const { units: withOverride } = moveBlock(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
      layout,
    );
    expect(withOverride[0].studentBookPages[1].blocks[1].layout).toEqual(layout);
  });

  it("moves a block across units and migrates its matching listeningAudio entry", () => {
    const units = [makeUnit(1, 1), makeUnit(2, 1)];
    units[0].listeningAudio = [{ blockRef: "Page 0", script: "Hello" }];
    const { units: result, audioMoved } = moveBlock(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
      { unitNumber: 2, pageArrayField: "studentBookPages", pageIndex: 0 },
    );
    expect(audioMoved).toBe(true);
    expect(result[0].listeningAudio).toEqual([]);
    expect(result[1].listeningAudio).toEqual([{ blockRef: "Page 0", script: "Hello" }]);
  });

  it("does not migrate audio for a cross-unit move when no entry matches", () => {
    const units = [makeUnit(1, 1), makeUnit(2, 1)];
    const { audioMoved } = moveBlock(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
      { unitNumber: 2, pageArrayField: "studentBookPages", pageIndex: 0 },
    );
    expect(audioMoved).toBe(false);
  });

  it("throws for an out-of-range source block index", () => {
    const units = [makeUnit(1, 1)];
    expect(() =>
      moveBlock(
        units,
        { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 5 },
        { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0 },
      ),
    ).toThrow(/blok 5 bulunamadı/);
  });

  it("throws for a nonexistent destination page", () => {
    const units = [makeUnit(1, 1), makeUnit(2, 1)];
    expect(() =>
      moveBlock(
        units,
        { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
        { unitNumber: 2, pageArrayField: "studentBookPages", pageIndex: 9 },
      ),
    ).toThrow(/sayfası bulunamadı/);
  });

  it("does not mutate the input array", () => {
    const units = [makeUnit(1, 2)];
    const original = JSON.parse(JSON.stringify(units));
    moveBlock(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0, blockIndex: 0 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
    );
    expect(units).toEqual(original);
  });
});

describe("moveImage", () => {
  it("moves an image from one page to another in the same unit", () => {
    const units = [makeUnit(1, 2)];
    const result = moveImage(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
    );
    expect(result[0].studentBookPages[0].imageOverrideSourcePageNumber).toBeNull();
    expect(result[0].studentBookPages[1].imageOverrideSourcePageNumber).toBe(100); // unit 1's page 0 sourcePageNumber
  });

  it("moves an image across units", () => {
    const units = [makeUnit(1, 1), makeUnit(2, 1)];
    const result = moveImage(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0 },
      { unitNumber: 2, pageArrayField: "studentBookPages", pageIndex: 0 },
    );
    expect(result[0].studentBookPages[0].imageOverrideSourcePageNumber).toBeNull();
    expect(result[1].studentBookPages[0].imageOverrideSourcePageNumber).toBe(100);
  });

  it("follows an existing override to its real image key when moved again", () => {
    const units = [makeUnit(1, 3)];
    units[0].studentBookPages[1].imageOverrideSourcePageNumber = 100; // page 1 already shows page 0's image
    const result = moveImage(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 2 },
    );
    expect(result[0].studentBookPages[1].imageOverrideSourcePageNumber).toBeNull();
    expect(result[0].studentBookPages[2].imageOverrideSourcePageNumber).toBe(100);
  });

  it("throws when the source page has no image to move", () => {
    const units = [makeUnit(1, 2)];
    units[0].studentBookPages[0].imageOverrideSourcePageNumber = null;
    expect(() =>
      moveImage(
        units,
        { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0 },
        { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
      ),
    ).toThrow(/taşınacak bir görsel yok/);
  });

  it("throws for a nonexistent destination page", () => {
    const units = [makeUnit(1, 1), makeUnit(2, 1)];
    expect(() =>
      moveImage(
        units,
        { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0 },
        { unitNumber: 2, pageArrayField: "studentBookPages", pageIndex: 9 },
      ),
    ).toThrow(/sayfası bulunamadı/);
  });

  it("does not mutate the input array", () => {
    const units = [makeUnit(1, 2)];
    const original = JSON.parse(JSON.stringify(units));
    moveImage(
      units,
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 0 },
      { unitNumber: 1, pageArrayField: "studentBookPages", pageIndex: 1 },
    );
    expect(units).toEqual(original);
  });
});

describe("moveAudio", () => {
  function makeUnitWithAudio(unitNumber: number, audio: { blockRef: string; script: string }[]): GeneratedUnit {
    return { ...makeUnit(unitNumber, 1), listeningAudio: audio };
  }

  it("moves an audio entry from one unit to another", () => {
    const units = [
      makeUnitWithAudio(1, [{ blockRef: "Page 0", script: "Hello" }]),
      makeUnitWithAudio(2, []),
    ];
    const result = moveAudio(units, 1, 0, 2);
    expect(result[0].listeningAudio).toEqual([]);
    expect(result[1].listeningAudio).toEqual([{ blockRef: "Page 0", script: "Hello" }]);
  });

  it("appends to an existing listeningAudio array rather than replacing it", () => {
    const units = [
      makeUnitWithAudio(1, [{ blockRef: "Page 0", script: "Hello" }]),
      makeUnitWithAudio(2, [{ blockRef: "Other", script: "Existing" }]),
    ];
    const result = moveAudio(units, 1, 0, 2);
    expect(result[1].listeningAudio).toEqual([
      { blockRef: "Other", script: "Existing" },
      { blockRef: "Page 0", script: "Hello" },
    ]);
  });

  it("is a no-op when source and destination unit are the same", () => {
    const units = [makeUnitWithAudio(1, [{ blockRef: "Page 0", script: "Hello" }])];
    const result = moveAudio(units, 1, 0, 1);
    expect(result).toBe(units);
  });

  it("throws for a nonexistent source or destination unit", () => {
    const units = [makeUnitWithAudio(1, [{ blockRef: "Page 0", script: "Hello" }])];
    expect(() => moveAudio(units, 99, 0, 1)).toThrow(/Ünite 99/);
    expect(() => moveAudio(units, 1, 0, 99)).toThrow(/Ünite 99/);
  });

  it("throws for an out-of-range audio index", () => {
    const units = [makeUnitWithAudio(1, []), makeUnitWithAudio(2, [])];
    expect(() => moveAudio(units, 1, 0, 2)).toThrow(/ses 0 bulunamadı/);
  });

  it("does not mutate the input array", () => {
    const units = [
      makeUnitWithAudio(1, [{ blockRef: "Page 0", script: "Hello" }]),
      makeUnitWithAudio(2, []),
    ];
    const original = JSON.parse(JSON.stringify(units));
    moveAudio(units, 1, 0, 2);
    expect(units).toEqual(original);
  });
});

describe("renumberRealUnits", () => {
  it("renumbers real units 1..N following the array's current order", () => {
    const units = [makeUnit(3), makeUnit(1), makeUnit(2)];
    const outlineUnits = [makeOutlineUnit(1), makeOutlineUnit(2), makeOutlineUnit(3)];
    const { units: newUnits } = renumberRealUnits(units, outlineUnits);
    expect(newUnits.map((u) => u.unitNumber)).toEqual([1, 2, 3]);
    // the unit that was originally "3" (first in array) keeps its own title
    expect(newUnits[0].title).toBe("Unit 3");
  });

  it("keeps synthetic units' unitNumber untouched and excludes them from the count", () => {
    const units = [makeUnit(2), makeUnit(90001), makeUnit(1)];
    const outlineUnits = [makeOutlineUnit(1), makeOutlineUnit(2)];
    const { units: newUnits } = renumberRealUnits(units, outlineUnits);
    expect(newUnits.map((u) => u.unitNumber)).toEqual([1, 90001, 2]);
  });

  it("keeps outlineUnits in sync with the new numbers, preserving each entry's own data", () => {
    const units = [makeUnit(2), makeUnit(1)];
    const outlineUnits = [makeOutlineUnit(1), makeOutlineUnit(2)];
    const { outlineUnits: newOutlineUnits } = renumberRealUnits(units, outlineUnits);
    expect(newOutlineUnits.map((ou) => ou.number)).toEqual([1, 2]);
    // the outline entry that described the original "unit 2" (now renumbered to 1)
    // keeps its own learningObjectives/keyTerms, just under the new number
    expect(newOutlineUnits[0].learningObjectives).toEqual(["Objective 2"]);
    expect(newOutlineUnits[1].learningObjectives).toEqual(["Objective 1"]);
  });

  it("renumbers a moved page's own unitNumber field along with its new owning unit", () => {
    const units = [makeUnit(2, 1), makeUnit(1, 0)];
    const outlineUnits = [makeOutlineUnit(1), makeOutlineUnit(2)];
    const { units: newUnits } = renumberRealUnits(units, outlineUnits);
    expect(newUnits[0].studentBookPages[0].unitNumber).toBe(1);
  });

  it("does not mutate the input arrays", () => {
    const units = [makeUnit(2), makeUnit(1)];
    const outlineUnits = [makeOutlineUnit(1), makeOutlineUnit(2)];
    const unitsCopy = JSON.parse(JSON.stringify(units));
    renumberRealUnits(units, outlineUnits);
    expect(units).toEqual(unitsCopy);
  });
});
