"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-brand px-6 py-16 text-center sm:px-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent"
        />
        <h2 className="font-display text-3xl font-bold tracking-tight text-brand-foreground sm:text-4xl">
          Ready to talk to your documents?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-brand-foreground/80">
          Open the dashboard to upload a document and start talking to it.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Open the dashboard
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </motion.div>
    </section>
  );
}
