import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { generateReport } from '../services/generator';
import { getApiKey } from '../services/apiKeys';

jest.mock('../services/apiKeys', () => ({
  getApiKey: jest.fn(),
}));

describe('generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends the Gemini API key in a header instead of the URL', async () => {
    (getApiKey as jest.MockedFunction<typeof getApiKey>).mockResolvedValue('test-key');
    const responseBody = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  report: { overview: 'Overview' },
                  summary: ['Summary'],
                }),
              },
            ],
          },
        },
      ],
    };
    const fetchMock = jest.fn(
      async () =>
        ({ ok: true, json: async () => responseBody }) as unknown as Response,
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await generateReport('Meeting transcript', 'EN');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key' }),
      }),
    );
  });
});
