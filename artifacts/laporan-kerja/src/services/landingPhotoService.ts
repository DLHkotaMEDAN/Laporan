import { supabase } from "@/lib/supabase";

export const landingPhotoSlots = ["mayor", "deputyMayor", "environmentHead"] as const;
export type LandingPhotoSlot = typeof landingPhotoSlots[number];

const bucket = "assets";
const pathFor = (slot: LandingPhotoSlot) => `landing/${slot}.jpg`;

const base64ToBlob = (base64: string) => {
  const [header, data] = base64.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(data);
  const values = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) values[index] = bytes.charCodeAt(index);
  return new Blob([values], { type: mime });
};

export const getLandingPhotoPublicUrl = (slot: LandingPhotoSlot) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(pathFor(slot));
  return data.publicUrl;
};

/** Returns null until an administrator has uploaded an internal photo for this position. */
export const getStoredLandingPhotoUrl = async (slot: LandingPhotoSlot) => {
  const { error } = await supabase.storage.from(bucket).download(pathFor(slot));
  return error ? null : getLandingPhotoPublicUrl(slot);
};

export const uploadLandingPhoto = async (slot: LandingPhotoSlot, base64: string) => {
  const { error } = await supabase.storage.from(bucket).upload(pathFor(slot), base64ToBlob(base64), {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  return `${getLandingPhotoPublicUrl(slot)}?v=${Date.now()}`;
};

export const removeLandingPhoto = async (slot: LandingPhotoSlot) => {
  const { error } = await supabase.storage.from(bucket).remove([pathFor(slot)]);
  if (error) throw error;
};
