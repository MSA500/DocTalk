"use client";

import { motion } from "framer-motion";
import {
  FileUp,
  Layers,
  Mic,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: FileUp,
    title: "Bring your own documents",
    description:
      "Upload PDFs, docs, notes, and spreadsheets. DocTalk indexes them automatically, no setup required.",
  },
  {
    icon: Mic,
    title: "Ask out loud",
    description:
      "Skip the typing. Talk to your documents like you would a colleague, and get a spoken-style answer back.",
  },
  {
    icon: Sparkles,
    title: "Grounded, sourced answers",
    description:
      "Every answer traces back to the passage it came from, so you can verify instead of guessing.",
  },
  {
    icon: Zap,
    title: "Fast by design",
    description:
      "Retrieval-augmented responses in seconds, powered by a lean pipeline built for speed.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-first",
    description:
      "Your documents stay yours. Nothing you upload is used to train shared models.",
  },
  {
    icon: Layers,
    title: "Works with your formats",
    description: "PDF, DOCX, TXT, Markdown, CSV, and more, out of the box.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="features-heading"
          className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          Everything you need to talk to your knowledge base
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          DocTalk pairs retrieval-augmented generation with a voice-first
          interface so answers feel like a conversation.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-border bg-surface p-6 transition-shadow hover:shadow-lg hover:shadow-brand/5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <feature.icon aria-hidden="true" className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
