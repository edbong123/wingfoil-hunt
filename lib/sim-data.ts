// Sample data for the simulator. Photos are public Wikimedia Commons files (CC licenses, credit on their pages).
const commons = (file: string, width = 1080) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

export type SampleImage = { id: string; url: string; thumb: string; label: string; source: string };

const img = (id: string, file: string, label: string): SampleImage => ({
  id,
  url: commons(file),
  thumb: commons(file, 320),
  label,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`,
});

export const IMAGES: SampleImage[] = [
  img("tarifa", "Nia Suardiaz Wingfoil.jpg", "Tarifa rider"),
  img("florida", "Red-Orange Wing Foil South Florida Watersports Like Kiteboarding (50009800442).jpg", "Red-orange wing, Florida"),
  img("freestyle", "Wingfoil freestyle.jpg", "Freestyle jump"),
  img("wave", "Wingfoiling on a wave.jpg", "Riding a wave"),
  img("maui", "Wing foiling in Maui, Hawaii.jpg", "Maui session"),
  img("plane", "A380 Wing.jpg", "Airplane wing (off-topic test)"),
];

export const imageById = (id: string) => IMAGES.find((i) => i.id === id);

export type Step = {
  label: string; // chip label
  text?: string;
  imageId?: string;
  attachType?: "image" | "video" | "ig_reel" | "share";
  expect: string; // what should happen
};

export type Persona = {
  key: string;
  handle: string;
  name: string;
  color: string;
  blurb: string;
  steps: Step[];
};

export const PERSONAS: Persona[] = [
  {
    key: "kai",
    handle: "kai.foils",
    name: "Kai Moreno",
    color: "#f97316",
    blurb: "Happy path. Shoots himself in Tarifa, confirms rights, gets approved.",
    steps: [
      { label: "Ask how it works", text: "Hey! Saw your story about the hunt. How does it work, can I send a pic?", expect: "Bot explains the hunt and asks for the original file." },
      { label: "Caption", text: "Levante pumping at Valdevaqueros today, 28 knots and butter flat between sets", expect: "Saved as the caption for the next upload." },
      { label: "Send photo", imageId: "tarifa", expect: "Bot asks to confirm rights with YES." },
      { label: "Confirm YES", text: "Yes, I took it myself, go for it", expect: "Claude screens it. Should be approved and live on the voting page." },
    ],
  },
  {
    key: "lena",
    handle: "lena_wings",
    name: "Lena Brandt",
    color: "#8b5cf6",
    blurb: "Photographer. Rider is a friend, so she tags the athlete.",
    steps: [
      { label: "Send photo", imageId: "freestyle", expect: "Bot asks to confirm rights." },
      { label: "YES + rider + caption", text: "YES @marco.rides first clean backloop of the season, Naxos Mikri Vigla", expect: "Rider stored as @marco.rides, caption saved, screened." },
    ],
  },
  {
    key: "moana",
    handle: "moana.downwind",
    name: "Moana Akana",
    color: "#06b6d4",
    blurb: "Sends a shared reel first, then the raw file.",
    steps: [
      { label: "Share a reel", attachType: "ig_reel", imageId: "maui", expect: "Bot says shared reels arrive as links and asks for the original file." },
      { label: "Send raw photo", imageId: "maui", text: "Sunrise Maliko run, 9 miles of bumps", expect: "Bot asks to confirm rights." },
      { label: "Confirm YES", text: "yes!", expect: "Screened and approved." },
    ],
  },
  {
    key: "jonas",
    handle: "jonas.pumps",
    name: "Jonas Weber",
    color: "#22c55e",
    blurb: "Changes his mind and declines the rights confirmation.",
    steps: [
      { label: "Send photo", imageId: "wave", expect: "Bot asks to confirm rights." },
      { label: "Ask a question", text: "Wait, will you put my name on it?", expect: "Bot answers and reminds him to reply YES." },
      { label: "Say no", text: "No, actually my sponsor owns this one, sorry", expect: "Submission cancelled, polite reply." },
    ],
  },
  {
    key: "shop",
    handle: "wingdeals.shop",
    name: "Wing Deals",
    color: "#ef4444",
    blurb: "Advertising attempt. Should be rejected or flagged.",
    steps: [
      { label: "Send photo", imageId: "florida", text: "NEW 2027 wings in stock! 20% off with code FOIL20, link in bio, free shipping EU", expect: "Bot asks to confirm rights." },
      { label: "Confirm YES", text: "yes", expect: "Claude should reject or flag it as advertising." },
    ],
  },
  {
    key: "plane",
    handle: "avgeek.tom",
    name: "Tom Fischer",
    color: "#64748b",
    blurb: "Off-topic: an airplane wing. Should be rejected.",
    steps: [
      { label: "Send photo", imageId: "plane", text: "Biggest wing you've ever seen haha", expect: "Bot asks to confirm rights." },
      { label: "Confirm YES", text: "yes mine", expect: "Claude should reject it as not wingfoiling." },
    ],
  },
];

export const personaByKey = (k: string | undefined) => PERSONAS.find((p) => p.key === k) ?? PERSONAS[0];
export const simIgsid = (p: Persona) => `sim_${p.handle.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
