'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WingmanHeader } from '@/components/WingmanHeader'
import { LoadingAnimation } from '@/components/LoadingAnimation'
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  Eye, 
  Video,
  BarChart3,
  Star,
  ArrowRight,
  MessageSquare,
  Activity,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

interface InterviewSession {
  id: string
  createdAt: string
  type: 'AI_PRACTICE' | 'PEER_PRACTICE' | 'EXPERT_SESSION'
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED'
  duration?: number
  hasVideoAnalysis: boolean
  overallScore?: string
  analysisData?: {
    overall_score?: {
      overall_score?: number
      grade?: string
      component_scores?: any
    }
    speech_analysis?: {
      transcript?: string
      pace_analysis?: {
        average_pace?: number
      }
      filler_words?: {
        total_count?: number
      }
    }
    facial_analysis?: {
      dominant_emotion?: string
    }
    confidence_analysis?: {
      confidence_score?: number
    }
  }
}

export default function InterviewHistoryPage() {
  const { data: session, status } = useSession()
  const [sessions, setSessions] = useState<InterviewSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchInterviewHistory()
    }
  }, [status])

  const fetchInterviewHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/interviews/history', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch interview history')
      }
      
      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return <LoadingAnimation message="Loading your interview history..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <WingmanHeader title="Interview History" showBackButton />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchInterviewHistory}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const getSessionTypeDisplay = (type: string) => {
    switch (type) {
      case 'AI_PRACTICE':
        return { label: 'AI Practice', color: 'bg-blue-100 text-blue-800' }
      case 'PEER_PRACTICE':
        return { label: 'Peer Practice', color: 'bg-green-100 text-green-800' }
      case 'EXPERT_SESSION':
        return { label: 'Expert Session', color: 'bg-purple-100 text-purple-800' }
      default:
        return { label: type, color: 'bg-gray-100 text-gray-800' }
    }
  }

  const getScoreColor = (grade?: string) => {
    if (!grade) return 'text-gray-500'
    const letter = grade.charAt(0)
    switch (letter) {
      case 'A': return 'text-green-600'
      case 'B': return 'text-blue-600'
      case 'C': return 'text-yellow-600'
      case 'D': return 'text-orange-600'
      case 'F': return 'text-red-600'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WingmanHeader 
        title="Interview History" 
        subtitle="Review your past interviews and analysis results"
        showBackButton 
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Video className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">With Analysis</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessions.filter(s => s.hasVideoAnalysis).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessions.filter(s => s.analysisData?.overall_score?.overall_score).length > 0
                      ? Math.round(
                          sessions
                            .filter(s => s.analysisData?.overall_score?.overall_score)
                            .reduce((acc, s) => acc + ((s.analysisData?.overall_score?.overall_score || 0) * 100), 0) /
                          sessions.filter(s => s.analysisData?.overall_score?.overall_score).length
                        ) + '%'
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Your Interview Sessions</h2>
            <Link href="/practice/ai/analysis">
              <Button>
                <Video className="w-4 h-4 mr-2" />
                Analyze New Video
              </Button>
            </Link>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews yet</h3>
                <p className="text-gray-600 mb-4">Start practicing to see your interview history here.</p>
                <Link href="/practice/ai">
                  <Button>Start First Interview</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => {
                const sessionType = getSessionTypeDisplay(session.type)
                return (
                  <Card key={session.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Session Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={sessionType.color}>
                              {sessionType.label}
                            </Badge>
                            <div className="flex items-center text-sm text-gray-500">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(session.createdAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="w-4 h-4 mr-1" />
                              {new Date(session.createdAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </div>
                            {session.duration && (
                              <div className="flex items-center text-sm text-gray-500">
                                <Activity className="w-4 h-4 mr-1" />
                                {Math.round(session.duration / 60)} min
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {session.hasVideoAnalysis ? (
                              <Link href={`/feedback/${session.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Full Report
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </Link>
                            ) : (
                              (() => {
                                // Convert UTC timestamp to local timezone for accurate time calculation
                                const sessionDate = new Date(session.createdAt);
                                const now = new Date();
                                
                                // Account for timezone offset - session.createdAt is in UTC
                                const timeDiff = now.getTime() - sessionDate.getTime();
                                const minutesAgo = Math.floor(timeDiff / (1000 * 60));
                                
                                // If session is less than 10 minutes old, show processing message
                                if (minutesAgo < 10) {
                                  return (
                                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Processing ({minutesAgo}m ago)
                                    </Badge>
                                  );
                                } else {
                                  return (
                                    <Badge variant="outline" className="text-gray-500">
                                      No Analysis Available
                                    </Badge>
                                  );
                                }
                              })()
                            )}
                          </div>
                        </div>

                        {/* Analysis Results Display */}
                        {session.hasVideoAnalysis && session.analysisData ? (
                          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                            {/* Overall Score */}
                            {session.analysisData.overall_score && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Star className="w-5 h-5 text-yellow-500" />
                                  <span className="font-medium">Overall Performance</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${getScoreColor(session.analysisData.overall_score.grade)}`}>
                                    {session.analysisData.overall_score.grade}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    ({Math.round((session.analysisData.overall_score.overall_score || 0) * 100)}%)
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Key Metrics */}
                            {session.analysisData.speech_analysis && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Speaking Pace */}
                                {session.analysisData.speech_analysis.pace_analysis && (
                                  <div className="bg-white rounded-lg p-3 border">
                                    <div className="flex items-center gap-2 mb-1">
                                      <MessageSquare className="w-4 h-4 text-blue-600" />
                                      <span className="text-sm font-medium text-gray-700">Speaking Pace</span>
                                    </div>
                                    <div className="text-lg font-bold text-blue-600">
                                      {Math.round(session.analysisData.speech_analysis.pace_analysis?.average_pace || 0)} WPM
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {(session.analysisData.speech_analysis.pace_analysis?.average_pace || 0) >= 140 && 
                                       (session.analysisData.speech_analysis.pace_analysis?.average_pace || 0) <= 160 ? 
                                       'Optimal pace' : 'Room for improvement'}
                                    </div>
                                  </div>
                                )}

                                {/* Filler Words */}
                                {session.analysisData.speech_analysis.filler_words && (
                                  <div className="bg-white rounded-lg p-3 border">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Activity className="w-4 h-4 text-orange-600" />
                                      <span className="text-sm font-medium text-gray-700">Filler Words</span>
                                    </div>
                                    <div className="text-lg font-bold text-orange-600">
                                      {session.analysisData.speech_analysis.filler_words.total_count || 0}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {(session.analysisData.speech_analysis.filler_words.total_count || 0) <= 2 ? 
                                       'Excellent clarity' : 'Consider reducing'}
                                    </div>
                                  </div>
                                )}

                                {/* Confidence Score */}
                                {session.analysisData.confidence_analysis && (
                                  <div className="bg-white rounded-lg p-3 border">
                                    <div className="flex items-center gap-2 mb-1">
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      <span className="text-sm font-medium text-gray-700">Confidence</span>
                                    </div>
                                    <div className="text-lg font-bold text-green-600">
                                      {Math.round((session.analysisData.confidence_analysis.confidence_score || 0) * 100)}%
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {(session.analysisData.confidence_analysis.confidence_score || 0) >= 0.7 ? 
                                       'Strong presence' : 'Room to grow'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Quick Insights */}
                            {session.analysisData.speech_analysis?.transcript && (
                              <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-400">
                                <div className="flex items-center gap-2 mb-2">
                                  <MessageSquare className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-800">Key Insights</span>
                                </div>
                                <div className="text-sm text-blue-700">
                                  Response length: {session.analysisData.speech_analysis.transcript.split(' ').length} words
                                  {session.analysisData.facial_analysis?.dominant_emotion && (
                                    <span className="ml-4">• Dominant emotion: {session.analysisData.facial_analysis.dominant_emotion}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : session.hasVideoAnalysis ? (
                          <div className="bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-400">
                            <div className="text-sm text-yellow-800">
                              Analysis data is being processed. Check back in a few minutes.
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                            <div className="text-sm text-gray-600">
                              No video analysis available for this session.
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
