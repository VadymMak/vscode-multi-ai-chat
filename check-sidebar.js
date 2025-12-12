const fs = require("fs");
const path = require("path");

console.log("\n🔍 SIDEBAR CONFIGURATION DIAGNOSTIC\n");

// 1. Check package.json
const packagePath = path.join(__dirname, "package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

console.log("✅ 1. CHECKING package.json...\n");

// Check viewsContainers
if (pkg.contributes && pkg.contributes.viewsContainers) {
  console.log("✅ viewsContainers exists");
  console.log(JSON.stringify(pkg.contributes.viewsContainers, null, 2));
} else {
  console.log("❌ viewsContainers MISSING!");
}

// Check views
if (pkg.contributes && pkg.contributes.views) {
  console.log("\n✅ views exists");
  console.log(JSON.stringify(pkg.contributes.views, null, 2));
} else {
  console.log("❌ views MISSING!");
}

// Check activation events
console.log("\n✅ 2. ACTIVATION EVENTS:");
console.log(pkg.activationEvents);

// 3. Check if sidebarProvider.ts exists
console.log("\n✅ 3. CHECKING FILES...\n");

const sidebarPath = path.join(__dirname, "src", "panels", "sidebarProvider.ts");
if (fs.existsSync(sidebarPath)) {
  console.log("✅ sidebarProvider.ts exists");
} else {
  console.log("❌ sidebarProvider.ts MISSING!");
}

// 4. Check icon
const iconPath = path.join(__dirname, "resources", "icon.svg");
if (fs.existsSync(iconPath)) {
  console.log("✅ resources/icon.svg exists");
} else {
  console.log("❌ resources/icon.svg MISSING!");
}

// 5. Check if extension.ts is compiled
const extJsPath = path.join(__dirname, "dist", "extension.js");
if (fs.existsSync(extJsPath)) {
  console.log("✅ out/extension.js exists (compiled)");

  const extJs = fs.readFileSync(extJsPath, "utf8");
  if (extJs.includes("SidebarProvider")) {
    console.log("✅ SidebarProvider found in compiled code");
  } else {
    console.log(
      "❌ SidebarProvider NOT found in compiled code! Need to compile!"
    );
  }
} else {
  console.log("❌ out/extension.js MISSING! Need to compile!");
}

console.log("\n✅ DIAGNOSTIC COMPLETE!\n");
