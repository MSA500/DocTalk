"use client";

import { motion } from "framer-motion";
import { FolderUp, MessageSquareText, Mic } from "lucide-react";

const steps = [
  {
    icon: FolderUp,
    title: "Upload",
    description: "Drop in your documents. DocTalk chunks and indexes them for retrieval.",
  },
  {
    icon: Mic,
    title: "Ask",
    description: "Speak your question in plain language, just like talking to a person.",
  },
  {
    icon: MessageSquareText,
    title: "Get answers",
    description: "Receive a grounded answer with the exact source passages it was built from.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="bg-surface py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="how-it-works-heading"
            className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three steps between a pile of documents and a real answer.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background text-brand ring-1 ring-border">
                <step.icon aria-hidden="true" className="h-6 w-6" />
              </div>
              <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand">
                Step {i + 1}
              </span>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
