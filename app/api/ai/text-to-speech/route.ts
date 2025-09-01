import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { z } from 'zod';

const textToSpeechClient = new TextToSpeechClient();

const textSchema = z.object({
  text: z.string().min(1, 'Text is required.'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = textSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { text } = parsed.data;

    const ttsRequest = {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Wavenet-A',
        ssmlGender: 'FEMALE' as const,
      },
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    const [response] = await textToSpeechClient.synthesizeSpeech(ttsRequest);

    if (!response.audioContent) {
        return NextResponse.json(
            { error: 'Failed to synthesize speech' },
            { status: 500 }
        );
    }

    return new NextResponse(response.audioContent, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('Error in text-to-speech synthesis:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to process text-to-speech request', details: errorMessage },
      { status: 500 }
    );
  }
}
