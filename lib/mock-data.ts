export type DemoExchange = {
  question: string;
  answer: string;
};

export const demoExchanges: DemoExchange[] = [
  {
    question: "What were the key findings in the Q3 report?",
    answer:
      "Revenue grew 18% quarter-over-quarter, driven mainly by expansion in enterprise accounts. Churn dropped to 3.2%, the lowest recorded this year.",
  },
  {
    question: "Summarize the onboarding dataset in two sentences.",
    answer:
      "Most users complete onboarding within 4 minutes, with the document-upload step causing the largest drop-off. Adding a progress indicator is the top-requested fix.",
  },
  {
    question: "What did customers say about the search experience?",
    answer:
      "Interview notes show customers want answers grounded in their own files, not generic responses. Voice input was called out as a time-saver during meetings.",
  },
];
