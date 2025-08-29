import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const finishSchema = z.object({
  sessionId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId } = finishSchema.parse(body)

    // Verify session belongs to user
    const sessionRecord = await prisma.interviewSession.findUnique({
      where: {
        id: sessionId,
        intervieweeId: session.user.id,
        status: 'RUNNING'
      },
      include: {
        transcriptItems: true,
        jd: true
      }
    })

    if (!sessionRecord) {
      return NextResponse.json(
        { error: 'Session not found or not running' },
        { status: 404 }
      )
    }

    // Update session status
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date()
      }
    })

    // Generate report (stubbed with deterministic data)
    const transcriptLength = sessionRecord.transcriptItems.length
    const hasFillers = sessionRecord.transcriptItems.some(item => 
      item.labels.includes('filler')
    )
    
    // Simple scoring algorithm
    const baseScore = 70
    const fillerPenalty = hasFillers ? -10 : 0
    const lengthBonus = Math.min(transcriptLength * 2, 20)
    const overall = Math.max(0, Math.min(100, baseScore + fillerPenalty + lengthBonus))

    const report = await prisma.report.create({
      data: {
        sessionId,
        overall,
        jdCoverage: overall > 75 ? 'HIGH' : overall > 50 ? 'MEDIUM' : 'LOW',
        strengths: [
          'Clear communication style',
          'Good problem-solving approach',
          'Relevant experience mentioned'
        ],
        improvements: [
          'Reduce filler words',
          'Provide more specific examples',
          'Better time management'
        ],
        actions: [
          { label: 'Practice STAR method', url: '/library/star-method', type: 'exercise' },
          { label: 'Watch: Communication Tips', url: '/library/communication', type: 'video' },
          { label: 'Read: Interview Best Practices', url: '/library/best-practices', type: 'article' }
        ],
        charts: {
          radar: {
            communication: Math.min(100, overall + Math.random() * 20 - 10),
            problemSolving: Math.min(100, overall + Math.random() * 20 - 10),
            confidence: Math.min(100, overall + Math.random() * 20 - 10),
            jdRelevance: Math.min(100, overall + Math.random() * 20 - 10),
            technicalDepth: Math.min(100, overall + Math.random() * 20 - 10),
            leadership: Math.min(100, overall + Math.random() * 20 - 10)
          },
          pace: sessionRecord.transcriptItems.map((item, index) => ({
            time: item.t,
            wpm: 120 + Math.sin(index * 0.1) * 20,
            confidence: 0.7 + Math.random() * 0.3
          })),
          sentiment: {
            positive: 60 + Math.random() * 20,
            neutral: 20 + Math.random() * 20,
            negative: 5 + Math.random() * 15
          }
        }
      }
    })

    // Update readiness score
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { intervieweeProfile: true }
    })

    if (user?.intervieweeProfile) {
      const newReadinessScore = Math.min(100, 
        Math.max(0, user.intervieweeProfile.readinessScore + (overall > 70 ? 2 : -1))
      )
      
      await prisma.intervieweeProfile.update({
        where: { userId: session.user.id },
        data: { readinessScore: newReadinessScore }
      })
    }

    return NextResponse.json({ reportId: report.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
