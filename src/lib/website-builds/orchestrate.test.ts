import assert from "node:assert/strict";
import {
  createPreparedBuildPlan,
  runPreparedBuildPlan,
} from "./orchestrate";
import type {
  PreparedBuildDestination,
  PreparedBuildSourcePage,
} from "./types";

const destination: PreparedBuildDestination = {
  name: "J. Bradford Smith, DDS",
  slug: "j-bradford-smith-dds",
  wpSiteUrl: "https://destination.example.com/",
  wpUsername: "builder",
  brandKit: {
    colors: {
      primary: "#112233",
      secondary: "#223344",
      accent: "#334455",
      text: "#111111",
      background: "#ffffff",
    },
    fonts: { heading: "Poppins", body: "Inter" },
    logo: { filename: "logo.png", dataBase64: "bG9nbw==" },
    favicon: { filename: "favicon.png", dataBase64: "aWNvbg==" },
  },
};

function sourcePage(id: string, title: string, slug: string): PreparedBuildSourcePage {
  return {
    preparedDraftId: `draft-${id}`,
    pagePlanItemId: `page-${id}`,
    pageName: title,
    slug,
    contentChecksum: id.repeat(64).slice(0, 64),
    layoutRevisionId: `layout-${id}`,
    sourceSignature: `source-${id}`,
    status: "ready",
    residueReport: [],
    artifact: [
      {
        id: `${id}0a0b0c0`.slice(0, 8),
        elType: "widget",
        widgetType: "e-heading",
        settings: { title },
        elements: [],
      },
    ],
  };
}

async function main() {
  const pages = [
    sourcePage("a1", "Home", "home"),
    sourcePage("b2", "About", "about"),
  ];
  const plan = createPreparedBuildPlan({
    id: "plan-1",
    projectId: "project-1",
    pages,
    workspaceChecksum: "workspace-1",
    destination,
    now: new Date("2026-07-17T12:00:00.000Z"),
  });
  assert.equal(plan.status, "ready");
  assert.equal(plan.items.length, 2);
  assert.equal(plan.events.length, 4);

  const same = createPreparedBuildPlan({
    id: "different-id",
    projectId: "project-1",
    pages,
    workspaceChecksum: "workspace-1",
    destination,
  });
  assert.equal(same.inputChecksum, plan.inputChecksum);
  const changed = createPreparedBuildPlan({
    id: "plan-2",
    projectId: "project-1",
    pages: [{ ...pages[0], pageName: "Welcome" }, pages[1]],
    workspaceChecksum: "workspace-1",
    destination,
  });
  assert.notEqual(changed.inputChecksum, plan.inputChecksum);

  const residue = createPreparedBuildPlan({
    id: "plan-3",
    projectId: "project-1",
    pages: [{ ...pages[0], residueReport: ["source domain"] }],
    workspaceChecksum: "workspace-1",
    destination,
  });
  assert.equal(residue.status, "failed");
  assert.match(residue.blockers.join(" "), /source-layout residue/);

  let destinationCalls = 0;
  let brandCalls = 0;
  const pageCalls: string[] = [];
  let failAbout = true;
  const gateway = {
    prepareDestination: async () => {
      destinationCalls += 1;
    },
    applyBrand: async () => {
      brandCalls += 1;
    },
    upsertDraft: async (input: { slug: string }) => {
      pageCalls.push(input.slug);
      if (input.slug === "about" && failAbout) throw new Error("simulated timeout");
      return {
        id: input.slug === "home" ? 10 : 11,
        status: "draft",
        editUrl: `https://destination.example.com/edit/${input.slug}`,
        viewUrl: `https://destination.example.com/?p=${input.slug}`,
        reused: input.slug === "about",
      };
    },
  };

  const partial = await runPreparedBuildPlan(plan, pages, gateway, {
    buildId: "build-1",
    now: sequence([
      "2026-07-17T12:01:00.000Z",
      "2026-07-17T12:01:01.000Z",
      "2026-07-17T12:01:02.000Z",
      "2026-07-17T12:01:03.000Z",
      "2026-07-17T12:01:04.000Z",
      "2026-07-17T12:01:05.000Z",
      "2026-07-17T12:01:06.000Z",
    ]),
  });
  assert.equal(partial.status, "partial");
  assert.deepEqual(pageCalls, ["home", "about"]);
  assert.equal(partial.items[0].status, "draft");
  assert.equal(partial.items[1].status, "failed");
  assert.equal(destinationCalls, 1);
  assert.equal(brandCalls, 1);

  failAbout = false;
  pageCalls.length = 0;
  const recovered = await runPreparedBuildPlan(partial, pages, gateway, {
    retryFailedOnly: true,
    buildId: "build-2",
  });
  assert.equal(recovered.status, "complete");
  assert.deepEqual(pageCalls, ["about"]);
  assert.equal(recovered.items[0].attemptCount, 1);
  assert.equal(recovered.items[1].attemptCount, 2);
  assert.match(recovered.items[1].editUrl ?? "", /about/);

  console.log("prepared website build checks passed");
}

function sequence(values: string[]) {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
}

void main();
