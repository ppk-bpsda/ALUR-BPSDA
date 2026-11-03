#!/usr/bin/env node
/**
 * Reset / buat akun Admin lewat Supabase Admin API (service_role).
 *
 *   node scripts/reset-admin.mjs --list
 *   node scripts/reset-admin.mjs --username admin
 *   node scripts/reset-admin.mjs --username admin --password 'SandiBaru123'
 *
 * Membaca NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dari
 * environment atau dari .env.local. Kunci service_role JANGAN dibagikan.
 * Kalau --password tidak diberikan, sandi ditanyakan (tidak terlihat di layar).
 */
import fs from "node:fs";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi (.env.local).");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function allUsers() {
  const out = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

function sandiValid(p) {
  return typeof p === "string" && p.length >= 10 && p.length <= 72 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
}

async function main() {
  const users = await allUsers();
  const { data: profiles } = await admin.from("profiles").select("id, username, nama");
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  if (args.includes("--list")) {
    console.log("\nAkun yang ada:\n");
    for (const u of users) {
      console.log(`  username: ${(byId.get(u.id)?.username ?? "(belum ada profil)").padEnd(20)} email: ${u.email}`);
    }
    console.log("");
    return;
  }

  const username = (opt("username") || "admin").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Username 3-32 karakter: huruf kecil/angka/./_/-");

  let password = opt("password");
  if (!password) {
    password = await askHidden(`Kata sandi baru untuk "${username}" (min. 10 karakter, huruf + angka): `);
  }
  if (!sandiValid(password)) throw new Error("Kata sandi harus 10-72 karakter dan mengandung huruf dan angka.");

  const emails = [`${username}@admin.local`, `${username}@spj-batu.internal`, username];
  let target = users.find((u) => byId.get(u.id)?.username === username)
    ?? users.find((u) => emails.includes((u.email || "").toLowerCase()));

  if (target) {
    const { error } = await admin.auth.admin.updateUserById(target.id, { password, email_confirm: true });
    if (error) throw error;
    await admin.auth.admin.signOut(target.id, "global").catch(() => {});
    console.log(`Kata sandi akun "${username}" (${target.email}) berhasil direset.`);
  } else {
    const email = `${username}@admin.local`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    target = data.user;
    console.log(`Akun baru "${username}" dibuat (${email}).`);
  }

  // Profil = syarat lolos RLS (is_admin()) dan dipakai halaman login.
  if (!byId.has(target.id)) {
    let { error } = await admin.from("profiles").insert({ id: target.id, username, nama: username, email: target.email });
    if (error && /email/i.test(error.message)) {
      ({ error } = await admin.from("profiles").insert({ id: target.id, username, nama: username }));
    }
    if (error) throw error;
    console.log("Profil admin dibuat.");
  }
  console.log(`\nSelesai. Login dengan username "${username}" dan kata sandi yang baru Anda isi.`);
}

main().catch((e) => { console.error("Gagal:", e?.message || e); process.exit(1); });
