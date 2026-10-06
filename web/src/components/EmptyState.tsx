import { Logo } from './Logo.js';

interface ExampleQuestion {
  topic: string;
  question: string;
}

// Shown before the first message. Clicking one sends it.
const EXAMPLE_QUESTIONS: readonly ExampleQuestion[] = [
  {
    topic: 'Winter',
    question: 'Which hubs in the Midwest are most exposed to winter disruption?',
  },
  {
    topic: 'Hurricane and flood',
    question: 'Compare Miami and Houston in terms of hurricane and flood exposure.',
  },
  {
    topic: 'Snowfall',
    question: 'What percentage of days in Denver last year had snowfall?',
  },
  {
    topic: 'Risk drivers',
    question: "Why is the Dallas hub's risk high?",
  },
];

export function EmptyState({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <section className="empty" aria-labelledby="empty-title">
      <Logo size={56} />
      <h1 id="empty-title" className="empty-title">
        Weather risk across your hubs
      </h1>
      <p className="empty-text">
        Hubcast helps you explore weather risk across the 19 distribution hubs: winter, flood,
        hurricane, severe storms, heat and wildfire. Answers come from weather statistics and FEMA
        hazard data, and the risk scores are calculated, not guessed.
      </p>
      <h2 className="empty-subtitle">Try asking</h2>
      <ul className="suggestions">
        {EXAMPLE_QUESTIONS.map(({ topic, question }) => (
          <li key={question}>
            <button type="button" className="suggestion" onClick={() => onAsk(question)}>
              <span className="suggestion-topic">{topic}</span>
              <span className="suggestion-question">{question}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
