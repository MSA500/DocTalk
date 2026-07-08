import type { Metadata } from "next";
import { Mic, ShieldCheck, Sparkles } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About",
  description: `Learn what ${siteConfig.name} is building and why.`,
  alternates: {
    canonical: "/about",
  },
};

const values = [
  {
    icon: Sparkles,
    title: "Answers you can verify",
    description:
      "Every response is grounded in a real passage from your documents, not an unverifiable guess.",
  },
  {
    icon: Mic,
    title: "Voice as a first-class input",
    description:
      "Talking is often faster than typing. DocTalk is designed around asking questions out loud.",
  },
  {
    icon: ShieldCheck,
    title: "Your documents stay yours",
    description:
      "Uploaded files are used only to answer your questions, never to train shared models.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        About {siteConfig.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        {`${siteConfig.name} is a voice-enabled retrieval-augmented generation (RAG) assistant. This page is a Phase 1 placeholder — the final copy, team details, and roadmap will be filled in as the product takes shape.`}
      </p>

      <section aria-labelledby="values-heading" className="mt-12">
        <h2 id="values-heading" className="text-xl font-semibold text-foreground">
          What we care about
        </h2>
        <ul className="mt-6 space-y-6">
          {values.map((value) => (
            <li key={value.title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <value.icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{value.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {value.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="status-heading" className="mt-12 rounded-2xl border border-border bg-surface p-6">
        <h2 id="status-heading" className="text-base font-semibold text-foreground">
          Project status
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This build is the Phase 1 frontend skeleton: layout, theming, and
          interaction design only. Document processing, voice input, and
          answer generation are not wired up yet.
        </p>
      </section>
    </div>
  );
}
