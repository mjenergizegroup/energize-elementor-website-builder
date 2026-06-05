/**
 * Elevate theme node maps.
 *
 * Maps each schema section/field to the widget IDs in the cleaned Elevate
 * Elementor templates. If the template is updated (new widget IDs, new
 * structure), these maps must be regenerated.
 *
 * Source-of-truth templates: theme-templates/elevate/*.json
 *
 * Convention: every section in the schema appears here. If a schema field
 * has no corresponding widget in the template, it's omitted (the builder
 * silently skips it).
 */

import type { PageMap } from "./types";

// =============================================================================
// HOMEPAGE
// =============================================================================

export const homepageMap: PageMap = {
  hero: {
    heading: { kind: "heading", id: "efa68b" },
    body: { kind: "text-editor", id: "cd7eaeb" },
    trust_points: { kind: "icon-list", id: "fac7f25" },
    cta_label: { kind: "button", id: "1e12af9a", urlSource: "booking_url" },
  },

  promo_bar: {
    promo_1_eyebrow: { kind: "heading", id: "625ff7ce" },
    promo_1_body: { kind: "text-editor", id: "5fd49c8a" },
    promo_2_eyebrow: { kind: "heading", id: "72696a60" },
    // No promo_2_body slot in template - heading only for the middle box
    emergency_eyebrow: { kind: "heading", id: "57c319a8" },
    emergency_body: { kind: "text-editor", id: "39035b53" },
  },

  about_intro: {
    heading: { kind: "heading", id: "3688fd05" },
    body: { kind: "text-editor", id: "504b06cd" },
    cta_label: { kind: "button", id: "2b382ce6" },
    image: { kind: "image", id: "6857cff6" },
  },

  services: {
    section_heading: { kind: "heading", id: "5ecec06d" },
    section_body: { kind: "text-editor", id: "62f3aafd" },
    // 6 service cards. Each card has: heading, body, cta_label, image.
    card: [
      {
        heading: { kind: "heading", id: "3c739629" },
        body: { kind: "text-editor", id: "73ae4a15" },
        cta_label: { kind: "button", id: "1a650f30" },
        image: { kind: "image", id: "3580e5f3" },
      },
      {
        heading: { kind: "heading", id: "9206cb7" },
        body: { kind: "text-editor", id: "6dec9746" },
        cta_label: { kind: "button", id: "63e64fad" },
        image: { kind: "image", id: "4d93dbb2" },
      },
      {
        heading: { kind: "heading", id: "377775e1" },
        body: { kind: "text-editor", id: "156b4bf" },
        cta_label: { kind: "button", id: "71779402" },
        image: { kind: "image", id: "211adce4" },
      },
      {
        heading: { kind: "heading", id: "6be75107" },
        body: { kind: "text-editor", id: "5e7f9b63" },
        cta_label: { kind: "button", id: "41379f12", urlSource: "phone_tel" },
        image: { kind: "image", id: "e6814e3" },
      },
      {
        heading: { kind: "heading", id: "61c1fd75" },
        body: { kind: "text-editor", id: "308084ae" },
        cta_label: { kind: "button", id: "5906d8d0" },
        image: { kind: "image", id: "4f8771e1" },
      },
      {
        heading: { kind: "heading", id: "434e1c4f" },
        body: { kind: "text-editor", id: "50b6bfaf" },
        cta_label: { kind: "button", id: "ee8cb27" },
        // 6th card has no image widget in template
      },
    ],
  },

  doctor_feature: {
    eyebrow: { kind: "heading", id: "585478ca" },
    heading: { kind: "heading", id: "52969a0b" },
    body: { kind: "text-editor", id: "60f8721c" },
    cta_label: { kind: "button", id: "37715124" },
    // Doctor image is a container background, not a widget. Handled by David.
  },

  final_cta: {
    heading: { kind: "heading", id: "4c9f9fc0" },
    body: { kind: "text-editor", id: "1bc04fbd" },
    cta_label: { kind: "button", id: "540a6d9e", urlSource: "booking_url" },
  },
};

// =============================================================================
// ABOUT
// =============================================================================

