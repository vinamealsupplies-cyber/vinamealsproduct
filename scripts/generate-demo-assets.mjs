import { mkdir, writeFile } from "node:fs/promises";

const items = [
  { file: "tropical-mango", title: "Tropical Mango", subtitle: "SUNNY SLICES", bg1: "#fff3a8", bg2: "#ffb66e", accent: "#0b7a55", product: "bag", ingredient: "mango" },
  { file: "veggie-dumplings", title: "Garden Veggie", subtitle: "DUMPLINGS", bg1: "#c9f3d9", bg2: "#96d8f1", accent: "#6f4aa8", product: "box", ingredient: "dumpling" },
  { file: "chili-crisp", title: "Golden Chili", subtitle: "CRISP", bg1: "#ffd4a3", bg2: "#ff7d67", accent: "#8d241c", product: "jar", ingredient: "chili" },
  { file: "rice-crackers", title: "Sesame Rice", subtitle: "CRACKERS", bg1: "#f7e7b0", bg2: "#d8f27a", accent: "#315f50", product: "bag", ingredient: "cracker" },
  { file: "coconut-water", title: "Pure Coconut", subtitle: "WATER", bg1: "#c8eff7", bg2: "#bdebcf", accent: "#087a71", product: "bottle", ingredient: "coconut" },
  { file: "ramen-kit", title: "Weeknight", subtitle: "RAMEN KIT", bg1: "#e8d9ff", bg2: "#ffcf8c", accent: "#563686", product: "box", ingredient: "ramen" }
];

function ingredientShapes(kind, detail = false) {
  const transform = detail ? "translate(0 30) scale(1.18)" : "";
  const groupStart = `<g transform="${transform}">`;
  if (kind === "mango") return `${groupStart}<g fill="#ffb31a"><path d="M160 500c50-95 137-123 190-57-42 81-115 111-190 57Z"/><path d="M620 520c42-88 126-116 181-50-38 78-106 108-181 50Z"/></g><path d="M274 438c31-38 61-58 92-62" stroke="#0b7a55" stroke-width="16" stroke-linecap="round"/><path d="M705 457c26-35 56-54 87-59" stroke="#0b7a55" stroke-width="16" stroke-linecap="round"/></g>`;
  if (kind === "dumpling") return `${groupStart}<g fill="#fff8df" stroke="#5e9c77" stroke-width="8"><path d="M115 516c21-96 128-133 208-58-6 92-134 123-208 58Z"/><path d="M641 502c16-84 116-125 194-55-8 82-117 113-194 55Z"/></g><g stroke="#5e9c77" stroke-width="6"><path d="M176 467c24 29 50 43 78 45"/><path d="M697 458c23 26 48 39 74 40"/></g></g>`;
  if (kind === "chili") return `${groupStart}<g fill="#c63426"><path d="M118 493c91-14 155 20 185 84-89 29-156-6-185-84Z"/><path d="M672 491c76-23 144 6 177 65-76 34-145 6-177-65Z"/></g><g stroke="#0b7a55" stroke-width="13" stroke-linecap="round"><path d="M129 489c-7-34 4-60 34-80"/><path d="M686 484c-2-35 12-59 42-74"/></g></g>`;
  if (kind === "cracker") return `${groupStart}<g fill="#f6ca62" stroke="#9b7228" stroke-width="7"><circle cx="220" cy="515" r="72"/><circle cx="746" cy="510" r="67"/></g><g fill="#6f4d18"><circle cx="191" cy="491" r="5"/><circle cx="225" cy="525" r="5"/><circle cx="244" cy="484" r="5"/><circle cx="720" cy="488" r="5"/><circle cx="756" cy="522" r="5"/><circle cx="776" cy="486" r="5"/></g></g>`;
  if (kind === "coconut") return `${groupStart}<g><circle cx="224" cy="512" r="78" fill="#6b9a4a"/><circle cx="224" cy="512" r="58" fill="#fffdf5"/><circle cx="740" cy="506" r="73" fill="#6b9a4a"/><circle cx="740" cy="506" r="54" fill="#fffdf5"/></g><path d="M210 431c18-47 52-76 99-87" stroke="#0b7a55" stroke-width="15" stroke-linecap="round"/></g>`;
  return `${groupStart}<g fill="none" stroke="#563686" stroke-width="12" stroke-linecap="round"><path d="M116 520c45-63 112-91 201-82"/><path d="M126 548c55-55 118-77 190-65"/><path d="M650 518c46-59 108-84 186-76"/><path d="M661 548c49-50 108-70 177-60"/></g><g fill="#0b7a55"><circle cx="201" cy="436" r="13"/><circle cx="755" cy="441" r="13"/></g></g>`;
}

