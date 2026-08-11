import { expect, test } from "@playwright/test";

test("Skeletal Mesh Editor offers manifest materials as persistent material slots", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(async () => {
    const { SkeletalMeshEditor } = await import("/src/editor/SkeletalMeshEditor.ts");
    SkeletalMeshEditor.open({
      modelPath: "assets/ThreeAges/Characters/Guard.glb",
      assetId: "guard",
      label: "Guard",
      assets: [
        { id: "m-guard-material", name: "M Guard.Material", assetType: "material", path: "assets/ThreeAges/Characters/M_Guard.material.json" },
        { id: "guard-bc", name: "Guard BC", assetType: "texture", path: "assets/ThreeAges/Characters/Guard_BC.png" },
        { id: "guard-n", name: "Guard N", assetType: "texture", path: "assets/ThreeAges/Characters/Guard_N.png" },
        { id: "guard-r", name: "Guard R", assetType: "texture", path: "assets/ThreeAges/Characters/Guard_R.png" },
      ],
    });
  });

  const editor = page.locator(".sm-editor-overlay");
  await expect(editor).toBeVisible();
  const materialSlot = editor.locator('[data-skel-material-slot="0"]');
  await expect(materialSlot).toBeVisible({ timeout: 30_000 });
  await expect(materialSlot).toContainText("M Guard.Material");
  await expect(materialSlot).toHaveValue("m-guard-material");

  await materialSlot.selectOption("");
  await expect(materialSlot).toHaveValue("");
  await expect(editor.locator("[data-sm-status]")).toContainText("Material slots cleared");
  await materialSlot.selectOption("m-guard-material");
  await expect(materialSlot).toHaveValue("m-guard-material");
  await expect(editor.locator("[data-sm-status]")).toContainText("Preview material slots updated.");
  expect(errors, "skeletal material preview must not produce page errors").toEqual([]);
});
