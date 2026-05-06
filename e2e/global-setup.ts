import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const DEPS_DIR = "/tmp/playwright-deps";
const FONTCONFIG_DIR = "/tmp/fontconfig";

function setupDeps(): void {
  if (existsSync(`${DEPS_DIR}/usr/lib/libatk-1.0.so.0`)) {
    console.log("Chromium deps already set up at", DEPS_DIR);
  } else {
    console.log("Downloading Chromium shared libraries...");
    const packages = [
      "at-spi2-core",
      "libx11",
      "libxcomposite",
      "libxdamage",
      "libxext",
      "libxfixes",
      "libxrandr",
      "libxcb",
      "libxkbcommon",
      "mesa",
      "alsa-lib",
      "nspr",
      "nss",
      "cups",
      "dbus-glib",
      "pango",
      "cairo",
      "libdrm",
      "expat",
      "libxshmfence",
      "libxrender",
      "libxau",
      "libxdmcp",
      "libxi",
    ];

    mkdirSync(DEPS_DIR, { recursive: true });

    for (const pkg of packages) {
      try {
        const url = execSync(
          `curl -s "https://archlinux.org/packages/extra/x86_64/${pkg}/download/" -o /dev/null -w '%{redirect_url}'`,
          { encoding: "utf-8" },
        ).trim();
        const realUrl =
          url ||
          execSync(
            `curl -s "https://archlinux.org/packages/core/x86_64/${pkg}/download/" -o /dev/null -w '%{redirect_url}'`,
            { encoding: "utf-8" },
          ).trim();
        if (!realUrl) continue;

        execSync(`curl -sL "${realUrl}" | zstd -d | tar -xC "${DEPS_DIR}"`, {
          stdio: "pipe",
        });
      } catch {
        console.warn(`  Skipping ${pkg} (download failed)`);
      }
    }
    console.log("Chromium deps installed.");
  }

  if (existsSync(`${FONTCONFIG_DIR}/fonts.conf`)) {
    console.log("Fontconfig already set up at", FONTCONFIG_DIR);
  } else {
    console.log("Setting up fontconfig...");
    mkdirSync(FONTCONFIG_DIR, { recursive: true });
    writeFileSync(
      `${FONTCONFIG_DIR}/fonts.conf`,
      [
        '<?xml version="1.0"?>',
        '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
        "<fontconfig>",
        "  <dir>/mnt/c/Windows/Fonts</dir>",
        `  <cachedir>${FONTCONFIG_DIR}/cache</cachedir>`,
        "  <config><rescan><int>30</int></rescan></config>",
        "</fontconfig>",
      ].join("\n"),
    );
    console.log("Fontconfig set up.");
  }
}

export default function globalSetup(): void {
  setupDeps();
}
