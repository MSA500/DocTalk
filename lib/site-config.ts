export const siteConfig = {
  name: "DocTalk",
  shortName: "DocTalk",
  tagline: "Talk to your documents.",
  description:
    "DocTalk is a voice-enabled RAG assistant. Upload your documents, ask questions out loud, and get grounded, source-backed answers in seconds.",
  url: "https://doctalk.app",
  ogImage: "/og-image.png",
  keywords: [
    "DocTalk",
    "voice assistant",
    "RAG",
    "retrieval augmented generation",
    "document assistant",
    "AI document search",
    "voice AI",
    "chat with documents",
  ],
  creator: "DocTalk",
  themeColor: "#4f46e5",
  links: {
    twitter: "#",
    github: "#",
    linkedin: "#",
  },
} as const;

export type NavLink = {
  label: string;
  href: string;
};

export const primaryNav: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "About", href: "/about" },
  { label: "Settings", href: "/settings" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Voice Assistant", href: "/dashboard#voice-assistant" },
      { label: "Document Library", href: "/dashboard#document-library" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Settings", href: "/settings" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Support", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
];