function packageShape(type, item) {
  if (type === "jar") return `<g filter="url(#shadow)"><rect x="345" y="185" width="310" height="390" rx="70" fill="#f8c24e"/><rect x="370" y="150" width="260" height="85" rx="30" fill="#4c3025"/><rect x="380" y="300" width="240" height="165" rx="26" fill="#fff9ed"/><text x="500" y="354" text-anchor="middle" font-size="34" font-weight="900" fill="${item.accent}">${item.title}</text><text x="500" y="401" text-anchor="middle" font-size="42" font-weight="900" fill="#18312c">${item.subtitle}</text><circle cx="500" cy="510" r="28" fill="${item.accent}"/></g>`;
  if (type === "bottle") return `<g filter="url(#shadow)"><rect x="405" y="130" width="190" height="80" rx="24" fill="#0d6d65"/><path d="M370 240c0-50 40-90 90-90h80c50 0 90 40 90 90v310c0 52-42 94-94 94h-72c-52 0-94-42-94-94V240Z" fill="#f7fffc"/><path d="M389 265h222v225H389z" fill="#bceef2"/><text x="500" y="330" text-anchor="middle" font-size="35" font-weight="900" fill="${item.accent}">${item.title}</text><text x="500" y="378" text-anchor="middle" font-size="44" font-weight="900" fill="#18312c">${item.subtitle}</text><path d="M462 433c42-52 74-52 79 0-25 26-52 26-79 0Z" fill="#0b7a55"/></g>`;
  if (type === "box") return `<g filter="url(#shadow)"><path d="M320 195 680 170l35 410-390 35Z" fill="#fffdf7"/><path d="M320 195 680 170l10 110-360 26Z" fill="${item.accent}" opacity=".95"/><circle cx="512" cy="408" r="112" fill="url(#spot)"/><text x="505" y="347" text-anchor="middle" font-size="34" font-weight="900" fill="${item.accent}">${item.title}</text><text x="505" y="400" text-anchor="middle" font-size="48" font-weight="900" fill="#18312c">${item.subtitle}</text><text x="505" y="463" text-anchor="middle" font-size="18" font-weight="800" fill="#60736e">BRIGHT · EASY · DELICIOUS</text></g>`;
  return `<g filter="url(#shadow)"><path d="M330 160h340l44 440H286l44-440Z" fill="#fffdf7"/><path d="M330 160h340l13 130H317l13-130Z" fill="${item.accent}"/><circle cx="500" cy="405" r="125" fill="url(#spot)"/><text x="500" y="345" text-anchor="middle" font-size="36" font-weight="900" fill="${item.accent}">${item.title}</text><text x="500" y="398" text-anchor="middle" font-size="48" font-weight="900" fill="#18312c">${item.subtitle}</text><text x="500" y="458" text-anchor="middle" font-size="18" font-weight="800" fill="#60736e">SHARE SOMETHING BRIGHT</text></g>`;
}

function svg(item, detail = false) {
  const label = detail ? `${item.title} ${item.subtitle} serving detail` : `${item.title} ${item.subtitle} package illustration`;
  const detailCenter = detail ? `<g filter="url(#shadow)"><ellipse cx="500" cy="425" rx="270" ry="180" fill="#fffdf7"/><ellipse cx="500" cy="420" rx="220" ry="130" fill="url(#spot)"/><text x="500" y="390" text-anchor="middle" font-size="45" font-weight="900" fill="${item.accent}">${item.title}</text><text x="500" y="445" text-anchor="middle" font-size="56" font-weight="900" fill="#18312c">${item.subtitle}</text><text x="500" y="495" text-anchor="middle" font-size="18" font-weight="800" fill="#60736e">SERVING IDEA</text></g>` : packageShape(item.product, item);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800" role="img" aria-label="${label}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${item.bg1}"/><stop offset="1" stop-color="${item.bg2}"/></linearGradient><radialGradient id="spot"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#f3f7f4"/></radialGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="24" stdDeviation="20" flood-color="#18312c" flood-opacity=".18"/></filter></defs>
  <rect width="1000" height="800" rx="54" fill="url(#bg)"/><circle cx="100" cy="120" r="48" fill="#fff" opacity=".35"/><circle cx="900" cy="670" r="90" fill="#fff" opacity=".28"/><path d="M0 650C220 560 320 760 520 680s310-70 480 25v95H0Z" fill="#fff" opacity=".35"/>
  ${ingredientShapes(item.ingredient, detail)}${detailCenter}
  <g fill="#18312c" opacity=".18"><circle cx="86" cy="630" r="10"/><circle cx="910" cy="112" r="14"/><circle cx="846" cy="183" r="7"/></g>
</svg>`;
}

await mkdir(new URL("../public/products/", import.meta.url), { recursive: true });
for (const item of items) {
  await writeFile(new URL(`../public/products/${item.file}.svg`, import.meta.url), svg(item));
  await writeFile(new URL(`../public/products/${item.file}-detail.svg`, import.meta.url), svg(item, true));
}
await writeFile(new URL("../public/favicon.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#0b7a55"/><circle cx="46" cy="18" r="10" fill="#d8f27a"/><text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="900" fill="white">BB</text></svg>`);
console.log(`Generated ${items.length * 2 + 1} demo assets.`);
