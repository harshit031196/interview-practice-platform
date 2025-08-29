import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get AI session details
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

    // Mock session data for now - in production this would come from database
    const mockSession = {
      id: sessionId,
      interviewType: 'Behavioral',
      difficulty: 'Medium',
      duration: 15,
      status: 'IN_PROGRESS',
      questions: [
        "Tell me about a time when you had to work with a difficult team member. How did you handle the situation, and what was the outcome?"
      ]
    };

    return NextResponse.json(mockSession);

  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
