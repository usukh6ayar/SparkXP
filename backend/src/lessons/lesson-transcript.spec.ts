import {
  readTranscript,
  readVideoUrl,
  withTranscript,
  stripTranscript,
  preserveTranscript,
} from './lesson-transcript';

describe('readVideoUrl', () => {
  it('reads content.videoUrl', () => {
    expect(readVideoUrl({ videoUrl: 'https://x/a.mp4' })).toBe('https://x/a.mp4');
  });

  it('returns null when missing or not a string', () => {
    expect(readVideoUrl({})).toBeNull();
    expect(readVideoUrl({ videoUrl: '' })).toBeNull();
    expect(readVideoUrl({ videoUrl: 42 })).toBeNull();
  });
});

describe('readTranscript', () => {
  it('reads a stored transcript', () => {
    const t = { text: 'hello', seconds: 12, at: '2026-08-11T00:00:00.000Z' };
    expect(readTranscript({ transcript: t })).toEqual(t);
  });

  it('returns null when absent or malformed', () => {
    expect(readTranscript({})).toBeNull();
    expect(readTranscript({ transcript: 'oops' })).toBeNull();
    expect(readTranscript({ transcript: { seconds: 1 } })).toBeNull();
  });
});

describe('withTranscript', () => {
  it('keeps every other content key', () => {
    const before = { videoUrl: 'https://x/a.mp4', imageUrl: 'https://x/a.png', topic: 'greetings' };
    const after = withTranscript(before, { text: 'hi', seconds: 5, at: 'now' });

    expect(after.videoUrl).toBe('https://x/a.mp4');
    expect(after.imageUrl).toBe('https://x/a.png');
    expect(after.topic).toBe('greetings');
    expect(after.transcript).toEqual({ text: 'hi', seconds: 5, at: 'now' });
  });

  it('does not mutate the input', () => {
    const before = { videoUrl: 'https://x/a.mp4' };
    withTranscript(before, { text: 'hi', seconds: 5, at: 'now' });
    expect(before).toEqual({ videoUrl: 'https://x/a.mp4' });
  });
});

describe('stripTranscript', () => {
  it('removes only the transcript', () => {
    const out = stripTranscript({ videoUrl: 'v', transcript: { text: 'hi', seconds: 1, at: 'now' } });
    expect(out).toEqual({ videoUrl: 'v' });
  });

  it('does not mutate the input', () => {
    const before = { transcript: { text: 'hi', seconds: 1, at: 'now' } };
    stripTranscript(before);
    expect(before.transcript).toBeDefined();
  });

  it('is safe on empty content', () => {
    expect(stripTranscript({})).toEqual({});
  });
});

describe('preserveTranscript', () => {
  // ⚠️ Энэ бол гол хамгаалалт. Админы форм `content`-оо ЖАГСААЛТЫН хариунаас
  // угсардаг (LessonsPage.tsx), тэр хариунд транскрипт байхгүй — тиймээс
  // хамгаалахгүй бол хичээл хадгалах бүрд транскрипт устана.
  it('restores the stored transcript when the payload omits it', () => {
    const stored = { videoUrl: 'v', transcript: { text: 'hi', seconds: 1, at: 'now' } };
    const incoming = { videoUrl: 'v', imageUrl: 'i' };

    const out = preserveTranscript(stored, incoming);

    expect(out.transcript).toEqual({ text: 'hi', seconds: 1, at: 'now' });
    expect(out.imageUrl).toBe('i');
  });

  it('ignores a transcript sent by the client', () => {
    const stored = { transcript: { text: 'real', seconds: 1, at: 'now' } };
    const incoming = { transcript: { text: 'forged', seconds: 999, at: 'then' } };

    expect(preserveTranscript(stored, incoming).transcript).toEqual({
      text: 'real', seconds: 1, at: 'now',
    });
  });

  it('leaves the payload alone when nothing is stored', () => {
    expect(preserveTranscript({ videoUrl: 'v' }, { imageUrl: 'i' })).toEqual({ imageUrl: 'i' });
  });
});
