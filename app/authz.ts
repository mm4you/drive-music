import type { ChatGPTUser } from "./chatgpt-auth";

export type AppRole = "admin" | "user";

const ADMIN_EMAILS = new Set([
  "nhutkhang11306@gmail.com",
]);

export function roleForUser(user: ChatGPTUser): AppRole {
  return ADMIN_EMAILS.has(user.email.trim().toLocaleLowerCase()) ? "admin" : "user";
}

export function isAdminUser(user: ChatGPTUser) {
  return roleForUser(user) === "admin";
}
