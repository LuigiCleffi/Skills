import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

const load = () => importFrom(makeProject(["tools"]), "tools/palette-check.mjs");

describe("palette check", () => {
  it("reads variables per theme, merges repeated blocks, and resolves var()", async () => {
    const palette = await load();
    const blocks = palette.readVariables(`/* tokens */ :root { --blue: #1f6feb; --chart-1: var(--blue); }\n:root { --chart-2: var(--missing, #d29922); }\n[data-theme="dark"] { --chart-1: #58a6ff; }`);
    const light = palette.themeVariables(blocks, [":root"]);
    assert.equal(palette.resolve(light["--chart-1"], light), "#1f6feb");
    assert.equal(palette.resolve(light["--chart-2"], light), "#d29922");
    assert.equal(palette.themeVariables(blocks, ['[data-theme="dark"]'])["--chart-1"], "#58a6ff");
  });

  it("measures color the standard way", async () => {
    const palette = await load();
    assert.deepEqual(palette.parseColor("#fff"), [1, 1, 1]);
    assert.deepEqual(palette.parseColor("rgb(255, 0, 0)"), [1, 0, 0]);
    assert.ok(Math.abs(palette.parseColor("hsl(120, 100%, 50%)")[1] - 1) < 1e-9);
    assert.equal(palette.parseColor("oklch(0.7 0.1 200)"), null);
    assert.equal(palette.contrast([0, 0, 0], [1, 1, 1]).toFixed(0), "21");
    assert.ok(palette.deltaE([1, 0, 0], [0, 0.5, 0]) > 15);
    const red = palette.simulate([0.84, 0.15, 0.16], "deuteranopia");
    const green = palette.simulate([0.17, 0.63, 0.17], "deuteranopia");
    assert.ok(palette.deltaE(red, green) < palette.deltaE([0.84, 0.15, 0.16], [0.17, 0.63, 0.17]));
  });

  it("fails low contrast, look-alike series, duplicates, and missing variables", async () => {
    const palette = await load();
    const variables = { "--bg": "#ffffff", "--a": "#1f77b4", "--b": "#1f77b4", "--c": "#fafafa", "--d": "var(--nope)" };
    const { failures } = palette.checkTheme("light", variables, { surfaces: ["--bg"], series: ["--a", "--b", "--c", "--d", "--e"] });
    assert.ok(failures.includes("light: --e is not set"));
    assert.ok(failures.includes("light: --d uses --nope, which is not set"));
    assert.ok(failures.includes("light: --a and --b are the same color"));
    assert.ok(failures.some((failure) => /--c on --bg is 1\.\d\d:1, under 3:1/.test(failure)));
  });

  it("passes a readable palette from the project's CSS", () => {
    const project = makeProject(["tools"]);
    write(project, "src/styles/tokens.css", ":root { --color-surface: #ffffff; --color-background: #f6f8fa; --chart-1: #005a9c; --chart-2: #c2410c; --chart-3: #000000; }\n");
    write(project, "tools/palette.json", JSON.stringify({ css: ["src/styles/tokens.css"], themes: { light: [":root"] }, surfaces: ["--color-surface", "--color-background"], series: ["--chart-1", "--chart-2", "--chart-3"] }));
    const result = run(project, "tools/palette-check.mjs");
    assert.equal(result.code, 0, result.stderr);
  });
});
