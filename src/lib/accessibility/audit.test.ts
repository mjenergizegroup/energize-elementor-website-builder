import assert from "node:assert/strict";
import {
  buildAccessibilityStatementElementorData,
  createAccessibilityReport,
  repairElementorHeadingStructure,
} from "./audit";

const statement = buildAccessibilityStatementElementorData({
  practiceName: "Orange County Dental Care",
  contactEmail: "hello@example.com",
});

assert.ok(JSON.stringify(statement).includes("Accessibility Statement"));

const headingTree = [
  {
    id: "first",
    elType: "widget",
    widgetType: "heading",
    settings: { title: "First", header_size: "h3" },
    elements: [],
  },
  {
    id: "second",
    elType: "widget",
    widgetType: "heading",
    settings: { title: "Second", header_size: "h5" },
    elements: [],
  },
  {
    id: "third",
    elType: "widget",
    widgetType: "heading",
    settings: { title: "Third", header_size: "h1" },
    elements: [],
  },
];

repairElementorHeadingStructure(headingTree);

assert.equal(headingTree[0].settings.header_size, "h1");
assert.equal(headingTree[1].settings.header_size, "h2");
assert.equal(headingTree[2].settings.header_size, "h2");

const report = createAccessibilityReport({
  content: {
    practiceName: "Orange County Dental Care",
    site: {
      email: "hello@example.com",
      phone: "(555) 123-4567",
    },
    pages: [
      {
        page: "homepage",
        slug: "home",
        pageData: {
          hero: {
            heading: "Orange County Dental Care",
            cta_label: "Learn More",
            image_url: "https://example.com/doctor.jpg",
            image_alt: "",
          },
        },
      },
    ],
  },
  colors: {
    primary: "#777777",
    secondary: "#005577",
    accent: "#D9A566",
    text: "#777777",
    background: "#FFFFFF",
  },
  pages: [
    {
      page: "home",
      title: "Home",
      elementorData: [
        {
          id: "hero",
          elType: "widget",
          widgetType: "heading",
          settings: {
            title: "Orange County Dental Care",
            header_size: "h1",
          },
          elements: [],
        },
        {
          id: "cta",
          elType: "widget",
          widgetType: "button",
          settings: {
            text: "Learn More",
            link: { url: "/about" },
          },
          elements: [],
        },
      ],
    },
    {
      page: "accessibility-statement",
      title: "Accessibility Statement",
      elementorData: statement,
    },
  ],
  statementCreated: true,
});

assert.equal(report.target, "WCAG 2.2 AA");
assert.equal(report.launchReady, false);
assert.ok(report.summary.fail >= 2);
assert.ok(
  report.issues.some(
    (issue) => issue.rule === "Accessibility Statement" && issue.severity === "pass",
  ),
);
assert.ok(
  report.issues.some(
    (issue) => issue.rule === "Button and Link Clarity" && issue.severity === "fail",
  ),
);
assert.ok(
  report.issues.some(
    (issue) => issue.rule === "Images and Alt Text" && issue.severity === "fail",
  ),
);

console.log("accessibility audit checks passed");
