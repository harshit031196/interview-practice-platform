import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get video analysis results for a specific session
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // Try to find stored video analysis results
    const analysisResult = await prisma.videoAnalysis.findFirst({
      where: {
        sessionId: sessionId,
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!analysisResult) {
      return NextResponse.json({ 
        error: 'No video analysis found for this session' 
      }, { status: 404 });
    }

    // Parse the stored JSON results
    const analysisData = JSON.parse(analysisResult.results);

    return NextResponse.json(analysisData);

  } catch (error) {
    console.error('Error fetching video analysis results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis results' },
      { status: 500 }
    );
  }
}

// Store video analysis results for a session
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    const analysisData = await request.json();

    // Store the analysis results
    const result = await prisma.videoAnalysis.upsert({
      where: {
        sessionId_userId: {
          sessionId: sessionId,
          userId: session.user.id,
        }
      },
      update: {
        results: JSON.stringify(analysisData),
        updatedAt: new Date(),
      },
      create: {
        sessionId: sessionId,
        userId: session.user.id,
        results: JSON.stringify(analysisData),
      },
    });

    return NextResponse.json({
      success: true,
      analysisId: result.id,
    });

  } catch (error) {
    console.error('Error storing video analysis results:', error);
    return NextResponse.json(
      { error: 'Failed to store analysis results' },
      { status: 500 }
    );
  }
}
