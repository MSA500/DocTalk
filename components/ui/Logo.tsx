import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "mark" | "wordmark";
  className?: string;
};

export function Logo({ variant = "wordmark", className }: LogoProps) {
  if (variant === "mark") {
    return (
      <svg
        viewBox="0 0 48 48"
        role="img"
        aria-labelledby="logoMarkTitle"
        className={cn("h-9 w-9", className)}
      >
        <title id="logoMarkTitle">DocTalk</title>
        <rect width="48" height="48" rx="11.5" className="fill-brand" />
        <g fill="#FFFFFF">
          <rect x="12.5" y="20.5" width="4" height="7" rx="2" />
          <rect x="19.5" y="14" width="4" height="20" rx="2" />
          <rect x="26.5" y="10.5" width="4" height="27" rx="2" />
          <rect x="33.5" y="17" width="4" height="14" rx="2" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 176 40"
      role="img"
      aria-labelledby="logoWordmarkTitle"
      className={cn("h-9 w-auto", className)}
    >
      <title id="logoWordmarkTitle">DocTalk</title>
      <rect x="0" y="0" width="40" height="40" rx="9.5" className="fill-brand" />
      <g fill="#FFFFFF">
        <rect x="10.5" y="17" width="3.4" height="6" rx="1.7" />
        <rect x="16.5" y="11.5" width="3.4" height="17" rx="1.7" />
        <rect x="22.5" y="8.5" width="3.4" height="23" rx="1.7" />
        <rect x="28.5" y="14" width="3.4" height="12" rx="1.7" />
      </g>
      <text
        x="50"
        y="27"
        fontFamily="var(--font-display)"
        fontSize="20"
        fontWeight="700"
        className="fill-foreground"
      >
        DocTalk
      </text>
    </svg>
  );
}
