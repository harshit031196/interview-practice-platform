import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// This endpoint generates signed URLs for video uploads
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, contentType, sessionId } = await request.json();

    if (!filename || !contentType || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, contentType, sessionId' },
        { status: 400 }
      );
    }

    // Validate content type for video files
    if (!contentType.startsWith('video/')) {
      return NextResponse.json(
        { error: 'Only video files are allowed' },
        { status: 400 }
      );
    }

    // Generate unique filename with user ID and session ID
    const uniqueFilename = `interviews/${session.user.id}/${sessionId}/${Date.now()}_${filename}`;

    // Call the Google Cloud Function to get signed URL
    const cloudFunctionUrl = process.env.GENERATE_UPLOAD_URL_ENDPOINT;
    if (!cloudFunctionUrl) {
      return NextResponse.json(
        { error: 'Upload service not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(cloudFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: uniqueFilename,
        contentType: contentType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate upload URL');
    }

    const data = await response.json();

    return NextResponse.json({
      signedUrl: data.signedUrl,
      filename: uniqueFilename,
      contentType: contentType,
      expiresAt: data.expiresAt,
    });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
