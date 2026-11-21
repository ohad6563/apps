import { memo } from 'react';
import type { Section, SongLine } from '../lib/model';
import { SECTION_LABEL } from '../lib/model';
import { groupRuns, layoutLine, type Word } from '../lib/layout';

interface Props {
  sections: Section[];
  /** ממיר סימון אקורד מקורי לסימון המוצג (לאחר העברת סולם). */
  renderChord: (chord: string) => string;
}

function WordView({
  word,
  withChords,
  renderChord,
}: {
  word: Word;
  withChords: boolean;
  renderChord: Props['renderChord'];
}) {
  return (
    <span className="word">
      {word.segments.map((s, si) => {
        const continues = si < word.segments.length - 1;
        return (
          <span className={'seg' + (continues ? ' seg--cont' : '')} key={si} data-start={s.start}>
            {withChords && (
              <span className="chord" dir="ltr" aria-hidden={s.chord ? undefined : true}>
                {s.chord ? renderChord(s.chord) : ''}
              </span>
            )}
            {s.text !== '' && <span className="lyric">{s.text}</span>}
          </span>
        );
      })}
      {/* רווח אמיתי בין מילים – שומר על העתק-הדבק תקין; לא תופס מקום */}
      <span className="sr-space"> </span>
    </span>
  );
}

function ChordLine({ line, renderChord }: { line: SongLine; renderChord: Props['renderChord'] }) {
  const withChords = line.chords.length > 0;
  const runs = groupRuns(layoutLine(line));
  const chordOnly = withChords && line.lyrics.trim() === '';

  return (
    <div className={'line' + (withChords ? ' line--chords' : '') + (chordOnly ? ' line--chord-only' : '')}>
      {runs.map((run, ri) =>
        run.dir === 'ltr' ? (
          // רצף באנגלית בתוך שורה עברית: מוצג משמאל לימין, והאקורד מיושר לתחילת המילה (משמאל)
          <span className="run-ltr" dir="ltr" key={ri}>
            {run.words.map((w, wi) => (
              <WordView word={w} withChords={withChords} renderChord={renderChord} key={wi} />
            ))}
          </span>
        ) : (
          run.words.map((w, wi) => (
            <WordView word={w} withChords={withChords} renderChord={renderChord} key={`${ri}-${wi}`} />
          ))
        ),
      )}
    </div>
  );
}

function SongSheetImpl({ sections, renderChord }: Props) {
  return (
    <div className="sheet">
      {sections.map((sec, i) => {
        const label = sec.label ?? SECTION_LABEL[sec.kind];
        return (
          <section className={`section section--${sec.kind}`} key={i} aria-label={label}>
            <div className="section-label">{label}</div>
            {sec.lines.map((line, li) => (
              <ChordLine line={line} renderChord={renderChord} key={li} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export const SongSheet = memo(SongSheetImpl);
