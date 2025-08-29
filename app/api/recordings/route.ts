import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const recordings = await prisma.recording.findMany({
      where: {
        session: {
          OR: [
            { intervieweeId: session.user.id },
            { interviewerId: session.user.id }
          ]
        }
      },
      include: {
        session: {
          include: {
            interviewee: {
              select: { name: true }
            },
            interviewer: {
              select: { name: true }
            },
            jd: {
              select: { title: true }
            }
          }
        }
      },
      orderBy: {
        session: {
          createdAt: 'desc'
        }
      },
      take: limit
    })

    const result = recordings.map(recording => ({
      id: recording.id,
      url: recording.url,
      durationSec: recording.durationSec,
      consent: recording.consent,
      session: {
        id: recording.session.id,
        type: recording.session.type,
        startedAt: recording.session.startedAt,
        endedAt: recording.session.endedAt,
        interviewee: recording.session.interviewee,
        interviewer: recording.session.interviewer,
        jd: recording.session.jd
      }
    }))

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