export const aboutMap: PageMap = {
  hero: {
    heading: { kind: "heading", id: "460554ae" },
    body: { kind: "text-editor", id: "600af01a" },
    cta_label: { kind: "button", id: "4ca72f8e", urlSource: "booking_url" },
    // Phone button #44132cac is auto-populated from site.phone
  },

  practice_intro: {
    heading: { kind: "heading", id: "5cffd039" },
    body: { kind: "text-editor", id: "55ca4e92" },
  },

  doctors: {
    doctor: [
      {
        heading: { kind: "heading", id: "78d9b38b" },
        body: { kind: "text-editor", id: "68a80915" },
      },
      {
        heading: { kind: "heading", id: "76aa398a" },
        body: { kind: "text-editor", id: "25a5a688" },
      },
      {
        heading: { kind: "heading", id: "15b00e7a" },
        body: { kind: "text-editor", id: "850f592" },
      },
    ],
  },

  team: {
    section_heading: { kind: "elementskit-heading", id: "38cc0b5d" },
    member: [
      { name: { kind: "image-box", id: "77172038", titleKey: "name", descKey: "role" } },
      { name: { kind: "image-box", id: "7364f400", titleKey: "name", descKey: "role" } },
      { name: { kind: "image-box", id: "754f6f51", titleKey: "name", descKey: "role" } },
      { name: { kind: "image-box", id: "e3c063", titleKey: "name", descKey: "role" } },
      { name: { kind: "image-box", id: "707fdf91", titleKey: "name", descKey: "role" } },
    ],
  },

  location: {
    heading: { kind: "heading", id: "13b620b5" },
    body: { kind: "text-editor", id: "68caacf0" },
  },

  final_cta: {
    heading: { kind: "heading", id: "17362999" },
    body: { kind: "text-editor", id: "19474dea" },
    cta_label: { kind: "button", id: "79e190d4", urlSource: "booking_url" },
  },
};

// =============================================================================
// SERVICE PAGE
// =============================================================================

export const servicePageMap: PageMap = {
  hero: {
    heading: { kind: "heading", id: "1352ddf1" },
    body: { kind: "text-editor", id: "1e818bbe" },
    cta_label: { kind: "button", id: "5b32646a", urlSource: "booking_url" },
    // Phone button #155cb69c is auto-populated from site
  },

  overview: {
    heading: { kind: "heading", id: "5ed2158c" },
    body: { kind: "text-editor", id: "5e6a22bf" },
    cta_label: { kind: "button", id: "3907317b", urlSource: "booking_url" },
    image: { kind: "image", id: "20d0ab33" },
  },

  featured_sub_services: {
    section_heading: { kind: "heading", id: "77faa38d" },
    item: [
      {
        title: { kind: "icon-box-title", id: "4506ceeb" },
        body: { kind: "heading", id: "1e4ce8ba" },
      },
      {
        title: { kind: "icon-box-title", id: "7aaab626" },
        body: { kind: "heading", id: "5c96930d" },
      },
      {
        title: { kind: "icon-box-title", id: "164b9df9" },
        body: { kind: "heading", id: "2358024f" },
      },
    ],
  },

  benefits: {
    heading: { kind: "heading", id: "26406d39" },
    body: { kind: "text-editor", id: "3e3b443f" },
    cta_label: { kind: "button", id: "1c3378a7", urlSource: "booking_url" },
  },

  treatment_journey: {
    heading: { kind: "heading", id: "981c04c" },
    body: { kind: "text-editor", id: "1121b959" },
  },

  faq: {
    eyebrow: { kind: "heading", id: "6a359b3e" },
    heading: { kind: "heading", id: "4ac02eb0" },
    // FAQ items go into elementskit-accordion widgets - handled specially by the builder
    // because the schema's list of {q, a} must populate the accordion tabs array.
  },

  final_cta: {
    heading: { kind: "heading", id: "57857188" },
    body: { kind: "text-editor", id: "7908fcda" },
    cta_label: { kind: "button", id: "68aae7a5", urlSource: "booking_url" },
  },
};

// =============================================================================
// CONTACT
// =============================================================================

export const contactMap: PageMap = {
  hero: {
    heading: { kind: "heading", id: "6489253" },
    body: { kind: "text-editor", id: "5e5de8cc" },
    cta_label: { kind: "button", id: "52397f4c", urlSource: "booking_url" },
  },

  contact_info: {
    heading: { kind: "heading", id: "6203fb9e" },
    body: { kind: "text-editor", id: "3b139a4f" },
    // The practice name display is auto-populated from site.practice_name
    // The address and phone icon-boxes are auto-populated from site values
  },

  // No final_cta on Contact page - template does not have the section
};

