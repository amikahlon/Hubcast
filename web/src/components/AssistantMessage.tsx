import type { ChatResponse, Hub } from '@hubcast/shared';
import { formatDataDate, hubLabel, plainText } from '../format.js';

export function AssistantMessage({
  response,
  hubs,
}: {
  response: ChatResponse;
  hubs: ReadonlyMap<string, Hub>;
}) {
  const { answer, hubIds, explanation, assumptions, sources, dataAsOf } = response;
  const hasFooter = sources.length > 0 || dataAsOf !== null;

  return (
    <article className="message message-assistant">
      <p className="answer">{plainText(answer)}</p>

      {hubIds.length > 0 && (
        <ul className="chips" aria-label="Hubs">
          {hubIds.map((hubId) => (
            <li key={hubId} className="chip">
              {hubLabel(hubId, hubs)}
            </li>
          ))}
        </ul>
      )}

      <p className="explanation">{plainText(explanation)}</p>

      {assumptions.length > 0 && (
        <section className="assumptions" aria-label="Assumptions and limitations">
          <h3 className="section-label">Assumptions and limitations</h3>
          <ul>
            {assumptions.map((assumption) => (
              <li key={assumption}>{plainText(assumption)}</li>
            ))}
          </ul>
        </section>
      )}

      {hasFooter && (
        <footer className="sources">
          {sources.length > 0 && <p>Sources: {sources.join(' · ')}</p>}
          {dataAsOf !== null && <p>Data as of {formatDataDate(dataAsOf)}</p>}
        </footer>
      )}
    </article>
  );
}
