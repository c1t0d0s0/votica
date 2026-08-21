import { describe, it, expect } from "vitest";
import { OSS_LICENSES } from "./ossLicenses";
import { translations } from "../lib/i18n/translations";

describe("OSS Licenses Data & i18n", () => {
  it("contains valid OSS licenses for all direct dependencies", () => {
    expect(OSS_LICENSES.length).toBeGreaterThanOrEqual(20);

    for (const pkg of OSS_LICENSES) {
      expect(pkg.name).toBeTruthy();
      expect(pkg.version).toBeTruthy();
      expect(pkg.license).toBeTruthy();
      expect(pkg.copyright).toBeTruthy();
      expect(pkg.licenseText).toBeTruthy();
      expect(typeof pkg.isDev).toBe("boolean");
    }
  });

  it("includes key production libraries", () => {
    const names = OSS_LICENSES.map((p) => p.name);
    expect(names).toContain("react");
    expect(names).toContain("react-dom");
    expect(names).toContain("react-router-dom");
    expect(names).toContain("firebase");
    expect(names).toContain("tailwindcss");
    expect(names).toContain("lucide-react");
  });

  it("has complete translation keys for OSS Modal and Footer", () => {
    expect(translations.ja.footer.ossLicenses).toBe("OSSライセンス");
    expect(translations.en.footer.ossLicenses).toBe("OSS Licenses");

    expect(translations.ja.ossModal.title).toContain("オープンソース");
    expect(translations.en.ossModal.title).toContain("Open Source");

    expect(translations.ja.ossModal.copyright).toBe("著作権");
    expect(translations.en.ossModal.copyright).toBe("Copyright");
  });
});