// =============================================================================
// AMENITIES
// =============================================================================

export const amenitiesMap: PageMap = {
  hero: {
    heading: { kind: "heading", id: "1d452249" },
  },

  intro: {
    eyebrow: { kind: "heading", id: "145bdb7a" },
    heading: { kind: "heading", id: "7a7a6a9c" },
    body: { kind: "text-editor", id: "4f0cbbc4" },
    cta_label: { kind: "button", id: "6633414b", urlSource: "booking_url" },
  },

  comfort_menu: {
    heading: { kind: "heading", id: "75feeebe" },
    body: { kind: "text-editor", id: "1a66013" },
    item: [
      { image: { kind: "image", id: "22a2569d" } },
      { image: { kind: "image", id: "df9cada" } },
      { image: { kind: "image", id: "2db88e4c" } },
      { image: { kind: "image", id: "2c4fe145" } },
      { image: { kind: "image", id: "2fd2ff88" } },
    ],
  },

  membership_cta: {
    heading: { kind: "heading", id: "6f78f75d" },
    body: { kind: "text-editor", id: "5a590a26" },
    cta_label: { kind: "button", id: "35a0ee98", urlSource: "membership_url" },
  },
};

// =============================================================================
// FIRST VISIT
// =============================================================================

export const firstVisitMap: PageMap = {
  hero: {
    heading: { kind: "heading", id: "72420383" },
  },

  intro: {
    heading: { kind: "heading", id: "2c18df6a" },
    body: { kind: "text-editor", id: "53792118" },
    cta_label: { kind: "button", id: "7e03821d", urlSource: "booking_url" },
  },

  what_to_expect: {
    heading: { kind: "heading", id: "66553274" },
    body: { kind: "text-editor", id: "3b496297" },
    cta_label: { kind: "button", id: "1d90cfc7", urlSource: "booking_url" },
  },

  comfort_menu: {
    heading: { kind: "heading", id: "477e4869" },
    body: { kind: "text-editor", id: "5aaa61f4" },
    item: [
      { image: { kind: "image", id: "f1d098f" } },
      { image: { kind: "image", id: "15735709" } },
      { image: { kind: "image", id: "b7ae357" } },
      { image: { kind: "image", id: "3ee6a55a" } },
      { image: { kind: "image", id: "2c2faaf6" } },
    ],
  },

  insurance_teaser: {
    heading: { kind: "heading", id: "760b430d" },
    body: { kind: "text-editor", id: "22e648ff" },
    cta_label: { kind: "button", id: "383f4dea" },
  },

  membership_cta: {
    heading: { kind: "heading", id: "2317f5f1" },
    body: { kind: "text-editor", id: "446e18ff" },
    cta_label: { kind: "button", id: "5a5280ec", urlSource: "membership_url" },
  },
};

// =============================================================================
// INSURANCE AND FINANCING
// =============================================================================

export const insuranceFinancingMap: PageMap = {
  hero: {
    heading: { kind: "heading", id: "36cbc8f5" },
  },

  insurance: {
    heading: { kind: "heading", id: "2c9e9926" },
    body: { kind: "text-editor", id: "60a8a28e" },
  },

  financing: {
    heading: { kind: "heading", id: "11c56088" },
    body: { kind: "text-editor", id: "2b0ad6c6" },
    cta_label: { kind: "button", id: "16dd35d6", urlSource: "booking_url" },
  },

  membership_cta: {
    heading: { kind: "heading", id: "30294a90" },
    body: { kind: "text-editor", id: "44a75c5b" },
    cta_label: { kind: "button", id: "30e0047f", urlSource: "membership_url" },
  },
};

// =============================================================================
// Lookup
// =============================================================================

import type { ElevatePageType } from "./types";

export const pageMaps: Record<ElevatePageType, PageMap> = {
  homepage: homepageMap,
  about: aboutMap,
  "service-page": servicePageMap,
  contact: contactMap,
  amenities: amenitiesMap,
  "first-visit": firstVisitMap,
  "insurance-and-financing": insuranceFinancingMap,
};
