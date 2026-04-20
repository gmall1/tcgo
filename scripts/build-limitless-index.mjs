#!/usr/bin/env node
/**
 * Paginates pokemontcg.io /v2/cards and writes a static lookup so the
 * Limitless importer can resolve most cards without a live API call.
 *
 * Output: src/lib/limitlessIndex.json
 *   {
 *     "byCode": { "OBF-125": "sv3-125", "BS-4": "base1-4", ... },
 *     "byName": { "charizard ex": ["sv3-125", ...] },
 *     "generatedAt": "2026-04-20T…Z",
 *     "count": <int>
 *   }
 *
 * Usage:
 *   POKEMONTCG_API_KEY=xxx node scripts/build-limitless-index.mjs
 *   # The key is optional but lifts rate limits from 30/min → 20k/day.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY || process.env.VITE_POKEMONTCG_API_KEY;
const PAGE_SIZE = 250;
const FIELDS = ["id", "name", "number", "set"].join(",");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT = path.resolve(__dirname, "..", "src", "lib", "limitlessIndex.json");

function headers() {
  return API_KEY ? { "X-Api-Key": API_KEY } : {};
}

async function fetchPage(page) {
  const url = `${BASE_URL}/cards?page=${page}&pageSize=${PAGE_SIZE}&select=${FIELDS}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`API ${res.status} on page ${page}`);
  return res.json();
}

async function main() {
  const byCode = {};
  const byName = {};
  let totalCount = 0;
  let page = 1;

  console.log(`Building Limitless index${API_KEY ? " (authenticated)" : ""}...`);
  while (true) {
    const body = await fetchPage(page);
    const data = body?.data || [];
    if (!data.length) break;

    for (const c of data) {
      const id = c.id;
      const name = (c.name || "").trim();
      const number = String(c.number || "").trim();
      const code = (c.set?.ptcgoCode || "").trim().toUpperCase();

      if (code && number) {
        // Prefer earliest set for a given code+number collision.
        const key = `${code}-${number}`;
        if (!byCode[key]) byCode[key] = id;
      }
      if (name) {
        const nk = name.toLowerCase();
        (byName[nk] ||= []).push(id);
      }
      totalCount += 1;
    }

    const total = body?.totalCount ?? 0;
    console.log(`  page ${page}: +${data.length} (total seen: ${totalCount}${total ? ` / ${total}` : ""})`);
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: totalCount,
    byCode,
    byName,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload));
  console.log(`Wrote ${OUT}`);
  console.log(`  byCode entries: ${Object.keys(byCode).length}`);
  console.log(`  byName entries: ${Object.keys(byName).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
