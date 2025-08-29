'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Brain, Mic, Video, Clock, Coins } from 'lucide-react'
import { WingmanHeader } from '@/components/WingmanHeader'

export default function AIPracticePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  
  const [settings, setSettings] = useState({
    interviewType: '',
    difficulty: '',
    duration: [15],
    jdId: '',
    voiceOnly: true,
    allowHints: true,
    showTimer: true,
  })

  const interviewTypes = [
    { value: 'behavioral', label: 'Behavioral', description: 'STAR method, leadership, teamwork' },
    { value: 'technical', label: 'Technical', description: 'Coding, algorithms, system design' },
    { value: 'product', label: 'Product', description: 'Strategy, metrics, user research' },
    { value: 'system-design', label: 'System Design', description: 'Architecture, scalability, trade-offs' },
  ]

  const difficulties = [
    { value: 'easy', label: 'Easy', description: 'Entry level questions' },
    { value: 'medium', label: 'Medium', description: 'Mid-level complexity' },
    { value: 'hard', label: 'Hard', description: 'Senior level challenges' },
  ]

  const creditCost = settings.duration[0] <= 15 ? 10 : settings.duration[0] <= 30 ? 15 : 20

  const handleStartSession = async () => {
    if (!settings.interviewType || !settings.difficulty) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/ai/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewType: settings.interviewType,
          difficulty: settings.difficulty,
          duration: settings.duration[0],
          jdId: settings.jdId || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start session')
      }

      const { sessionId } = await response.json()
      router.push(`/practice/ai/session/${sessionId}`)
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Failed to start session. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const canStart = settings.interviewType && settings.difficulty

  return (
    <div className="min-h-screen bg-gray-50">
      <WingmanHeader 
        title="AI Interview Practice"
        subtitle="Get instant feedback with our AI interviewer"
        showBackButton={true}
        backHref="/dashboard"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Interview Type */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Type</CardTitle>
                <CardDescription>Choose the type of interview you want to practice</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {interviewTypes.map((type) => (
                    <div
                      key={type.value}
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        settings.interviewType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200'
                      }`}
                      onClick={() => setSettings({ ...settings, interviewType: type.value })}
                    >
                      <h3 className="font-medium">{type.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Difficulty & Duration */}
            <Card>
              <CardHeader>
                <CardTitle>Session Settings</CardTitle>
                <CardDescription>Configure your practice session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Difficulty Level</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {difficulties.map((diff) => (
                      <div
                        key={diff.value}
                        className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${
                          settings.difficulty === diff.value
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200'
                        }`}
                        onClick={() => setSettings({ ...settings, difficulty: diff.value })}
                      >
                        <div className="font-medium">{diff.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{diff.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Duration: {settings.duration[0]} minutes</Label>
                  <Slider
                    value={settings.duration}
                    onValueChange={(value) => setSettings({ ...settings, duration: value })}
                    min={5}
                    max={45}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>5 min</span>
                    <span>25 min</span>
                    <span>45 min</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interview Aids */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Aids</CardTitle>
                <CardDescription>Optional features to help during the interview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Voice Only Mode</div>
                      <div className="text-sm text-muted-foreground">Audio-only interview (recommended)</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.voiceOnly}
                      onChange={(e) => setSettings({ ...settings, voiceOnly: e.target.checked })}
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Allow Hints</div>
                      <div className="text-sm text-muted-foreground">Get hints if you're stuck</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowHints}
                      onChange={(e) => setSettings({ ...settings, allowHints: e.target.checked })}
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Show Timer</div>
                      <div className="text-sm text-muted-foreground">Display remaining time</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showTimer}
                      onChange={(e) => setSettings({ ...settings, showTimer: e.target.checked })}
                      className="w-4 h-4"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cost & Start */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5" />
                  Session Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-3xl font-bold text-primary">{creditCost} credits</div>
                  <div className="text-sm text-muted-foreground">
                    {settings.duration[0]} minute {settings.difficulty} {settings.interviewType} interview
                  </div>
                  
                  <Button
                    onClick={handleStartSession}
                    disabled={!canStart || isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? 'Starting...' : 'Start Interview'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Check */}
            <Card>
              <CardHeader>
                <CardTitle>Before You Start</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mic className="w-4 h-4 text-green-600" />
                    <span>Microphone access required</span>
                  </div>
                  {!settings.voiceOnly && (
                    <div className="flex items-center gap-3 text-sm">
                      <Video className="w-4 h-4 text-green-600" />
                      <span>Camera access required</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Find a quiet environment</span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Tip:</strong> Treat this like a real interview. Speak clearly and take your time to think through answers.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Practice</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4 text-muted-foreground">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent sessions</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
