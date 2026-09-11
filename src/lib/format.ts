import type { Timestamp } from "firebase/firestore";

export function toMillis(value: Timestamp | Date | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as Timestamp).toMillis === "function") return (value as Timestamp).toMillis();
  return null;
}

/** "today, 9:12 am" · "yesterday, 4:30 pm" · "12 Aug, 10:05 am" */
export function formatEdited(value: Timestamp | Date | number | null | undefined, now = new Date()): string {
  const ms = toMillis(value);
  if (ms == null) return "just now";
  const date = new Date(ms);
  const time = date
    .toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `yesterday, ${time}`;
  const day = date.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  return `${day}, ${time}`;
}

/** Malay time-of-day greeting, as in the dashboard design ("Selamat pagi, Ros"). */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Selamat pagi";
  if (h < 15) return "Selamat tengah hari";
  if (h < 19) return "Selamat petang";
  return "Selamat malam";
}

export function firstName(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  return first || null;
}

export function initials(name: string | null | undefined, fallback = "W"): string {
  const first = name?.trim()[0];
  return (first || fallback).toUpperCase();
}
