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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        intervieweeProfile: true,
        intervieweeSessions: {
          include: {
            report: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!user?.intervieweeProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Calculate readiness score trend
    const sessions = user.intervieweeSessions.filter(s => s.report)
    const readinessTrend = sessions.map((session, index) => ({
      date: session.createdAt,
      score: session.report?.overall || 0,
      session: index + 1
    })).reverse()

    // Calculate peer percentile (mock data based on current readiness score)
    const currentReadiness = user.intervieweeProfile.readinessScore
    let percentile = 50 // Default
    
    if (currentReadiness >= 80) percentile = 85
    else if (currentReadiness >= 70) percentile = 70
    else if (currentReadiness >= 60) percentile = 55
    else if (currentReadiness >= 50) percentile = 40
    else percentile = 25

    return NextResponse.json({
      readinessScore: currentReadiness,
      readinessTrend,
      peerPercentile: percentile,
      totalSessions: user.intervieweeSessions.length,
      completedSessions: sessions.length,
      averageScore: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (s.report?.overall || 0), 0) / sessions.length)
        : 0
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
