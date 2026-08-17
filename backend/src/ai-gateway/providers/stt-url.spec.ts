import { ConfigService } from '@nestjs/config';
import { ElevenLabsSttAdapter } from './stt.adapter';

/**
 * `transcribeUrl` нь видеог татаж авалгүй ElevenLabs-д URL өгдөг — энэ нь
 * 200MB видеог Railway-гийн санах ойд оруулахаас сэргийлдэг гол шийдвэр.
 * Мөн хичээлийн видео **холимог хэлтэй** (монгол тайлбар + англи жишээ) тул
 * `language_code` илгээх ЁСГҮЙ — тэгвэл Scribe нэг хэл рүү шахна.
 */
describe('ElevenLabsSttAdapter.transcribeUrl', () => {
  const config = { get: (k: string, d?: string) => (k === 'ELEVENLABS_API_KEY' ? 'test-key' : d) } as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it('sends source_url and no language_code', async () => {
    let sentBody: FormData | undefined;
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      sentBody = init?.body as FormData;
      return Promise.resolve(
        new Response(
          JSON.stringify({ text: '  Hello world  ', language_probability: 0.9, words: [{ end: 12.2 }] }),
          { status: 200 },
        ),
      );
    });

    const adapter = new ElevenLabsSttAdapter(config);
    const result = await adapter.transcribeUrl('https://cdn.example.com/lesson.mp4');

    expect(sentBody?.get('source_url')).toBe('https://cdn.example.com/lesson.mp4');
    expect(sentBody?.get('language_code')).toBeNull();
    expect(sentBody?.get('file')).toBeNull();
    expect(result.text).toBe('Hello world');
    expect(result.seconds).toBe(13); // Math.ceil(12.2)
  });

  it('throws a Mongolian error when the API rejects the request', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 400 }));
    const adapter = new ElevenLabsSttAdapter(config);
    await expect(adapter.transcribeUrl('https://cdn.example.com/x.mp4')).rejects.toThrow(
      'Видеоны яриаг таньж чадсангүй',
    );
  });
});
